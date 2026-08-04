import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "../lib/planStorage";

export type ResourceWithExtras = Doc<"onboardingResources"> & {
  fileUrl: string | null;
  contactName: string | null;
  contactAvatar: string | null;
  contactJobTitle: string | null;
  contactEmail: string | null;
};

const VALID_KINDS = ["link", "document", "video", "contact"];
const VALID_CATEGORIES = [
  "welcome",
  "culture",
  "policy",
  "tool",
  "people",
  "benefits",
  "other",
];

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true, allowPending: true });
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
      message: "Hanya admin yang dapat melakukan tindakan ini",
    });
  }
  return user;
}

async function enrichResources(
  ctx: QueryCtx,
  rows: Array<Doc<"onboardingResources">>,
): Promise<Array<ResourceWithExtras>> {
  const out: Array<ResourceWithExtras> = [];
  for (const r of rows) {
    const fileUrl = r.storageId ? await ctx.storage.getUrl(r.storageId) : null;
    const contact = r.contactUserId ? await ctx.db.get(r.contactUserId) : null;
    out.push({
      ...r,
      fileUrl,
      contactName: contact?.name ?? null,
      contactAvatar: contact?.avatarUrl ?? null,
      contactJobTitle: contact?.jobTitle ?? null,
      contactEmail: contact?.email ?? null,
    });
  }
  return out;
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<Array<ResourceWithExtras>> => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("onboardingResources")
      .withIndex("by_order")
      .collect();
    // Pinned first, then by order
    rows.sort((a, b) => {
      const pa = a.isPinned ? 1 : 0;
      const pb = b.isPinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return a.order - b.order;
    });
    return await enrichResources(ctx, rows);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    kind: v.string(),
    category: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    contactUserId: v.optional(v.id("users")),
    icon: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"onboardingResources">> => {
    const user = await requireAdmin(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    if (!VALID_KINDS.includes(args.kind)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jenis tidak valid",
      });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    // Kind-specific validation
    if ((args.kind === "link" || args.kind === "video") && !args.url) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "URL wajib diisi",
      });
    }
    if (args.kind === "document" && !args.storageId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "File wajib diunggah",
      });
    }
    if (args.kind === "contact" && !args.contactUserId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih kontak karyawan",
      });
    }
    const existing = await ctx.db.query("onboardingResources").collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((r) => r.order)) + 1;

    // Enforce plan storage limit when a document file is attached.
    if (args.storageId) {
      const incomingBytes = await getStorageSizeBytes(ctx, args.storageId);
      await assertStorageWithinLimit(ctx, user.organizationId, incomingBytes);
    }

    const resourceId = await ctx.db.insert("onboardingResources", {
      title,
      description: args.description?.trim() || undefined,
      kind: args.kind,
      category: args.category,
      url: args.url?.trim() || undefined,
      storageId: args.storageId,
      fileName: args.fileName,
      contactUserId: args.contactUserId,
      icon: args.icon?.trim() || undefined,
      isPinned: args.isPinned ?? false,
      order: nextOrder,
      authorId: user._id,
      organizationId: user.organizationId,
    });

    if (args.storageId) {
      await trackStorageAdded(ctx, user.organizationId, args.storageId);
    }

    return resourceId;
  },
});

export const update = mutation({
  args: {
    id: v.id("onboardingResources"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    url: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Resource tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"onboardingResources">> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (t.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Judul tidak boleh kosong",
        });
      }
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.category !== undefined) {
      if (!VALID_CATEGORIES.includes(args.category)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kategori tidak valid",
        });
      }
      patch.category = args.category;
    }
    if (args.url !== undefined) {
      patch.url = args.url.trim() || undefined;
    }
    if (args.icon !== undefined) {
      patch.icon = args.icon.trim() || undefined;
    }
    if (args.isPinned !== undefined) patch.isPinned = args.isPinned;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("onboardingResources") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (row?.storageId) {
      await trackStorageRemoved(ctx, row.organizationId, row.storageId);
      try {
        await ctx.storage.delete(row.storageId);
      } catch {
        // ignore missing storage
      }
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
