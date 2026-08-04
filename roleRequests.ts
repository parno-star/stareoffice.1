import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isRole, normalizeRole, ROLE_LABELS } from "./roles";
import { requireTenant } from "./lib/tenant";

// ---- Helpers -----------------------------------------------------------

async function requireAuthUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true, allowPending: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ---- Queries -----------------------------------------------------------

/** Current user's pending role request (if any) */
export const getMyPendingRequest = query({
  args: {},
  handler: async (ctx): Promise<Doc<"roleRequests"> | null> => {
    let userId: Id<"users">;
    try {
      const tenant = await requireTenant(ctx, { allowSuperAdmin: true, allowPending: true });
      userId = tenant.userId;
    } catch {
      return null;
    }

    const req = await ctx.db
      .query("roleRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return req;
  },
});

/** All pending requests – admin only */
export const listPending = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"roleRequests"> & { user: Doc<"users"> | null }>> => {
    let actor: Doc<"users">;
    try {
      actor = await requireAuthUser(ctx);
    } catch {
      return [];
    }
    if (!isAdminRole(actor.role)) return [];

    let requests: Array<Doc<"roleRequests">>;
    if (actor.role === "super_admin") {
      // Pengaturan Pengguna is always scoped to a single organization. Use the
      // selected viewing org, else fall back to the super admin's home org.
      const scopeOrgId =
        actor.viewingOrganizationId ?? actor.organizationId ?? null;
      if (!scopeOrgId) return [];
      const all = await ctx.db
        .query("roleRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .order("asc")
        .collect();
      requests = all.filter(
        (r) => r.organizationId === scopeOrgId || !r.organizationId,
      );
    } else {
      // Scoped admin sees only their org's pending requests
      const organizationId = actor.organizationId;
      if (!organizationId) return [];
      const all = await ctx.db
        .query("roleRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      requests = all.filter((r) => r.status === "pending");
    }

    return Promise.all(
      requests.map(async (r) => ({
        ...r,
        user: await ctx.db.get(r.userId),
      })),
    );
  },
});

/** All requests (history) – admin only, paginated */
export const listAll = query({
  args: {
    statusFilter: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"roleRequests"> & { user: Doc<"users"> | null; reviewer: Doc<"users"> | null }>> => {
    let actor: Doc<"users">;
    try {
      actor = await requireAuthUser(ctx);
    } catch {
      return [];
    }
    if (!isAdminRole(actor.role)) return [];

    let requests: Array<Doc<"roleRequests">>;

    if (actor.role === "super_admin") {
      // Scoped to a single organization: selected viewing org, else home org.
      const scopeOrgId =
        actor.viewingOrganizationId ?? actor.organizationId ?? null;
      if (!scopeOrgId) return [];
      let all: Array<Doc<"roleRequests">>;
      if (args.statusFilter && args.statusFilter !== "all") {
        all = await ctx.db
          .query("roleRequests")
          .withIndex("by_status", (q) => q.eq("status", args.statusFilter!))
          .order("desc")
          .take(100);
      } else {
        all = await ctx.db.query("roleRequests").order("desc").take(100);
      }
      // Scope to the resolved org (plus org-less requests).
      requests = all.filter(
        (r) => r.organizationId === scopeOrgId || !r.organizationId,
      );
    } else {
      // Scoped admin sees only their org
      const organizationId = actor.organizationId;
      if (!organizationId) return [];
      const all = await ctx.db
        .query("roleRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(100);
      requests =
        args.statusFilter && args.statusFilter !== "all"
          ? all.filter((r) => r.status === args.statusFilter)
          : all;
    }

    return Promise.all(
      requests.map(async (r) => ({
        ...r,
        user: await ctx.db.get(r.userId),
        reviewer: r.reviewedById ? await ctx.db.get(r.reviewedById) : null,
      })),
    );
  },
});

/** Audit log for a user – admin only, tenant-scoped */
export const getAuditLog = query({
  args: { targetUserId: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<Array<Doc<"userAuditLog"> & { actor: Doc<"users"> | null }>> => {
    let currentActor: Doc<"users">;
    try {
      currentActor = await requireAuthUser(ctx);
    } catch {
      return [];
    }
    if (!isAdminRole(currentActor.role)) return [];

    const isSuper = currentActor.role === "super_admin";
    // Pengaturan Pengguna is scoped to a single organization. For a super admin,
    // use the org they are viewing, else fall back to their home org.
    const scopeOrgId = isSuper
      ? (currentActor.viewingOrganizationId ?? currentActor.organizationId ?? null)
      : (currentActor.organizationId ?? null);

    // An admin with no organization can never see cross-tenant logs.
    if (!scopeOrgId) return [];

    // Resolve the organization a given audit log entry belongs to. Prefer the
    // log's own organizationId; fall back to the target user's organization so
    // older entries (written before organizationId was stored) stay scoped.
    const logOrgId = async (
      log: Doc<"userAuditLog">,
    ): Promise<Id<"organizations"> | null> => {
      if (log.organizationId) return log.organizationId;
      const target = await ctx.db.get(log.targetUserId);
      return target?.organizationId ?? null;
    };

    let logs: Array<Doc<"userAuditLog">>;
    if (args.targetUserId) {
      // Verify the requested target belongs to the caller's tenant before
      // exposing any of their audit history.
      const target = await ctx.db.get(args.targetUserId);
      if (!target) return [];
      if (scopeOrgId && target.organizationId !== scopeOrgId) return [];

      logs = await ctx.db
        .query("userAuditLog")
        .withIndex("by_target", (q) => q.eq("targetUserId", args.targetUserId!))
        .order("desc")
        .take(50);
    } else {
      // Scoped view: pull a bounded window of recent logs, then keep only those
      // that resolve to the caller's organization.
      const recent = await ctx.db
        .query("userAuditLog")
        .withIndex("by_occurred")
        .order("desc")
        .take(300);
      const scoped: Array<Doc<"userAuditLog">> = [];
      for (const log of recent) {
        if ((await logOrgId(log)) === scopeOrgId) scoped.push(log);
        if (scoped.length >= 100) break;
      }
      logs = scoped;
    }

    return Promise.all(
      logs.map(async (l) => ({
        ...l,
        actor: l.actorId ? await ctx.db.get(l.actorId) : null,
      })),
    );
  },
});

// ---- Mutations ---------------------------------------------------------

/** New user submits a role request during onboarding */
export const submitRequest = mutation({
  args: {
    requestedRole: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true, allowPending: true });
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // Validate role
    if (!isRole(args.requestedRole)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid role selected" });
    }

    // Super admin can never be requested
    if (args.requestedRole === "super_admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Cannot request super_admin role" });
    }

    // Rate limit: max 1 pending request per user
    const existingPending = await ctx.db
      .query("roleRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const pendingCount = existingPending.filter((r) => r.status === "pending").length;
    if (pendingCount >= 1) {
      throw new ConvexError({ code: "CONFLICT", message: "Anda sudah memiliki permintaan yang sedang menunggu persetujuan" });
    }

    // Mark user as pending
    await ctx.db.patch(user._id, { accountStatus: "pending_approval" });

    // Create request – scoped to the user's organization
    const requestId = await ctx.db.insert("roleRequests", {
      userId: user._id,
      requestedRole: args.requestedRole,
      reason: args.reason,
      status: "pending",
      requestedAt: nowISO(),
      organizationId: organizationId ?? undefined,
    });

    // Audit log
    await ctx.db.insert("userAuditLog", {
      targetUserId: user._id,
      action: "role_requested",
      detail: `Requested role: ${ROLE_LABELS[normalizeRole(args.requestedRole)]}`,
      occurredAt: nowISO(),
    });

    return requestId;
  },
});

/** Admin approves a role request */
export const approveRequest = mutation({
  args: {
    requestId: v.id("roleRequests"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthUser(ctx);
    if (!isAdminRole(actor.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat menyetujui permintaan" });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError({ code: "NOT_FOUND", message: "Request not found" });
    if (request.status !== "pending") {
      throw new ConvexError({ code: "CONFLICT", message: "Request sudah diproses sebelumnya" });
    }

    // Scoped admin can only approve requests within their org
    if (actor.role !== "super_admin" && actor.organizationId) {
      if (request.organizationId && request.organizationId !== actor.organizationId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Anda tidak memiliki akses ke permintaan ini" });
      }
    }

    const now = nowISO();

    // The account tied to this request may have been removed (e.g. cleaned up
    // after abandoning onboarding). Close the stale request gracefully.
    const targetUser = await ctx.db.get(request.userId);
    if (!targetUser) {
      await ctx.db.patch(args.requestId, {
        status: "rejected",
        reviewedAt: now,
        reviewedById: actor._id,
        reviewNote: "Akun pengguna sudah tidak ada — permintaan ditutup otomatis.",
      });
      return { orphaned: true } as const;
    }

    // Update request
    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedAt: now,
      reviewedById: actor._id,
      reviewNote: args.reviewNote,
    });

    // Apply role and activate account
    await ctx.db.patch(request.userId, {
      role: request.requestedRole,
      accountStatus: "active",
    });

    // Audit log
    await ctx.db.insert("userAuditLog", {
      actorId: actor._id,
      targetUserId: request.userId,
      action: "role_request_approved",
      detail: `Role approved: ${ROLE_LABELS[normalizeRole(request.requestedRole)]}${args.reviewNote ? ` — ${args.reviewNote}` : ""}`,
      occurredAt: now,
      organizationId: targetUser.organizationId,
    });

    // Notify the user
    await ctx.db.insert("notifications", {
      userId: request.userId,
      type: "account_approved",
      title: "Akun Disetujui",
      message: `Selamat! Akun Anda telah disetujui sebagai ${ROLE_LABELS[normalizeRole(request.requestedRole)]}. Anda sekarang dapat mengakses platform.`,
      actorId: actor._id,
      link: "/dashboard",
      organizationId: targetUser.organizationId,
    });

    return { orphaned: false } as const;
  },
});

/** Admin rejects a role request */
export const rejectRequest = mutation({
  args: {
    requestId: v.id("roleRequests"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthUser(ctx);
    if (!isAdminRole(actor.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat menolak permintaan" });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError({ code: "NOT_FOUND", message: "Request not found" });
    if (request.status !== "pending") {
      throw new ConvexError({ code: "CONFLICT", message: "Request sudah diproses sebelumnya" });
    }

    // Scoped admin can only reject requests within their org
    if (actor.role !== "super_admin" && actor.organizationId) {
      if (request.organizationId && request.organizationId !== actor.organizationId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Anda tidak memiliki akses ke permintaan ini" });
      }
    }

    const now = nowISO();

    // The account tied to this request may have been removed (e.g. cleaned up
    // after abandoning onboarding). Close the stale request gracefully instead
    // of erroring on a nonexistent user document.
    const targetUser = await ctx.db.get(request.userId);
    if (!targetUser) {
      await ctx.db.patch(args.requestId, {
        status: "rejected",
        reviewedAt: now,
        reviewedById: actor._id,
        reviewNote: args.reviewNote ?? "Akun pengguna sudah tidak ada — permintaan ditutup otomatis.",
      });
      return { orphaned: true } as const;
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedAt: now,
      reviewedById: actor._id,
      reviewNote: args.reviewNote,
    });

    // Keep user in rejected state (they can resubmit)
    await ctx.db.patch(request.userId, { accountStatus: "rejected" });

    // Audit log
    await ctx.db.insert("userAuditLog", {
      actorId: actor._id,
      targetUserId: request.userId,
      action: "role_request_rejected",
      detail: `Role request rejected${args.reviewNote ? `: ${args.reviewNote}` : ""}`,
      occurredAt: now,
      organizationId: targetUser.organizationId,
    });

    // Notify the user
    await ctx.db.insert("notifications", {
      userId: request.userId,
      type: "account_rejected",
      title: "Permintaan Ditolak",
      message: `Permintaan peran Anda telah ditolak.${args.reviewNote ? ` Catatan: ${args.reviewNote}` : ""} Anda dapat mengajukan ulang.`,
      actorId: actor._id,
      organizationId: targetUser.organizationId,
    });

    return { orphaned: false } as const;
  },
});

/** Admin permanently deletes a role request record (history cleanup). */
export const deleteRequest = mutation({
  args: {
    requestId: v.id("roleRequests"),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthUser(ctx);
    if (!isAdminRole(actor.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat menghapus permintaan",
      });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found" });
    }

    // Scoped admin can only delete requests within their org
    if (actor.role !== "super_admin" && actor.organizationId) {
      if (
        request.organizationId &&
        request.organizationId !== actor.organizationId
      ) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Anda tidak memiliki akses ke permintaan ini",
        });
      }
    }

    await ctx.db.delete(args.requestId);

    await ctx.db.insert("userAuditLog", {
      actorId: actor._id,
      targetUserId: request.userId,
      action: "role_request_deleted",
      detail: `Role request (${request.status}) dihapus dari riwayat`,
      occurredAt: nowISO(),
      organizationId: request.organizationId,
    });

    return { deleted: true } as const;
  },
});

/** Admin suspends a user account */
export const suspendUser = mutation({
  args: {
    targetUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthUser(ctx);
    if (!isAdminRole(actor.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mensuspend akun" });
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // Super admin cannot be suspended
    if (target.role === "super_admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Akun Super Admin tidak dapat disuspend" });
    }

    // Tenant isolation: a scoped admin can only suspend users in their own org
    if (actor.role !== "super_admin") {
      if (!actor.organizationId || target.organizationId !== actor.organizationId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Anda tidak memiliki akses ke pengguna ini" });
      }
    }

    await ctx.db.patch(args.targetUserId, { accountStatus: "suspended" });

    await ctx.db.insert("userAuditLog", {
      actorId: actor._id,
      targetUserId: args.targetUserId,
      action: "account_suspended",
      detail: args.reason ?? "Akun disuspend oleh admin",
      occurredAt: nowISO(),
      organizationId: target.organizationId,
    });
  },
});

/** Admin activates/reinstates a user account */
export const activateUser = mutation({
  args: {
    targetUserId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthUser(ctx);
    if (!isAdminRole(actor.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengaktifkan akun" });
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // Tenant isolation: a scoped admin can only activate users in their own org
    if (actor.role !== "super_admin") {
      if (!actor.organizationId || target.organizationId !== actor.organizationId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Anda tidak memiliki akses ke pengguna ini" });
      }
    }

    await ctx.db.patch(args.targetUserId, { accountStatus: "active" });

    await ctx.db.insert("userAuditLog", {
      actorId: actor._id,
      targetUserId: args.targetUserId,
      action: "account_activated",
      detail: args.note ?? "Akun diaktifkan oleh admin",
      occurredAt: nowISO(),
      organizationId: target.organizationId,
    });
  },
});

/** User resubmits after rejection */
export const resubmitRequest = mutation({
  args: {
    requestedRole: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true, allowPending: true });
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (user.accountStatus === "suspended") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Akun Anda sedang disuspend" });
    }

    if (!isRole(args.requestedRole) || args.requestedRole === "super_admin") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Role tidak valid" });
    }

    const now = nowISO();
    await ctx.db.patch(user._id, { accountStatus: "pending_approval" });
    const requestId = await ctx.db.insert("roleRequests", {
      userId: user._id,
      requestedRole: args.requestedRole,
      reason: args.reason,
      status: "pending",
      requestedAt: now,
      organizationId: organizationId ?? undefined,
    });

    await ctx.db.insert("userAuditLog", {
      targetUserId: user._id,
      action: "role_requested",
      detail: `Resubmitted role request: ${ROLE_LABELS[normalizeRole(args.requestedRole)]}`,
      occurredAt: now,
    });

    return requestId;
  },
});

/** Admin directly assigns role (bypasses request flow) */
export const adminSetRole = mutation({
  args: {
    targetUserId: v.id("users"),
    newRole: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const actor = await requireAuthUser(ctx);
    if (!isAdminRole(actor.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengubah role" });
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    if (!isRole(args.newRole)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Role tidak valid" });
    }

    // Only super_admin can assign super_admin
    if (args.newRole === "super_admin" && actor.role !== "super_admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya Super Admin yang dapat assign role Super Admin" });
    }

    const oldRole = target.role ?? "employee";
    await ctx.db.patch(args.targetUserId, {
      role: args.newRole,
      accountStatus: "active",
    });

    await ctx.db.insert("userAuditLog", {
      actorId: actor._id,
      targetUserId: args.targetUserId,
      action: "role_changed",
      detail: `Role changed: ${ROLE_LABELS[normalizeRole(oldRole)]} → ${ROLE_LABELS[normalizeRole(args.newRole)]}${args.note ? ` (${args.note})` : ""}`,
      occurredAt: nowISO(),
    });
  },
});

/** Count pending requests – for badge in admin UI */
export const countPending = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    let actor: Doc<"users">;
    try {
      actor = await requireAuthUser(ctx);
    } catch {
      return 0;
    }
    if (!isAdminRole(actor.role)) return 0;

    if (actor.role === "super_admin") {
      // Mirror listPending: Pengaturan Pengguna is always scoped to a single
      // organization (selected viewing org, else the super admin's home org).
      // If none is in scope, show nothing so the badge matches the tab (and
      // never reveals cross-org pending counts without a selected org).
      const scopeOrgId =
        actor.viewingOrganizationId ?? actor.organizationId ?? null;
      if (!scopeOrgId) return 0;
      const pending = await ctx.db
        .query("roleRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
      return pending.filter(
        (r) => r.organizationId === scopeOrgId || !r.organizationId,
      ).length;
    }

    // Scoped admin: count only their org's pending requests
    const organizationId = actor.organizationId;
    if (!organizationId) return 0;
    const all = await ctx.db
      .query("roleRequests")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return all.filter((r) => r.status === "pending").length;
  },
});
