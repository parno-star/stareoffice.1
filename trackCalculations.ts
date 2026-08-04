import { v, ConvexError } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ message: "User tidak ditemukan", code: "NOT_FOUND" });
  }
  return user;
}

/** Save a calculation result */
export const save = mutation({
  args: {
    segmentName: v.string(),
    staStart: v.string(),
    staEnd: v.string(),
    input: v.object({
      operation: v.object({
        axleLoad: v.number(),
        designSpeed: v.number(),
        trainFrequency: v.number(),
        passengerTonnageDaily: v.number(),
        freightTonnageDaily: v.number(),
        locomotiveTonnageDaily: v.number(),
      }),
      infrastructure: v.object({
        gauge: v.string(),
        railType: v.string(),
        sleeperType: v.string(),
        ballastThickness: v.number(),
        subgrade: v.string(),
      }),
      geometry: v.object({
        sdAlignment: v.number(),
        sdLevel: v.number(),
        sdGauge: v.number(),
        sdTwist: v.number(),
      }),
    }),
    trackClassId: v.string(),
    trackClassLabel: v.string(),
    mgt: v.number(),
    annualTonnage: v.number(),
    tqi: v.number(),
    tqiCategory: v.string(),
    effectiveMaxSpeed: v.number(),
    designSpeed: v.number(),
    overallStatus: v.string(),
    statusLabel: v.string(),
    issueCount: v.number(),
    fullResult: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db.insert("trackCalculations", {
      userId: user._id,
      segmentName: args.segmentName,
      staStart: args.staStart,
      staEnd: args.staEnd,
      input: args.input,
      trackClassId: args.trackClassId,
      trackClassLabel: args.trackClassLabel,
      mgt: args.mgt,
      annualTonnage: args.annualTonnage,
      tqi: args.tqi,
      tqiCategory: args.tqiCategory,
      effectiveMaxSpeed: args.effectiveMaxSpeed,
      designSpeed: args.designSpeed,
      overallStatus: args.overallStatus,
      statusLabel: args.statusLabel,
      issueCount: args.issueCount,
      fullResult: args.fullResult,
      calculatedAt: new Date().toISOString(),
      note: args.note,
    });
  },
});

/** Get paginated history for the current user */
export const listMy = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("trackCalculations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Get all calculations for current user (for charts, limited to recent 200) */
export const getAllForCharts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("trackCalculations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(200);
  },
});

/** Get a single calculation by ID */
export const getById = query({
  args: { id: v.id("trackCalculations") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ message: "Data tidak ditemukan", code: "NOT_FOUND" });
    }
    return doc;
  },
});

/** Delete a calculation */
export const remove = mutation({
  args: { id: v.id("trackCalculations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ message: "Data tidak ditemukan", code: "NOT_FOUND" });
    }
    if (doc.userId !== user._id) {
      throw new ConvexError({ message: "Tidak memiliki akses", code: "FORBIDDEN" });
    }
    await ctx.db.delete(args.id);
  },
});

/** Update note on a calculation */
export const updateNote = mutation({
  args: {
    id: v.id("trackCalculations"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ message: "Data tidak ditemukan", code: "NOT_FOUND" });
    }
    if (doc.userId !== user._id) {
      throw new ConvexError({ message: "Tidak memiliki akses", code: "FORBIDDEN" });
    }
    await ctx.db.patch(args.id, { note: args.note });
  },
});
