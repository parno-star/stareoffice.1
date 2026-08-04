import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireUser, requireAdmin } from "./_helpers";

export type PathWithProgress = Doc<"learningPaths"> & {
  completedCount: number;
  totalCount: number;
  percent: number;
};

export const listPaths = query({
  args: { onlyPublished: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Array<PathWithProgress>> => {
    const user = await requireUser(ctx);
    const isAdmin = isAdminRole(user.role);
    const all = await ctx.db.query("learningPaths").order("desc").take(200);
    const filtered =
      args.onlyPublished || !isAdmin
        ? all.filter((p) => p.isPublished)
        : all;
    const out: Array<PathWithProgress> = [];
    for (const p of filtered) {
      const pcs = await ctx.db
        .query("learningPathCourses")
        .withIndex("by_path", (q) => q.eq("pathId", p._id))
        .collect();
      let completedCount = 0;
      for (const pc of pcs) {
        const enrollment = await ctx.db
          .query("courseEnrollments")
          .withIndex("by_course_and_user", (q) =>
            q.eq("courseId", pc.courseId).eq("userId", user._id),
          )
          .unique();
        if (enrollment?.completedAt) completedCount += 1;
      }
      const totalCount = pcs.length;
      const percent =
        totalCount === 0
          ? 0
          : Math.round((completedCount / totalCount) * 100);
      out.push({ ...p, completedCount, totalCount, percent });
    }
    return out;
  },
});

export const getPath = query({
  args: { id: v.id("learningPaths") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (PathWithProgress & {
        courses: Array<
          Doc<"courses"> & {
            order: number;
            enrollmentCompletedAt: string | null;
            progress: number;
          }
        >;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const path = await ctx.db.get(args.id);
    if (!path) return null;
    if (!path.isPublished && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Jalur pembelajaran belum dipublikasikan",
      });
    }
    const pcs = await ctx.db
      .query("learningPathCourses")
      .withIndex("by_path", (q) => q.eq("pathId", args.id))
      .collect();
    pcs.sort((a, b) => a.order - b.order);
    const courses: Array<
      Doc<"courses"> & {
        order: number;
        enrollmentCompletedAt: string | null;
        progress: number;
      }
    > = [];
    let completedCount = 0;
    for (const pc of pcs) {
      const c = await ctx.db.get(pc.courseId);
      if (!c) continue;
      const enrollment = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", pc.courseId).eq("userId", user._id),
        )
        .unique();
      if (enrollment?.completedAt) completedCount += 1;
      courses.push({
        ...c,
        order: pc.order,
        enrollmentCompletedAt: enrollment?.completedAt ?? null,
        progress: enrollment?.progress ?? 0,
      });
    }
    const totalCount = courses.length;
    const percent =
      totalCount === 0
        ? 0
        : Math.round((completedCount / totalCount) * 100);
    return {
      ...path,
      completedCount,
      totalCount,
      percent,
      courses,
    };
  },
});

export const createPath = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    category: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"learningPaths">> => {
    const admin = await requireAdmin(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul jalur wajib diisi",
      });
    }
    return await ctx.db.insert("learningPaths", {
      title,
      description: args.description.trim(),
      coverColor: args.coverColor,
      icon: args.icon?.trim() || undefined,
      category: args.category,
      isPublished: false,
      authorId: admin._id,
      courseCount: 0,
    });
  },
});

export const updatePath = mutation({
  args: {
    id: v.id("learningPaths"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    coverColor: v.optional(v.string()),
    icon: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const path = await ctx.db.get(args.id);
    if (!path) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Jalur tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"learningPaths">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim();
    if (args.coverColor !== undefined) patch.coverColor = args.coverColor;
    if (args.icon !== undefined)
      patch.icon = args.icon.trim() || undefined;
    if (args.category !== undefined) patch.category = args.category;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const setPathPublished = mutation({
  args: { id: v.id("learningPaths"), isPublished: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const path = await ctx.db.get(args.id);
    if (!path) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Jalur tidak ditemukan",
      });
    }
    if (args.isPublished && path.courseCount === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tambahkan minimal satu kelas sebelum publikasi",
      });
    }
    await ctx.db.patch(args.id, { isPublished: args.isPublished });
    return null;
  },
});

export const removePath = mutation({
  args: { id: v.id("learningPaths") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const pcs = await ctx.db
      .query("learningPathCourses")
      .withIndex("by_path", (q) => q.eq("pathId", args.id))
      .collect();
    for (const pc of pcs) await ctx.db.delete(pc._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

export const addCourseToPath = mutation({
  args: {
    pathId: v.id("learningPaths"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const path = await ctx.db.get(args.pathId);
    if (!path) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Jalur tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("learningPathCourses")
      .withIndex("by_path_and_course", (q) =>
        q.eq("pathId", args.pathId).eq("courseId", args.courseId),
      )
      .unique();
    if (existing) return null;
    const current = await ctx.db
      .query("learningPathCourses")
      .withIndex("by_path", (q) => q.eq("pathId", args.pathId))
      .collect();
    const nextOrder =
      current.length === 0
        ? 0
        : Math.max(...current.map((p) => p.order)) + 1;
    await ctx.db.insert("learningPathCourses", {
      pathId: args.pathId,
      courseId: args.courseId,
      order: nextOrder,
    });
    await ctx.db.patch(args.pathId, { courseCount: current.length + 1 });
    return null;
  },
});

export const removeCourseFromPath = mutation({
  args: {
    pathId: v.id("learningPaths"),
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("learningPathCourses")
      .withIndex("by_path_and_course", (q) =>
        q.eq("pathId", args.pathId).eq("courseId", args.courseId),
      )
      .unique();
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    const path = await ctx.db.get(args.pathId);
    if (path) {
      await ctx.db.patch(args.pathId, {
        courseCount: Math.max(0, path.courseCount - 1),
      });
    }
    return null;
  },
});

export const reorderCoursesInPath = mutation({
  args: {
    pathId: v.id("learningPaths"),
    orderedCourseIds: v.array(v.id("courses")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (let i = 0; i < args.orderedCourseIds.length; i += 1) {
      const row = await ctx.db
        .query("learningPathCourses")
        .withIndex("by_path_and_course", (q) =>
          q.eq("pathId", args.pathId).eq("courseId", args.orderedCourseIds[i]),
        )
        .unique();
      if (row) await ctx.db.patch(row._id, { order: i });
    }
    return null;
  },
});
