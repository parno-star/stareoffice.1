import type { Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Recurring subscription billing helpers.
 *
 * Each organization is "paid up through" `subscriptionPaidUntil` (an ISO
 * instant). A verified payment extends that instant by its billing cycle.
 * After it lapses, the org enters a short grace period; once the grace period
 * also passes the org is considered expired (and access is degraded to
 * read-only by the enforcement layer built in the next milestone).
 *
 * All timestamps are ISO 8601 strings in UTC. Status is always derived at read
 * time from `paidUntil` + "now" so it is never stale.
 */

/** Days after `paidUntil` before an org is treated as expired (read-only). */
export const GRACE_PERIOD_DAYS = 3;

/** Days before `paidUntil` when we start showing a "due soon" warning. */
export const DUE_SOON_DAYS = 7;

/** Allowed billing cycle lengths, in months. */
export const CYCLE_MONTHS = [1, 3, 6, 12] as const;
export type CycleMonths = (typeof CYCLE_MONTHS)[number];

export type SubscriptionStatus =
  | "no_subscription" // never billed / no paid period set
  | "active" // paid and not near expiry
  | "due_soon" // within DUE_SOON_DAYS of paidUntil
  | "overdue" // past paidUntil but within grace period
  | "expired"; // past paidUntil + grace (access read-only)

export type SubscriptionInfo = {
  status: SubscriptionStatus;
  paidUntil: string | null;
  graceEndsAt: string | null;
  cycleMonths: number | null;
  startedAt: string | null;
  // Whole days until paidUntil (negative if past due). null when no subscription.
  daysUntilDue: number | null;
  // True when access should be restricted to read-only.
  isReadOnly: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Add a whole number of months to an ISO instant, returning a new ISO string. */
export function addMonthsIso(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  const result = new Date(d);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result.toISOString();
}

/** Whole days between two instants (b - a), rounded toward zero. */
function diffDays(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.trunc((b - a) / MS_PER_DAY);
}

/**
 * Derive the full subscription status for an org from its stored fields.
 * `nowIso` is injected so callers can compute deterministically.
 */
export function computeSubscriptionInfo(
  org: {
    subscriptionPaidUntil?: string;
    subscriptionCycleMonths?: number;
    subscriptionStartedAt?: string;
  },
  nowIso: string,
): SubscriptionInfo {
  const paidUntil = org.subscriptionPaidUntil ?? null;
  const cycleMonths = org.subscriptionCycleMonths ?? null;
  const startedAt = org.subscriptionStartedAt ?? null;

  if (!paidUntil) {
    return {
      status: "no_subscription",
      paidUntil: null,
      graceEndsAt: null,
      cycleMonths,
      startedAt,
      daysUntilDue: null,
      isReadOnly: false,
    };
  }

  const graceEndsAt = addDaysIso(paidUntil, GRACE_PERIOD_DAYS);
  const daysUntilDue = diffDays(nowIso, paidUntil);
  const now = new Date(nowIso).getTime();
  const paidUntilMs = new Date(paidUntil).getTime();
  const graceEndsMs = new Date(graceEndsAt).getTime();

  let status: SubscriptionStatus;
  if (now <= paidUntilMs) {
    status = daysUntilDue <= DUE_SOON_DAYS ? "due_soon" : "active";
  } else if (now <= graceEndsMs) {
    status = "overdue";
  } else {
    status = "expired";
  }

  return {
    status,
    paidUntil,
    graceEndsAt,
    cycleMonths,
    startedAt,
    daysUntilDue,
    isReadOnly: status === "expired",
  };
}

/** Add a whole number of days to an ISO instant, returning a new ISO string. */
export function addDaysIso(fromIso: string, days: number): string {
  return new Date(new Date(fromIso).getTime() + days * MS_PER_DAY).toISOString();
}

/**
 * Compute the new paid-through instant when applying a payment of
 * `cycleMonths` to an org. If the org is still within its current paid period,
 * the new period stacks on top of `paidUntil`; otherwise it starts from now so
 * lapsed orgs don't get credited for the gap.
 */
export function extendPaidUntil(
  currentPaidUntil: string | undefined | null,
  cycleMonths: number,
  nowIso: string,
): { periodStart: string; periodEnd: string } {
  const now = new Date(nowIso).getTime();
  const base =
    currentPaidUntil && new Date(currentPaidUntil).getTime() > now
      ? currentPaidUntil
      : nowIso;
  return {
    periodStart: base,
    periodEnd: addMonthsIso(base, cycleMonths),
  };
}

/** Read an org and compute its subscription info (or null if org missing). */
export async function getOrgSubscriptionInfo(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  nowIso: string,
): Promise<SubscriptionInfo | null> {
  const org = await ctx.db.get(organizationId);
  if (!org) return null;
  return computeSubscriptionInfo(org, nowIso);
}
