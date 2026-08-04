/**
 * Multi-tenant helper functions.
 *
 * Every query / mutation that reads or writes tenant-scoped data MUST use
 * these helpers to ensure data isolation between organizations.
 *
 * Usage pattern:
 *   const { organizationId } = await requireTenant(ctx);
 *   // then filter all queries: .withIndex("by_org", q => q.eq("organizationId", organizationId))
 */

import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { computeSubscriptionInfo } from "./subscription";
import {
  DATA_SCOPE_VALUES,
  isDataScope,
  scopeLabel,
  type DataScope,
} from "../dataScopes";

/**
 * Returns the current user and their organizationId.
 * Throws UNAUTHENTICATED if not logged in.
 * Throws NOT_FOUND if user record doesn't exist.
 * Throws FORBIDDEN if user has no organization assigned yet.
 *
 * super_admin users are NOT bound to a tenant — they can access all orgs.
 * Pass `allowSuperAdmin: true` to skip the organizationId requirement for them.
 */
export async function requireTenant(
  ctx: QueryCtx | MutationCtx,
  options: {
    allowSuperAdmin?: boolean;
    allowPending?: boolean;
    // When true, skip the subscription read-only lock. Use ONLY for mutations
    // that must keep working while an org is expired (e.g. submitting payment).
    bypassSubscriptionLock?: boolean;
  } = {},
): Promise<{ userId: Id<"users">; organizationId: Id<"organizations"> | null; isSuperAdmin: boolean }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "User not logged in",
    });
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  const isSuperAdmin = user.role === "super_admin";

  // Block users with non-active account status (pending, suspended, rejected)
  // unless explicitly allowed or user is super_admin
  if (!isSuperAdmin && !options.allowPending) {
    const status = user.accountStatus;
    if (status === "pending_approval" || status === "suspended" || status === "rejected") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Akun Anda belum disetujui atau sedang dinonaktifkan",
      });
    }
  }

  // super_admin bypasses tenant requirement. When they have selected an
  // organization to view (viewingOrganizationId), the entire app scopes to it —
  // but ONLY while the company's time-boxed access grant is still active
  // (consent-first). If the grant is missing/expired/revoked, we collapse to the
  // platform-wide view (null) so no confidential tenant data is ever readable
  // without live consent.
  if (isSuperAdmin) {
    const viewingId = user.viewingOrganizationId ?? null;
    if (viewingId === null) {
      return { userId: user._id, organizationId: null, isSuperAdmin: true };
    }
    const grant = await getActiveGrantForTenant(ctx, user._id, viewingId);
    const effectiveOrgId = grant ? viewingId : null;
    return { userId: user._id, organizationId: effectiveOrgId, isSuperAdmin: true };
  }

  if (!user.organizationId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "User is not assigned to any organization",
    });
  }

  // Subscription read-only lock: when the org's subscription has expired (past
  // the grace period), block ALL writes for regular users. Reads (query ctx)
  // are always allowed so data stays visible. Super admins are never locked.
  // Callers that must keep working while expired (e.g. submitting a payment)
  // pass { bypassSubscriptionLock: true }.
  if (!options.bypassSubscriptionLock && isMutationCtx(ctx)) {
    const org = await ctx.db.get(user.organizationId);
    if (org) {
      const info = computeSubscriptionInfo(org, new Date().toISOString());
      if (info.isReadOnly) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "Masa langganan organisasi telah berakhir. Akses dalam mode hanya-baca. Hubungi admin untuk menyelesaikan pembayaran agar akses penuh pulih.",
        });
      }
    }
  }

  return { userId: user._id, organizationId: user.organizationId, isSuperAdmin };
}

/** True when the context can write to the database (a mutation context). */
function isMutationCtx(ctx: QueryCtx | MutationCtx): ctx is MutationCtx {
  return typeof (ctx as MutationCtx).db.insert === "function";
}

/**
 * Consent-first check: returns this super admin's currently ACTIVE, non-expired
 * access grant into the given organization, or null. Inlined here (rather than
 * importing from convex/dataAccess.ts) to avoid a circular module dependency,
 * since almost every module depends on requireTenant.
 */
async function getActiveGrantForTenant(
  ctx: QueryCtx | MutationCtx,
  superAdminId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<Doc<"dataAccessGrants"> | null> {
  const now = new Date().toISOString();
  const grants = await ctx.db
    .query("dataAccessGrants")
    .withIndex("by_superadmin_and_org", (q) =>
      q.eq("superAdminId", superAdminId).eq("organizationId", organizationId),
    )
    .collect();
  return (
    grants.find(
      (g) => g.status === "approved" && !!g.expiresAt && g.expiresAt > now,
    ) ?? null
  );
}

/**
 * The set of data scopes the CURRENT caller is allowed to touch inside their
 * effective organization, or `null` meaning "unrestricted" (a normal tenant
 * user, or a super admin acting outside a scoped grant).
 *
 * A super admin viewing a company through a time-boxed grant is restricted to
 * exactly the scopes that company approved. A grant with no scopes recorded
 * (legacy, pre-scoped-consent) is treated as unrestricted for backward
 * compatibility. This is the single source of truth for scope enforcement.
 */
export async function getEffectiveScopes(
  ctx: QueryCtx | MutationCtx,
): Promise<ReadonlyArray<DataScope> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) return null;

  // Only a super admin actively viewing an org via a grant is ever restricted.
  if (user.role !== "super_admin") return null;
  const viewingId = user.viewingOrganizationId ?? null;
  if (viewingId === null) return null;

  // A super admin may hold SEVERAL active grants for one organization (for
  // example an original "HR" grant plus a later "Letters" top-up). The caller's
  // effective scopes are the UNION of every active grant's scopes.
  const now = new Date().toISOString();
  const activeGrants = (
    await ctx.db
      .query("dataAccessGrants")
      .withIndex("by_superadmin_and_org", (q) =>
        q.eq("superAdminId", user._id).eq("organizationId", viewingId),
      )
      .collect()
  ).filter((g) => g.status === "approved" && !!g.expiresAt && g.expiresAt > now);

  if (activeGrants.length === 0) return null;

  const union = new Set<DataScope>();
  for (const grant of activeGrants) {
    const rawScopes = grant.scopes;
    // Legacy grant without recorded scopes → full access (unrestricted).
    if (!rawScopes || rawScopes.length === 0) return null;
    for (const s of rawScopes) {
      if (isDataScope(s)) union.add(s);
    }
  }
  // Defensive: grants whose stored scopes are all invalid → allow nothing.
  return [...union];
}

/** True if the caller's effective scopes include `scope` (null = unrestricted). */
export async function hasScope(
  ctx: QueryCtx | MutationCtx,
  scope: DataScope,
): Promise<boolean> {
  const scopes = await getEffectiveScopes(ctx);
  if (scopes === null) return true;
  return scopes.includes(scope);
}

/**
 * Returns the set of organization ids the given super admin currently has an
 * ACTIVE, approved, non-expired access grant for. Used by the cross-tenant
 * Super Admin panel to only reveal data from companies that have consented.
 */
export async function getGrantedOrgIds(
  ctx: QueryCtx | MutationCtx,
  superAdminId: Id<"users">,
): Promise<Set<Id<"organizations">>> {
  const now = new Date().toISOString();
  const grants = await ctx.db
    .query("dataAccessGrants")
    .withIndex("by_superadmin_and_org", (q) =>
      q.eq("superAdminId", superAdminId),
    )
    .collect();
  const granted = new Set<Id<"organizations">>();
  for (const g of grants) {
    if (g.status === "approved" && !!g.expiresAt && g.expiresAt > now) {
      granted.add(g.organizationId);
    }
  }
  return granted;
}

/**
 * True if the given super admin currently has an active approved grant into the
 * given organization. Convenience wrapper around getGrantedOrgIds for single
 * lookups (e.g. guarding a detail view or a mutation on one user).
 */
export async function hasActiveGrantForOrg(
  ctx: QueryCtx | MutationCtx,
  superAdminId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  const grant = await getActiveGrantForTenant(ctx, superAdminId, organizationId);
  return grant !== null;
}

/**
 * Graceful read gate for scoped consent: returns `true` when the current caller
 * MUST be blocked from a data scope because they are a super admin viewing a
 * company through a grant that does NOT include this scope. Regular users and
 * unrestricted super admins return `false`.
 *
 * Read/list functions should return an empty result when this is true, so a
 * scoped vendor simply sees no data (mirrors isSuperAdminBlocked).
 */
export async function isScopeBlocked(
  ctx: QueryCtx | MutationCtx,
  scope: DataScope,
): Promise<boolean> {
  return !(await hasScope(ctx, scope));
}

/**
 * Asserts the caller may access data in the given scope. Throws FORBIDDEN when a
 * scoped vendor grant does not include it. Use at the top of the most sensitive
 * read/write functions (letters/document archive, payroll/finance, HR personal)
 * as defense-in-depth behind the menu-level restriction.
 */
export async function requireScope(
  ctx: QueryCtx | MutationCtx,
  scope: DataScope,
): Promise<void> {
  const ok = await hasScope(ctx, scope);
  if (!ok) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Akses ke kategori data "${scopeLabel(scope)}" tidak termasuk dalam izin yang disetujui perusahaan.`,
    });
  }
}

/** All known data scope values (re-exported for convenience). */
export const ALL_DATA_SCOPES: ReadonlyArray<DataScope> = DATA_SCOPE_VALUES;

/**
 * Asserts that a document belongs to the same organization as the caller.
 * Pass the organizationId from requireTenant() and the doc's organizationId.
 *
 * Policy: a caller with no organization in scope (callerOrgId null/undefined —
 * only ever a super admin without an active access grant) may access ONLY
 * legacy documents that have no organization assigned. Any org-scoped document
 * is blocked, so a super admin never reads another organization's data without
 * consent. Legacy documents without an organizationId remain accessible.
 */
export function assertSameTenant(
  callerOrgId: Id<"organizations"> | null | undefined,
  docOrgId: Id<"organizations"> | null | undefined,
  resourceName = "resource",
): void {
  // Legacy doc with no org assigned — accessible to all tenants
  if (docOrgId === null || docOrgId === undefined) return;

  // No org in scope (super admin without an active grant): block org-scoped docs.
  if (callerOrgId === null || callerOrgId === undefined) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `You do not have access to this ${resourceName}`,
    });
  }

  if (callerOrgId !== docOrgId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `You do not have access to this ${resourceName}`,
    });
  }
}
