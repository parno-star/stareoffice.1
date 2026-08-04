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
import { isSuperAdminBlocked } from "./superAdminDataAccess";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

export type DocumentWithUploader = Doc<"documents"> & {
  uploaderName: string | null;
  url: string | null;
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

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul dokumen wajib diisi",
      });
    }

    // Enforce plan storage limit before persisting the file reference.
    const incomingBytes = await getStorageSizeBytes(ctx, args.storageId);
    await assertStorageWithinLimit(ctx, user.organizationId, incomingBytes);

    const docId = await ctx.db.insert("documents", {
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      storageId: args.storageId,
      uploaderId: user._id,
      organizationId: user.organizationId,
    });

    // Update the org storage counter and fire graduated warnings if crossed.
    await trackStorageAdded(ctx, user.organizationId, args.storageId);

    return docId;
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<DocumentWithUploader>> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    // Super admin data-access gate: when blocked, return no documents.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "documents")) {
      return [];
    }

    const searchTerm = args.search?.trim();
    const category = args.category?.trim();

    let docs: Array<Doc<"documents">>;

    if (searchTerm && searchTerm.length > 0) {
      docs = await ctx.db
        .query("documents")
        .withSearchIndex("search_title", (q) => {
          const base = q.search("title", searchTerm);
          if (category && category !== "all") {
            return base.eq("category", category);
          }
          return base;
        })
        .take(200);
    } else if (category && category !== "all") {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_category", (q) => q.eq("category", category))
        .order("desc")
        .take(200);
    } else {
      docs = await ctx.db.query("documents").order("desc").take(200);
    }

    // Scope by organization. A super admin without an active grant has
    // organizationId === null and must see NO documents (never cross-org).
    if (!organizationId) {
      return [];
    }
    docs = docs.filter((d) => d.organizationId === organizationId);

    // Resolve uploader name and signed URL for each document
    const results: Array<DocumentWithUploader> = [];
    const uploaderCache = new Map<Id<"users">, Doc<"users"> | null>();
    for (const doc of docs) {
      let uploader = uploaderCache.get(doc.uploaderId);
      if (uploader === undefined) {
        uploader = await ctx.db.get(doc.uploaderId);
        uploaderCache.set(doc.uploaderId, uploader);
      }
      const url = await ctx.storage.getUrl(doc.storageId);
      results.push({
        ...doc,
        uploaderName: uploader?.name ?? null,
        url,
      });
    }
    return results;
  },
});

export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Dokumen tidak ditemukan",
      });
    }
    if (doc.organizationId) {
      assertSameTenant(user.organizationId ?? null, doc.organizationId, "document");
    }
    // Only the uploader or an admin can delete
    if (doc.uploaderId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus dokumen ini",
      });
    }
    await trackStorageRemoved(ctx, doc.organizationId, doc.storageId);
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.documentId);
    return null;
  },
});
