import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireTenant } from "./lib/tenant";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

/** Get tour progress for the current user */
export const getMyProgress = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await requireUser(ctx);
      return await ctx.db
        .query("tourProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
    } catch {
      return null;
    }
  },
});

/** Initialize tour progress for a new user */
export const initialize = mutation({
  args: {
    totalSteps: v.number(),
    totalItems: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check if already exists
    const existing = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("tourProgress", {
      userId: user._id,
      organizationId: user.organizationId,
      currentStep: 0,
      totalSteps: args.totalSteps,
      tourCompleted: false,
      completedItems: [],
      totalItems: args.totalItems,
      checklistDismissed: false,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Advance the tour to a specific step */
export const setStep = mutation({
  args: { step: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!progress) {
      throw new ConvexError({ message: "Tour not initialized", code: "NOT_FOUND" });
    }

    await ctx.db.patch(progress._id, {
      currentStep: args.step,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Mark the spotlight tour as completed */
export const completeTour = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!progress) return;

    await ctx.db.patch(progress._id, {
      tourCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Toggle a checklist item */
export const toggleChecklistItem = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!progress) return;

    const items = progress.completedItems;
    const updated = items.includes(args.itemId)
      ? items.filter((id) => id !== args.itemId)
      : [...items, args.itemId];

    await ctx.db.patch(progress._id, {
      completedItems: updated,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Dismiss the checklist */
export const dismissChecklist = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!progress) return;

    await ctx.db.patch(progress._id, {
      checklistDismissed: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Reset tour (for restarting) */
export const resetTour = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!progress) return;

    await ctx.db.patch(progress._id, {
      currentStep: 0,
      tourCompleted: false,
      checklistDismissed: false,
      updatedAt: new Date().toISOString(),
    });
  },
});
