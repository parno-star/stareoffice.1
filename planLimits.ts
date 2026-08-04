import type { Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { isAdminRole, isSuperAdminRole } from "../roles";
import { isCountableEmployee } from "./countableUsers";
import { getTrialSettings } from "./trialAccess";

/**
 * Graduated plan-limit warnings & auto-blocking.
 *
 * Metrics tracked: "employees" and "storage". When usage of a metric crosses
 * 80/90/95% of the plan limit we notify all org admins + super admins ONCE per
 * threshold (in-app + email). At 100% "add" actions are blocked. Limits reset
 * automatically when the org's plan changes (bigger limits => usage% drops).
 */

export const EMPLOYEE_METRIC = "employees" as const;
export const STORAGE_METRIC = "storage" as const;

// Ordered ascending. 100 = blocking threshold.
export const THRESHOLDS = [80, 90, 95, 100] as const;

/** Human labels for messages. */
const METRIC_LABEL: Record<string, { noun: string; unit: string }> = {
  employees: { noun: "karyawan", unit: "" },
  storage: { noun: "penyimpanan", unit: " MB" },
};

/** Highest threshold (0/80/90/95/100) that `pct` has reached. */
export function highestCrossedThreshold(pct: number): number {
  let crossed = 0;
  for (const t of THRESHOLDS) {
    if (pct >= t) crossed = t;
  }
  return crossed;
}

/** Count employees currently in an organization (via index).
 * Excludes test/simulation & super_admin accounts so seat usage matches the
 * real workforce. */
export async function countOrgEmployees(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  return users.filter(isCountableEmployee).length;
}

/**
 * Returns the org's active plan limit for a metric (0 = unlimited / no plan).
 */
export async function getOrgMetricLimit(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  metric: string,
): Promise<{ max: number; planId: Id<"membershipPlans"> | null; planName: string | null }> {
  const org = await ctx.db.get(organizationId);
  if (!org?.membershipPlanId) return { max: 0, planId: null, planName: null };
  const plan = await ctx.db.get(org.membershipPlanId);
  if (!plan) return { max: 0, planId: null, planName: null };

  // Trial organisations use the global trial employee cap instead of the plan
  // limit (0 = unlimited). Storage still follows the plan.
  if (metric === EMPLOYEE_METRIC && org.isTrial) {
    const trial = await getTrialSettings(ctx);
    return {
      max: trial.maxEmployees,
      planId: plan._id,
      planName: `${plan.name} (Trial)`,
    };
  }

  let max = metric === STORAGE_METRIC ? plan.maxStorageMb : plan.maxEmployees;
  // Extra purchased seats add to the plan's employee limit, but only when the
  // plan has a finite limit (max > 0). Unlimited plans (max = 0) stay unlimited.
  if (metric === EMPLOYEE_METRIC && max > 0 && org.extraSeats && org.extraSeats > 0) {
    max += org.extraSeats;
  }
  return { max, planId: plan._id, planName: plan.name };
}

/**
 * True when adding one more unit of `metric` would exceed the plan limit.
 * `currentUsage` is the usage BEFORE the new item. Returns false for unlimited
 * plans (max <= 0) so blocking never applies without a real limit.
 */
export function wouldExceedLimit(currentUsage: number, max: number): boolean {
  if (max <= 0) return false;
  return currentUsage >= max;
}

/** Collect the userIds + emails of all recipients: org admins + super admins. */
async function collectAdminRecipients(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<{ userIds: Array<Id<"users">>; emails: string[] }> {
  const userIds = new Set<Id<"users">>();
  const emails = new Set<string>();

  // Org admins (scoped by org index)
  const orgUsers = await ctx.db
    .query("users")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const u of orgUsers) {
    if (isAdminRole(u.role)) {
      userIds.add(u._id);
      if (u.email) emails.add(u.email);
    }
  }

  // Super admins (platform-wide; typically very few). Only runs when a
  // threshold is actually crossed, so a full scan here is rare.
  const allUsers = await ctx.db.query("users").collect();
  for (const u of allUsers) {
    if (isSuperAdminRole(u.role)) {
      userIds.add(u._id);
      if (u.email) emails.add(u.email);
    }
  }

  return { userIds: [...userIds], emails: [...emails] };
}

/**
 * Evaluate a metric against the plan limit and, if a NEW threshold has been
 * crossed since last time, notify all admins (in-app + email) exactly once.
 * Self-heals: keeps the stored threshold in sync with current usage so drops
 * (e.g. after a plan upgrade) re-arm the alerts.
 *
 * Call this AFTER the usage change (insert) so `currentUsage` is the new total.
 */
export async function evaluateAndAlert(
  ctx: MutationCtx,
  params: {
    organizationId: Id<"organizations">;
    metric: string;
    currentUsage: number;
    max: number;
    planId: Id<"membershipPlans"> | null;
    planName: string | null;
  },
): Promise<void> {
  const { organizationId, metric, currentUsage, max, planId, planName } = params;

  // No limit configured => nothing to warn about. Clear any stale row.
  if (max <= 0) return;

  const pct = Math.round((currentUsage / max) * 100);
  const crossed = highestCrossedThreshold(pct);

  const row = await ctx.db
    .query("orgLimitAlerts")
    .withIndex("by_org_and_metric", (q) =>
      q.eq("organizationId", organizationId).eq("metric", metric),
    )
    .unique();

  // If the plan changed since last alert, treat as fresh (re-arm all thresholds).
  const planChanged = row ? row.membershipPlanId !== (planId ?? undefined) : false;
  const prevThreshold = row && !planChanged ? row.lastThreshold : 0;

  const now = new Date().toISOString();

  // Persist the current threshold state (upsert) regardless of notifying.
  if (row) {
    await ctx.db.patch(row._id, {
      lastThreshold: crossed,
      membershipPlanId: planId ?? undefined,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("orgLimitAlerts", {
      organizationId,
      metric,
      lastThreshold: crossed,
      membershipPlanId: planId ?? undefined,
      updatedAt: now,
    });
  }

  // Only notify when we cross into a HIGHER threshold band than before.
  if (crossed === 0 || crossed <= prevThreshold) return;

  const label = METRIC_LABEL[metric] ?? { noun: metric, unit: "" };
  const org = await ctx.db.get(organizationId);
  const orgName = org?.name ?? "organisasi Anda";
  const usageText = `${currentUsage}${label.unit}/${max}${label.unit}`;

  const isBlock = crossed >= 100;
  const title = isBlock
    ? `Batas ${label.noun} tercapai`
    : `Peringatan batas ${label.noun} (${crossed}%)`;
  const message = isBlock
    ? `Penggunaan ${label.noun} "${orgName}" telah mencapai batas paket ${planName ?? ""} (${usageText}). Penambahan ${label.noun} baru diblokir sampai paket ditingkatkan.`
    : `Penggunaan ${label.noun} "${orgName}" sudah ${pct}% dari batas paket ${planName ?? ""} (${usageText}). Pertimbangkan untuk meningkatkan paket.`;

  const { userIds, emails } = await collectAdminRecipients(ctx, organizationId);

  // In-app notifications
  for (const userId of userIds) {
    await ctx.db.insert("notifications", {
      userId,
      type: isBlock ? "plan_limit_blocked" : "plan_limit_warning",
      title,
      message,
      link: "/membership-dashboard",
      organizationId,
    });
  }

  // Emails (best-effort, async, only if a verified sender is configured)
  if (emails.length > 0) {
    await ctx.scheduler.runAfter(0, internal.planLimitEmails.sendLimitAlert, {
      to: emails,
      subject: title,
      heading: title,
      body: message,
    });
  }
}

/**
 * Reset stored alert thresholds for an org (all metrics). Call when the plan
 * changes so warnings re-arm against the new limits and prior "blocked" state
 * is cleared.
 */
export async function resetOrgLimitAlerts(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const rows = await ctx.db
    .query("orgLimitAlerts")
    .withIndex("by_org_and_metric", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}
