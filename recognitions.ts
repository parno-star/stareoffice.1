import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

export type RecognitionListItem = Doc<"recognitions"> & {
  fromUserName: string | null;
  fromUserAvatar: string | null;
  fromUserJobTitle: string | null;
  toUserName: string | null;
  toUserAvatar: string | null;
  toUserJobTitle: string | null;
  hasReacted: boolean;
};

export type LeaderboardEntry = {
  userId: Id<"users">;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  receivedCount: number;
};

async function requireUserTenant(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { userId, organizationId } = await requireTenant(ctx);
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { user, organizationId };
}

/** Filter recognitions to those belonging to the caller's org.
 *  Super admins (organizationId === null) see everything.
 *  Legacy records with no organizationId are visible to all tenants. */
function filterByOrg<T extends { organizationId?: Id<"organizations"> }>(
  rows: T[],
  organizationId: Id<"organizations"> | null,
): T[] {
  if (organizationId === null) return rows;
  return rows.filter(
    (r) => !r.organizationId || r.organizationId === organizationId,
  );
}

async function enrichRecognitions(
  ctx: QueryCtx,
  currentUserId: Id<"users">,
  items: Array<Doc<"recognitions">>,
): Promise<Array<RecognitionListItem>> {
  const cache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    let cached = cache.get(id);
    if (cached === undefined) {
      cached = await ctx.db.get(id);
      cache.set(id, cached);
    }
    return cached;
  };

  const results: Array<RecognitionListItem> = [];
  for (const r of items) {
    const fromUser = await getUser(r.fromUserId);
    const toUser = await getUser(r.toUserId);
    const reaction = await ctx.db
      .query("recognitionReactions")
      .withIndex("by_user_and_recognition", (q) =>
        q.eq("userId", currentUserId).eq("recognitionId", r._id),
      )
      .unique();

    results.push({
      ...r,
      fromUserName: fromUser?.name ?? null,
      fromUserAvatar: fromUser?.avatarUrl ?? null,
      fromUserJobTitle: fromUser?.jobTitle ?? null,
      toUserName: toUser?.name ?? null,
      toUserAvatar: toUser?.avatarUrl ?? null,
      toUserJobTitle: toUser?.jobTitle ?? null,
      hasReacted: reaction !== null,
    });
  }
  return results;
}

export const listRecognitions = query({
  args: {
    category: v.optional(v.string()),
    toUserId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<RecognitionListItem>> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    let items: Array<Doc<"recognitions">>;
    if (args.toUserId) {
      items = await ctx.db
        .query("recognitions")
        .withIndex("by_to_user", (q) => q.eq("toUserId", args.toUserId!))
        .order("desc")
        .take(limit);
    } else {
      items = await ctx.db
        .query("recognitions")
        .order("desc")
        .take(limit * 2);
    }

    items = filterByOrg(items, organizationId);

    if (args.category && args.category !== "all") {
      items = items.filter((r) => r.category === args.category);
    }
    items = items.slice(0, limit);
    return await enrichRecognitions(ctx, user._id, items);
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    total: number;
    thisMonth: number;
    givenByMe: number;
    receivedByMe: number;
  }> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const allRows = await ctx.db.query("recognitions").collect();
    const all = filterByOrg(allRows, organizationId);
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).getTime();

    let thisMonth = 0;
    let givenByMe = 0;
    let receivedByMe = 0;
    for (const r of all) {
      if (r._creationTime >= startOfMonth) thisMonth++;
      if (r.fromUserId === user._id) givenByMe++;
      if (r.toUserId === user._id) receivedByMe++;
    }
    return { total: all.length, thisMonth, givenByMe, receivedByMe };
  },
});

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<LeaderboardEntry>> => {
    const { organizationId } = await requireUserTenant(ctx);
    const limit = Math.min(args.limit ?? 10, 50);

    const allRows = await ctx.db.query("recognitions").collect();
    const all = filterByOrg(allRows, organizationId);
    const counts = new Map<Id<"users">, number>();
    for (const r of all) {
      counts.set(r.toUserId, (counts.get(r.toUserId) ?? 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const results: Array<LeaderboardEntry> = [];
    for (const [userId, count] of sorted) {
      const u = await ctx.db.get(userId);
      if (!u) continue;
      results.push({
        userId,
        name: u.name ?? "Karyawan",
        avatarUrl: u.avatarUrl ?? null,
        jobTitle: u.jobTitle ?? null,
        department: u.department ?? null,
        receivedCount: count,
      });
    }
    return results;
  },
});

export const createRecognition = mutation({
  args: {
    toUserId: v.id("users"),
    category: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"recognitions">> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const message = args.message.trim();
    if (message.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pesan apresiasi wajib diisi",
      });
    }
    if (args.toUserId === user._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda tidak dapat memberi apresiasi untuk diri sendiri",
      });
    }
    const recipient = await ctx.db.get(args.toUserId);
    if (!recipient) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penerima tidak ditemukan",
      });
    }
    const validCategories = [
      "teamwork",
      "innovation",
      "leadership",
      "excellence",
      "helpfulness",
    ];
    if (!validCategories.includes(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    const recognitionId = await ctx.db.insert("recognitions", {
      fromUserId: user._id,
      toUserId: args.toUserId,
      category: args.category,
      message,
      reactionCount: 0,
      organizationId: organizationId ?? undefined,
    });

    // Notify the recipient
    await notifyUser(ctx, {
      userId: args.toUserId,
      type: "recognition_received",
      title: "Anda menerima apresiasi",
      message: `${user.name ?? "Seorang rekan"} memberi apresiasi untuk Anda`,
      link: "/recognitions",
      actorId: user._id,
    });

    return recognitionId;
  },
});

export const toggleReaction = mutation({
  args: { recognitionId: v.id("recognitions") },
  handler: async (ctx, args): Promise<{ reacted: boolean }> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const recognition = await ctx.db.get(args.recognitionId);
    if (!recognition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Apresiasi tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("recognitionReactions")
      .withIndex("by_user_and_recognition", (q) =>
        q.eq("userId", user._id).eq("recognitionId", args.recognitionId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.recognitionId, {
        reactionCount: Math.max(0, recognition.reactionCount - 1),
      });
      return { reacted: false };
    }
    await ctx.db.insert("recognitionReactions", {
      recognitionId: args.recognitionId,
      userId: user._id,
      organizationId: organizationId ?? undefined,
    });
    await ctx.db.patch(args.recognitionId, {
      reactionCount: recognition.reactionCount + 1,
    });
    return { reacted: true };
  },
});

export const removeRecognition = mutation({
  args: { recognitionId: v.id("recognitions") },
  handler: async (ctx, args) => {
    const { user } = await requireUserTenant(ctx);
    const recognition = await ctx.db.get(args.recognitionId);
    if (!recognition) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Apresiasi tidak ditemukan",
      });
    }
    if (recognition.fromUserId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus apresiasi ini",
      });
    }
    const reactions = await ctx.db
      .query("recognitionReactions")
      .withIndex("by_recognition", (q) =>
        q.eq("recognitionId", args.recognitionId),
      )
      .collect();
    for (const r of reactions) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.recognitionId);
    return null;
  },
});
