import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant, assertSameTenant } from "./lib/tenant";

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

export type SpaceWithStats = Doc<"wikiSpaces">;

export type ArticlePreview = {
  _id: Id<"wikiArticles">;
  _creationTime: number;
  spaceId: Id<"wikiSpaces">;
  title: string;
  summary: string | null;
  tags: Array<string>;
  status: string;
  viewCount: number;
  lastEditedAt: string;
  authorId: Id<"users">;
  authorName: string | null;
  authorAvatar: string | null;
  spaceName: string | null;
  spaceIcon: string | null;
  spaceColor: string | null;
};

export type ArticleDetail = Doc<"wikiArticles"> & {
  author: {
    _id: Id<"users">;
    name: string | null;
    avatarUrl: string | null;
    jobTitle: string | null;
  } | null;
  lastEditor: {
    _id: Id<"users">;
    name: string | null;
  } | null;
  space: Doc<"wikiSpaces"> | null;
};

async function enrichArticle(
  ctx: QueryCtx,
  article: Doc<"wikiArticles">,
  spaceCache: Map<Id<"wikiSpaces">, Doc<"wikiSpaces"> | null>,
  userCache: Map<Id<"users">, Doc<"users"> | null>,
): Promise<ArticlePreview> {
  let space = spaceCache.get(article.spaceId);
  if (space === undefined) {
    space = await ctx.db.get(article.spaceId);
    spaceCache.set(article.spaceId, space);
  }
  let author = userCache.get(article.authorId);
  if (author === undefined) {
    author = await ctx.db.get(article.authorId);
    userCache.set(article.authorId, author);
  }
  return {
    _id: article._id,
    _creationTime: article._creationTime,
    spaceId: article.spaceId,
    title: article.title,
    summary: article.summary ?? null,
    tags: article.tags,
    status: article.status,
    viewCount: article.viewCount,
    lastEditedAt: article.lastEditedAt,
    authorId: article.authorId,
    authorName: author?.name ?? null,
    authorAvatar: author?.avatarUrl ?? null,
    spaceName: space?.name ?? null,
    spaceIcon: space?.icon ?? null,
    spaceColor: space?.color ?? null,
  };
}

/** List all wiki spaces ordered by name */
export const listSpaces = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"wikiSpaces">>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    let spaces = await ctx.db.query("wikiSpaces").collect();
    if (organizationId) {
      spaces = spaces.filter((s) => s.organizationId === organizationId);
    }
    return spaces.sort((a, b) =>
      a.name.localeCompare(b.name, "id", { sensitivity: "base" }),
    );
  },
});

/** Get a space by id */
export const getSpace = query({
  args: { spaceId: v.id("wikiSpaces") },
  handler: async (ctx, args): Promise<Doc<"wikiSpaces"> | null> => {
    await requireUser(ctx);
    return await ctx.db.get(args.spaceId);
  },
});

/**
 * Search + list articles. If `search` is provided, use search index; else
 * filter by space. Always returns published articles unless `includeDrafts`
 * is true and the user is the author.
 */
export const listArticles = query({
  args: {
    spaceId: v.optional(v.id("wikiSpaces")),
    search: v.optional(v.string()),
    tag: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<ArticlePreview>> => {
    const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    // Fetch full user doc for draft filtering (requireTenant guarantees user exists)
    const me = await ctx.db.get(userId);
    const limit = Math.min(args.limit ?? 100, 200);
    const searchTerm = args.search?.trim() ?? "";

    let articles: Array<Doc<"wikiArticles">>;
    if (searchTerm.length > 0) {
      articles = await ctx.db
        .query("wikiArticles")
        .withSearchIndex("search_title", (q) => {
          const base = q.search("title", searchTerm);
          if (args.spaceId) {
            return base.eq("spaceId", args.spaceId).eq("status", "published");
          }
          return base.eq("status", "published");
        })
        .take(limit);
    } else if (args.spaceId) {
      articles = await ctx.db
        .query("wikiArticles")
        .withIndex("by_space_and_status", (q) =>
          q.eq("spaceId", args.spaceId as Id<"wikiSpaces">).eq("status", "published"),
        )
        .order("desc")
        .take(limit);
    } else {
      // No filter – show latest published across all spaces
      const all = await ctx.db
        .query("wikiArticles")
        .withIndex("by_last_edited")
        .order("desc")
        .take(limit * 2);
      articles = all.filter((a) => a.status === "published").slice(0, limit);
    }

    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      articles = articles.filter((a) => a.organizationId === organizationId);
    }

    // Optional tag filtering happens in memory
    if (args.tag && args.tag.length > 0) {
      const tagLower = args.tag.toLowerCase();
      articles = articles.filter((a) =>
        a.tags.some((t) => t.toLowerCase() === tagLower),
      );
    }

    // Include my drafts alongside published when listing by space
    if (args.spaceId && searchTerm.length === 0 && me) {
      const myDrafts = await ctx.db
        .query("wikiArticles")
        .withIndex("by_space_and_status", (q) =>
          q.eq("spaceId", args.spaceId as Id<"wikiSpaces">).eq("status", "draft"),
        )
        .take(50);
      const mine = myDrafts.filter((a) => a.authorId === me._id);
      articles = [...mine, ...articles];
    }

    const spaceCache = new Map<Id<"wikiSpaces">, Doc<"wikiSpaces"> | null>();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<ArticlePreview> = [];
    for (const a of articles) {
      results.push(await enrichArticle(ctx, a, spaceCache, userCache));
    }
    return results;
  },
});

/** Recent published articles across all spaces – used for homepage. */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<ArticlePreview>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const limit = Math.min(args.limit ?? 8, 20);
    const all = await ctx.db
      .query("wikiArticles")
      .withIndex("by_last_edited")
      .order("desc")
      .take(limit * 3);
    let published = all.filter((a) => a.status === "published");
    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      published = published.filter((a) => a.organizationId === organizationId);
    }
    published = published.slice(0, limit);
    const spaceCache = new Map<Id<"wikiSpaces">, Doc<"wikiSpaces"> | null>();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<ArticlePreview> = [];
    for (const a of published) {
      results.push(await enrichArticle(ctx, a, spaceCache, userCache));
    }
    return results;
  },
});

/** Popular articles (by view count). */
export const listPopular = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<ArticlePreview>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const limit = Math.min(args.limit ?? 5, 20);
    // Scan recent published articles then sort by views (bounded by index)
    const all = await ctx.db
      .query("wikiArticles")
      .withIndex("by_last_edited")
      .order("desc")
      .take(100);
    let published = all.filter((a) => a.status === "published");
    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      published = published.filter((a) => a.organizationId === organizationId);
    }
    published.sort((a, b) => b.viewCount - a.viewCount);
    const spaceCache = new Map<Id<"wikiSpaces">, Doc<"wikiSpaces"> | null>();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<ArticlePreview> = [];
    for (const a of published.slice(0, limit)) {
      results.push(await enrichArticle(ctx, a, spaceCache, userCache));
    }
    return results;
  },
});

/** All unique tags (sorted alphabetically). */
export const listTags = query({
  args: {},
  handler: async (ctx): Promise<Array<string>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    let articles = await ctx.db.query("wikiArticles").collect();
    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      articles = articles.filter((a) => a.organizationId === organizationId);
    }
    const set = new Set<string>();
    for (const a of articles) {
      if (a.status !== "published") continue;
      for (const t of a.tags) {
        if (t.trim().length > 0) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  },
});

/** Get a single article with author + space info. */
export const getArticle = query({
  args: { articleId: v.id("wikiArticles") },
  handler: async (ctx, args): Promise<ArticleDetail | null> => {
    await requireUser(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;
    const author = await ctx.db.get(article.authorId);
    const lastEditor = article.lastEditorId
      ? await ctx.db.get(article.lastEditorId)
      : null;
    const space = await ctx.db.get(article.spaceId);
    return {
      ...article,
      author: author
        ? {
            _id: author._id,
            name: author.name ?? null,
            avatarUrl: author.avatarUrl ?? null,
            jobTitle: author.jobTitle ?? null,
          }
        : null,
      lastEditor: lastEditor
        ? { _id: lastEditor._id, name: lastEditor.name ?? null }
        : null,
      space,
    };
  },
});

/** Create a new space. */
export const createSpace = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"wikiSpaces">> => {
    const me = await requireUser(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama space wajib diisi",
      });
    }
    if (name.length > 80) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama space terlalu panjang",
      });
    }
    return await ctx.db.insert("wikiSpaces", {
      name,
      description: args.description?.trim() || undefined,
      icon: args.icon.trim().slice(0, 4) || "📘",
      color: args.color || "blue",
      authorId: me._id,
      articleCount: 0,
      organizationId: me.organizationId,
    });
  },
});

/** Update a space (author or admin). */
export const updateSpace = mutation({
  args: {
    spaceId: v.id("wikiSpaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Space tidak ditemukan",
      });
    }
    if (space.organizationId) {
      assertSameTenant(me.organizationId ?? null, space.organizationId, "wiki space");
    }
    if (space.authorId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak boleh mengubah space ini",
      });
    }
    const patch: Partial<Doc<"wikiSpaces">> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.icon !== undefined) patch.icon = args.icon.trim().slice(0, 4) || "📘";
    if (args.color !== undefined) patch.color = args.color;
    await ctx.db.patch(args.spaceId, patch);
    return null;
  },
});

/** Delete a space (author or admin) + all its articles. */
export const deleteSpace = mutation({
  args: { spaceId: v.id("wikiSpaces") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (!space) return null;
    if (space.organizationId) {
      assertSameTenant(me.organizationId ?? null, space.organizationId, "wiki space");
    }
    if (space.authorId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak boleh menghapus space ini",
      });
    }
    const articles = await ctx.db
      .query("wikiArticles")
      .withIndex("by_space", (q) => q.eq("spaceId", args.spaceId))
      .collect();
    for (const a of articles) {
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(args.spaceId);
    return null;
  },
});

/** Create a new article. */
export const createArticle = mutation({
  args: {
    spaceId: v.id("wikiSpaces"),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.string(), // "draft" | "published"
  },
  handler: async (ctx, args): Promise<Id<"wikiArticles">> => {
    const me = await requireUser(ctx);
    const space = await ctx.db.get(args.spaceId);
    if (!space) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Space tidak ditemukan",
      });
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    if (title.length > 200) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul terlalu panjang",
      });
    }
    if (args.status !== "draft" && args.status !== "published") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const normalizedTags = Array.from(
      new Set(
        args.tags
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0 && t.length <= 24),
      ),
    ).slice(0, 10);
    const now = new Date().toISOString();
    const articleId = await ctx.db.insert("wikiArticles", {
      spaceId: args.spaceId,
      title,
      content: args.content,
      summary: args.summary?.trim() || undefined,
      tags: normalizedTags,
      authorId: me._id,
      lastEditorId: me._id,
      lastEditedAt: now,
      viewCount: 0,
      status: args.status,
      organizationId: me.organizationId,
    });

    if (args.status === "published") {
      await ctx.db.patch(args.spaceId, {
        articleCount: space.articleCount + 1,
      });
    }
    return articleId;
  },
});

/** Update an article (author or admin). */
export const updateArticle = mutation({
  args: {
    articleId: v.id("wikiArticles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
    spaceId: v.optional(v.id("wikiSpaces")),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Artikel tidak ditemukan",
      });
    }
    if (article.organizationId) {
      assertSameTenant(me.organizationId ?? null, article.organizationId, "wiki article");
    }
    if (article.authorId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak boleh mengubah artikel ini",
      });
    }
    const patch: Partial<Doc<"wikiArticles">> = {
      lastEditorId: me._id,
      lastEditedAt: new Date().toISOString(),
    };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.content !== undefined) patch.content = args.content;
    if (args.summary !== undefined)
      patch.summary = args.summary.trim() || undefined;
    if (args.tags !== undefined) {
      patch.tags = Array.from(
        new Set(
          args.tags
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0 && t.length <= 24),
        ),
      ).slice(0, 10);
    }
    const prevStatus = article.status;
    let nextStatus = prevStatus;
    if (args.status !== undefined) {
      if (args.status !== "draft" && args.status !== "published") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Status tidak valid",
        });
      }
      patch.status = args.status;
      nextStatus = args.status;
    }
    // Allow moving to a different space
    let prevSpaceId = article.spaceId;
    let nextSpaceId = article.spaceId;
    if (args.spaceId !== undefined && args.spaceId !== article.spaceId) {
      const target = await ctx.db.get(args.spaceId);
      if (!target) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Space tujuan tidak ditemukan",
        });
      }
      patch.spaceId = args.spaceId;
      nextSpaceId = args.spaceId;
    }
    await ctx.db.patch(args.articleId, patch);

    // Adjust article counts for status/space transitions
    const wasPublished = prevStatus === "published";
    const isPublished = nextStatus === "published";
    const spaceChanged = prevSpaceId !== nextSpaceId;

    if (wasPublished && (!isPublished || spaceChanged)) {
      const prev = await ctx.db.get(prevSpaceId);
      if (prev) {
        await ctx.db.patch(prevSpaceId, {
          articleCount: Math.max(0, prev.articleCount - 1),
        });
      }
    }
    if (isPublished && (!wasPublished || spaceChanged)) {
      const nextSpace = await ctx.db.get(nextSpaceId);
      if (nextSpace) {
        await ctx.db.patch(nextSpaceId, {
          articleCount: nextSpace.articleCount + 1,
        });
      }
    }
    return null;
  },
});

/** Delete an article (author or admin). */
export const deleteArticle = mutation({
  args: { articleId: v.id("wikiArticles") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;
    if (article.organizationId) {
      assertSameTenant(me.organizationId ?? null, article.organizationId, "wiki article");
    }
    if (article.authorId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak boleh menghapus artikel ini",
      });
    }
    if (article.status === "published") {
      const space = await ctx.db.get(article.spaceId);
      if (space) {
        await ctx.db.patch(article.spaceId, {
          articleCount: Math.max(0, space.articleCount - 1),
        });
      }
    }
    await ctx.db.delete(args.articleId);
    return null;
  },
});

/** Increment view count. Called when an article page opens. */
export const incrementViewCount = mutation({
  args: { articleId: v.id("wikiArticles") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;
    if (article.organizationId) {
      assertSameTenant(me.organizationId ?? null, article.organizationId, "wiki article");
    }
    await ctx.db.patch(args.articleId, {
      viewCount: article.viewCount + 1,
    });
    return null;
  },
});

/** High-level stats for the wiki homepage. */
export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    spaceCount: number;
    articleCount: number;
    contributorCount: number;
    totalViews: number;
  }> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    let spaces = await ctx.db.query("wikiSpaces").collect();
    let articles = await ctx.db.query("wikiArticles").collect();
    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      spaces = spaces.filter((s) => s.organizationId === organizationId);
      articles = articles.filter((a) => a.organizationId === organizationId);
    }
    const published = articles.filter((a) => a.status === "published");
    const authors = new Set<string>();
    let totalViews = 0;
    for (const a of published) {
      authors.add(a.authorId);
      totalViews += a.viewCount;
    }
    return {
      spaceCount: spaces.length,
      articleCount: published.length,
      contributorCount: authors.size,
      totalViews,
    };
  },
});
