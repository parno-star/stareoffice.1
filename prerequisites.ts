import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Course prerequisites: course A requires course B completed first.

export type PrereqRow = Doc<"coursePrerequisites"> & {
  prerequisiteTitle: string;
  prerequisiteCategory: string;
  completed: boolean;
};

export const listForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<Array<PrereqRow>> => {
    const viewer = await requireUser(ctx);
    const rows = await ctx.db
      .query("coursePrerequisites")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    const out: Array<PrereqRow> = [];
    for (const r of rows) {
      const course = await ctx.db.get(r.prerequisiteId);
      if (!course) continue;
      const enrollment = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", r.prerequisiteId).eq("userId", viewer._id),
        )
        .unique();
      out.push({
        ...r,
        prerequisiteTitle: course.title,
        prerequisiteCategory: course.category,
        completed: Boolean(enrollment?.completedAt),
      });
    }
    return out;
  },
});

export const addPrerequisite = mutation({
  args: {
    courseId: v.id("courses"),
    prerequisiteId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.courseId === args.prerequisiteId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kelas tidak bisa menjadi prasyarat dirinya sendiri",
      });
    }
    // Simple cycle check: ensure prerequisite's chain doesn't reach back.
    const visited = new Set<string>();
    const stack: Array<Id<"courses">> = [args.prerequisiteId];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur) break;
      if (String(cur) === String(args.courseId)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Ini akan menciptakan prasyarat melingkar",
        });
      }
      if (visited.has(String(cur))) continue;
      visited.add(String(cur));
      const nexts = await ctx.db
        .query("coursePrerequisites")
        .withIndex("by_course", (q) => q.eq("courseId", cur))
        .collect();
      for (const n of nexts) stack.push(n.prerequisiteId);
    }
    const existing = await ctx.db
      .query("coursePrerequisites")
      .withIndex("by_course_and_prereq", (q) =>
        q.eq("courseId", args.courseId).eq("prerequisiteId", args.prerequisiteId),
      )
      .unique();
    if (existing) return null;
    await ctx.db.insert("coursePrerequisites", {
      courseId: args.courseId,
      prerequisiteId: args.prerequisiteId,
    });
    return null;
  },
});

export const removePrerequisite = mutation({
  args: { id: v.id("coursePrerequisites") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// Check if user has completed all prerequisites of a course.
export const checkCanEnroll = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    canEnroll: boolean;
    missing: Array<{
      prerequisiteId: Id<"courses">;
      title: string;
    }>;
  }> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("coursePrerequisites")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    const missing: Array<{ prerequisiteId: Id<"courses">; title: string }> = [];
    for (const r of rows) {
      const enrollment = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", r.prerequisiteId).eq("userId", user._id),
        )
        .unique();
      if (!enrollment?.completedAt) {
        const c = await ctx.db.get(r.prerequisiteId);
        missing.push({
          prerequisiteId: r.prerequisiteId,
          title: c?.title ?? "Kelas prasyarat",
        });
      }
    }
    return {
      canEnroll: missing.length === 0,
      missing,
    };
  },
});
