import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

export type NotificationWithActor = Doc<"notifications"> & {
  actorName: string | null;
  actorAvatar: string | null;
};

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
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
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

/**
 * Insert a single notification. Skips self-notifications (when actor === recipient).
 * Stamps organizationId from the recipient user's org for tenant isolation.
 * Safe to call from other mutations – errors are not swallowed so upstream sees issues.
 */
export async function notifyUser(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    type: string;
    title: string;
    message: string;
    link?: string;
    actorId?: Id<"users">;
  },
): Promise<Id<"notifications"> | null> {
  // Don't notify yourself about your own actions
  if (args.actorId && args.actorId === args.userId) return null;

  // Resolve recipient's org so the notification is tenant-scoped
  const recipient = await ctx.db.get(args.userId);
  const organizationId = recipient?.organizationId;

  return await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    message: args.message,
    link: args.link,
    actorId: args.actorId,
    ...(organizationId ? { organizationId } : {}),
  });
}

/**
 * Broadcast a notification to all users within the actor's organization
 * (or all users if actor has no org, e.g. super_admin platform broadcasts).
 */
export async function notifyAllUsers(
  ctx: MutationCtx,
  args: {
    type: string;
    title: string;
    message: string;
    link?: string;
    actorId?: Id<"users">;
  },
): Promise<number> {
  // Determine actor org to scope the broadcast
  let actorOrgId: Id<"organizations"> | undefined;
  if (args.actorId) {
    const actor = await ctx.db.get(args.actorId);
    actorOrgId = actor?.organizationId;
  }

  const users = await ctx.db.query("users").collect();
  let count = 0;
  for (const u of users) {
    if (args.actorId && u._id === args.actorId) continue;
    // Only notify users in the same org (skip cross-org if org is known)
    if (actorOrgId && u.organizationId !== actorOrgId) continue;
    await ctx.db.insert("notifications", {
      userId: u._id,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      actorId: args.actorId,
      ...(u.organizationId ? { organizationId: u.organizationId } : {}),
    });
    count += 1;
  }
  return count;
}

/**
 * Notify all admins within the same organization as the actor.
 * Looks up the actor's org from their user record to enforce tenant isolation.
 */
export async function notifyAdmins(
  ctx: MutationCtx,
  args: {
    type: string;
    title: string;
    message: string;
    link?: string;
    actorId?: Id<"users">;
  },
): Promise<number> {
  // Resolve actor's organization so we only notify admins in the same org
  let actorOrgId: Id<"organizations"> | undefined;
  if (args.actorId) {
    const actor = await ctx.db.get(args.actorId);
    actorOrgId = actor?.organizationId;
  }

  const users = await ctx.db.query("users").collect();
  let count = 0;
  for (const u of users) {
    if (!isAdminRole(u.role)) continue;
    if (args.actorId && u._id === args.actorId) continue;
    // Only notify admins that belong to the same organization as the actor
    if (actorOrgId && u.organizationId !== actorOrgId) continue;
    await ctx.db.insert("notifications", {
      userId: u._id,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      actorId: args.actorId,
      ...(u.organizationId ? { organizationId: u.organizationId } : {}),
    });
    count += 1;
  }
  return count;
}

/**
 * Notify all platform super admins, regardless of organization.
 * Used as a fallback so tickets are never left unattended when an
 * organization has no admin of its own.
 */
export async function notifySuperAdmins(
  ctx: MutationCtx,
  args: {
    type: string;
    title: string;
    message: string;
    link?: string;
    actorId?: Id<"users">;
  },
): Promise<number> {
  const users = await ctx.db.query("users").collect();
  let count = 0;
  for (const u of users) {
    if (!isSuperAdminRole(u.role)) continue;
    if (args.actorId && u._id === args.actorId) continue;
    await ctx.db.insert("notifications", {
      userId: u._id,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      actorId: args.actorId,
      ...(u.organizationId ? { organizationId: u.organizationId } : {}),
    });
    count += 1;
  }
  return count;
}

/**
 * Notify all profile-change reviewers (HR managers + admins) within a given
 * organization. Used when an employee submits a profile change request so the
 * right people are alerted to review it.
 */
export async function notifyProfileReviewers(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    type: string;
    title: string;
    message: string;
    link?: string;
    actorId?: Id<"users">;
  },
): Promise<number> {
  const reviewerRoles = ["super_admin", "admin", "hr_manager"];
  const orgUsers = await ctx.db
    .query("users")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", args.organizationId),
    )
    .collect();
  let count = 0;
  for (const u of orgUsers) {
    if (!reviewerRoles.includes(u.role ?? "")) continue;
    if (args.actorId && u._id === args.actorId) continue;
    await ctx.db.insert("notifications", {
      userId: u._id,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      actorId: args.actorId,
      organizationId: args.organizationId,
    });
    count += 1;
  }
  return count;
}

export const listMine = query({
  args: {
    filter: v.optional(v.string()), // "all" | "unread"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<NotificationWithActor>> => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    // Already user-scoped via the by_user index — no extra tenant filter needed
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    const filtered =
      args.filter === "unread"
        ? notifications.filter((n) => !n.readAt)
        : notifications;

    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<NotificationWithActor> = [];
    for (const n of filtered) {
      let actor: Doc<"users"> | null = null;
      if (n.actorId) {
        const cached = cache.get(n.actorId);
        if (cached === undefined) {
          actor = await ctx.db.get(n.actorId);
          cache.set(n.actorId, actor);
        } else {
          actor = cached;
        }
      }
      results.push({
        ...n,
        actorName: actor?.name ?? null,
        actorAvatar: actor?.avatarUrl ?? null,
      });
    }
    return results;
  },
});

export const getUnreadCount = query({
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

    // Already user-scoped via the by_user index — no extra tenant filter needed
    // Take recent 200 to bound work; sufficient for badge counting
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);
    return recent.filter((n) => !n.readAt).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const n = await ctx.db.get(args.id);
    if (!n) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Notifikasi tidak ditemukan",
      });
    }
    if (n.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan notifikasi Anda",
      });
    }
    if (!n.readAt) {
      await ctx.db.patch(args.id, { readAt: new Date().toISOString() });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(500);
    const now = new Date().toISOString();
    let count = 0;
    for (const n of unread) {
      if (!n.readAt) {
        await ctx.db.patch(n._id, { readAt: now });
        count += 1;
      }
    }
    return { count };
  },
});

export const remove = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const n = await ctx.db.get(args.id);
    if (!n) return null;
    if (n.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan notifikasi Anda",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);
    for (const n of all) {
      await ctx.db.delete(n._id);
    }
    return { count: all.length };
  },
});

// Mark a specific set of the user's own notifications as read.
export const bulkMarkRead = mutation({
  args: { ids: v.array(v.id("notifications")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (args.ids.length > 200) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 200 notifikasi per aksi",
      });
    }
    const now = new Date().toISOString();
    let count = 0;
    for (const id of args.ids) {
      const n = await ctx.db.get(id);
      if (!n || n.userId !== user._id) continue;
      if (!n.readAt) {
        await ctx.db.patch(id, { readAt: now });
        count += 1;
      }
    }
    return { count };
  },
});

// Delete a specific set of the user's own notifications.
export const bulkRemove = mutation({
  args: { ids: v.array(v.id("notifications")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (args.ids.length > 200) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 200 notifikasi per aksi",
      });
    }
    let count = 0;
    for (const id of args.ids) {
      const n = await ctx.db.get(id);
      if (!n || n.userId !== user._id) continue;
      await ctx.db.delete(id);
      count += 1;
    }
    return { count };
  },
});
