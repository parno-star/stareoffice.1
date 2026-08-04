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

export type EmployeeDocumentWithMeta = Doc<"employeeDocuments"> & {
  uploaderName: string | null;
  ownerName: string | null;
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

function canAccessEmployeeDocs(
  me: Doc<"users">,
  ownerId: Id<"users">,
): boolean {
  if (me._id === ownerId) return true;
  if (isAdminRole(me.role)) return true;
  return false;
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
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    storageId: v.id("_storage"),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"employeeDocuments">> => {
    const me = await requireUser(ctx);
    if (!canAccessEmployeeDocs(me, args.userId)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak dapat mengunggah dokumen untuk karyawan lain",
      });
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul dokumen wajib diisi",
      });
    }

    // Enforce plan storage limit before persisting the file reference.
    const incomingBytes = await getStorageSizeBytes(ctx, args.storageId);
    await assertStorageWithinLimit(ctx, me.organizationId, incomingBytes);

    const docId = await ctx.db.insert("employeeDocuments", {
      userId: args.userId,
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      storageId: args.storageId,
      uploaderId: me._id,
      issueDate: args.issueDate?.trim() || undefined,
      expiryDate: args.expiryDate?.trim() || undefined,
      organizationId: me.organizationId,
    });

    await trackStorageAdded(ctx, me.organizationId, args.storageId);

    return docId;
  },
});

export const listForUser = query({
  args: {
    userId: v.id("users"),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EmployeeDocumentWithMeta>> => {
    const { userId: callerId, organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    // Super admin data-access gate: when blocked, return no documents.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return [];
    }
    const me = await ctx.db.get(callerId);
    if (!me) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (!canAccessEmployeeDocs(me, args.userId)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki akses ke dokumen karyawan ini",
      });
    }

    const category = args.category?.trim();
    let docs: Array<Doc<"employeeDocuments">>;
    if (category && category !== "all") {
      docs = await ctx.db
        .query("employeeDocuments")
        .withIndex("by_user_and_category", (q) =>
          q.eq("userId", args.userId).eq("category", category),
        )
        .order("desc")
        .collect();
    } else {
      docs = await ctx.db
        .query("employeeDocuments")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .collect();
    }

    // Post-filter by organization
    if (organizationId) {
      docs = docs.filter((d) => d.organizationId === organizationId);
    }

    const uploaderCache = new Map<Id<"users">, Doc<"users"> | null>();
    const owner = await ctx.db.get(args.userId);
    const results: Array<EmployeeDocumentWithMeta> = [];
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
        ownerName: owner?.name ?? null,
        url,
      });
    }
    return results;
  },
});

export const getStats = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    total: number;
    byCategory: Record<string, number>;
    expiringSoon: number;
    expired: number;
  }> => {
    const { userId: callerId, organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    // Super admin data-access gate: when blocked, return empty stats.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return { total: 0, byCategory: {}, expiringSoon: 0, expired: 0 };
    }
    const me = await ctx.db.get(callerId);
    if (!me) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (!canAccessEmployeeDocs(me, args.userId)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki akses",
      });
    }
    let docs = await ctx.db
      .query("employeeDocuments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Post-filter by organization
    if (organizationId) {
      docs = docs.filter((d) => d.organizationId === organizationId);
    }

    const byCategory: Record<string, number> = {};
    let expiringSoon = 0;
    let expired = 0;

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const soonStr = in30Days.toISOString().slice(0, 10);

    for (const doc of docs) {
      byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
      if (doc.expiryDate) {
        if (doc.expiryDate < todayStr) {
          expired += 1;
        } else if (doc.expiryDate <= soonStr) {
          expiringSoon += 1;
        }
      }
    }

    return {
      total: docs.length,
      byCategory,
      expiringSoon,
      expired,
    };
  },
});

export const remove = mutation({
  args: { documentId: v.id("employeeDocuments") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Dokumen tidak ditemukan",
      });
    }
    if (doc.organizationId) {
      assertSameTenant(me.organizationId ?? null, doc.organizationId, "employee document");
    }
    if (!canAccessEmployeeDocs(me, doc.userId)) {
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

export const update = mutation({
  args: {
    documentId: v.id("employeeDocuments"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"employeeDocuments">> => {
    const me = await requireUser(ctx);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Dokumen tidak ditemukan",
      });
    }
    if (doc.organizationId) {
      assertSameTenant(me.organizationId ?? null, doc.organizationId, "employee document");
    }
    if (!canAccessEmployeeDocs(me, doc.userId)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk mengubah dokumen ini",
      });
    }
    const patch: Partial<Doc<"employeeDocuments">> = {};
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
      patch.category = args.category;
    }
    if (args.issueDate !== undefined) {
      patch.issueDate = args.issueDate.trim() || undefined;
    }
    if (args.expiryDate !== undefined) {
      patch.expiryDate = args.expiryDate.trim() || undefined;
    }
    await ctx.db.patch(args.documentId, patch);
    return args.documentId;
  },
});

// Returns the set of employee ids (visible to the caller) that have at least
// one SK/Kontrak document (category "contract") attached. Used by the directory
// table to turn the SK number into a clickable link. Admins see every employee
// in their organization; regular employees only ever see their own row.
export const skOwnerIds = query({
  args: {},
  handler: async (ctx): Promise<Array<Id<"users">>> => {
    const { userId: callerId, organizationId, isSuperAdmin } =
      await requireTenant(ctx, { allowSuperAdmin: true });
    // Super admin data-access gate: when blocked, return no owners.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return [];
    }
    const me = await ctx.db.get(callerId);
    if (!me) return [];
    const admin = isAdminRole(me.role);

    let docs: Array<Doc<"employeeDocuments">>;
    if (organizationId) {
      docs = await ctx.db
        .query("employeeDocuments")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();
    } else {
      docs = await ctx.db.query("employeeDocuments").collect();
    }

    const owners = new Set<Id<"users">>();
    for (const doc of docs) {
      if (doc.category !== "contract") continue;
      if (admin || doc.userId === me._id) {
        owners.add(doc.userId);
      }
    }
    return Array.from(owners);
  },
});

// Admin-only: overview of all employees with document counts
export const listEmployeesOverview = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      user: Doc<"users">;
      documentCount: number;
      expiringSoon: number;
      expired: number;
    }>
  > => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    // Super admin data-access gate: when blocked, return an empty overview.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return [];
    }
    // Fetch full user doc to verify admin role
    const { userId: callerId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const me = await ctx.db.get(callerId);
    if (!me || !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat melihat overview",
      });
    }

    let users = await ctx.db.query("users").collect();
    // Post-filter by organization
    if (organizationId) {
      users = users.filter((u) => u.organizationId === organizationId);
    }

    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const soonStr = in30Days.toISOString().slice(0, 10);

    const results: Array<{
      user: Doc<"users">;
      documentCount: number;
      expiringSoon: number;
      expired: number;
    }> = [];

    for (const user of users) {
      const docs = await ctx.db
        .query("employeeDocuments")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      let expiringSoon = 0;
      let expired = 0;
      for (const doc of docs) {
        if (doc.expiryDate) {
          if (doc.expiryDate < todayStr) {
            expired += 1;
          } else if (doc.expiryDate <= soonStr) {
            expiringSoon += 1;
          }
        }
      }

      results.push({
        user,
        documentCount: docs.length,
        expiringSoon,
        expired,
      });
    }

    // Sort: expired first, then expiring soon, then by doc count desc, then name
    results.sort((a, b) => {
      if (a.expired !== b.expired) return b.expired - a.expired;
      if (a.expiringSoon !== b.expiringSoon)
        return b.expiringSoon - a.expiringSoon;
      if (a.documentCount !== b.documentCount)
        return b.documentCount - a.documentCount;
      return (a.user.name ?? "").localeCompare(b.user.name ?? "");
    });
    return results;
  },
});
