import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireTenant } from "../lib/tenant";

/**
 * Advanced org-structure records (dotted lines, skills, succession, 9-box,
 * headcount, job roles, scenarios, history, KPI measurements, ...) are keyed
 * by userId / created inside a single organization but historically were NOT
 * stamped with an `organizationId` on insert. To guarantee tenant isolation we
 * scope these queries by the set of users that belong to the caller's viewing
 * organization.
 *
 * Policy: a super admin NEVER sees tenant data across organizations. They only
 * see a single organization's data after selecting it AND holding an active,
 * approved access grant (consent-first). When no organization is effectively in
 * scope (`organizationId === null`), these queries return NOTHING.
 *
 * Returns:
 *  - `organizationId`: the caller's effective org (null = no org in scope; the
 *    caller must be shown empty results).
 *  - `userIds`: set of user ids in that org. Empty set when `organizationId` is
 *    null (no data visible).
 *  - `isMember(userId)`: membership predicate against the org's user set. Always
 *    false when no org is in scope.
 */
export async function getOrgScope(
  ctx: QueryCtx | MutationCtx,
): Promise<{
  organizationId: Id<"organizations"> | null;
  isSuperAdmin: boolean;
  userIds: Set<Id<"users">> | null;
  isMember: (userId: Id<"users"> | null | undefined) => boolean;
  users: Array<Doc<"users">>;
}> {
  const { organizationId, isSuperAdmin } = await requireTenant(ctx, {
    allowSuperAdmin: true,
  });

  // No organization effectively in scope (super admin without an active grant,
  // or no org selected): the caller sees NOTHING. We fall through with an empty
  // user set so every membership check fails and all rows are filtered out.

  // Scope to the caller's organization user set.
  const users =
    organizationId === null
      ? []
      : await ctx.db
          .query("users")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect();
  const scopedUsers = users.filter((u) => u.role !== "super_admin");
  const userIds = new Set<Id<"users">>(scopedUsers.map((u) => u._id));
  return {
    organizationId,
    isSuperAdmin,
    userIds,
    isMember: (userId) => (userId ? userIds.has(userId) : false),
    users: scopedUsers,
  };
}
