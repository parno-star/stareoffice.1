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

export type EnrichedAsset = Doc<"assets"> & {
  imageUrl: string | null;
  currentHolderName: string | null;
  currentHolderAvatar: string | null;
  currentHolderDepartment: string | null;
  assignedAt: string | null;
};

export type EnrichedAssignment = Doc<"assetAssignments"> & {
  userName: string | null;
  userAvatar: string | null;
  userDepartment: string | null;
  assignedByName: string | null;
  returnedByName: string | null;
  assetName: string | null;
  assetTag: string | null;
  assetCategory: string | null;
};

export type AssetStats = {
  total: number;
  available: number;
  assigned: number;
  inRepair: number;
  retired: number;
  byCategory: Array<{ category: string; count: number }>;
};

const VALID_CATEGORIES = [
  "laptop",
  "monitor",
  "phone",
  "peripheral",
  "furniture",
  "vehicle",
  "software",
  "other",
];

const VALID_STATUSES = ["available", "assigned", "in_repair", "retired"];

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

async function requireAdminTenant(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { user, organizationId } = await requireUserTenant(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola aset",
    });
  }
  return { user, organizationId };
}

/** Filter a list of records to those belonging to the caller's org.
 *  A super admin without an active grant has organizationId === null and sees
 *  nothing. Legacy records with no organizationId are visible to real tenants. */
function filterByOrg<T extends { organizationId?: Id<"organizations"> }>(
  rows: T[],
  organizationId: Id<"organizations"> | null,
): T[] {
  if (organizationId === null) return [];
  return rows.filter(
    (r) => !r.organizationId || r.organizationId === organizationId,
  );
}

async function enrichAssets(
  ctx: QueryCtx,
  assets: Array<Doc<"assets">>,
): Promise<Array<EnrichedAsset>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = userCache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  };
  const results: Array<EnrichedAsset> = [];
  for (const a of assets) {
    const holder = a.currentHolderId ? await getUser(a.currentHolderId) : null;
    const imageUrl = a.imageStorageId
      ? await ctx.storage.getUrl(a.imageStorageId)
      : null;
    let assignedAt: string | null = null;
    if (a.currentAssignmentId) {
      const assign = await ctx.db.get(a.currentAssignmentId);
      assignedAt = assign?.assignedAt ?? null;
    }
    results.push({
      ...a,
      imageUrl,
      currentHolderName: holder?.name ?? null,
      currentHolderAvatar: holder?.avatarUrl ?? null,
      currentHolderDepartment: holder?.department ?? null,
      assignedAt,
    });
  }
  return results;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdminTenant(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedAsset>> => {
    const { organizationId } = await requireUserTenant(ctx);
    let rows: Array<Doc<"assets">>;
    if (args.search && args.search.length > 0) {
      rows = await ctx.db
        .query("assets")
        .withSearchIndex("search_name", (q) => {
          let qb = q.search("name", args.search!);
          if (args.category) qb = qb.eq("category", args.category);
          if (args.status) qb = qb.eq("status", args.status);
          return qb;
        })
        .take(200);
    } else if (args.status) {
      rows = await ctx.db
        .query("assets")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(200);
      if (args.category) {
        rows = rows.filter((r) => r.category === args.category);
      }
    } else if (args.category) {
      rows = await ctx.db
        .query("assets")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc")
        .take(200);
    } else {
      rows = await ctx.db.query("assets").order("desc").take(200);
    }
    rows = filterByOrg(rows, organizationId);
    return await enrichAssets(ctx, rows);
  },
});

export const getById = query({
  args: { id: v.id("assets") },
  handler: async (ctx, args): Promise<EnrichedAsset | null> => {
    await requireUserTenant(ctx);
    const asset = await ctx.db.get(args.id);
    if (!asset) return null;
    const [enriched] = await enrichAssets(ctx, [asset]);
    return enriched;
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx): Promise<Array<EnrichedAsset>> => {
    const { user } = await requireUserTenant(ctx);
    const rows = await ctx.db
      .query("assets")
      .withIndex("by_holder", (q) => q.eq("currentHolderId", user._id))
      .collect();
    return await enrichAssets(ctx, rows);
  },
});

export const listAssignmentsForAsset = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args): Promise<Array<EnrichedAssignment>> => {
    await requireUserTenant(ctx);
    const rows = await ctx.db
      .query("assetAssignments")
      .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .take(200);
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };
    const asset = await ctx.db.get(args.assetId);
    const results: Array<EnrichedAssignment> = [];
    for (const row of rows) {
      const user = await getUser(row.userId);
      const assignedBy = await getUser(row.assignedBy);
      const returnedBy = row.returnedBy ? await getUser(row.returnedBy) : null;
      results.push({
        ...row,
        userName: user?.name ?? null,
        userAvatar: user?.avatarUrl ?? null,
        userDepartment: user?.department ?? null,
        assignedByName: assignedBy?.name ?? null,
        returnedByName: returnedBy?.name ?? null,
        assetName: asset?.name ?? null,
        assetTag: asset?.assetTag ?? null,
        assetCategory: asset?.category ?? null,
      });
    }
    return results;
  },
});

export const listAssignmentsForUser = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<Array<EnrichedAssignment>> => {
    const { user: me } = await requireUserTenant(ctx);
    const targetId = args.userId ?? me._id;
    if (targetId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak dapat melihat histori pengguna lain",
      });
    }
    const rows = await ctx.db
      .query("assetAssignments")
      .withIndex("by_user", (q) => q.eq("userId", targetId))
      .order("desc")
      .take(200);
    const assetCache = new Map<Id<"assets">, Doc<"assets"> | null>();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getAsset = async (id: Id<"assets">) => {
      const cached = assetCache.get(id);
      if (cached !== undefined) return cached;
      const a = await ctx.db.get(id);
      assetCache.set(id, a);
      return a;
    };
    const getUser = async (id: Id<"users">) => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };
    const results: Array<EnrichedAssignment> = [];
    for (const row of rows) {
      const asset = await getAsset(row.assetId);
      const user = await getUser(row.userId);
      const assignedBy = await getUser(row.assignedBy);
      const returnedBy = row.returnedBy ? await getUser(row.returnedBy) : null;
      results.push({
        ...row,
        userName: user?.name ?? null,
        userAvatar: user?.avatarUrl ?? null,
        userDepartment: user?.department ?? null,
        assignedByName: assignedBy?.name ?? null,
        returnedByName: returnedBy?.name ?? null,
        assetName: asset?.name ?? null,
        assetTag: asset?.assetTag ?? null,
        assetCategory: asset?.category ?? null,
      });
    }
    return results;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<AssetStats> => {
    const { organizationId } = await requireUserTenant(ctx);
    const allRows = await ctx.db.query("assets").take(2000);
    const rows = filterByOrg(allRows, organizationId);
    let available = 0;
    let assigned = 0;
    let inRepair = 0;
    let retired = 0;
    const catMap = new Map<string, number>();
    for (const a of rows) {
      if (a.status === "available") available += 1;
      else if (a.status === "assigned") assigned += 1;
      else if (a.status === "in_repair") inRepair += 1;
      else if (a.status === "retired") retired += 1;
      catMap.set(a.category, (catMap.get(a.category) ?? 0) + 1);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    return {
      total: rows.length,
      available,
      assigned,
      inRepair,
      retired,
      byCategory,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    assetTag: v.string(),
    category: v.string(),
    status: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<Id<"assets">> => {
    const { user: admin, organizationId } = await requireAdminTenant(ctx);
    const name = args.name.trim();
    const tag = args.assetTag.trim();
    if (!name || !tag) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama dan kode aset wajib diisi",
      });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    const status = args.status ?? "available";
    if (!VALID_STATUSES.includes(status) || status === "assigned") {
      // Assets are marked assigned only via the assign mutation.
      if (status === "assigned") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message:
            "Status 'assigned' ditetapkan otomatis saat aset ditugaskan",
        });
      }
      if (!VALID_STATUSES.includes(status)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Status tidak valid",
        });
      }
    }
    const assetId = await ctx.db.insert("assets", {
      name,
      assetTag: tag,
      category: args.category,
      status,
      serialNumber: args.serialNumber,
      brand: args.brand,
      model: args.model,
      purchaseDate: args.purchaseDate,
      purchasePrice: args.purchasePrice,
      location: args.location,
      description: args.description,
      imageStorageId: args.imageStorageId,
      authorId: admin._id,
      organizationId: organizationId ?? undefined,
    });
    return assetId;
  },
});

export const update = mutation({
  args: {
    id: v.id("assets"),
    name: v.optional(v.string()),
    assetTag: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    clearImage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminTenant(ctx);
    const asset = await ctx.db.get(args.id);
    if (!asset) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Aset tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"assets">> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.assetTag !== undefined) patch.assetTag = args.assetTag.trim();
    if (args.category !== undefined) {
      if (!VALID_CATEGORIES.includes(args.category)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kategori tidak valid",
        });
      }
      patch.category = args.category;
    }
    if (args.status !== undefined) {
      if (!VALID_STATUSES.includes(args.status)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Status tidak valid",
        });
      }
      // Prevent manually flipping between assigned/available without the
      // proper assign/return flow; allow marking as in_repair or retired.
      if (
        args.status === "assigned" &&
        asset.status !== "assigned"
      ) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Gunakan tindakan 'Tugaskan' untuk menandai sebagai assigned",
        });
      }
      if (asset.status === "assigned" && args.status === "available") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kembalikan aset terlebih dahulu sebelum mengubah status",
        });
      }
      patch.status = args.status;
    }
    if (args.serialNumber !== undefined) patch.serialNumber = args.serialNumber;
    if (args.brand !== undefined) patch.brand = args.brand;
    if (args.model !== undefined) patch.model = args.model;
    if (args.purchaseDate !== undefined) patch.purchaseDate = args.purchaseDate;
    if (args.purchasePrice !== undefined)
      patch.purchasePrice = args.purchasePrice;
    if (args.location !== undefined) patch.location = args.location;
    if (args.description !== undefined) patch.description = args.description;
    if (args.clearImage) {
      if (asset.imageStorageId) {
        await ctx.storage.delete(asset.imageStorageId);
      }
      patch.imageStorageId = undefined;
    } else if (args.imageStorageId !== undefined) {
      if (asset.imageStorageId && asset.imageStorageId !== args.imageStorageId) {
        await ctx.storage.delete(asset.imageStorageId);
      }
      patch.imageStorageId = args.imageStorageId;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, args) => {
    await requireAdminTenant(ctx);
    const asset = await ctx.db.get(args.id);
    if (!asset) return null;
    if (asset.status === "assigned") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak bisa menghapus aset yang sedang ditugaskan",
      });
    }
    // Clean up assignment history
    const assignments = await ctx.db
      .query("assetAssignments")
      .withIndex("by_asset", (q) => q.eq("assetId", args.id))
      .collect();
    for (const a of assignments) {
      await ctx.db.delete(a._id);
    }
    if (asset.imageStorageId) {
      await ctx.storage.delete(asset.imageStorageId);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const assign = mutation({
  args: {
    assetId: v.id("assets"),
    userId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"assetAssignments">> => {
    const { user: admin, organizationId } = await requireAdminTenant(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Aset tidak ditemukan",
      });
    }
    if (asset.status === "assigned") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Aset ini sudah ditugaskan",
      });
    }
    if (asset.status === "retired") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Aset yang pensiun tidak bisa ditugaskan",
      });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      });
    }
    const now = new Date().toISOString();
    const assignmentId = await ctx.db.insert("assetAssignments", {
      assetId: args.assetId,
      userId: args.userId,
      assignedAt: now,
      assignedBy: admin._id,
      note: args.note,
      organizationId: organizationId ?? undefined,
    });
    await ctx.db.patch(args.assetId, {
      status: "assigned",
      currentAssignmentId: assignmentId,
      currentHolderId: args.userId,
    });
    await notifyUser(ctx, {
      userId: args.userId,
      type: "asset_assigned",
      title: "Aset ditugaskan kepada Anda",
      message: `${asset.name} (${asset.assetTag}) telah ditugaskan kepada Anda.`,
      link: `/assets/${args.assetId}`,
      actorId: admin._id,
    });
    return assignmentId;
  },
});

export const returnAsset = mutation({
  args: {
    assetId: v.id("assets"),
    returnCondition: v.optional(v.string()),
    returnNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user: admin } = await requireAdminTenant(ctx);
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Aset tidak ditemukan",
      });
    }
    if (asset.status !== "assigned" || !asset.currentAssignmentId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Aset tidak sedang ditugaskan",
      });
    }
    const condition = args.returnCondition ?? "good";
    if (!["good", "damaged", "lost"].includes(condition)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kondisi pengembalian tidak valid",
      });
    }
    const assignment = await ctx.db.get(asset.currentAssignmentId);
    const now = new Date().toISOString();
    if (assignment) {
      await ctx.db.patch(assignment._id, {
        returnedAt: now,
        returnedBy: admin._id,
        returnNote: args.returnNote,
        returnCondition: condition,
      });
    }
    // If lost, mark retired; if damaged, mark in_repair; else available.
    const nextStatus =
      condition === "lost"
        ? "retired"
        : condition === "damaged"
          ? "in_repair"
          : "available";
    await ctx.db.patch(args.assetId, {
      status: nextStatus,
      currentAssignmentId: undefined,
      currentHolderId: undefined,
    });
    if (assignment && assignment.userId !== admin._id) {
      await notifyUser(ctx, {
        userId: assignment.userId,
        type: "asset_returned",
        title: "Aset telah dikembalikan",
        message: `${asset.name} (${asset.assetTag}) telah dicatat sebagai dikembalikan.`,
        link: `/assets/${args.assetId}`,
        actorId: admin._id,
      });
    }
    return null;
  },
});
