import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { canManageFinance } from "./roles";
import { requireTenant } from "./lib/tenant";
import { getActiveCategoryKeys } from "./expenseCategories";

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"expensePolicies">>> => {
    await requireUser(ctx);
    const policies = await ctx.db.query("expensePolicies").collect();
    // Return sorted by category
    return policies.sort((a, b) => a.category.localeCompare(b.category));
  },
});

export const upsert = mutation({
  args: {
    category: v.string(),
    maxAmountPerRequest: v.optional(v.number()),
    monthlyLimitPerUser: v.optional(v.number()),
    receiptRequiredAbove: v.optional(v.number()),
    requireDescription: v.boolean(),
    isActive: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const user = await requireUser(ctx);
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat mengelola kebijakan",
      });
    }
    const activeCategoryKeys = await getActiveCategoryKeys(ctx, organizationId);
    if (!activeCategoryKeys.has(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    const cleanNumber = (n?: number) =>
      n !== undefined && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;

    const existing = await ctx.db
      .query("expensePolicies")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .unique();

    const payload = {
      category: args.category,
      maxAmountPerRequest: cleanNumber(args.maxAmountPerRequest),
      monthlyLimitPerUser: cleanNumber(args.monthlyLimitPerUser),
      receiptRequiredAbove: cleanNumber(args.receiptRequiredAbove),
      requireDescription: args.requireDescription,
      isActive: args.isActive,
      note: args.note?.trim() || undefined,
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("expensePolicies", payload);
  },
});

export const remove = mutation({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat mengelola kebijakan",
      });
    }
    const existing = await ctx.db
      .query("expensePolicies")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
