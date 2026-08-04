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
import { requireTenant, assertSameTenant } from "./lib/tenant";

export type SuggestionListItem = Doc<"suggestions"> & {
  authorName: string | null;
  authorAvatar: string | null;
  hasVoted: boolean;
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

async function enrichSuggestions(
  ctx: QueryCtx,
  currentUserId: Id<"users">,
  suggestions: Array<Doc<"suggestions">>,
  isAdmin: boolean,
): Promise<Array<SuggestionListItem>> {
  const authorCache = new Map<Id<"users">, Doc<"users"> | null>();
  const results: Array<SuggestionListItem> = [];

  for (const s of suggestions) {
    // Check if current user has voted
    const vote = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_user_and_suggestion", (q) =>
        q.eq("userId", currentUserId).eq("suggestionId", s._id),
      )
      .unique();

    // Hide author info if anonymous (except to author themselves or admins)
    const canSeeAuthor =
      !s.isAnonymous || s.authorId === currentUserId || isAdmin;

    let authorName: string | null = null;
    let authorAvatar: string | null = null;

    if (canSeeAuthor) {
      let author = authorCache.get(s.authorId);
      if (author === undefined) {
        author = await ctx.db.get(s.authorId);
        authorCache.set(s.authorId, author);
      }
      authorName = author?.name ?? null;
      authorAvatar = author?.avatarUrl ?? null;
    }

    results.push({
      ...s,
      authorName,
      authorAvatar,
      hasVoted: vote !== null,
    });
  }

  return results;
}

export const listSuggestions = query({
  args: {
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    sortBy: v.optional(v.string()), // "recent" | "popular"
  },
  handler: async (ctx, args): Promise<Array<SuggestionListItem>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const isAdmin = isAdminRole(user.role);

    let suggestions: Array<Doc<"suggestions">>;

    if (args.status && args.status !== "all") {
      suggestions = await ctx.db
        .query("suggestions")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .collect();
    } else if (args.category && args.category !== "all") {
      suggestions = await ctx.db
        .query("suggestions")
        .withIndex("by_category", (q) =>
          q.eq("category", args.category as string),
        )
        .collect();
    } else {
      suggestions = await ctx.db.query("suggestions").collect();
    }

    // Apply secondary filter in-memory
    if (args.status && args.status !== "all" && args.category && args.category !== "all") {
      suggestions = suggestions.filter((s) => s.category === args.category);
    }

    // Multi-tenant isolation: filter to the effective org (also for a super
    // admin viewing one org). Null org (super admin viewing all) shows everything.
    if (organizationId !== null) {
      suggestions = suggestions.filter((s) => s.organizationId === organizationId);
    }

    // Sort
    const sortBy = args.sortBy ?? "recent";
    if (sortBy === "popular") {
      suggestions.sort((a, b) => {
        if (b.upvoteCount !== a.upvoteCount) {
          return b.upvoteCount - a.upvoteCount;
        }
        return b._creationTime - a._creationTime;
      });
    } else {
      suggestions.sort((a, b) => b._creationTime - a._creationTime);
    }

    suggestions = suggestions.slice(0, 200);

    return await enrichSuggestions(ctx, user._id, suggestions, isAdmin);
  },
});

export const getSuggestion = query({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, args): Promise<SuggestionListItem | null> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const isAdmin = isAdminRole(user.role);
    const s = await ctx.db.get(args.suggestionId);
    if (!s) return null;
    assertSameTenant(organizationId, s.organizationId, "suggestion");

    const vote = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_user_and_suggestion", (q) =>
        q.eq("userId", user._id).eq("suggestionId", s._id),
      )
      .unique();

    const canSeeAuthor =
      !s.isAnonymous || s.authorId === user._id || isAdmin;

    let authorName: string | null = null;
    let authorAvatar: string | null = null;

    if (canSeeAuthor) {
      const author = await ctx.db.get(s.authorId);
      authorName = author?.name ?? null;
      authorAvatar = author?.avatarUrl ?? null;
    }

    return {
      ...s,
      authorName,
      authorAvatar,
      hasVoted: vote !== null,
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    total: number;
    new: number;
    reviewing: number;
    accepted: number;
    implemented: number;
    rejected: number;
  }> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    let all = await ctx.db.query("suggestions").collect();

    // Multi-tenant isolation: filter to the effective org (also for a super
    // admin viewing one org). Null org (super admin viewing all) shows everything.
    if (organizationId !== null) {
      all = all.filter((s) => s.organizationId === organizationId);
    }

    const stats = {
      total: all.length,
      new: 0,
      reviewing: 0,
      accepted: 0,
      implemented: 0,
      rejected: 0,
    };
    for (const s of all) {
      if (s.status === "new") stats.new++;
      else if (s.status === "reviewing") stats.reviewing++;
      else if (s.status === "accepted") stats.accepted++;
      else if (s.status === "implemented") stats.implemented++;
      else if (s.status === "rejected") stats.rejected++;
    }
    return stats;
  },
});

export const createSuggestion = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
    isAnonymous: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"suggestions">> => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    const content = args.content.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul saran wajib diisi",
      });
    }
    if (content.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Isi saran wajib diisi",
      });
    }
    if (!user.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User is not assigned to any organization",
      });
    }
    return await ctx.db.insert("suggestions", {
      title,
      content,
      category: args.category,
      authorId: user._id,
      organizationId: user.organizationId,
      isAnonymous: args.isAnonymous,
      status: "new",
      upvoteCount: 0,
    });
  },
});

export const toggleVote = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, args): Promise<{ voted: boolean }> => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Saran tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, suggestion.organizationId, "suggestion");
    const existing = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_user_and_suggestion", (q) =>
        q.eq("userId", user._id).eq("suggestionId", args.suggestionId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.suggestionId, {
        upvoteCount: Math.max(0, suggestion.upvoteCount - 1),
      });
      return { voted: false };
    }
    await ctx.db.insert("suggestionVotes", {
      suggestionId: args.suggestionId,
      userId: user._id,
    });
    await ctx.db.patch(args.suggestionId, {
      upvoteCount: suggestion.upvoteCount + 1,
    });
    return { voted: true };
  },
});

export const respondToSuggestion = mutation({
  args: {
    suggestionId: v.id("suggestions"),
    status: v.string(),
    response: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat merespons saran",
      });
    }
    const validStatuses = [
      "new",
      "reviewing",
      "accepted",
      "rejected",
      "implemented",
    ];
    if (!validStatuses.includes(args.status)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Saran tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, suggestion.organizationId, "suggestion");
    const response = args.response?.trim();
    await ctx.db.patch(args.suggestionId, {
      status: args.status,
      adminResponse: response && response.length > 0 ? response : undefined,
      respondedAt: new Date().toISOString(),
      respondedBy: user._id,
    });

    // Notify the suggestion author about the admin response
    const statusLabel: Record<string, string> = {
      new: "Baru",
      reviewing: "Sedang Ditinjau",
      accepted: "Diterima",
      rejected: "Ditolak",
      implemented: "Diimplementasikan",
    };
    await notifyUser(ctx, {
      userId: suggestion.authorId,
      type: "suggestion_response",
      title: "Tanggapan untuk saran Anda",
      message: `"${suggestion.title}" → ${statusLabel[args.status] ?? args.status}`,
      link: "/suggestions",
      actorId: user._id,
    });

    return null;
  },
});

export const removeSuggestion = mutation({
  args: { suggestionId: v.id("suggestions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Saran tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, suggestion.organizationId, "suggestion");
    if (suggestion.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus saran ini",
      });
    }
    // Delete votes first
    const votes = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_suggestion", (q) =>
        q.eq("suggestionId", args.suggestionId),
      )
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }
    await ctx.db.delete(args.suggestionId);
    return null;
  },
});
