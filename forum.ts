import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";
import { requireTenant, assertSameTenant } from "./lib/tenant";

export type ThreadListItem = Doc<"forumThreads"> & {
  authorName: string | null;
  authorAvatar: string | null;
};

export type ThreadWithAuthor = ThreadListItem;

export type ReplyWithAuthor = Doc<"forumReplies"> & {
  authorName: string | null;
  authorAvatar: string | null;
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

async function enrichThreads(
  ctx: QueryCtx,
  threads: Array<Doc<"forumThreads">>,
): Promise<Array<ThreadListItem>> {
  const results: Array<ThreadListItem> = [];
  const cache = new Map<Id<"users">, Doc<"users"> | null>();
  for (const t of threads) {
    let author = cache.get(t.authorId);
    if (author === undefined) {
      author = await ctx.db.get(t.authorId);
      cache.set(t.authorId, author);
    }
    results.push({
      ...t,
      authorName: author?.name ?? null,
      authorAvatar: author?.avatarUrl ?? null,
    });
  }
  return results;
}

export const listThreads = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ThreadListItem>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    const searchTerm = args.search?.trim();
    const category = args.category?.trim();

    let threads: Array<Doc<"forumThreads">>;
    if (searchTerm && searchTerm.length > 0) {
      threads = await ctx.db
        .query("forumThreads")
        .withSearchIndex("search_title", (q) => {
          const base = q.search("title", searchTerm);
          if (category && category !== "all") {
            return base.eq("category", category);
          }
          return base;
        })
        .take(100);
    } else if (category && category !== "all") {
      threads = await ctx.db
        .query("forumThreads")
        .withIndex("by_category", (q) => q.eq("category", category))
        .collect();
      threads.sort((a, b) =>
        b.lastActivityAt.localeCompare(a.lastActivityAt),
      );
      threads = threads.slice(0, 100);
    } else {
      threads = await ctx.db
        .query("forumThreads")
        .withIndex("by_last_activity")
        .order("desc")
        .take(100);
    }

    // Multi-tenant isolation: filter to the effective org (also for a super
    // admin viewing one org). Null org (super admin viewing all) shows everything.
    if (organizationId !== null) {
      threads = threads.filter((t) => t.organizationId === organizationId);
    }

    return await enrichThreads(ctx, threads);
  },
});

export const getThread = query({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args): Promise<ThreadWithAuthor | null> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    assertSameTenant(organizationId, thread.organizationId, "thread");
    const author = await ctx.db.get(thread.authorId);
    return {
      ...thread,
      authorName: author?.name ?? null,
      authorAvatar: author?.avatarUrl ?? null,
    };
  },
});

export const listReplies = query({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args): Promise<Array<ReplyWithAuthor>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    // Verify the thread belongs to the caller's org before returning its replies
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];
    assertSameTenant(organizationId, thread.organizationId, "thread");

    const replies = await ctx.db
      .query("forumReplies")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    const results: Array<ReplyWithAuthor> = [];
    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    for (const r of replies) {
      let author = cache.get(r.authorId);
      if (author === undefined) {
        author = await ctx.db.get(r.authorId);
        cache.set(r.authorId, author);
      }
      results.push({
        ...r,
        authorName: author?.name ?? null,
        authorAvatar: author?.avatarUrl ?? null,
      });
    }
    return results;
  },
});

export const createThread = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"forumThreads">> => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    const content = args.content.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul diskusi wajib diisi",
      });
    }
    if (content.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Isi diskusi wajib diisi",
      });
    }
    if (!user.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User is not assigned to any organization",
      });
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("forumThreads", {
      title,
      content,
      category: args.category,
      authorId: user._id,
      organizationId: user.organizationId,
      replyCount: 0,
      lastActivityAt: now,
    });
  },
});

export const createReply = mutation({
  args: {
    threadId: v.id("forumThreads"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"forumReplies">> => {
    const user = await requireUser(ctx);
    const content = args.content.trim();
    if (content.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Balasan tidak boleh kosong",
      });
    }
    if (!user.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User is not assigned to any organization",
      });
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Diskusi tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, thread.organizationId, "thread");
    const replyId = await ctx.db.insert("forumReplies", {
      threadId: args.threadId,
      authorId: user._id,
      organizationId: user.organizationId,
      content,
    });
    await ctx.db.patch(args.threadId, {
      replyCount: thread.replyCount + 1,
      lastActivityAt: new Date().toISOString(),
    });

    // Notify thread author about the new reply
    await notifyUser(ctx, {
      userId: thread.authorId,
      type: "forum_reply",
      title: "Balasan baru di diskusi Anda",
      message: `${user.name ?? "Seseorang"} membalas "${thread.title}"`,
      link: `/forum/${thread._id}`,
      actorId: user._id,
    });

    return replyId;
  },
});

export const removeThread = mutation({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Diskusi tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, thread.organizationId, "thread");
    if (thread.authorId !== user._id && user.role !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus diskusi ini",
      });
    }
    // Delete all replies
    const replies = await ctx.db
      .query("forumReplies")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    for (const r of replies) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.threadId);
    return null;
  },
});

export const removeReply = mutation({
  args: { replyId: v.id("forumReplies") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const reply = await ctx.db.get(args.replyId);
    if (!reply) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Balasan tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, reply.organizationId, "reply");
    if (reply.authorId !== user._id && user.role !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus balasan ini",
      });
    }
    await ctx.db.delete(args.replyId);
    const thread = await ctx.db.get(reply.threadId);
    if (thread) {
      await ctx.db.patch(reply.threadId, {
        replyCount: Math.max(0, thread.replyCount - 1),
      });
    }
    return null;
  },
});
