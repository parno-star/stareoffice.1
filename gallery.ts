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
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

export type AlbumSummary = Doc<"galleryAlbums"> & {
  authorName: string | null;
  coverUrl: string | null;
};

export type PhotoWithUrl = Doc<"galleryPhotos"> & {
  url: string | null;
  uploaderName: string | null;
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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listAlbums = query({
  args: {},
  handler: async (ctx): Promise<Array<AlbumSummary>> => {
    await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const albums = await ctx.db
      .query("galleryAlbums")
      .withIndex("by_event_date")
      .order("desc")
      .take(100);

    const tenantAlbums = organizationId === null
      ? albums
      : albums.filter((a) => a.organizationId === organizationId);

    const authorCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<AlbumSummary> = [];
    for (const album of tenantAlbums) {
      let author = authorCache.get(album.authorId);
      if (author === undefined) {
        author = await ctx.db.get(album.authorId);
        authorCache.set(album.authorId, author);
      }
      let coverUrl: string | null = null;
      if (album.coverPhotoId) {
        const cover = await ctx.db.get(album.coverPhotoId);
        if (cover) {
          coverUrl = await ctx.storage.getUrl(cover.storageId);
        }
      }
      results.push({
        ...album,
        authorName: author?.name ?? null,
        coverUrl,
      });
    }
    return results;
  },
});

export const getAlbum = query({
  args: { albumId: v.id("galleryAlbums") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    album: AlbumSummary;
    photos: Array<PhotoWithUrl>;
  } | null> => {
    await requireUser(ctx);
    const album = await ctx.db.get(args.albumId);
    if (!album) return null;

    const author = await ctx.db.get(album.authorId);

    let coverUrl: string | null = null;
    if (album.coverPhotoId) {
      const cover = await ctx.db.get(album.coverPhotoId);
      if (cover) {
        coverUrl = await ctx.storage.getUrl(cover.storageId);
      }
    }

    const photoDocs = await ctx.db
      .query("galleryPhotos")
      .withIndex("by_album", (q) => q.eq("albumId", album._id))
      .order("desc")
      .take(500);

    const uploaderCache = new Map<Id<"users">, Doc<"users"> | null>();
    const photos: Array<PhotoWithUrl> = [];
    for (const photo of photoDocs) {
      let uploader = uploaderCache.get(photo.uploaderId);
      if (uploader === undefined) {
        uploader = await ctx.db.get(photo.uploaderId);
        uploaderCache.set(photo.uploaderId, uploader);
      }
      const url = await ctx.storage.getUrl(photo.storageId);
      photos.push({
        ...photo,
        url,
        uploaderName: uploader?.name ?? null,
      });
    }

    return {
      album: {
        ...album,
        authorName: author?.name ?? null,
        coverUrl,
      },
      photos,
    };
  },
});

export const createAlbum = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    eventDate: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"galleryAlbums">> => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul album wajib diisi",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.eventDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal kegiatan tidak valid",
      });
    }
    return await ctx.db.insert("galleryAlbums", {
      title,
      description: args.description?.trim() || undefined,
      eventDate: args.eventDate,
      authorId: user._id,
      coverPhotoId: undefined,
      photoCount: 0,
      organizationId: user.organizationId,
    });
  },
});

export const addPhoto = mutation({
  args: {
    albumId: v.id("galleryAlbums"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"galleryPhotos">> => {
    const user = await requireUser(ctx);
    const album = await ctx.db.get(args.albumId);
    if (!album) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Album tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, album.organizationId);

    // Enforce plan storage limit before persisting the photo.
    const incomingBytes = await getStorageSizeBytes(ctx, args.storageId);
    await assertStorageWithinLimit(ctx, user.organizationId, incomingBytes);

    const photoId = await ctx.db.insert("galleryPhotos", {
      albumId: args.albumId,
      storageId: args.storageId,
      caption: args.caption?.trim() || undefined,
      uploaderId: user._id,
      organizationId: user.organizationId,
    });
    await ctx.db.patch(args.albumId, {
      photoCount: album.photoCount + 1,
      // Set first photo as cover if album doesn't have one yet
      coverPhotoId: album.coverPhotoId ?? photoId,
    });
    await trackStorageAdded(ctx, user.organizationId, args.storageId);
    return photoId;
  },
});

export const removePhoto = mutation({
  args: { photoId: v.id("galleryPhotos") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const photo = await ctx.db.get(args.photoId);
    if (!photo) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Foto tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, photo.organizationId);
    const album = await ctx.db.get(photo.albumId);
    if (!album) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Album tidak ditemukan",
      });
    }
    // Only uploader, album author, or admin can delete
    const canDelete =
      photo.uploaderId === user._id ||
      album.authorId === user._id ||
      isAdminRole(user.role);
    if (!canDelete) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus foto ini",
      });
    }

    await trackStorageRemoved(ctx, photo.organizationId, photo.storageId);
    await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(args.photoId);

    // Update cover if this was the cover photo
    let newCoverId: Id<"galleryPhotos"> | undefined = album.coverPhotoId;
    if (album.coverPhotoId === args.photoId) {
      const next = await ctx.db
        .query("galleryPhotos")
        .withIndex("by_album", (q) => q.eq("albumId", album._id))
        .first();
      newCoverId = next?._id ?? undefined;
    }

    await ctx.db.patch(album._id, {
      photoCount: Math.max(0, album.photoCount - 1),
      coverPhotoId: newCoverId,
    });
    return null;
  },
});

export const removeAlbum = mutation({
  args: { albumId: v.id("galleryAlbums") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const album = await ctx.db.get(args.albumId);
    if (!album) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Album tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, album.organizationId);
    if (album.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus album ini",
      });
    }
    // Delete all photos and their storage
    const photos = await ctx.db
      .query("galleryPhotos")
      .withIndex("by_album", (q) => q.eq("albumId", album._id))
      .collect();
    for (const photo of photos) {
      await trackStorageRemoved(ctx, photo.organizationId, photo.storageId);
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
    }
    await ctx.db.delete(album._id);
    return null;
  },
});
