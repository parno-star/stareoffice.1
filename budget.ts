import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Course bookmarks / wishlist.

export const listMyBookmarks = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<
      Doc<"courses"> & {
        bookmarkId: Id<"courseBookmarks">;
      }
    >
  > => {
    const user = await requireUser(ctx);
    const bookmarks = await ctx.db
      .query("courseBookmarks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    bookmarks.sort((a, b) => b._creationTime - a._creationTime);
    const out: Array<
      Doc<"courses"> & { bookmarkId: Id<"courseBookmarks"> }
    > = [];
    for (const b of bookmarks) {
      const c = await ctx.db.get(b.courseId);
      if (c) out.push({ ...c, bookmarkId: b._id });
    }
    return out;
  },
});

export const isBookmarked = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await requireUser(ctx);
    const row = await ctx.db
      .query("courseBookmarks")
      .withIndex("by_user_and_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .unique();
    return row !== null;
  },
});

export const toggleBookmark = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<{ bookmarked: boolean }> => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("courseBookmarks")
      .withIndex("by_user_and_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { bookmarked: false };
    }
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    await ctx.db.insert("courseBookmarks", {
      userId: user._id,
      courseId: args.courseId,
    });
    return { bookmarked: true };
  },
});

// -------- Training budgets --------

export const listBudgets = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<
      Doc<"trainingBudgets"> & {
        actualSpent: number;
      }
    >
  > => {
    await requireAdmin(ctx);
    const budgets = await ctx.db.query("trainingBudgets").collect();
    budgets.sort((a, b) => b.period.localeCompare(a.period));
    // Compute actual spent per budget based on approved external trainings + course costs.
    const approvedExternal = await ctx.db
      .query("externalTrainings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const out: Array<
      Doc<"trainingBudgets"> & { actualSpent: number }
    > = [];
    for (const b of budgets) {
      let spent = 0;
      // approved external trainings in the period
      for (const e of approvedExternal) {
        if (!e.cost) continue;
        // Match year/quarter by string prefix
        if (!e.completedDate.startsWith(b.period.slice(0, 4))) continue;
        if (b.department) {
          const u = await ctx.db.get(e.userId);
          if (u?.department !== b.department) continue;
        }
        spent += e.cost;
      }
      out.push({ ...b, actualSpent: spent });
    }
    return out;
  },
});

export const createBudget = mutation({
  args: {
    period: v.string(),
    periodLabel: v.string(),
    department: v.optional(v.string()),
    plannedAmount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"trainingBudgets">> => {
    const admin = await requireAdmin(ctx);
    return await ctx.db.insert("trainingBudgets", {
      period: args.period,
      periodLabel: args.periodLabel,
      department: args.department,
      plannedAmount: Math.max(0, Math.round(args.plannedAmount)),
      description: args.description?.trim() || undefined,
      createdBy: admin._id,
    });
  },
});

export const updateBudget = mutation({
  args: {
    id: v.id("trainingBudgets"),
    plannedAmount: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const patch: Partial<Doc<"trainingBudgets">> = {};
    if (args.plannedAmount !== undefined) {
      patch.plannedAmount = Math.max(0, Math.round(args.plannedAmount));
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const deleteBudget = mutation({
  args: { id: v.id("trainingBudgets") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// -------- Course cost --------

export const getCourseCost = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<Doc<"courseCosts"> | null> => {
    await requireUser(ctx);
    return await ctx.db
      .query("courseCosts")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
  },
});

export const setCourseCost = mutation({
  args: {
    courseId: v.id("courses"),
    amount: v.number(),
    model: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("courseCosts")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        amount: Math.max(0, Math.round(args.amount)),
        model: args.model,
        note: args.note?.trim() || undefined,
      });
    } else {
      await ctx.db.insert("courseCosts", {
        courseId: args.courseId,
        amount: Math.max(0, Math.round(args.amount)),
        model: args.model,
        note: args.note?.trim() || undefined,
      });
    }
    return null;
  },
});

// -------- Spend summary --------

export const getSpendSummary = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalPlanned: number;
    totalSpent: number;
    byDepartment: Array<{
      department: string;
      planned: number;
      spent: number;
    }>;
    byCategory: Array<{
      category: string;
      spent: number;
    }>;
  }> => {
    await requireAdmin(ctx);
    const budgets = await ctx.db.query("trainingBudgets").collect();
    const approvedExternal = await ctx.db
      .query("externalTrainings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const totalPlanned = budgets.reduce((s, b) => s + b.plannedAmount, 0);
    const totalSpent = approvedExternal.reduce(
      (s, e) => s + (e.cost ?? 0),
      0,
    );
    const deptSpentMap = new Map<string, number>();
    const catSpentMap = new Map<string, number>();
    for (const e of approvedExternal) {
      const cost = e.cost ?? 0;
      const u = await ctx.db.get(e.userId);
      const dept = u?.department ?? "Tanpa Departemen";
      deptSpentMap.set(dept, (deptSpentMap.get(dept) ?? 0) + cost);
      catSpentMap.set(e.category, (catSpentMap.get(e.category) ?? 0) + cost);
    }
    const deptPlannedMap = new Map<string, number>();
    for (const b of budgets) {
      const key = b.department ?? "Perusahaan";
      deptPlannedMap.set(key, (deptPlannedMap.get(key) ?? 0) + b.plannedAmount);
    }
    const departments = new Set([
      ...deptPlannedMap.keys(),
      ...deptSpentMap.keys(),
    ]);
    const byDepartment = Array.from(departments).map((d) => ({
      department: d,
      planned: deptPlannedMap.get(d) ?? 0,
      spent: deptSpentMap.get(d) ?? 0,
    }));
    byDepartment.sort((a, b) => b.spent - a.spent);
    const byCategory = Array.from(catSpentMap.entries()).map(
      ([category, spent]) => ({ category, spent }),
    );
    byCategory.sort((a, b) => b.spent - a.spent);
    return {
      totalPlanned,
      totalSpent,
      byDepartment,
      byCategory,
    };
  },
});
