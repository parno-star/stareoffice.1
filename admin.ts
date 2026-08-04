import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, normalizeRole } from "./roles";
import { requireTenant } from "./lib/tenant";

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengakses area ini",
    });
  }
  return user;
}

export type AdminOverviewStats = {
  totals: {
    employees: number;
    admins: number;
    announcements: number;
    events: number;
    documents: number;
    forumThreads: number;
    suggestions: number;
    tickets: number;
    rooms: number;
    polls: number;
    recognitions: number;
    galleryAlbums: number;
  };
  pending: {
    leaveRequests: number;
    openTickets: number;
    inProgressTickets: number;
    newSuggestions: number;
    activePolls: number;
  };
  engagement: {
    forumRepliesThisMonth: number;
    recognitionsThisMonth: number;
    announcementsThisMonth: number;
  };
};

export const getOverviewStats = query({
  args: {},
  handler: async (ctx): Promise<AdminOverviewStats> => {
    await requireAdmin(ctx);

    const [
      users,
      announcements,
      events,
      documents,
      forumThreads,
      suggestions,
      tickets,
      rooms,
      polls,
      recognitions,
      albums,
      forumReplies,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("announcements").collect(),
      ctx.db.query("events").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("forumThreads").collect(),
      ctx.db.query("suggestions").collect(),
      ctx.db.query("tickets").collect(),
      ctx.db.query("rooms").collect(),
      ctx.db.query("polls").collect(),
      ctx.db.query("recognitions").collect(),
      ctx.db.query("galleryAlbums").collect(),
      ctx.db.query("forumReplies").collect(),
    ]);

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const threshold = now - thirtyDaysMs;

    const admins = users.filter((u) => isAdminRole(u.role)).length;
    const pendingLeave = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const openTickets = tickets.filter((t) => t.status === "open").length;
    const inProgressTickets = tickets.filter(
      (t) => t.status === "in_progress",
    ).length;
    const newSuggestions = suggestions.filter((s) => s.status === "new").length;
    const activePolls = polls.filter((p) => p.status === "active").length;

    const forumRepliesThisMonth = forumReplies.filter(
      (r) => r._creationTime >= threshold,
    ).length;
    const recognitionsThisMonth = recognitions.filter(
      (r) => r._creationTime >= threshold,
    ).length;
    const announcementsThisMonth = announcements.filter(
      (a) => a._creationTime >= threshold,
    ).length;

    return {
      totals: {
        employees: users.length,
        admins,
        announcements: announcements.length,
        events: events.length,
        documents: documents.length,
        forumThreads: forumThreads.length,
        suggestions: suggestions.length,
        tickets: tickets.length,
        rooms: rooms.length,
        polls: polls.length,
        recognitions: recognitions.length,
        galleryAlbums: albums.length,
      },
      pending: {
        leaveRequests: pendingLeave.length,
        openTickets,
        inProgressTickets,
        newSuggestions,
        activePolls,
      },
      engagement: {
        forumRepliesThisMonth,
        recognitionsThisMonth,
        announcementsThisMonth,
      },
    };
  },
});

export type DepartmentBreakdownItem = {
  department: string;
  count: number;
};

export const getDepartmentBreakdown = query({
  args: {},
  handler: async (ctx): Promise<Array<DepartmentBreakdownItem>> => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const map = new Map<string, number>();
    for (const u of users) {
      const key =
        u.department && u.department.trim().length > 0
          ? u.department
          : "Tanpa Departemen";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const items: Array<DepartmentBreakdownItem> = [];
    for (const [department, count] of map.entries()) {
      items.push({ department, count });
    }
    items.sort((a, b) => {
      if (a.department === "Tanpa Departemen") return 1;
      if (b.department === "Tanpa Departemen") return -1;
      return b.count - a.count;
    });
    return items;
  },
});

export type ActivityTrendPoint = {
  date: string; // YYYY-MM-DD
  leaveRequests: number;
  tickets: number;
  suggestions: number;
  forumThreads: number;
};

export const getActivityTrend = query({
  args: {},
  handler: async (ctx): Promise<Array<ActivityTrendPoint>> => {
    await requireAdmin(ctx);

    // Last 14 days including today (UTC for storage/aggregation consistency)
    const days = 14;
    const now = new Date();
    const startOfTodayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const cutoffMs = startOfTodayUtc - (days - 1) * 24 * 60 * 60 * 1000;

    const [leaveRequests, tickets, suggestions, forumThreads] =
      await Promise.all([
        ctx.db.query("leaveRequests").collect(),
        ctx.db.query("tickets").collect(),
        ctx.db.query("suggestions").collect(),
        ctx.db.query("forumThreads").collect(),
      ]);

    // Initialize buckets
    const buckets = new Map<string, ActivityTrendPoint>();
    for (let i = 0; i < days; i++) {
      const ms = cutoffMs + i * 24 * 60 * 60 * 1000;
      const d = new Date(ms);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
        2,
        "0",
      )}-${String(d.getUTCDate()).padStart(2, "0")}`;
      buckets.set(key, {
        date: key,
        leaveRequests: 0,
        tickets: 0,
        suggestions: 0,
        forumThreads: 0,
      });
    }

    const keyFor = (ms: number) => {
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
        2,
        "0",
      )}-${String(d.getUTCDate()).padStart(2, "0")}`;
    };

    for (const r of leaveRequests) {
      if (r._creationTime < cutoffMs) continue;
      const k = keyFor(r._creationTime);
      const b = buckets.get(k);
      if (b) b.leaveRequests += 1;
    }
    for (const t of tickets) {
      if (t._creationTime < cutoffMs) continue;
      const k = keyFor(t._creationTime);
      const b = buckets.get(k);
      if (b) b.tickets += 1;
    }
    for (const s of suggestions) {
      if (s._creationTime < cutoffMs) continue;
      const k = keyFor(s._creationTime);
      const b = buckets.get(k);
      if (b) b.suggestions += 1;
    }
    for (const f of forumThreads) {
      if (f._creationTime < cutoffMs) continue;
      const k = keyFor(f._creationTime);
      const b = buckets.get(k);
      if (b) b.forumThreads += 1;
    }

    return Array.from(buckets.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  },
});

export const listEmployeesForAdmin = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<Doc<"users">>> => {
    const me = await requireAdmin(ctx);
    const search = args.search?.trim().toLowerCase() ?? "";

    // Scope to the caller's organization. For a super admin this reflects the
    // organization they have currently selected (viewingOrganizationId); for a
    // regular admin it is their own org. When a super admin has no organization
    // selected, they see everyone.
    const isSuper = normalizeRole(me.role) === "super_admin";
    const scopeOrgId = isSuper
      ? (me.viewingOrganizationId ?? null)
      : (me.organizationId ?? null);

    let users: Array<Doc<"users">>;
    if (scopeOrgId) {
      const inOrg = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", scopeOrgId),
        )
        .collect();
      const withoutOrg = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", undefined))
        .collect();
      users = [...inOrg, ...withoutOrg];
    } else if (isSuper) {
      // Super admin with no org selected sees all users.
      users = await ctx.db.query("users").collect();
    } else {
      // Regular admin without an org has nothing to show.
      users = [];
    }

    const filtered = !search
      ? users
      : users.filter(
          (u) =>
            (u.name ?? "").toLowerCase().includes(search) ||
            (u.email ?? "").toLowerCase().includes(search) ||
            (u.department ?? "").toLowerCase().includes(search) ||
            (u.jobTitle ?? "").toLowerCase().includes(search),
        );
    filtered.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "id", { sensitivity: "base" }),
    );
    return filtered;
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Legacy endpoint. Prefer userSettings.setUserRole (super admin only).
    const me = await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }

    // Block assigning super_admin role — only platform owner can have it
    const newRole = normalizeRole(args.role);
    if (newRole === "super_admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Role Super Admin hanya dapat dimiliki oleh pemilik platform. Gunakan role Administrator sebagai gantinya.",
      });
    }

    // Prevent removing the last super admin
    const currentRole = normalizeRole(target.role);
    if (currentRole === "super_admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak dapat mengubah role Super Admin melalui endpoint ini.",
      });
    }
    await ctx.db.patch(args.userId, { role: newRole });
    return args.userId;
  },
});

export type PendingActionsSummary = {
  pendingLeave: Array<{
    id: Id<"leaveRequests">;
    userName: string;
    type: string;
    startDate: string;
    endDate: string;
    dayCount: number;
  }>;
  openTickets: Array<{
    id: Id<"tickets">;
    title: string;
    priority: string;
    authorName: string;
    lastActivityAt: string;
  }>;
  newSuggestions: Array<{
    id: Id<"suggestions">;
    title: string;
    category: string;
    upvoteCount: number;
  }>;
};

export const getPendingActions = query({
  args: {},
  handler: async (ctx): Promise<PendingActionsSummary> => {
    await requireAdmin(ctx);

    const [leaveReqs, openTickets, inProgressTickets, newSuggestions] =
      await Promise.all([
        ctx.db
          .query("leaveRequests")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .order("desc")
          .take(5),
        ctx.db
          .query("tickets")
          .withIndex("by_status", (q) => q.eq("status", "open"))
          .collect(),
        ctx.db
          .query("tickets")
          .withIndex("by_status", (q) => q.eq("status", "in_progress"))
          .collect(),
        ctx.db
          .query("suggestions")
          .withIndex("by_status", (q) => q.eq("status", "new"))
          .order("desc")
          .take(5),
      ]);

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      let u = userCache.get(id);
      if (u === undefined) {
        u = await ctx.db.get(id);
        userCache.set(id, u);
      }
      return u;
    };

    const pendingLeave: PendingActionsSummary["pendingLeave"] = [];
    for (const lr of leaveReqs) {
      const u = await getUser(lr.userId);
      pendingLeave.push({
        id: lr._id,
        userName: u?.name ?? "Karyawan",
        type: lr.type,
        startDate: lr.startDate,
        endDate: lr.endDate,
        dayCount: lr.dayCount,
      });
    }

    const priorityRank: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const allTickets = [...openTickets, ...inProgressTickets]
      .sort((a, b) => {
        const pa = priorityRank[a.priority] ?? 4;
        const pb = priorityRank[b.priority] ?? 4;
        if (pa !== pb) return pa - pb;
        return b.lastActivityAt.localeCompare(a.lastActivityAt);
      })
      .slice(0, 5);

    const ticketResults: PendingActionsSummary["openTickets"] = [];
    for (const t of allTickets) {
      const u = await getUser(t.authorId);
      ticketResults.push({
        id: t._id,
        title: t.title,
        priority: t.priority,
        authorName: u?.name ?? "Karyawan",
        lastActivityAt: t.lastActivityAt,
      });
    }

    const suggestionResults: PendingActionsSummary["newSuggestions"] =
      newSuggestions.map((s) => ({
        id: s._id,
        title: s.title,
        category: s.category,
        upvoteCount: s.upvoteCount,
      }));

    return {
      pendingLeave,
      openTickets: ticketResults,
      newSuggestions: suggestionResults,
    };
  },
});
