import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyAdmins, notifyUser } from "./notifications";
import { canManageTeam, isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { isSuperAdminBlocked } from "./superAdminDataAccess";

const DEFAULT_ANNUAL_QUOTA = 12;

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "User not logged in",
    });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }
  return user;
}

// Compute inclusive day count between two ISO dates (YYYY-MM-DD)
function computeDayCount(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const diff = end.getTime() - start.getTime();
  if (diff < 0) return 0;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
  return days;
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Whether `reviewer` is allowed to review the request from `requester`.
// Admin roles see everything; supervisors see their direct reports.
function canReviewRequest(
  reviewer: Doc<"users">,
  requester: Doc<"users"> | null,
): boolean {
  if (isAdminRole(reviewer.role)) return true;
  if (!canManageTeam(reviewer.role)) return false;
  if (!requester) return false;
  return requester.managerId === reviewer._id;
}

export type EnrichedLeaveRequest = Doc<"leaveRequests"> & {
  userName: string;
  userDepartment: string;
  userJobTitle: string;
  userAvatarUrl: string | null;
  reviewerName: string | null;
};

async function enrich(
  ctx: QueryCtx,
  req: Doc<"leaveRequests">,
): Promise<EnrichedLeaveRequest> {
  const user = await ctx.db.get(req.userId);
  const reviewer = req.reviewerId ? await ctx.db.get(req.reviewerId) : null;
  return {
    ...req,
    userName: user?.name ?? "Karyawan",
    userDepartment: user?.department ?? "",
    userJobTitle: user?.jobTitle ?? "",
    userAvatarUrl: user?.avatarUrl ?? null,
    reviewerName: reviewer?.name ?? null,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx): Promise<Array<EnrichedLeaveRequest>> => {
    const user = await requireUser(ctx);
    const requests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return await Promise.all(requests.map((r) => enrich(ctx, r)));
  },
});

export const listForReview = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedLeaveRequest>> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau atasan yang dapat meninjau pengajuan cuti",
      });
    }

    const { organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Data privacy gate: a super admin only sees leave data when the "Cuti"
    // category is explicitly enabled in super admin data access settings.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "leave")) {
      return [];
    }

    const status = args.status ?? "pending";
    const requests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .collect();

    // Apply tenant isolation: only a super admin viewing ALL organizations
    // (organizationId === null) sees every org. A super admin who has selected
    // a specific organization to view MUST be scoped to that org, just like a
    // regular user — otherwise leave requests from other organizations leak in.
    const tenantFiltered =
      organizationId === null
        ? requests
        : requests.filter((r) => r.organizationId === organizationId);

    // Supervisors only see requests from their direct reports. Admin sees all.
    const visibleRequests = isAdminRole(user.role)
      ? tenantFiltered
      : await filterToDirectReports(ctx, tenantFiltered, user._id);

    return await Promise.all(visibleRequests.map((r) => enrich(ctx, r)));
  },
});

async function filterToDirectReports(
  ctx: QueryCtx,
  requests: Array<Doc<"leaveRequests">>,
  managerId: Id<"users">,
): Promise<Array<Doc<"leaveRequests">>> {
  const reports = await ctx.db
    .query("users")
    .withIndex("by_manager", (q) => q.eq("managerId", managerId))
    .collect();
  const reportIds = new Set(reports.map((r) => r._id));
  return requests.filter((r) => reportIds.has(r.userId));
}

export const getMyStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    approvedDays: number;
    annualQuota: number;
    annualUsed: number;
    annualRemaining: number;
    year: number;
  }> => {
    const user = await requireUser(ctx);
    const year = currentYear();

    const requests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let approvedDays = 0;
    let annualUsed = 0;
    for (const r of requests) {
      if (r.status === "pending") pending += 1;
      else if (r.status === "approved") {
        approved += 1;
        approvedDays += r.dayCount;
        if (r.type === "annual") {
          const reqYear = Number(r.startDate.slice(0, 4));
          if (reqYear === year) annualUsed += r.dayCount;
        }
      } else if (r.status === "rejected") rejected += 1;
    }

    const balance = await ctx.db
      .query("leaveBalances")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", year),
      )
      .unique();
    const annualQuota = balance?.annualQuota ?? DEFAULT_ANNUAL_QUOTA;
    const annualRemaining = Math.max(0, annualQuota - annualUsed);

    return {
      pending,
      approved,
      rejected,
      approvedDays,
      annualQuota,
      annualUsed,
      annualRemaining,
      year,
    };
  },
});

export const getPendingCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) return 0;

    const { organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Data privacy gate for super admins (Cuti category).
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "leave")) {
      return 0;
    }

    const pending = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // Apply tenant isolation. A super admin viewing a specific org is scoped to
    // it (organizationId is set); only viewing ALL orgs (null) shows everything.
    const tenantFiltered =
      organizationId === null
        ? pending
        : pending.filter((r) => r.organizationId === organizationId);

    const visible = isAdminRole(user.role)
      ? tenantFiltered
      : await filterToDirectReports(ctx, tenantFiltered, user._id);

    return visible.length;
  },
});

// Lightweight sidebar badge count for "Pengajuan Cuti".
// Counts leave requests still awaiting the current user's review (admins see
// their whole org/scope; supervisors see only their direct reports). Regular
// employees have nothing to approve, so they get 0. Never throws.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return 0;
    if (!canManageTeam(user.role)) return 0;

    const isSuperAdmin = user.role === "super_admin";

    if (isSuperAdmin) {
      // A platform super admin only gets a leave badge when actively viewing a
      // specific company AND the "Cuti" data category is granted. Otherwise 0 —
      // never aggregate every company's pending leave into the super admin's
      // sidebar (that would leak tenant data and spam the badge).
      const viewingOrgId = user.viewingOrganizationId ?? null;
      if (viewingOrgId === null) return 0;
      if (await isSuperAdminBlocked(ctx, true, "leave")) return 0;

      const pendingForOrg = await ctx.db
        .query("leaveRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .take(500);
      return pendingForOrg.filter((r) => r.organizationId === viewingOrgId)
        .length;
    }

    const organizationId = user.organizationId ?? null;

    const pending = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(500);

    const tenantFiltered =
      organizationId === null
        ? pending
        : pending.filter((r) => r.organizationId === organizationId);

    if (isAdminRole(user.role)) return tenantFiltered.length;

    // Supervisor: only requests from their direct reports.
    const reports = await ctx.db
      .query("users")
      .withIndex("by_manager", (q) => q.eq("managerId", user._id))
      .collect();
    const reportIds = new Set(reports.map((r) => r._id));
    return tenantFiltered.filter((r) => reportIds.has(r.userId)).length;
  },
});

// Who is currently out of office today (approved leave covering today).
export const listOnLeaveToday = query({
  args: {},
  handler: async (ctx): Promise<Array<EnrichedLeaveRequest>> => {
    await requireUser(ctx);

    const { organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Data privacy gate for super admins (Cuti category).
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "leave")) {
      return [];
    }

    const today = todayIso();
    // Gather approved leaves that start on/before today; filter by endDate >= today
    const approved = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const onLeave = approved.filter(
      (r) =>
        r.startDate <= today &&
        r.endDate >= today &&
        // Apply tenant isolation (super admin viewing a specific org is scoped)
        (organizationId === null
          ? true
          : r.organizationId === organizationId),
    );

    return await Promise.all(onLeave.map((r) => enrich(ctx, r)));
  },
});

// Upcoming approved leaves in the next 30 days (excludes today).
export const listUpcoming = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<EnrichedLeaveRequest>> => {
    await requireUser(ctx);

    const { organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Data privacy gate for super admins (Cuti category).
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "leave")) {
      return [];
    }

    const days = args.days ?? 30;
    const today = todayIso();
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + days);
    const futureIso = futureDate.toISOString().slice(0, 10);

    const approved = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status_and_start", (q) =>
        q.eq("status", "approved").gte("startDate", today),
      )
      .collect();

    const upcoming = approved.filter(
      (r) =>
        r.startDate <= futureIso &&
        // Apply tenant isolation (super admin viewing a specific org is scoped)
        (organizationId === null
          ? true
          : r.organizationId === organizationId),
    );

    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return await Promise.all(upcoming.map((r) => enrich(ctx, r)));
  },
});

export const create = mutation({
  args: {
    type: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"leaveRequests">> => {
    const user = await requireUser(ctx);

    const allowedTypes = new Set([
      "annual",
      "sick",
      "personal",
      "maternity",
      "other",
    ]);
    if (!allowedTypes.has(args.type)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jenis cuti tidak valid",
      });
    }

    if (args.reason.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Alasan wajib diisi",
      });
    }

    const dayCount = computeDayCount(args.startDate, args.endDate);
    if (dayCount <= 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai",
      });
    }

    const id = await ctx.db.insert("leaveRequests", {
      userId: user._id,
      organizationId: user.organizationId,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      dayCount,
      reason: args.reason.trim(),
      status: "pending",
    });

    // Notify the direct manager first (if any), otherwise all admins.
    if (user.managerId) {
      await notifyUser(ctx, {
        userId: user.managerId,
        type: "leave_new",
        title: "Pengajuan cuti baru",
        message: `${user.name ?? "Anggota tim"} mengajukan cuti ${dayCount} hari`,
        link: "/leave",
        actorId: user._id,
      });
    } else {
      await notifyAdmins(ctx, {
        type: "leave_new",
        title: "Pengajuan cuti baru",
        message: `${user.name ?? "Seorang karyawan"} mengajukan cuti ${dayCount} hari`,
        link: "/leave",
        actorId: user._id,
      });
    }

    return id;
  },
});

export const cancel = mutation({
  args: { id: v.id("leaveRequests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (req.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pemilik pengajuan yang dapat membatalkan",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya pengajuan yang menunggu persetujuan yang bisa dibatalkan",
      });
    }
    await ctx.db.delete(args.id);
  },
});

export const review = mutation({
  args: {
    id: v.id("leaveRequests"),
    decision: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau atasan yang dapat meninjau pengajuan cuti",
      });
    }
    if (args.decision !== "approved" && args.decision !== "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Keputusan tidak valid",
      });
    }
    const req = await ctx.db.get(args.id);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan sudah ditinjau sebelumnya",
      });
    }
    const requester = await ctx.db.get(req.userId);
    if (!canReviewRequest(user, requester)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda hanya dapat meninjau pengajuan anggota tim Anda",
      });
    }

    await ctx.db.patch(args.id, {
      status: args.decision,
      reviewerId: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.note?.trim() ? args.note.trim() : undefined,
    });

    // Notify the requester of the decision
    await notifyUser(ctx, {
      userId: req.userId,
      type: "leave_reviewed",
      title:
        args.decision === "approved"
          ? "Cuti Anda disetujui"
          : "Cuti Anda ditolak",
      message: `Pengajuan ${req.dayCount} hari (${req.startDate}) telah ${
        args.decision === "approved" ? "disetujui" : "ditolak"
      }${args.note?.trim() ? `: ${args.note.trim()}` : ""}`,
      link: "/leave",
      actorId: user._id,
    });
  },
});

// Approve or reject many pending leave requests at once. Skips any request the
// reviewer cannot act on or that is no longer pending; never throws mid-loop.
export const bulkReview = mutation({
  args: {
    ids: v.array(v.id("leaveRequests")),
    decision: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau atasan yang dapat meninjau pengajuan cuti",
      });
    }
    if (args.decision !== "approved" && args.decision !== "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Keputusan tidak valid",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 pengajuan per aksi",
      });
    }
    const note = args.note?.trim() ? args.note.trim() : undefined;
    const now = new Date().toISOString();
    let count = 0;
    for (const id of args.ids) {
      const req = await ctx.db.get(id);
      if (!req || req.status !== "pending") continue;
      const requester = await ctx.db.get(req.userId);
      if (!canReviewRequest(user, requester)) continue;
      await ctx.db.patch(id, {
        status: args.decision,
        reviewerId: user._id,
        reviewedAt: now,
        reviewNote: note,
      });
      await notifyUser(ctx, {
        userId: req.userId,
        type: "leave_reviewed",
        title:
          args.decision === "approved"
            ? "Cuti Anda disetujui"
            : "Cuti Anda ditolak",
        message: `Pengajuan ${req.dayCount} hari (${req.startDate}) telah ${
          args.decision === "approved" ? "disetujui" : "ditolak"
        }${note ? `: ${note}` : ""}`,
        link: "/leave",
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});

// ---- Leave balances (admin) -------------------------------------------

export type BalanceRow = {
  userId: Id<"users">;
  name: string;
  department: string;
  jobTitle: string;
  avatarUrl: string | null;
  year: number;
  annualQuota: number;
  annualUsed: number;
  annualRemaining: number;
};

export const listBalances = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<BalanceRow>> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat melihat saldo cuti",
      });
    }

    const { organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Data privacy gate for super admins (Cuti category).
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "leave")) {
      return [];
    }

    const year = args.year ?? currentYear();

    const allUsers = await ctx.db.query("users").collect();

    // Apply tenant isolation to the user list. A super admin viewing a specific
    // org is scoped to it; only viewing ALL orgs (null) shows everyone.
    const users =
      organizationId === null
        ? allUsers
        : allUsers.filter((u) => u.organizationId === organizationId);

    const rows: Array<BalanceRow> = [];
    for (const u of users) {
      const balance = await ctx.db
        .query("leaveBalances")
        .withIndex("by_user_and_year", (q) =>
          q.eq("userId", u._id).eq("year", year),
        )
        .unique();
      const annualQuota = balance?.annualQuota ?? DEFAULT_ANNUAL_QUOTA;

      const requests = await ctx.db
        .query("leaveRequests")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", u._id).eq("status", "approved"),
        )
        .collect();
      let annualUsed = 0;
      for (const r of requests) {
        if (r.type !== "annual") continue;
        const reqYear = Number(r.startDate.slice(0, 4));
        if (reqYear === year) annualUsed += r.dayCount;
      }

      rows.push({
        userId: u._id,
        name: u.name ?? "Karyawan",
        department: u.department ?? "",
        jobTitle: u.jobTitle ?? "",
        avatarUrl: u.avatarUrl ?? null,
        year,
        annualQuota,
        annualUsed,
        annualRemaining: Math.max(0, annualQuota - annualUsed),
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },
});

export const setQuota = mutation({
  args: {
    userId: v.id("users"),
    year: v.number(),
    annualQuota: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat mengubah saldo cuti",
      });
    }
    if (args.annualQuota < 0 || args.annualQuota > 365) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kuota cuti harus antara 0 dan 365 hari",
      });
    }
    const existing = await ctx.db
      .query("leaveBalances")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", args.userId).eq("year", args.year),
      )
      .unique();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        annualQuota: args.annualQuota,
        updatedBy: user._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("leaveBalances", {
        userId: args.userId,
        year: args.year,
        annualQuota: args.annualQuota,
        organizationId: user.organizationId,
        updatedBy: user._id,
        updatedAt: now,
      });
    }
    return null;
  },
});
