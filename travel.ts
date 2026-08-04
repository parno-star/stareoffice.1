import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyAdmins, notifyUser } from "./notifications";
import { canManageTeam, isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ---- Constants -----------------------------------------------------------

const VALID_TRANSPORT = [
  "flight",
  "train",
  "bus",
  "car",
  "ship",
  "other",
] as const;

const VALID_STATUS = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const DEFAULT_CURRENCY = "IDR";

// ---- Helpers -------------------------------------------------------------

function computeDayCount(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const diff = end.getTime() - start.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function canApprove(
  approver: Doc<"users">,
  requester: Doc<"users"> | null,
): boolean {
  if (isAdminRole(approver.role)) return true;
  if (!canManageTeam(approver.role)) return false;
  if (!requester) return false;
  return requester.managerId === approver._id;
}

// ---- Types ---------------------------------------------------------------

export type EnrichedTravelRequest = Doc<"travelRequests"> & {
  userName: string;
  userAvatarUrl: string | null;
  approverName: string | null;
};

async function enrich(
  ctx: QueryCtx,
  req: Doc<"travelRequests">,
): Promise<EnrichedTravelRequest> {
  const user = await ctx.db.get(req.userId);
  const approver = req.approverId ? await ctx.db.get(req.approverId) : null;
  return {
    ...req,
    userName: user?.name ?? "Karyawan",
    userAvatarUrl: user?.avatarUrl ?? null,
    approverName: approver?.name ?? null,
  };
}

async function filterToDirectReports(
  ctx: QueryCtx,
  requests: Array<Doc<"travelRequests">>,
  managerId: Id<"users">,
): Promise<Array<Doc<"travelRequests">>> {
  const reports = await ctx.db
    .query("users")
    .withIndex("by_manager", (q) => q.eq("managerId", managerId))
    .collect();
  const reportIds = new Set(reports.map((r) => r._id));
  return requests.filter((r) => reportIds.has(r.userId));
}

function validateInput(args: {
  title: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  transportMode: string;
  estimatedCost: number;
}): void {
  if (args.title.trim().length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Judul perjalanan wajib diisi",
    });
  }
  if (args.destination.trim().length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Tujuan perjalanan wajib diisi",
    });
  }
  if (args.purpose.trim().length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Tujuan/alasan perjalanan wajib diisi",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Tanggal mulai tidak valid",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.endDate)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Tanggal selesai tidak valid",
    });
  }
  if (args.startDate > args.endDate) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Tanggal selesai harus setelah tanggal mulai",
    });
  }
  if (!VALID_TRANSPORT.includes(args.transportMode as (typeof VALID_TRANSPORT)[number])) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Moda transportasi tidak valid",
    });
  }
  if (!Number.isFinite(args.estimatedCost) || args.estimatedCost < 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Estimasi biaya tidak valid",
    });
  }
}

// ---- Queries -------------------------------------------------------------

export const listMine = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedTravelRequest>> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    let requests: Array<Doc<"travelRequests">>;
    if (args.status && args.status !== "all") {
      requests = await ctx.db
        .query("travelRequests")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status as string),
        )
        .order("desc")
        .take(200);
    } else {
      requests = await ctx.db
        .query("travelRequests")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(200);
    }
    return await Promise.all(requests.map((r) => enrich(ctx, r)));
  },
});

export const listForReview = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedTravelRequest>> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Hanya admin atau atasan yang dapat meninjau pengajuan perjalanan",
      });
    }
    const status = args.status ?? "pending";
    let requests: Array<Doc<"travelRequests">>;
    if (organizationId !== null) {
      // Org-scoped: use by_organization index, filter status in memory
      const orgRequests = await ctx.db
        .query("travelRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(500);
      requests = orgRequests.filter((r) => r.status === status);
    } else {
      requests = await ctx.db
        .query("travelRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(500);
    }
    const visible = isAdminRole(user.role)
      ? requests
      : await filterToDirectReports(ctx, requests, user._id);
    return await Promise.all(visible.map((r) => enrich(ctx, r)));
  },
});

// Lightweight sidebar badge count for "Perjalanan Dinas".
// Counts pending travel requests awaiting the current user's review (admins see
// their whole scope; supervisors see only their direct reports). Regular
// employees get 0. Never throws.
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
    const organizationId = isSuperAdmin
      ? (user.viewingOrganizationId ?? null)
      : (user.organizationId ?? null);

    let requests: Array<Doc<"travelRequests">>;
    if (organizationId !== null) {
      const orgRequests = await ctx.db
        .query("travelRequests")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .take(500);
      requests = orgRequests.filter((r) => r.status === "pending");
    } else {
      requests = await ctx.db
        .query("travelRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .take(500);
    }

    if (isAdminRole(user.role)) return requests.length;

    const visible = await filterToDirectReports(ctx, requests, user._id);
    return visible.length;
  },
});

export const listAll = query({
  args: {
    status: v.optional(v.string()),
    department: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedTravelRequest>> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat melihat seluruh pengajuan perjalanan",
      });
    }
    let requests: Array<Doc<"travelRequests">>;
    if (organizationId !== null) {
      // Org-scoped: use by_organization index, filter status in memory
      requests = await ctx.db
        .query("travelRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(1000);
      if (args.status && args.status !== "all") {
        requests = requests.filter((r) => r.status === args.status);
      }
    } else if (args.status && args.status !== "all") {
      requests = await ctx.db
        .query("travelRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(1000);
    } else {
      requests = await ctx.db.query("travelRequests").order("desc").take(1000);
    }
    const filtered = requests.filter((r) => {
      if (
        args.department &&
        args.department !== "all" &&
        (r.userDepartment ?? "") !== args.department
      )
        return false;
      if (args.userId && r.userId !== args.userId) return false;
      if (args.startDate && r.endDate < args.startDate) return false;
      if (args.endDate && r.startDate > args.endDate) return false;
      return true;
    });
    return await Promise.all(filtered.map((r) => enrich(ctx, r)));
  },
});

export const getById = query({
  args: { id: v.id("travelRequests") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    request: EnrichedTravelRequest;
    itinerary: Array<Doc<"travelItineraryItems">>;
    canApprove: boolean;
    canEdit: boolean;
  } | null> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const req = await ctx.db.get(args.id);
    if (!req) return null;
    const isOwner = req.userId === user._id;
    const requester = await ctx.db.get(req.userId);
    const isApprover = canApprove(user, requester);
    const isReadOnlyAdmin = isAdminRole(user.role);
    if (!isOwner && !isApprover && !isReadOnlyAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki akses ke pengajuan ini",
      });
    }
    const itinerary = await ctx.db
      .query("travelItineraryItems")
      .withIndex("by_request", (q) => q.eq("travelRequestId", req._id))
      .collect();
    itinerary.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.order - b.order;
    });
    const enriched = await enrich(ctx, req);
    return {
      request: enriched,
      itinerary,
      canApprove: isApprover && req.status === "pending",
      canEdit: isOwner && (req.status === "draft" || req.status === "pending"),
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    myDraft: number;
    myPending: number;
    myApproved: number;
    myCompleted: number;
    myUpcomingCount: number;
    myTotalTrips: number;
    myTotalEstimated: number;
    adminPendingCount: number;
    adminInProgressCount: number;
  }> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const mine = await ctx.db
      .query("travelRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);
    const today = todayIso();
    let myDraft = 0;
    let myPending = 0;
    let myApproved = 0;
    let myCompleted = 0;
    let myUpcomingCount = 0;
    let myTotalEstimated = 0;
    for (const r of mine) {
      myTotalEstimated += r.estimatedCost;
      if (r.status === "draft") myDraft += 1;
      else if (r.status === "pending") myPending += 1;
      else if (r.status === "approved") {
        myApproved += 1;
        if (r.startDate >= today) myUpcomingCount += 1;
      } else if (r.status === "completed") myCompleted += 1;
      else if (r.status === "in_progress") {
        if (r.startDate >= today) myUpcomingCount += 1;
      }
    }
    let adminPendingCount = 0;
    let adminInProgressCount = 0;
    if (canManageTeam(user.role)) {
      let pending: Array<Doc<"travelRequests">>;
      let inProgress: Array<Doc<"travelRequests">>;
      if (organizationId !== null) {
        const orgRequests = await ctx.db
          .query("travelRequests")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .take(500);
        pending = orgRequests.filter((r) => r.status === "pending");
        inProgress = orgRequests.filter((r) => r.status === "in_progress");
      } else {
        pending = await ctx.db
          .query("travelRequests")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .take(500);
        inProgress = await ctx.db
          .query("travelRequests")
          .withIndex("by_status", (q) => q.eq("status", "in_progress"))
          .take(500);
      }
      const visiblePending = isAdminRole(user.role)
        ? pending
        : await filterToDirectReports(ctx, pending, user._id);
      const visibleInProgress = isAdminRole(user.role)
        ? inProgress
        : await filterToDirectReports(ctx, inProgress, user._id);
      adminPendingCount = visiblePending.length;
      adminInProgressCount = visibleInProgress.length;
    }
    return {
      myDraft,
      myPending,
      myApproved,
      myCompleted,
      myUpcomingCount,
      myTotalTrips: mine.length,
      myTotalEstimated,
      adminPendingCount,
      adminInProgressCount,
    };
  },
});

export type TravelAnalytics = {
  total: number;
  totalEstimated: number;
  totalActual: number;
  byStatus: Array<{ status: string; count: number }>;
  byTransport: Array<{ mode: string; count: number; cost: number }>;
  byDepartment: Array<{ department: string; count: number; cost: number }>;
  byMonth: Array<{ month: string; count: number; cost: number }>;
  topTravelers: Array<{
    userId: Id<"users">;
    userName: string | null;
    userAvatar: string | null;
    tripCount: number;
    totalCost: number;
  }>;
};

export const getAnalytics = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<TravelAnalytics> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat melihat analitik perjalanan",
      });
    }
    let all: Array<Doc<"travelRequests">>;
    if (organizationId !== null) {
      all = await ctx.db
        .query("travelRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(2000);
    } else {
      all = await ctx.db.query("travelRequests").order("desc").take(2000);
    }
    const scoped = all.filter((r) => {
      if (args.startDate && r.endDate < args.startDate) return false;
      if (args.endDate && r.startDate > args.endDate) return false;
      return true;
    });

    let totalEstimated = 0;
    let totalActual = 0;
    const byStatus = new Map<string, number>();
    const byTransport = new Map<string, { count: number; cost: number }>();
    const byDept = new Map<string, { count: number; cost: number }>();
    const byMonth = new Map<string, { count: number; cost: number }>();
    const byUser = new Map<
      Id<"users">,
      { tripCount: number; totalCost: number }
    >();

    for (const r of scoped) {
      totalEstimated += r.estimatedCost;
      totalActual += r.actualCost ?? 0;
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      const t = byTransport.get(r.transportMode) ?? { count: 0, cost: 0 };
      t.count += 1;
      t.cost += r.estimatedCost;
      byTransport.set(r.transportMode, t);
      const dept = r.userDepartment ?? "Tidak Ditentukan";
      const d = byDept.get(dept) ?? { count: 0, cost: 0 };
      d.count += 1;
      d.cost += r.estimatedCost;
      byDept.set(dept, d);
      const month = r.startDate.slice(0, 7);
      const m = byMonth.get(month) ?? { count: 0, cost: 0 };
      m.count += 1;
      m.cost += r.estimatedCost;
      byMonth.set(month, m);
      const u = byUser.get(r.userId) ?? { tripCount: 0, totalCost: 0 };
      u.tripCount += 1;
      u.totalCost += r.estimatedCost;
      byUser.set(r.userId, u);
    }

    const topEntries = [...byUser.entries()].sort(
      (a, b) => b[1].totalCost - a[1].totalCost,
    );
    const topTravelers: TravelAnalytics["topTravelers"] = [];
    for (const [uid, data] of topEntries.slice(0, 5)) {
      const u = await ctx.db.get(uid);
      topTravelers.push({
        userId: uid,
        userName: u?.name ?? null,
        userAvatar: u?.avatarUrl ?? null,
        tripCount: data.tripCount,
        totalCost: data.totalCost,
      });
    }

    return {
      total: scoped.length,
      totalEstimated,
      totalActual,
      byStatus: [...byStatus.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      byTransport: [...byTransport.entries()]
        .map(([mode, d]) => ({ mode, ...d }))
        .sort((a, b) => b.count - a.count),
      byDepartment: [...byDept.entries()]
        .map(([department, d]) => ({ department, ...d }))
        .sort((a, b) => b.cost - a.cost),
      byMonth: [...byMonth.entries()]
        .map(([month, d]) => ({ month, ...d }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      topTravelers,
    };
  },
});

export const listDepartments = query({
  args: {},
  handler: async (ctx): Promise<Array<string>> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!isAdminRole(user.role)) return [];
    let users: Array<Doc<"users">>;
    if (organizationId !== null) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .take(1000);
    } else {
      users = await ctx.db.query("users").take(1000);
    }
    const set = new Set<string>();
    for (const u of users) {
      if (u.department) set.add(u.department);
    }
    return [...set].sort();
  },
});

// ---- Mutations -----------------------------------------------------------

export const create = mutation({
  args: {
    title: v.string(),
    destination: v.string(),
    purpose: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    transportMode: v.string(),
    accommodation: v.optional(v.string()),
    estimatedCost: v.number(),
    currency: v.optional(v.string()),
    submit: v.optional(v.boolean()),
    itinerary: v.optional(
      v.array(
        v.object({
          date: v.string(),
          timeStart: v.optional(v.string()),
          timeEnd: v.optional(v.string()),
          location: v.string(),
          activity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args): Promise<Id<"travelRequests">> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    validateInput(args);
    const dayCount = computeDayCount(args.startDate, args.endDate);
    if (dayCount <= 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Durasi perjalanan tidak valid",
      });
    }
    const status = args.submit ? "pending" : "draft";
    const now = new Date().toISOString();
    const id = await ctx.db.insert("travelRequests", {
      userId: user._id,
      title: args.title.trim(),
      destination: args.destination.trim(),
      purpose: args.purpose.trim(),
      startDate: args.startDate,
      endDate: args.endDate,
      dayCount,
      transportMode: args.transportMode,
      accommodation: args.accommodation?.trim() || undefined,
      estimatedCost: Math.max(0, Math.round(args.estimatedCost)),
      currency: args.currency?.trim() || DEFAULT_CURRENCY,
      status,
      userDepartment: user.department,
      userJobTitle: user.jobTitle,
      submittedAt: status === "pending" ? now : undefined,
      organizationId: organizationId ?? undefined,
    });

    // Insert itinerary items if provided
    if (args.itinerary && args.itinerary.length > 0) {
      const dayGroups = new Map<string, number>();
      for (const item of args.itinerary) {
        if (item.location.trim().length === 0) continue;
        if (item.activity.trim().length === 0) continue;
        if (item.date < args.startDate || item.date > args.endDate) continue;
        const order = dayGroups.get(item.date) ?? 0;
        dayGroups.set(item.date, order + 1);
        await ctx.db.insert("travelItineraryItems", {
          travelRequestId: id,
          userId: user._id,
          date: item.date,
          timeStart: item.timeStart?.trim() || undefined,
          timeEnd: item.timeEnd?.trim() || undefined,
          location: item.location.trim(),
          activity: item.activity.trim(),
          notes: item.notes?.trim() || undefined,
          order,
        });
      }
    }

    if (status === "pending") {
      if (user.managerId) {
        await notifyUser(ctx, {
          userId: user.managerId,
          type: "travel_new",
          title: "Pengajuan perjalanan dinas baru",
          message: `${user.name ?? "Anggota tim"} mengajukan perjalanan ke ${args.destination}`,
          link: "/travel",
          actorId: user._id,
        });
      } else {
        await notifyAdmins(ctx, {
          type: "travel_new",
          title: "Pengajuan perjalanan dinas baru",
          message: `${user.name ?? "Karyawan"} mengajukan perjalanan ke ${args.destination}`,
          link: "/travel",
          actorId: user._id,
        });
      }
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("travelRequests"),
    title: v.string(),
    destination: v.string(),
    purpose: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    transportMode: v.string(),
    accommodation: v.optional(v.string()),
    estimatedCost: v.number(),
    currency: v.optional(v.string()),
    itinerary: v.optional(
      v.array(
        v.object({
          date: v.string(),
          timeStart: v.optional(v.string()),
          timeEnd: v.optional(v.string()),
          location: v.string(),
          activity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
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
        message: "Hanya pemilik pengajuan yang dapat mengubah",
      });
    }
    if (req.status !== "draft" && req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan sudah tidak dapat diubah",
      });
    }
    validateInput(args);
    const dayCount = computeDayCount(args.startDate, args.endDate);
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      destination: args.destination.trim(),
      purpose: args.purpose.trim(),
      startDate: args.startDate,
      endDate: args.endDate,
      dayCount,
      transportMode: args.transportMode,
      accommodation: args.accommodation?.trim() || undefined,
      estimatedCost: Math.max(0, Math.round(args.estimatedCost)),
      currency: args.currency?.trim() || DEFAULT_CURRENCY,
    });

    if (args.itinerary) {
      const existing = await ctx.db
        .query("travelItineraryItems")
        .withIndex("by_request", (q) => q.eq("travelRequestId", args.id))
        .collect();
      for (const e of existing) {
        await ctx.db.delete(e._id);
      }
      const dayGroups = new Map<string, number>();
      for (const item of args.itinerary) {
        if (item.location.trim().length === 0) continue;
        if (item.activity.trim().length === 0) continue;
        if (item.date < args.startDate || item.date > args.endDate) continue;
        const order = dayGroups.get(item.date) ?? 0;
        dayGroups.set(item.date, order + 1);
        await ctx.db.insert("travelItineraryItems", {
          travelRequestId: args.id,
          userId: user._id,
          date: item.date,
          timeStart: item.timeStart?.trim() || undefined,
          timeEnd: item.timeEnd?.trim() || undefined,
          location: item.location.trim(),
          activity: item.activity.trim(),
          notes: item.notes?.trim() || undefined,
          order,
        });
      }
    }

    return null;
  },
});

export const submitDraft = mutation({
  args: { id: v.id("travelRequests") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
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
        message: "Hanya pemilik pengajuan yang dapat mengirim",
      });
    }
    if (req.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya draft yang dapat dikirim",
      });
    }
    await ctx.db.patch(args.id, {
      status: "pending",
      submittedAt: new Date().toISOString(),
    });
    if (user.managerId) {
      await notifyUser(ctx, {
        userId: user.managerId,
        type: "travel_new",
        title: "Pengajuan perjalanan dinas baru",
        message: `${user.name ?? "Anggota tim"} mengajukan perjalanan ke ${req.destination}`,
        link: "/travel",
        actorId: user._id,
      });
    } else {
      await notifyAdmins(ctx, {
        type: "travel_new",
        title: "Pengajuan perjalanan dinas baru",
        message: `${user.name ?? "Karyawan"} mengajukan perjalanan ke ${req.destination}`,
        link: "/travel",
        actorId: user._id,
      });
    }
    return null;
  },
});

export const review = mutation({
  args: {
    id: v.id("travelRequests"),
    decision: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
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
    if (!canApprove(user, requester)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak berwenang menyetujui pengajuan ini",
      });
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, {
      status: args.decision,
      approverId: user._id,
      approvedAt: now,
      approvalNote:
        args.decision === "approved" ? args.note?.trim() || undefined : undefined,
      rejectionReason:
        args.decision === "rejected" ? args.note?.trim() || undefined : undefined,
    });
    await notifyUser(ctx, {
      userId: req.userId,
      type: "travel_reviewed",
      title:
        args.decision === "approved"
          ? "Perjalanan dinas disetujui"
          : "Perjalanan dinas ditolak",
      message: `Perjalanan ke ${req.destination}${args.note?.trim() ? `: ${args.note.trim()}` : ""}`,
      link: "/travel",
      actorId: user._id,
    });
    return null;
  },
});

// Approve or reject many pending travel requests at once. Skips requests the
// reviewer cannot approve or that are no longer pending; never throws mid-loop.
export const bulkReview = mutation({
  args: {
    ids: v.array(v.id("travelRequests")),
    decision: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
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
      if (!canApprove(user, requester)) continue;
      await ctx.db.patch(id, {
        status: args.decision,
        approverId: user._id,
        approvedAt: now,
        approvalNote: args.decision === "approved" ? note : undefined,
        rejectionReason: args.decision === "rejected" ? note : undefined,
      });
      await notifyUser(ctx, {
        userId: req.userId,
        type: "travel_reviewed",
        title:
          args.decision === "approved"
            ? "Perjalanan dinas disetujui"
            : "Perjalanan dinas ditolak",
        message: `Perjalanan ke ${req.destination}${note ? `: ${note}` : ""}`,
        link: "/travel",
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});

export const cancel = mutation({
  args: { id: v.id("travelRequests") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const req = await ctx.db.get(args.id);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (req.userId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (req.status === "completed" || req.status === "cancelled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan tidak dapat dibatalkan",
      });
    }
    await ctx.db.patch(args.id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    return null;
  },
});

export const markInProgress = mutation({
  args: { id: v.id("travelRequests") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const req = await ctx.db.get(args.id);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (req.userId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (req.status !== "approved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya perjalanan yang disetujui yang dapat ditandai berjalan",
      });
    }
    await ctx.db.patch(args.id, { status: "in_progress" });
    return null;
  },
});

export const submitReport = mutation({
  args: {
    id: v.id("travelRequests"),
    actualCost: v.number(),
    reportSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
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
        message: "Hanya pemilik yang dapat menyerahkan laporan",
      });
    }
    if (req.status !== "approved" && req.status !== "in_progress") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Laporan hanya bisa dikirim setelah perjalanan disetujui",
      });
    }
    if (!Number.isFinite(args.actualCost) || args.actualCost < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Biaya aktual tidak valid",
      });
    }
    if (args.reportSummary.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Ringkasan laporan wajib diisi",
      });
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, {
      status: "completed",
      actualCost: Math.max(0, Math.round(args.actualCost)),
      reportSummary: args.reportSummary.trim(),
      reportSubmittedAt: now,
      completedAt: now,
    });
    if (req.approverId) {
      await notifyUser(ctx, {
        userId: req.approverId,
        type: "travel_report",
        title: "Laporan perjalanan dinas",
        message: `${user.name ?? "Karyawan"} menyelesaikan perjalanan ke ${req.destination}`,
        link: "/travel",
        actorId: user._id,
      });
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("travelRequests") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const req = await ctx.db.get(args.id);
    if (!req) return null;
    const isOwner = req.userId === user._id;
    const isAdmin = isAdminRole(user.role);
    if (!isOwner && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (!isAdmin && req.status !== "draft" && req.status !== "cancelled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya draft atau pengajuan yang dibatalkan yang dapat dihapus",
      });
    }
    const items = await ctx.db
      .query("travelItineraryItems")
      .withIndex("by_request", (q) => q.eq("travelRequestId", args.id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// Sanity helper used by the frontend to expose allowed status values.
export const getValidStatuses = query({
  args: {},
  handler: async (): Promise<Array<string>> => {
    return [...VALID_STATUS];
  },
});
