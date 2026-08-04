import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireTenant, isScopeBlocked } from "./lib/tenant";
import type { DataScope } from "./dataScopes";

/**
 * Super admin data access control (consent-based).
 *
 * Historically, a super admin could globally toggle read access to operational
 * data categories from an "Akses Data" tab. That global toggle has been removed
 * in favour of the stronger, company-controlled CONSENT system: a super admin
 * only sees a company's data after that company approves a time-boxed grant for
 * specific data scopes (see convex/dataAccess.ts + lib/tenant.ts).
 *
 * To guarantee data integrity, the helpers below now delegate entirely to that
 * consent/scope system. Each legacy "category" maps onto the customer-facing
 * data scope it belongs to. Regular users are never affected — they always see
 * only their own organization's data.
 */

// The operational data categories referenced by existing read gates.
export const DATA_CATEGORIES = [
  "leave",
  "letters",
  "messages",
  "documents",
  "directory",
  "reports",
] as const;

export type DataCategory = (typeof DATA_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(DATA_CATEGORIES);

// Maps each legacy category onto the consent data scope that governs it.
const CATEGORY_TO_SCOPE: Record<DataCategory, DataScope> = {
  leave: "hr_people",
  letters: "letters_documents",
  messages: "communication",
  documents: "letters_documents",
  directory: "hr_people",
  reports: "hr_people",
};

/**
 * Server-side read gate for super admins, now backed by the consent system.
 *
 * Returns `true` when the caller MUST be blocked from seeing the data because
 * they are a super admin viewing a company through a grant that does not cover
 * the scope this category belongs to. Regular users, and super admins acting
 * outside a scoped grant, return `false`.
 *
 * The `isSuperAdmin` parameter is kept for backward compatibility with existing
 * call sites; the underlying scope check derives everything it needs from ctx.
 */
export async function isSuperAdminBlocked(
  ctx: QueryCtx | MutationCtx,
  _isSuperAdmin: boolean,
  category: DataCategory,
): Promise<boolean> {
  const scope = CATEGORY_TO_SCOPE[category];
  if (!scope) return false;
  return await isScopeBlocked(ctx, scope);
}

/**
 * Lightweight query used by the DataAccessBanner to know whether the CURRENT
 * viewer (if a super admin) is blocked from a category by the consent system.
 * Regular users always get blocked=false.
 */
export const getMyCategoryAccess = query({
  args: { category: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ isSuperAdmin: boolean; blocked: boolean }> => {
    const { isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!CATEGORY_SET.has(args.category)) {
      return { isSuperAdmin, blocked: false };
    }
    const blocked = await isSuperAdminBlocked(
      ctx,
      isSuperAdmin,
      args.category as DataCategory,
    );
    return { isSuperAdmin, blocked };
  },
});
