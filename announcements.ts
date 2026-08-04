import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyAllUsers, notifyUser } from "./notifications";
import { isAdminRole } from "./roles";
import { requireTenant, assertSameTenant } from "./lib/tenant";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

export type EnrichedAnnouncement = Doc<"announcements"> & {
  authorName: string;
  authorDepartment: string;
  authorAvatarUrl: string | null;
  coverImageUrl: string | null;
  isLikedByMe: boolean;
};

export type AnnouncementComment = Doc<"announcementComments"> & {
  authorName: string;
  authorAvatarUrl: string | null;
  authorJobTitle: string | null;
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

async function getOptionalUser(
  ctx: QueryCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  return user;
}

async function enrichAnnouncements(
  ctx: QueryCtx,
  rows: Array<Doc<"announcements">>,
  meId: Id<"users"> | null,
): Promise<Array<EnrichedAnnouncement>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = userCache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  };

  const results: Array<EnrichedAnnouncement> = [];
  for (const a of rows) {
    const author = await getUser(a.authorId);
    const coverImageUrl = a.coverImageStorageId
      ? await ctx.storage.getUrl(a.coverImageStorageId)
      : null;
    let isLikedByMe = false;
    if (meId) {
      const like = await ctx.db
        .query("announcementLikes")
        .withIndex("by_user_and_announcement", (q) =>
          q.eq("userId", meId).eq("announcementId", a._id),
        )
        .unique();
      isLikedByMe = !!like;
    }
    results.push({
      ...a,
      authorName: author?.name ?? "Admin",
      authorDepartment: author?.department ?? "",
      authorAvatarUrl: author?.avatarUrl ?? null,
      coverImageUrl,
      isLikedByMe,
    });
  }
  return results;
}

// Legacy list: used on dashboard. Returns only published announcements.
export const list = query({
  args: {},
  handler: async (ctx): Promise<Array<EnrichedAnnouncement>> => {
    const me = await getOptionalUser(ctx);
    if (!me) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const rows = await ctx.db.query("announcements").order("desc").take(20);

    // Tenant isolation: show only the effective org's announcements. A super
    // admin without an active grant has organizationId === null and sees none.
    const tenantRows =
      organizationId === null
        ? []
        : rows.filter((a) => a.organizationId === organizationId);

    // Hide drafts (not me)
    const visible = tenantRows.filter(
      (a) =>
        (a.status ?? "published") === "published" || a.authorId === me._id,
    );
    // Sort: pinned first, then by publishedAt desc
    visible.sort((a, b) => {
      const pa = a.isPinned ? 1 : 0;
      const pb = b.isPinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
    return enrichAnnouncements(ctx, visible, me._id);
  },
});

// Rich news feed with filters.
export const listNews = query({
  args: {
    category: v.optional(v.string()), // "all" or category key
    priority: v.optional(v.string()), // "all" | "normal" | "important" | "urgent"
    search: v.optional(v.string()),
    includeDrafts: v.optional(v.boolean()), // admins only
  },
  handler: async (ctx, args): Promise<Array<EnrichedAnnouncement>> => {
    const me = await getOptionalUser(ctx);
    if (!me) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const search = args.search?.trim() ?? "";
    let rows: Array<Doc<"announcements">>;
    if (search.length > 0) {
      rows = await ctx.db
        .query("announcements")
        .withSearchIndex("search_title", (q) => q.search("title", search))
        .take(100);
    } else {
      rows = await ctx.db.query("announcements").order("desc").take(200);
    }

    // Tenant isolation: show only the effective org's announcements. A super
    // admin without an active grant has organizationId === null and sees none.
    const tenantRows =
      organizationId === null
        ? []
        : rows.filter((a) => a.organizationId === organizationId);

    const allowDrafts = args.includeDrafts && isAdminRole(me.role);
    let filtered = tenantRows.filter((a) => {
      if (!allowDrafts) {
        const status = a.status ?? "published";
        if (status !== "published" && a.authorId !== me._id) return false;
      }
      if (args.category && args.category !== "all") {
        const cat = a.category ?? "general";
        if (cat !== args.category) return false;
      }
      if (args.priority && args.priority !== "all") {
        if (a.priority !== args.priority) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      const pa = a.isPinned ? 1 : 0;
      const pb = b.isPinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.publishedAt.localeCompare(a.publishedAt);
    });

    return enrichAnnouncements(ctx, filtered, me._id);
  },
});

export const getById = query({
  args: { id: v.id("announcements") },
  handler: async (ctx, args): Promise<EnrichedAnnouncement | null> => {
    const me = await getOptionalUser(ctx);
    if (!me) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const a = await ctx.db.get(args.id);
    if (!a) return null;

    // Tenant isolation: only the effective org may read this announcement. Null
    // org (super admin viewing all) may read any.
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (organizationId !== null && a.organizationId !== organizationId) return null;

    const status = a.status ?? "published";
    if (
      status !== "published" &&
      a.authorId !== me._id &&
      !isAdminRole(me.role)
    ) {
      return null;
    }
    const enriched = await enrichAnnouncements(ctx, [a], me._id);
    return enriched[0] ?? null;
  },
});

export const listComments = query({
  args: { id: v.id("announcements") },
  handler: async (ctx, args): Promise<Array<AnnouncementComment>> => {
    const me = await getOptionalUser(ctx);
    if (!me) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const rows = await ctx.db
      .query("announcementComments")
      .withIndex("by_announcement", (q) => q.eq("announcementId", args.id))
      .order("asc")
      .collect();
    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    const out: Array<AnnouncementComment> = [];
    for (const c of rows) {
      let u = cache.get(c.authorId);
      if (u === undefined) {
        u = await ctx.db.get(c.authorId);
        cache.set(c.authorId, u);
      }
      out.push({
        ...c,
        authorName: u?.name ?? "Karyawan",
        authorAvatarUrl: u?.avatarUrl ?? null,
        authorJobTitle: u?.jobTitle ?? null,
      });
    }
    return out;
  },
});

export type NewsStats = {
  totalPublished: number;
  totalThisMonth: number;
  totalPinned: number;
  totalDrafts: number;
  totalUrgent: number;
};

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<NewsStats> => {
    const me = await getOptionalUser(ctx);
    if (!me) {
      return {
        totalPublished: 0,
        totalThisMonth: 0,
        totalPinned: 0,
        totalDrafts: 0,
        totalUrgent: 0,
      };
    }
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const allRows = await ctx.db.query("announcements").collect();

    // Tenant isolation: count only the effective org's announcements. A super
    // admin without an active grant has organizationId === null and counts none.
    const rows =
      organizationId === null
        ? []
        : allRows.filter((a) => a.organizationId === organizationId);

    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const threshold = now - monthMs;
    const isAdmin = isAdminRole(me.role);
    let totalPublished = 0;
    let totalThisMonth = 0;
    let totalPinned = 0;
    let totalDrafts = 0;
    let totalUrgent = 0;
    for (const a of rows) {
      const status = a.status ?? "published";
      if (status === "published") {
        totalPublished += 1;
        if (a._creationTime >= threshold) totalThisMonth += 1;
        if (a.isPinned) totalPinned += 1;
        if (a.priority === "urgent") totalUrgent += 1;
      } else if (status === "draft") {
        if (isAdmin || a.authorId === me._id) totalDrafts += 1;
      }
    }
    return {
      totalPublished,
      totalThisMonth,
      totalPinned,
      totalDrafts,
      totalUrgent,
    };
  },
});

// Any authenticated user can upload cover via file storage.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    priority: v.string(),
    category: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id("_storage")),
    isPinned: v.optional(v.boolean()),
    status: v.optional(v.string()), // "published" | "draft"
  },
  handler: async (ctx, args): Promise<Id<"announcements">> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Administrator yang dapat membuat berita/pengumuman",
      });
    }
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const status = args.status === "draft" ? "draft" : "published";
    const category = args.category ?? "general";

    // Enforce plan storage limit when a cover image is attached.
    if (args.coverImageStorageId) {
      const incomingBytes = await getStorageSizeBytes(ctx, args.coverImageStorageId);
      await assertStorageWithinLimit(ctx, organizationId, incomingBytes);
    }

    const announcementId = await ctx.db.insert("announcements", {
      title: args.title,
      content: args.content,
      summary: args.summary,
      priority: args.priority,
      category,
      coverImageStorageId: args.coverImageStorageId,
      isPinned: args.isPinned ?? false,
      status,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      authorId: user._id,
      publishedAt: new Date().toISOString(),
      organizationId: organizationId as Id<"organizations">,
    });

    if (args.coverImageStorageId) {
      await trackStorageAdded(ctx, organizationId, args.coverImageStorageId);
    }

    if (status === "published") {
      await notifyAllUsers(ctx, {
        type: "announcement",
        title:
          args.priority === "urgent"
            ? "Pengumuman MENDESAK"
            : "Berita & Pengumuman baru",
        message: args.title,
        link: `/news/${announcementId}`,
        actorId: user._id,
      });
    }

    return announcementId;
  },
});

export const update = mutation({
  args: {
    id: v.id("announcements"),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
    priority: v.string(),
    category: v.optional(v.string()),
    coverImageStorageId: v.optional(v.id("_storage")),
    clearCover: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengumuman tidak ditemukan",
      });
    }

    // Tenant isolation: verify the announcement belongs to caller's org
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (existing.organizationId) {
      assertSameTenant(organizationId, existing.organizationId, "announcement");
    }

    if (!isAdminRole(user.role) && existing.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak dapat mengubah pengumuman ini",
      });
    }

    const wasDraft = (existing.status ?? "published") === "draft";
    const newStatus =
      args.status === "draft"
        ? "draft"
        : args.status === "published"
          ? "published"
          : (existing.status ?? "published");

    const patch: Partial<Doc<"announcements">> = {
      title: args.title,
      content: args.content,
      summary: args.summary,
      priority: args.priority,
      category: args.category ?? existing.category ?? "general",
      isPinned: args.isPinned ?? existing.isPinned ?? false,
      status: newStatus,
    };
    if (args.coverImageStorageId) {
      // Enforce limit + track when adding/replacing a cover image.
      const incomingBytes = await getStorageSizeBytes(ctx, args.coverImageStorageId);
      await assertStorageWithinLimit(ctx, existing.organizationId, incomingBytes);
      // Replacing an existing cover: subtract the old file first.
      if (existing.coverImageStorageId) {
        await trackStorageRemoved(ctx, existing.organizationId, existing.coverImageStorageId);
        try {
          await ctx.storage.delete(existing.coverImageStorageId);
        } catch {
          // ignore – storage may have been removed already
        }
      }
      patch.coverImageStorageId = args.coverImageStorageId;
      await trackStorageAdded(ctx, existing.organizationId, args.coverImageStorageId);
    } else if (args.clearCover) {
      if (existing.coverImageStorageId) {
        await trackStorageRemoved(ctx, existing.organizationId, existing.coverImageStorageId);
        try {
          await ctx.storage.delete(existing.coverImageStorageId);
        } catch {
          // ignore – storage may have been removed already
        }
      }
      patch.coverImageStorageId = undefined;
    }

    await ctx.db.patch(args.id, patch);

    // If moving from draft to published for the first time, notify.
    if (wasDraft && newStatus === "published") {
      await ctx.db.patch(args.id, { publishedAt: new Date().toISOString() });
      await notifyAllUsers(ctx, {
        type: "announcement",
        title:
          args.priority === "urgent"
            ? "Pengumuman MENDESAK"
            : "Berita & Pengumuman baru",
        message: args.title,
        link: `/news/${args.id}`,
        actorId: user._id,
      });
    }

    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;

    // Tenant isolation: verify the announcement belongs to caller's org
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (existing.organizationId) {
      assertSameTenant(organizationId, existing.organizationId, "announcement");
    }

    if (!isAdminRole(user.role) && existing.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak dapat menghapus pengumuman ini",
      });
    }

    // Cleanup likes + comments + cover image
    const likes = await ctx.db
      .query("announcementLikes")
      .withIndex("by_announcement", (q) => q.eq("announcementId", args.id))
      .collect();
    for (const l of likes) await ctx.db.delete(l._id);

    const comments = await ctx.db
      .query("announcementComments")
      .withIndex("by_announcement", (q) => q.eq("announcementId", args.id))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);

    if (existing.coverImageStorageId) {
      await trackStorageRemoved(ctx, existing.organizationId, existing.coverImageStorageId);
      try {
        await ctx.storage.delete(existing.coverImageStorageId);
      } catch {
        // ignore
      }
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const togglePin = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Administrator yang dapat menyematkan pengumuman",
      });
    }
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengumuman tidak ditemukan",
      });
    }

    // Tenant isolation: verify the announcement belongs to caller's org
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (existing.organizationId) {
      assertSameTenant(organizationId, existing.organizationId, "announcement");
    }

    await ctx.db.patch(args.id, { isPinned: !(existing.isPinned ?? false) });
    return null;
  },
});

export const toggleLike = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, args): Promise<{ liked: boolean }> => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengumuman tidak ditemukan",
      });
    }

    // Tenant isolation: verify the announcement belongs to caller's org
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (existing.organizationId) {
      assertSameTenant(organizationId, existing.organizationId, "announcement");
    }

    const like = await ctx.db
      .query("announcementLikes")
      .withIndex("by_user_and_announcement", (q) =>
        q.eq("userId", user._id).eq("announcementId", args.id),
      )
      .unique();

    const current = existing.likeCount ?? 0;
    if (like) {
      await ctx.db.delete(like._id);
      await ctx.db.patch(args.id, { likeCount: Math.max(0, current - 1) });
      return { liked: false };
    } else {
      await ctx.db.insert("announcementLikes", {
        announcementId: args.id,
        userId: user._id,
        organizationId: organizationId as Id<"organizations">,
      });
      await ctx.db.patch(args.id, { likeCount: current + 1 });
      return { liked: true };
    }
  },
});

export const addComment = mutation({
  args: {
    id: v.id("announcements"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"announcementComments">> => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengumuman tidak ditemukan",
      });
    }

    // Tenant isolation: verify the announcement belongs to caller's org
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (existing.organizationId) {
      assertSameTenant(organizationId, existing.organizationId, "announcement");
    }

    const content = args.content.trim();
    if (content.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Komentar tidak boleh kosong",
      });
    }

    const commentId = await ctx.db.insert("announcementComments", {
      announcementId: args.id,
      authorId: user._id,
      content,
      organizationId: organizationId as Id<"organizations">,
    });
    await ctx.db.patch(args.id, {
      commentCount: (existing.commentCount ?? 0) + 1,
    });

    // Notify the author of the announcement
    if (existing.authorId !== user._id) {
      await notifyUser(ctx, {
        userId: existing.authorId,
        type: "announcement_comment",
        title: "Komentar baru di pengumuman Anda",
        message: `${user.name ?? "Karyawan"}: ${content.slice(0, 100)}`,
        link: `/news/${args.id}`,
        actorId: user._id,
      });
    }

    return commentId;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("announcementComments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return null;

    // Tenant isolation: verify the comment belongs to caller's org
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (comment.organizationId) {
      assertSameTenant(organizationId, comment.organizationId, "comment");
    }

    if (!isAdminRole(user.role) && comment.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak dapat menghapus komentar ini",
      });
    }
    const announcement = await ctx.db.get(comment.announcementId);
    await ctx.db.delete(args.commentId);
    if (announcement) {
      await ctx.db.patch(comment.announcementId, {
        commentCount: Math.max(0, (announcement.commentCount ?? 1) - 1),
      });
    }
    return null;
  },
});
