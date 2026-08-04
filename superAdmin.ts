import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireTenant, getGrantedOrgIds } from "./lib/tenant";
import { computeSubscriptionInfo } from "./lib/subscription";
import type { SubscriptionStatus } from "./lib/subscription";
import { isCountableEmployee } from "./lib/countableUsers";

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function requireSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (user.role !== "super_admin") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Super admin only" });
  }
  return user;
}

// ─── Platform Dashboard Stats ────────────────────────────────────────────────

export const getPlatformStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalOrganizations: number;
    activeOrganizations: number;
    inactiveOrganizations: number;
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    suspendedUsers: number;
    usersWithoutOrg: number;
    planDistribution: Array<{ plan: string; count: number }>;
    roleDistribution: Array<{ role: string; count: number }>;
    recentOrganizations: Array<Doc<"organizations">>;
  }> => {
    await requireSuperAdmin(ctx);

    const orgs = await ctx.db.query("organizations").collect();
    const allUsers = await ctx.db.query("users").collect();

    // Baris "users" berisi DUA jenis: akun login asli, dan record direktori
    // "placeholder" (karyawan yang didaftarkan admin tapi belum pernah login /
    // belum ditautkan ke akun). Statistik platform menghitung AKUN LOGIN ASLI
    // saja agar tidak menggelembung oleh stub direktori yang belum diklaim.
    // Akun uji coba (isTestAccount) dan super_admin juga dikecualikan agar
    // konsisten dengan perhitungan pengguna di tab Organisasi (isCountableEmployee)
    // dan bagian lain platform.
    const users = allUsers.filter(
      (u) =>
        !(u.tokenIdentifier ?? "").startsWith("placeholder:") &&
        isCountableEmployee(u),
    );

    const activeOrgs = orgs.filter((o) => o.isActive).length;

    // Plan distribution
    const planMap = new Map<string, number>();
    for (const o of orgs) {
      const plan = o.plan ?? "free";
      planMap.set(plan, (planMap.get(plan) ?? 0) + 1);
    }

    // Role distribution
    const roleMap = new Map<string, number>();
    for (const u of users) {
      const role = u.role ?? "employee";
      roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
    }

    // User statuses
    const activeUsers = users.filter(
      (u) => !u.accountStatus || u.accountStatus === "active",
    ).length;
    const pendingUsers = users.filter(
      (u) => u.accountStatus === "pending_approval",
    ).length;
    const suspendedUsers = users.filter(
      (u) => u.accountStatus === "suspended",
    ).length;
    // "Tanpa Organisasi" hanya untuk AKUN LOGIN ASLI yang belum ditugaskan ke
    // organisasi (perlu perhatian admin). Kecualikan:
    //  - super_admin: memang sengaja tidak terikat organisasi
    //  - record undangan placeholder (token "placeholder:"): stub direktori yang
    //    belum ditautkan ke login, bukan pengguna nyasar.
    const usersWithoutOrg = users.filter(
      (u) =>
        !u.organizationId &&
        u.role !== "super_admin" &&
        !(u.tokenIdentifier ?? "").startsWith("placeholder:"),
    ).length;

    // Recent orgs (last 5 by creation time)
    const recentOrgs = [...orgs]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5);

    return {
      totalOrganizations: orgs.length,
      activeOrganizations: activeOrgs,
      inactiveOrganizations: orgs.length - activeOrgs,
      totalUsers: users.length,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      usersWithoutOrg,
      planDistribution: Array.from(planMap.entries())
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count),
      roleDistribution: Array.from(roleMap.entries())
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count),
      recentOrganizations: recentOrgs,
    };
  },
});

// ─── Data Access Governance Summary ──────────────────────────────────────────

/**
 * Aggregate, privacy-preserving summary of the super admin's data-access
 * consent status. Returns only counts and organization-level metadata (never
 * personal user data), so it is safe to surface on the dashboard while
 * respecting company data confidentiality.
 */
export const getAccessGovernanceSummary = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalOrganizations: number;
    activeGrants: number;
    pendingRequests: number;
    coveragePercent: number;
    activeGrantsList: Array<{
      organizationId: Id<"organizations">;
      orgName: string;
      expiresAt: string | null;
    }>;
  }> => {
    const caller = await requireSuperAdmin(ctx);
    const now = new Date().toISOString();

    const orgs = await ctx.db.query("organizations").collect();

    // All grants tied to this super admin.
    const grants = await ctx.db
      .query("dataAccessGrants")
      .withIndex("by_superadmin_and_org", (q) =>
        q.eq("superAdminId", caller._id),
      )
      .collect();

    const activeGrants = grants.filter(
      (g) => g.status === "approved" && !!g.expiresAt && g.expiresAt > now,
    );
    const pendingRequests = grants.filter((g) => g.status === "pending");

    const orgNameById = new Map<Id<"organizations">, string>();
    for (const o of orgs) orgNameById.set(o._id, o.name);

    // Unique organizations currently granting access.
    const grantedOrgIds = new Set<Id<"organizations">>();
    for (const g of activeGrants) grantedOrgIds.add(g.organizationId);

    const activeGrantsList = activeGrants
      .map((g) => ({
        organizationId: g.organizationId,
        orgName: orgNameById.get(g.organizationId) ?? "—",
        expiresAt: g.expiresAt ?? null,
      }))
      .sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""))
      .slice(0, 8);

    const coveragePercent =
      orgs.length > 0
        ? Math.round((grantedOrgIds.size / orgs.length) * 100)
        : 0;

    return {
      totalOrganizations: orgs.length,
      activeGrants: grantedOrgIds.size,
      pendingRequests: pendingRequests.length,
      coveragePercent,
      activeGrantsList,
    };
  },
});

// ─── Company Responsible Persons (PJ) Directory ──────────────────────────────

/**
 * Directory of each company's official administrative contacts ("penanggung
 * jawab"). These are the org-level admin-role accounts that act as the
 * company's representatives for billing, technical coordination, and
 * administration of their app usage.
 *
 * This intentionally exposes ONLY administrative contact metadata (name,
 * email, phone, job title) plus the org's billing status. It never reveals
 * operational data or non-admin employees, so it is safe to show without a
 * per-company data-access grant.
 */
const RESPONSIBLE_ROLES = ["admin", "it_support"] as const;

export const listCompanyResponsibles = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      organizationId: Id<"organizations">;
      orgName: string;
      orgPlan: string;
      orgIsActive: boolean;
      orgEmail: string | null;
      orgPhone: string | null;
      billingStatus: SubscriptionStatus;
      billingPaidUntil: string | null;
      responsibles: Array<{
        userId: Id<"users">;
        name: string;
        email: string | null;
        phone: string | null;
        jobTitle: string | null;
        role: string;
        isCreator: boolean;
        accountStatus: string;
      }>;
    }>
  > => {
    await requireSuperAdmin(ctx);
    const nowIso = new Date().toISOString();

    const orgs = await ctx.db.query("organizations").collect();
    const allUsers = await ctx.db.query("users").collect();

    const responsibleRoleSet = new Set<string>(RESPONSIBLE_ROLES);
    const searchLower = args.search?.trim().toLowerCase() ?? "";

    const rows = orgs.map((org) => {
      const admins = allUsers.filter(
        (u) =>
          u.organizationId === org._id &&
          u.role !== undefined &&
          responsibleRoleSet.has(u.role),
      );

      const responsibles = admins
        .map((u) => ({
          userId: u._id,
          name: u.name ?? "Tanpa Nama",
          email: u.email ?? null,
          phone: u.phone ?? null,
          jobTitle: u.jobTitle ?? null,
          role: u.role ?? "admin",
          isCreator: org.createdBy === u._id,
          accountStatus: u.accountStatus ?? "active",
        }))
        // Show the org creator first, then alphabetically.
        .sort((a, b) => {
          if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
          return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
        });

      const info = computeSubscriptionInfo(
        {
          subscriptionPaidUntil: org.subscriptionPaidUntil,
          subscriptionCycleMonths: org.subscriptionCycleMonths,
          subscriptionStartedAt: org.subscriptionStartedAt,
        },
        nowIso,
      );

      return {
        organizationId: org._id,
        orgName: org.name,
        orgPlan: org.plan ?? "free",
        orgIsActive: org.isActive,
        orgEmail: org.email ?? null,
        orgPhone: org.phone ?? null,
        billingStatus: info.status,
        billingPaidUntil: info.paidUntil,
        responsibles,
      };
    });

    // Apply search across org name and responsible names/emails.
    const filtered = searchLower
      ? rows.filter((r) => {
          if (r.orgName.toLowerCase().includes(searchLower)) return true;
          return r.responsibles.some(
            (p) =>
              p.name.toLowerCase().includes(searchLower) ||
              (p.email?.toLowerCase().includes(searchLower) ?? false),
          );
        })
      : rows;

    // Companies with a designated contact first, then by name.
    filtered.sort((a, b) => {
      const aHas = a.responsibles.length > 0;
      const bHas = b.responsibles.length > 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.orgName.localeCompare(b.orgName, "id", { sensitivity: "base" });
    });

    return filtered;
  },
});

// ─── All Users List (cross-tenant) ──────────────────────────────────────────

export const listAllUsers = query({
  args: {
    search: v.optional(v.string()),
    organizationId: v.optional(v.union(v.id("organizations"), v.null())),
    role: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<Doc<"users"> & { orgName?: string }>> => {
    // Global cross-tenant view — restricted to super admins only.
    const caller = await requireSuperAdmin(ctx);

    // Consent-first: a super admin may only see users belonging to companies
    // that have granted them active access. Accounts with no organization
    // (platform-level accounts) and the super admin's own account are always
    // visible for platform administration.
    const grantedOrgIds = await getGrantedOrgIds(ctx, caller._id);
    const canSeeUser = (u: Doc<"users">): boolean => {
      if (u._id === caller._id) return true;
      if (!u.organizationId) return true;
      return grantedOrgIds.has(u.organizationId);
    };

    let users: Array<Doc<"users">>;

    const searchTerm = args.search?.trim();
    if (searchTerm && searchTerm.length > 0) {
      users = await ctx.db
        .query("users")
        .withSearchIndex("search_name", (q) => q.search("name", searchTerm))
        .take(200);
    } else {
      users = await ctx.db.query("users").collect();
    }

    // Drop any user from an organization that has not consented to access.
    users = users.filter(canSeeUser);

    // The Super Admin Panel is intentionally a global, cross-tenant view: it
    // shows users from every organization the super admin has been granted
    // access to. Narrowing to a single org is done via the `organizationId`
    // filter below.

    // Filter by organizationId
    if (args.organizationId !== undefined) {
      if (args.organizationId === null) {
        users = users.filter((u) => !u.organizationId);
      } else {
        users = users.filter((u) => u.organizationId === args.organizationId);
      }
    }

    // Filter by role
    if (args.role) {
      users = users.filter((u) => (u.role ?? "employee") === args.role);
    }

    // Filter by status
    if (args.status) {
      users = users.filter(
        (u) => (u.accountStatus ?? "active") === args.status,
      );
    }

    // Sort by name
    users.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "id", { sensitivity: "base" }),
    );

    // Enrich with org name
    const orgCache = new Map<string, string>();
    const result: Array<Doc<"users"> & { orgName?: string }> = [];
    for (const u of users) {
      let orgName: string | undefined;
      if (u.organizationId) {
        if (orgCache.has(u.organizationId)) {
          orgName = orgCache.get(u.organizationId);
        } else {
          const org = await ctx.db.get(u.organizationId);
          orgName = org?.name;
          if (orgName) orgCache.set(u.organizationId, orgName);
        }
      }
      result.push({ ...u, orgName });
    }

    return result;
  },
});

// ─── Update User (cross-tenant) ─────────────────────────────────────────────

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(v.string()),
    accountStatus: v.optional(v.string()),
    organizationId: v.optional(v.union(v.id("organizations"), v.null())),
    isTestAccount: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const caller = await requireSuperAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Consent-first: block editing a user that belongs to a company which has
    // not granted active access. The super admin's own account and accounts
    // without an organization remain editable for platform administration.
    if (
      args.userId !== caller._id &&
      target.organizationId
    ) {
      const grantedOrgIds = await getGrantedOrgIds(ctx, caller._id);
      if (!grantedOrgIds.has(target.organizationId)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "Anda belum memiliki izin akses yang aktif dari organisasi pengguna ini. Ajukan permintaan akses terlebih dahulu.",
        });
      }
    }

    // Cannot demote self
    if (args.userId === caller._id && args.role && args.role !== "super_admin") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak dapat mengubah role diri sendiri",
      });
    }

    // Block assigning super_admin to anyone other than the platform owner
    if (args.role === "super_admin" && args.userId !== caller._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Role Super Admin hanya dapat dimiliki oleh pemilik platform. Gunakan role Administrator sebagai gantinya.",
      });
    }

    const patch: Record<string, unknown> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.accountStatus !== undefined) patch.accountStatus = args.accountStatus;
    if (args.organizationId !== undefined) {
      patch.organizationId = args.organizationId === null ? undefined : args.organizationId;
    }
    if (args.isTestAccount !== undefined) patch.isTestAccount = args.isTestAccount;

    await ctx.db.patch(args.userId, patch);
  },
});

// ─── Delete User (permanent, cross-tenant) ──────────────────────────────────

/**
 * Permanently delete a user account and cascade-purge all of their personal
 * records across every user-scoped table (background batches).
 *
 * Intended for cleaning up accounts left without an organization — for example
 * after their company was deleted. Guardrails:
 *  - super_admin only
 *  - cannot delete your own account
 *  - cannot delete another super_admin
 *  - if the user still belongs to an organization, that org must have granted
 *    active access (consent-first), matching the rest of the panel
 */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const caller = await requireSuperAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    if (args.userId === caller._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak dapat menghapus akun Anda sendiri.",
      });
    }

    if (target.role === "super_admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Akun Super Admin tidak dapat dihapus.",
      });
    }

    if (target.organizationId) {
      const grantedOrgIds = await getGrantedOrgIds(ctx, caller._id);
      if (!grantedOrgIds.has(target.organizationId)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "Anda belum memiliki izin akses yang aktif dari organisasi pengguna ini. Ajukan permintaan akses terlebih dahulu.",
        });
      }
    }

    // Cascade-purge all personal records, then delete the user, in safe
    // background batches.
    await ctx.scheduler.runAfter(0, internal.userPurge.purgeUserBatch, {
      userId: args.userId,
      tableIndex: 0,
    });
  },
});

export const activateOrganization = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch(args.id, { isActive: true, updatedAt: new Date().toISOString() });
  },
});

// ─── Audit Log (recent activity) ────────────────────────────────────────────

export const getAuditLog = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      event: Doc<"orgHistory">;
      actor: Doc<"users"> | null;
    }>
  > => {
    await requireSuperAdmin(ctx);

    const events = await ctx.db
      .query("orgHistory")
      .order("desc")
      .take(50);

    const result: Array<{
      event: Doc<"orgHistory">;
      actor: Doc<"users"> | null;
    }> = [];

    for (const event of events) {
      const actor = event.actorId ? await ctx.db.get(event.actorId) : null;
      result.push({ event, actor });
    }

    return result;
  },
});

// Query: daftar pengguna yang sedang menunggu persetujuan surat (status pending)
// di semua organisasi — untuk super admin.
export const listPendingApprovers = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    approvalId: Id<"letterApprovals">;
    letterId: Id<"letters">;
    letterSubject: string;
    letterType: string;
    urgency: string;
    approvalDeadline: string | undefined;
    approvalRole: string;
    approvalLabel: string;
    approver: { _id: Id<"users">; name: string; jobTitle: string | undefined; organizationId: string | undefined; orgName: string | undefined };
    pendingSince: number;
  }>> => {
    await requireSuperAdmin(ctx);

    const pendingApprovals = await ctx.db
      .query("letterApprovals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const result: Array<{
      approvalId: Id<"letterApprovals">;
      letterId: Id<"letters">;
      letterSubject: string;
      letterType: string;
      urgency: string;
      approvalDeadline: string | undefined;
      approvalRole: string;
      approvalLabel: string;
      approver: { _id: Id<"users">; name: string; jobTitle: string | undefined; organizationId: string | undefined; orgName: string | undefined };
      pendingSince: number;
    }> = [];

    for (const approval of pendingApprovals) {
      const letter = await ctx.db.get(approval.letterId);
      if (!letter || letter.status !== "review") continue;

      const approver = await ctx.db.get(approval.approverId);
      if (!approver) continue;

      const org = approver.organizationId
        ? await ctx.db.get(approver.organizationId as Id<"organizations">)
        : null;

      result.push({
        approvalId: approval._id,
        letterId: approval.letterId,
        letterSubject: letter.subject,
        letterType: letter.type,
        urgency: letter.urgency ?? "normal",
        approvalDeadline: letter.approvalDeadline,
        approvalRole: approval.approvalRole ?? "pemeriksa",
        approvalLabel: approval.approvalLabel ?? "Pemeriksa",
        approver: {
          _id: approver._id,
          name: approver.name ?? "-",
          jobTitle: approver.jobTitle,
          organizationId: approver.organizationId,
          orgName: org?.name,
        },
        pendingSince: approval._creationTime,
      });
    }

    const urgencyOrder: Record<string, number> = { sangat_segera: 0, segera: 1, normal: 2 };
    result.sort((a, b) => {
      const uDiff = (urgencyOrder[a.urgency] ?? 2) - (urgencyOrder[b.urgency] ?? 2);
      if (uDiff !== 0) return uDiff;
      return a.pendingSince - b.pendingSince;
    });

    return result;
  },
});
