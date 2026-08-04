/**
 * Audio/video call quota helpers.
 *
 * Usage is tracked per organization in a denormalized monthly counter
 * (`callQuotaUsage`) so quota checks read one small document instead of scanning
 * every call session. The month bucket is a UTC "YYYY-MM" string, so usage
 * resets automatically each calendar month (a fresh month simply has no row).
 */

import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";

/** Current UTC month bucket, e.g. "2026-07". */
export function currentMonthUTC(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Minutes already used by an org in the given month (0 if no record). */
export async function getUsedMinutes(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  month: string,
): Promise<number> {
  const row = await ctx.db
    .query("callQuotaUsage")
    .withIndex("by_org_and_month", (q) =>
      q.eq("organizationId", organizationId).eq("month", month),
    )
    .unique();
  return row?.minutesUsed ?? 0;
}

export type QuotaState = {
  // Monthly minute limit; null means unlimited (no enforcement).
  limitMinutes: number | null;
  usedMinutes: number;
  // Remaining minutes; null when unlimited.
  remainingMinutes: number | null;
  month: string;
  isExhausted: boolean;
};

/** Computes the current quota state for an org (unlimited when no limit set). */
export async function getQuotaState(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  org: Doc<"organizations"> | null,
): Promise<QuotaState> {
  const month = currentMonthUTC();
  const usedMinutes = await getUsedMinutes(ctx, organizationId, month);
  const rawLimit = org?.callQuotaMinutesPerMonth;
  const limitMinutes =
    typeof rawLimit === "number" && rawLimit > 0 ? rawLimit : null;
  const remainingMinutes =
    limitMinutes === null ? null : Math.max(0, limitMinutes - usedMinutes);
  return {
    limitMinutes,
    usedMinutes,
    remainingMinutes,
    month,
    isExhausted: limitMinutes !== null && usedMinutes >= limitMinutes,
  };
}

/**
 * Throws FORBIDDEN when the org has exhausted its monthly call quota. No-op for
 * unlimited orgs or when there is no org in scope (super admin without a grant).
 */
export async function assertQuotaAvailable(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<void> {
  if (!organizationId) return;
  const org = await ctx.db.get(organizationId);
  const state = await getQuotaState(ctx, organizationId, org);
  if (state.isExhausted) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message:
        "Kuota panggilan organisasi untuk bulan ini sudah habis. Hubungi admin untuk menambah batas menit atau tunggu reset bulan depan.",
    });
  }
}

/** Adds used minutes to an org's monthly counter (upsert). */
export async function addUsedMinutes(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  minutes: number,
): Promise<void> {
  if (minutes <= 0) return;
  const month = currentMonthUTC();
  const existing = await ctx.db
    .query("callQuotaUsage")
    .withIndex("by_org_and_month", (q) =>
      q.eq("organizationId", organizationId).eq("month", month),
    )
    .unique();
  const nowIso = new Date().toISOString();
  if (existing) {
    await ctx.db.patch(existing._id, {
      minutesUsed: existing.minutesUsed + minutes,
      updatedAt: nowIso,
    });
  } else {
    await ctx.db.insert("callQuotaUsage", {
      organizationId,
      month,
      minutesUsed: minutes,
      updatedAt: nowIso,
    });
  }
}
