import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import {
  requireUser,
  canEditObjective,
  canUpdateKeyResult,
  computeKrProgress,
  deriveKrStatus,
  recomputeObjective,
  KR_METRIC_TYPES,
  KR_DIRECTIONS,
} from "./_helpers";

async function enrichKr(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  kr: Doc<"keyResults">,
) {
  const owner = await ctx.db.get(kr.ownerId);
  return {
    ...kr,
    owner: owner
      ? {
          _id: owner._id,
          name: owner.name,
          avatarUrl: owner.avatarUrl,
          jobTitle: owner.jobTitle,
        }
      : null,
  };
}

export const listByObjective = query({
  args: { objectiveId: v.id("objectives") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("keyResults")
      .withIndex("by_objective", (q) => q.eq("objectiveId", args.objectiveId))
      .collect();
    const enriched = await Promise.all(rows.map((r) => enrichKr(ctx, r)));
    enriched.sort((a, b) => a.order - b.order);
    return enriched;
  },
});

export const createKeyResult = mutation({
  args: {
    objectiveId: v.id("objectives"),
    title: v.string(),
    description: v.optional(v.string()),
    metricType: v.string(),
    startValue: v.number(),
    targetValue: v.number(),
    direction: v.string(),
    unit: v.optional(v.string()),
    weight: v.optional(v.number()),
    ownerId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) throw new ConvexError({ code: "NOT_FOUND", message: "Objective tidak ditemukan" });
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak dapat menambah KR" });
    }
    const title = args.title.trim();
    if (!title) throw new ConvexError({ code: "BAD_REQUEST", message: "Judul KR wajib" });
    if (!KR_METRIC_TYPES.includes(args.metricType as (typeof KR_METRIC_TYPES)[number])) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tipe metrik tidak valid" });
    }
    if (!KR_DIRECTIONS.includes(args.direction as (typeof KR_DIRECTIONS)[number])) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Arah tidak valid" });
    }
    if (args.metricType !== "boolean" && args.startValue === args.targetValue) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nilai awal dan target harus berbeda",
      });
    }
    const existing = await ctx.db
      .query("keyResults")
      .withIndex("by_objective", (q) => q.eq("objectiveId", args.objectiveId))
      .collect();
    const order = existing.reduce((m, r) => Math.max(m, r.order), -1) + 1;
    const current = args.startValue;
    const progress = computeKrProgress({
      startValue: args.startValue,
      targetValue: args.targetValue,
      currentValue: current,
      direction: args.direction,
    });
    const confidence = Math.max(0, Math.min(100, args.confidence ?? 70));
    const status = deriveKrStatus(progress, confidence);
    const now = new Date().toISOString();
    const krId = await ctx.db.insert("keyResults", {
      objectiveId: args.objectiveId,
      title,
      description: args.description?.trim() || undefined,
      metricType: args.metricType,
      startValue: args.startValue,
      targetValue: args.targetValue,
      currentValue: current,
      direction: args.direction,
      unit: args.unit?.trim() || undefined,
      weight: Math.max(0.1, args.weight ?? 1),
      ownerId: args.ownerId ?? obj.ownerId,
      dueDate: args.dueDate,
      status,
      confidence,
      progress,
      order,
      lastUpdatedAt: now,
    });
    await recomputeObjective(ctx, args.objectiveId);
    return krId;
  },
});

export const updateKeyResult = mutation({
  args: {
    keyResultId: v.id("keyResults"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    metricType: v.optional(v.string()),
    startValue: v.optional(v.number()),
    targetValue: v.optional(v.number()),
    direction: v.optional(v.string()),
    unit: v.optional(v.string()),
    weight: v.optional(v.number()),
    ownerId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const kr = await ctx.db.get(args.keyResultId);
    if (!kr) throw new ConvexError({ code: "NOT_FOUND", message: "KR tidak ditemukan" });
    const obj = await ctx.db.get(kr.objectiveId);
    if (!obj) throw new ConvexError({ code: "NOT_FOUND", message: "Objective tidak ditemukan" });
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak dapat mengedit KR" });
    }
    const patch: Partial<Doc<"keyResults">> = {
      lastUpdatedAt: new Date().toISOString(),
    };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new ConvexError({ code: "BAD_REQUEST", message: "Judul KR wajib" });
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.metricType) patch.metricType = args.metricType;
    if (args.direction) patch.direction = args.direction;
    if (args.startValue !== undefined) patch.startValue = args.startValue;
    if (args.targetValue !== undefined) patch.targetValue = args.targetValue;
    if (args.unit !== undefined) patch.unit = args.unit.trim() || undefined;
    if (args.weight !== undefined) patch.weight = Math.max(0.1, args.weight);
    if (args.ownerId !== undefined) patch.ownerId = args.ownerId;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    // Recompute progress with latest values
    const startValue = patch.startValue ?? kr.startValue;
    const targetValue = patch.targetValue ?? kr.targetValue;
    const direction = patch.direction ?? kr.direction;
    const progress = computeKrProgress({
      startValue,
      targetValue,
      currentValue: kr.currentValue,
      direction,
    });
    patch.progress = progress;
    patch.status = deriveKrStatus(progress, kr.confidence);
    await ctx.db.patch(args.keyResultId, patch);
    await recomputeObjective(ctx, kr.objectiveId);
  },
});

export const deleteKeyResult = mutation({
  args: { keyResultId: v.id("keyResults") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const kr = await ctx.db.get(args.keyResultId);
    if (!kr) return;
    const obj = await ctx.db.get(kr.objectiveId);
    if (!obj) return;
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak dapat menghapus KR" });
    }
    // Delete check-ins
    const checkins = await ctx.db
      .query("okrCheckins")
      .withIndex("by_key_result", (q) => q.eq("keyResultId", args.keyResultId))
      .collect();
    for (const c of checkins) await ctx.db.delete(c._id);
    await ctx.db.delete(args.keyResultId);
    await recomputeObjective(ctx, kr.objectiveId);
  },
});

export const reorderKeyResults = mutation({
  args: {
    objectiveId: v.id("objectives"),
    orderedIds: v.array(v.id("keyResults")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) return;
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak diizinkan" });
    }
    for (let i = 0; i < args.orderedIds.length; i++) {
      const id: Id<"keyResults"> = args.orderedIds[i];
      const kr = await ctx.db.get(id);
      if (kr && kr.objectiveId === args.objectiveId) {
        await ctx.db.patch(id, { order: i });
      }
    }
  },
});

export const checkInKeyResult = mutation({
  args: {
    keyResultId: v.id("keyResults"),
    newValue: v.number(),
    confidence: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const kr = await ctx.db.get(args.keyResultId);
    if (!kr) throw new ConvexError({ code: "NOT_FOUND", message: "KR tidak ditemukan" });
    const obj = await ctx.db.get(kr.objectiveId);
    if (!obj) throw new ConvexError({ code: "NOT_FOUND", message: "Objective tidak ditemukan" });
    if (!canUpdateKeyResult(user, kr, obj)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pemilik KR yang dapat check-in",
      });
    }
    const confidence = Math.max(0, Math.min(100, Math.round(args.confidence)));
    const progress = computeKrProgress({
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      currentValue: args.newValue,
      direction: kr.direction,
    });
    const status = deriveKrStatus(progress, confidence);
    const now = new Date().toISOString();
    await ctx.db.insert("okrCheckins", {
      keyResultId: kr._id,
      objectiveId: kr.objectiveId,
      userId: user._id,
      previousValue: kr.currentValue,
      newValue: args.newValue,
      note: args.note?.trim() || undefined,
      status,
      confidence,
      checkedInAt: now,
    });
    await ctx.db.patch(kr._id, {
      currentValue: args.newValue,
      progress,
      confidence,
      status,
      lastUpdatedAt: now,
    });
    await recomputeObjective(ctx, kr.objectiveId);
    // Notify objective owner if different from user
    if (obj.ownerId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: obj.ownerId,
        type: "okr_checkin",
        title: "Check-in OKR",
        message: `Progress "${kr.title}" diperbarui menjadi ${progress}%`,
        link: `/okr?objective=${obj._id}`,
        actorId: user._id,
      });
    }
  },
});

export const listCheckins = query({
  args: { keyResultId: v.id("keyResults") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("okrCheckins")
      .withIndex("by_key_result", (q) => q.eq("keyResultId", args.keyResultId))
      .collect();
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const u = await ctx.db.get(c.userId);
        return {
          ...c,
          user: u ? { _id: u._id, name: u.name, avatarUrl: u.avatarUrl } : null,
        };
      }),
    );
    enriched.sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
    return enriched;
  },
});

export const listRecentCheckins = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const limit = Math.min(50, args.limit ?? 10);
    const rows = await ctx.db.query("okrCheckins").collect();
    rows.sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
    const slice = rows.slice(0, limit);
    return Promise.all(
      slice.map(async (c) => {
        const kr = await ctx.db.get(c.keyResultId);
        const obj = await ctx.db.get(c.objectiveId);
        const u = await ctx.db.get(c.userId);
        return {
          ...c,
          keyResultTitle: kr?.title ?? "(dihapus)",
          objectiveTitle: obj?.title ?? "(dihapus)",
          user: u ? { _id: u._id, name: u.name, avatarUrl: u.avatarUrl } : null,
        };
      }),
    );
  },
});
