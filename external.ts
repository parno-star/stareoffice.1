import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";
import { awardXpForUser } from "./gamification";

// External training: employees upload certificates from outside providers.

export const listMyExternalTrainings = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"externalTrainings">>> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("externalTrainings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort(
      (a, b) =>
        new Date(b.completedDate).getTime() -
        new Date(a.completedDate).getTime(),
    );
    return rows;
  },
});

export const listPendingExternalTrainings = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<
      Doc<"externalTrainings"> & {
        userName: string | null;
        userDepartment: string | null;
      }
    >
  > => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("externalTrainings")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const out: Array<
      Doc<"externalTrainings"> & {
        userName: string | null;
        userDepartment: string | null;
      }
    > = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        ...r,
        userName: u?.name ?? null,
        userDepartment: u?.department ?? null,
      });
    }
    out.sort((a, b) => b._creationTime - a._creationTime);
    return out;
  },
});

export const listAllExternalTrainings = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<
      Doc<"externalTrainings"> & {
        userName: string | null;
        userDepartment: string | null;
      }
    >
  > => {
    await requireAdmin(ctx);
    let rows: Array<Doc<"externalTrainings">>;
    if (args.status && args.status !== "all") {
      rows = await ctx.db
        .query("externalTrainings")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      rows = await ctx.db.query("externalTrainings").collect();
    }
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const out: Array<
      Doc<"externalTrainings"> & {
        userName: string | null;
        userDepartment: string | null;
      }
    > = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        ...r,
        userName: u?.name ?? null,
        userDepartment: u?.department ?? null,
      });
    }
    return out;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitExternalTraining = mutation({
  args: {
    title: v.string(),
    provider: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    durationHours: v.optional(v.number()),
    completedDate: v.string(),
    expiryDate: v.optional(v.string()),
    certificateStorageId: v.optional(v.id("_storage")),
    certificateFileName: v.optional(v.string()),
    certificateUrl: v.optional(v.string()),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"externalTrainings">> => {
    const user = await requireUser(ctx);
    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul pelatihan wajib diisi",
      });
    }
    return await ctx.db.insert("externalTrainings", {
      userId: user._id,
      title: args.title.trim(),
      provider: args.provider.trim(),
      description: args.description?.trim() || undefined,
      category: args.category,
      durationHours: args.durationHours,
      completedDate: args.completedDate,
      expiryDate: args.expiryDate,
      certificateStorageId: args.certificateStorageId,
      certificateFileName: args.certificateFileName,
      certificateUrl: args.certificateUrl?.trim() || undefined,
      status: "pending",
      cost: args.cost,
    });
  },
});

export const reviewExternalTraining = mutation({
  args: {
    id: v.id("externalTrainings"),
    status: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pelatihan tidak ditemukan",
      });
    }
    if (args.status !== "approved" && args.status !== "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewerId: admin._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.note?.trim() || undefined,
    });
    if (args.status === "approved") {
      await awardXpForUser(ctx, row.userId, "external_training_approved");
    }
    return null;
  },
});

export const deleteExternalTraining = mutation({
  args: { id: v.id("externalTrainings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const isOwner = row.userId === user._id;
    const isAdmin =
      user.role === "admin" ||
      user.role === "super_admin";
    if (!isOwner && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak diizinkan",
      });
    }
    if (row.certificateStorageId) {
      try {
        await ctx.storage.delete(row.certificateStorageId);
      } catch {
        // ignore
      }
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const getCertificateUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<string | null> => {
    await requireUser(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});
