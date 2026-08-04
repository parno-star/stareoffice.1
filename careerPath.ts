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

// ---- Types -------------------------------------------------------------

export type CareerPathWithMeta = Doc<"careerPaths"> & {
  authorName: string | null;
};

export type LevelProgress = {
  levelId: Id<"careerPathLevels">;
  order: number;
  title: string;
  // Percentage 0..100 completed for this level
  progressPercent: number;
  // Course progress details
  courses: Array<{
    courseId: Id<"courses">;
    title: string;
    progress: number; // 0..100
    completed: boolean;
  }>;
  // Whether all required courses completed
  coursesCompleted: boolean;
  // Performance requirement status
  performanceMet: boolean;
  performanceAverage: number | null;
  performancePeriodsMet: number;
  // Whether all requirements satisfied (used to auto-advance)
  allRequirementsMet: boolean;
};

export type AssignmentDetail = Doc<"careerPathAssignments"> & {
  path: Doc<"careerPaths"> | null;
  userName: string | null;
  userJobTitle: string | null;
  userAvatarUrl: string | null;
  userDepartment: string | null;
  currentLevel: Doc<"careerPathLevels"> | null;
  targetLevel: Doc<"careerPathLevels"> | null;
  targetLevelProgress: LevelProgress | null;
  mentorName: string | null;
};

// ---- Helpers -----------------------------------------------------------

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

async function requireAdmin(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya administrator yang dapat mengelola jenjang karier",
    });
  }
  return user;
}

function nowIso(): string {
  return new Date().toISOString();
}

// Compute user's enrollment progress for a specific course.
async function getCourseProgressForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  courseId: Id<"courses">,
): Promise<{ progress: number; completed: boolean }> {
  const enrollment = await ctx.db
    .query("courseEnrollments")
    .withIndex("by_course_and_user", (q) =>
      q.eq("courseId", courseId).eq("userId", userId),
    )
    .unique();
  if (!enrollment) return { progress: 0, completed: false };
  return {
    progress: enrollment.progress,
    completed: enrollment.completedAt !== undefined,
  };
}

// Compute average performance rating + number of qualifying review periods.
async function getPerformanceSnapshot(
  ctx: QueryCtx,
  userId: Id<"users">,
  minRating: number,
): Promise<{ average: number | null; qualifyingPeriods: number }> {
  const reviews = await ctx.db
    .query("performanceReviews")
    .withIndex("by_reviewee", (q) => q.eq("revieweeId", userId))
    .collect();
  const finalizedReviews = reviews.filter(
    (r) =>
      (r.status === "submitted" || r.status === "acknowledged") &&
      typeof r.overallRating === "number",
  );
  if (finalizedReviews.length === 0) {
    return { average: null, qualifyingPeriods: 0 };
  }
  const total = finalizedReviews.reduce(
    (sum, r) => sum + (r.overallRating ?? 0),
    0,
  );
  const average = total / finalizedReviews.length;
  const qualifyingPeriods = finalizedReviews.filter(
    (r) => (r.overallRating ?? 0) >= minRating,
  ).length;
  return { average, qualifyingPeriods };
}

async function computeLevelProgress(
  ctx: QueryCtx,
  userId: Id<"users">,
  level: Doc<"careerPathLevels">,
): Promise<LevelProgress> {
  // Courses
  const courseDetails: Array<{
    courseId: Id<"courses">;
    title: string;
    progress: number;
    completed: boolean;
  }> = [];
  for (const courseId of level.requiredCourseIds) {
    const course = await ctx.db.get(courseId);
    if (!course) continue;
    const { progress, completed } = await getCourseProgressForUser(
      ctx,
      userId,
      courseId,
    );
    courseDetails.push({
      courseId,
      title: course.title,
      progress,
      completed,
    });
  }
  const coursesCompleted =
    courseDetails.length === 0
      ? true
      : courseDetails.every((c) => c.completed);

  // Performance
  const minRating = level.minPerformanceRating ?? 0;
  const minPeriods = level.minReviewPeriods ?? 0;
  const perfSnapshot = await getPerformanceSnapshot(ctx, userId, minRating);
  const performanceMet =
    minRating <= 0
      ? true
      : (perfSnapshot.average ?? 0) >= minRating &&
        perfSnapshot.qualifyingPeriods >= minPeriods;

  // Overall progress percentage (weighted average courses 70% / performance 30%)
  const courseProgressAvg =
    courseDetails.length === 0
      ? 100
      : courseDetails.reduce((sum, c) => sum + c.progress, 0) /
        courseDetails.length;
  const performanceProgress =
    minRating <= 0
      ? 100
      : Math.min(
          100,
          Math.round(
            ((perfSnapshot.average ?? 0) / Math.max(minRating, 0.01)) * 100,
          ),
        );
  const progressPercent = Math.round(
    courseProgressAvg * 0.7 + performanceProgress * 0.3,
  );

  return {
    levelId: level._id,
    order: level.order,
    title: level.title,
    progressPercent: Math.max(0, Math.min(100, progressPercent)),
    courses: courseDetails,
    coursesCompleted,
    performanceMet,
    performanceAverage: perfSnapshot.average,
    performancePeriodsMet: perfSnapshot.qualifyingPeriods,
    allRequirementsMet: coursesCompleted && performanceMet,
  };
}

async function recomputePathLevelCount(
  ctx: MutationCtx,
  pathId: Id<"careerPaths">,
): Promise<void> {
  const levels = await ctx.db
    .query("careerPathLevels")
    .withIndex("by_path", (q) => q.eq("pathId", pathId))
    .collect();
  await ctx.db.patch(pathId, { levelCount: levels.length });
}

async function recomputePathAssigneeCount(
  ctx: MutationCtx,
  pathId: Id<"careerPaths">,
): Promise<void> {
  const assignments = await ctx.db
    .query("careerPathAssignments")
    .withIndex("by_path", (q) => q.eq("pathId", pathId))
    .collect();
  await ctx.db.patch(pathId, { assigneeCount: assignments.length });
}

// ---- Queries: Paths ----------------------------------------------------

export const listPaths = query({
  args: {
    track: v.optional(v.string()),
    department: v.optional(v.string()),
    search: v.optional(v.string()),
    includeUnpublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<CareerPathWithMeta>> => {
    await requireUser(ctx);
    const search = (args.search ?? "").trim();
    let rows: Array<Doc<"careerPaths">>;
    if (search.length > 0) {
      rows = await ctx.db
        .query("careerPaths")
        .withSearchIndex("search_title", (q) => {
          let builder = q.search("title", search);
          if (!args.includeUnpublished) {
            builder = builder.eq("isPublished", true);
          }
          if (args.track && args.track !== "all") {
            builder = builder.eq("track", args.track);
          }
          return builder;
        })
        .take(100);
    } else {
      const raw = await ctx.db.query("careerPaths").collect();
      rows = raw;
    }
    const filtered = rows.filter((p) => {
      if (!args.includeUnpublished && !p.isPublished) return false;
      if (args.track && args.track !== "all" && p.track !== args.track)
        return false;
      if (
        args.department &&
        args.department !== "all" &&
        p.department !== args.department
      )
        return false;
      return true;
    });

    filtered.sort((a, b) => b._creationTime - a._creationTime);

    const authorCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getAuthor = async (id: Id<"users">) => {
      if (authorCache.has(id)) return authorCache.get(id) ?? null;
      const u = await ctx.db.get(id);
      authorCache.set(id, u);
      return u;
    };

    const out: Array<CareerPathWithMeta> = [];
    for (const p of filtered) {
      const author = await getAuthor(p.authorId);
      out.push({ ...p, authorName: author?.name ?? null });
    }
    return out;
  },
});

export const getPath = query({
  args: { pathId: v.id("careerPaths") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    path: Doc<"careerPaths">;
    levels: Array<Doc<"careerPathLevels">>;
  } | null> => {
    await requireUser(ctx);
    const path = await ctx.db.get(args.pathId);
    if (!path) return null;
    const levels = await ctx.db
      .query("careerPathLevels")
      .withIndex("by_path_and_order", (q) => q.eq("pathId", args.pathId))
      .collect();
    levels.sort((a, b) => a.order - b.order);
    return { path, levels };
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalPaths: number;
    publishedPaths: number;
    totalAssignments: number;
    myAssignments: number;
  }> => {
    const user = await requireUser(ctx);
    const paths = await ctx.db.query("careerPaths").collect();
    const assignments = await ctx.db.query("careerPathAssignments").collect();
    const mine = assignments.filter((a) => a.userId === user._id);
    return {
      totalPaths: paths.length,
      publishedPaths: paths.filter((p) => p.isPublished).length,
      totalAssignments: assignments.length,
      myAssignments: mine.length,
    };
  },
});

// ---- Queries: Assignments ----------------------------------------------

export const listMyAssignments = query({
  args: {},
  handler: async (ctx): Promise<Array<AssignmentDetail>> => {
    const user = await requireUser(ctx);
    const assignments = await ctx.db
      .query("careerPathAssignments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return await hydrateAssignments(ctx, assignments);
  },
});

export const listPathAssignments = query({
  args: { pathId: v.id("careerPaths") },
  handler: async (ctx, args): Promise<Array<AssignmentDetail>> => {
    await requireUser(ctx);
    const assignments = await ctx.db
      .query("careerPathAssignments")
      .withIndex("by_path", (q) => q.eq("pathId", args.pathId))
      .collect();
    return await hydrateAssignments(ctx, assignments);
  },
});

async function hydrateAssignments(
  ctx: QueryCtx,
  assignments: Array<Doc<"careerPathAssignments">>,
): Promise<Array<AssignmentDetail>> {
  const out: Array<AssignmentDetail> = [];
  for (const a of assignments) {
    const path = await ctx.db.get(a.pathId);
    const user = await ctx.db.get(a.userId);
    const currentLevel = a.currentLevelId
      ? await ctx.db.get(a.currentLevelId)
      : null;
    const targetLevel = a.targetLevelId
      ? await ctx.db.get(a.targetLevelId)
      : null;
    const mentor = a.mentorId ? await ctx.db.get(a.mentorId) : null;
    const targetLevelProgress = targetLevel
      ? await computeLevelProgress(ctx, a.userId, targetLevel)
      : null;
    out.push({
      ...a,
      path,
      userName: user?.name ?? null,
      userJobTitle: user?.jobTitle ?? null,
      userAvatarUrl: user?.avatarUrl ?? null,
      userDepartment: user?.department ?? null,
      currentLevel,
      targetLevel,
      targetLevelProgress,
      mentorName: mentor?.name ?? null,
    });
  }
  return out;
}

export const getAssignmentProgress = query({
  args: { assignmentId: v.id("careerPathAssignments") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    assignment: Doc<"careerPathAssignments">;
    path: Doc<"careerPaths"> | null;
    levels: Array<
      Doc<"careerPathLevels"> & { progress: LevelProgress }
    >;
    currentLevelOrder: number;
  } | null> => {
    const viewer = await requireUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return null;
    // Only the assignee or admins can view detail
    if (assignment.userId !== viewer._id && !isAdminRole(viewer.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak bisa melihat progres karyawan lain",
      });
    }
    const path = await ctx.db.get(assignment.pathId);
    const rawLevels = await ctx.db
      .query("careerPathLevels")
      .withIndex("by_path_and_order", (q) =>
        q.eq("pathId", assignment.pathId),
      )
      .collect();
    rawLevels.sort((a, b) => a.order - b.order);
    const enriched: Array<Doc<"careerPathLevels"> & { progress: LevelProgress }> = [];
    for (const l of rawLevels) {
      const progress = await computeLevelProgress(ctx, assignment.userId, l);
      enriched.push({ ...l, progress });
    }
    return {
      assignment,
      path,
      levels: enriched,
      currentLevelOrder: assignment.currentLevelOrder ?? 0,
    };
  },
});

// ---- Mutations: Paths --------------------------------------------------

export const createPath = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    track: v.string(),
    department: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"careerPaths">> => {
    const admin = await requireAdmin(ctx);
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul tidak boleh kosong",
      });
    }
    return await ctx.db.insert("careerPaths", {
      title,
      description: args.description.trim(),
      track: args.track,
      department: args.department.trim(),
      coverColor: args.coverColor,
      icon: args.icon?.trim() || undefined,
      isPublished: false,
      authorId: admin._id,
      levelCount: 0,
      assigneeCount: 0,
    });
  },
});

export const updatePath = mutation({
  args: {
    pathId: v.id("careerPaths"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    track: v.optional(v.string()),
    department: v.optional(v.string()),
    coverColor: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);
    const path = await ctx.db.get(args.pathId);
    if (!path) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Path not found" });
    }
    const patch: Partial<Doc<"careerPaths">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim();
    if (args.track !== undefined) patch.track = args.track;
    if (args.department !== undefined)
      patch.department = args.department.trim();
    if (args.coverColor !== undefined) patch.coverColor = args.coverColor;
    if (args.icon !== undefined)
      patch.icon = args.icon.trim() || undefined;
    if (args.isPublished !== undefined) patch.isPublished = args.isPublished;
    await ctx.db.patch(args.pathId, patch);
  },
});

export const deletePath = mutation({
  args: { pathId: v.id("careerPaths") },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);
    const levels = await ctx.db
      .query("careerPathLevels")
      .withIndex("by_path", (q) => q.eq("pathId", args.pathId))
      .collect();
    for (const l of levels) await ctx.db.delete(l._id);
    const assignments = await ctx.db
      .query("careerPathAssignments")
      .withIndex("by_path", (q) => q.eq("pathId", args.pathId))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    await ctx.db.delete(args.pathId);
  },
});

// ---- Mutations: Levels -------------------------------------------------

export const createLevel = mutation({
  args: {
    pathId: v.id("careerPaths"),
    title: v.string(),
    summary: v.string(),
    description: v.optional(v.string()),
    targetJobTitle: v.optional(v.string()),
    targetGrade: v.optional(v.string()),
    estimatedMonths: v.optional(v.number()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    requiredCourseIds: v.array(v.id("courses")),
    minPerformanceRating: v.optional(v.number()),
    minReviewPeriods: v.optional(v.number()),
    requiredSkills: v.array(
      v.object({ skill: v.string(), level: v.number() }),
    ),
    extraRequirements: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"careerPathLevels">> => {
    await requireAdmin(ctx);
    const path = await ctx.db.get(args.pathId);
    if (!path) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Path not found" });
    }
    const existing = await ctx.db
      .query("careerPathLevels")
      .withIndex("by_path", (q) => q.eq("pathId", args.pathId))
      .collect();
    const order = existing.length + 1;
    const id = await ctx.db.insert("careerPathLevels", {
      pathId: args.pathId,
      order,
      title: args.title.trim(),
      summary: args.summary.trim(),
      description: args.description?.trim() || undefined,
      targetJobTitle: args.targetJobTitle?.trim() || undefined,
      targetGrade: args.targetGrade?.trim() || undefined,
      estimatedMonths: args.estimatedMonths,
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      requiredCourseIds: args.requiredCourseIds,
      minPerformanceRating: args.minPerformanceRating,
      minReviewPeriods: args.minReviewPeriods,
      requiredSkills: args.requiredSkills,
      extraRequirements: args.extraRequirements?.trim() || undefined,
    });
    await recomputePathLevelCount(ctx, args.pathId);
    return id;
  },
});

export const updateLevel = mutation({
  args: {
    levelId: v.id("careerPathLevels"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    targetJobTitle: v.optional(v.string()),
    targetGrade: v.optional(v.string()),
    estimatedMonths: v.optional(v.number()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    requiredCourseIds: v.optional(v.array(v.id("courses"))),
    minPerformanceRating: v.optional(v.number()),
    minReviewPeriods: v.optional(v.number()),
    requiredSkills: v.optional(
      v.array(v.object({ skill: v.string(), level: v.number() })),
    ),
    extraRequirements: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);
    const level = await ctx.db.get(args.levelId);
    if (!level) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Level not found" });
    }
    const patch: Partial<Doc<"careerPathLevels">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.summary !== undefined) patch.summary = args.summary.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.targetJobTitle !== undefined)
      patch.targetJobTitle = args.targetJobTitle.trim() || undefined;
    if (args.targetGrade !== undefined)
      patch.targetGrade = args.targetGrade.trim() || undefined;
    if (args.estimatedMonths !== undefined)
      patch.estimatedMonths = args.estimatedMonths;
    if (args.salaryMin !== undefined) patch.salaryMin = args.salaryMin;
    if (args.salaryMax !== undefined) patch.salaryMax = args.salaryMax;
    if (args.requiredCourseIds !== undefined)
      patch.requiredCourseIds = args.requiredCourseIds;
    if (args.minPerformanceRating !== undefined)
      patch.minPerformanceRating = args.minPerformanceRating;
    if (args.minReviewPeriods !== undefined)
      patch.minReviewPeriods = args.minReviewPeriods;
    if (args.requiredSkills !== undefined)
      patch.requiredSkills = args.requiredSkills;
    if (args.extraRequirements !== undefined)
      patch.extraRequirements = args.extraRequirements.trim() || undefined;
    await ctx.db.patch(args.levelId, patch);
  },
});

export const deleteLevel = mutation({
  args: { levelId: v.id("careerPathLevels") },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);
    const level = await ctx.db.get(args.levelId);
    if (!level) return;
    const pathId = level.pathId;
    await ctx.db.delete(args.levelId);
    // Re-number remaining levels
    const remaining = await ctx.db
      .query("careerPathLevels")
      .withIndex("by_path", (q) => q.eq("pathId", pathId))
      .collect();
    remaining.sort((a, b) => a.order - b.order);
    for (let i = 0; i < remaining.length; i++) {
      const expected = i + 1;
      if (remaining[i].order !== expected) {
        await ctx.db.patch(remaining[i]._id, { order: expected });
      }
    }
    await recomputePathLevelCount(ctx, pathId);
    // Clear any assignments pointing to removed level
    const assignments = await ctx.db
      .query("careerPathAssignments")
      .withIndex("by_path", (q) => q.eq("pathId", pathId))
      .collect();
    for (const a of assignments) {
      const patch: Partial<Doc<"careerPathAssignments">> = {};
      if (a.currentLevelId === args.levelId) {
        patch.currentLevelId = undefined;
        patch.currentLevelOrder = undefined;
      }
      if (a.targetLevelId === args.levelId) patch.targetLevelId = undefined;
      if (Object.keys(patch).length > 0) await ctx.db.patch(a._id, patch);
    }
  },
});

export const reorderLevels = mutation({
  args: {
    pathId: v.id("careerPaths"),
    orderedLevelIds: v.array(v.id("careerPathLevels")),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);
    for (let i = 0; i < args.orderedLevelIds.length; i++) {
      const id = args.orderedLevelIds[i];
      const level = await ctx.db.get(id);
      if (!level || level.pathId !== args.pathId) continue;
      await ctx.db.patch(id, { order: i + 1 });
    }
  },
});

// ---- Mutations: Assignments --------------------------------------------

export const assignEmployee = mutation({
  args: {
    pathId: v.id("careerPaths"),
    userId: v.id("users"),
    currentLevelId: v.optional(v.id("careerPathLevels")),
    targetLevelId: v.optional(v.id("careerPathLevels")),
    mentorId: v.optional(v.id("users")),
    mentorNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"careerPathAssignments">> => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("careerPathAssignments")
      .withIndex("by_path_and_user", (q) =>
        q.eq("pathId", args.pathId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Karyawan sudah ditugaskan di path ini",
      });
    }
    const currentLevel = args.currentLevelId
      ? await ctx.db.get(args.currentLevelId)
      : null;
    const id = await ctx.db.insert("careerPathAssignments", {
      pathId: args.pathId,
      userId: args.userId,
      currentLevelId: args.currentLevelId,
      currentLevelOrder: currentLevel?.order,
      targetLevelId: args.targetLevelId,
      status: "in_progress",
      mentorNote: args.mentorNote?.trim() || undefined,
      mentorId: args.mentorId,
      startedAt: nowIso(),
      assignedById: admin._id,
    });
    await recomputePathAssigneeCount(ctx, args.pathId);
    const path = await ctx.db.get(args.pathId);
    await notifyUser(ctx, {
      userId: args.userId,
      type: "career_path_assigned",
      title: "Jenjang karier baru",
      message: `Anda telah ditugaskan pada jenjang "${path?.title ?? "karier"}".`,
      link: "/career-path",
      actorId: admin._id,
    });
    return id;
  },
});

export const updateAssignment = mutation({
  args: {
    assignmentId: v.id("careerPathAssignments"),
    currentLevelId: v.optional(v.id("careerPathLevels")),
    targetLevelId: v.optional(v.id("careerPathLevels")),
    status: v.optional(v.string()),
    mentorId: v.optional(v.id("users")),
    mentorNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const viewer = await requireUser(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Assignment not found",
      });
    }
    const isAdmin = isAdminRole(viewer.role);
    if (!isAdmin && assignment.userId !== viewer._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak diizinkan memperbarui assignment ini",
      });
    }
    const patch: Partial<Doc<"careerPathAssignments">> = {};
    if (args.currentLevelId !== undefined) {
      // Only admins/mentors can change current level
      if (!isAdmin) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Hanya admin yang bisa mengubah level saat ini",
        });
      }
      const level = await ctx.db.get(args.currentLevelId);
      patch.currentLevelId = args.currentLevelId;
      patch.currentLevelOrder = level?.order;
    }
    if (args.targetLevelId !== undefined) {
      patch.targetLevelId = args.targetLevelId;
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.mentorId !== undefined) patch.mentorId = args.mentorId;
    if (args.mentorNote !== undefined)
      patch.mentorNote = args.mentorNote.trim() || undefined;
    patch.lastProgressAt = nowIso();
    await ctx.db.patch(args.assignmentId, patch);
  },
});

export const promoteToNextLevel = mutation({
  args: { assignmentId: v.id("careerPathAssignments") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireAdmin(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Assignment not found",
      });
    }
    const levels = await ctx.db
      .query("careerPathLevels")
      .withIndex("by_path_and_order", (q) =>
        q.eq("pathId", assignment.pathId),
      )
      .collect();
    levels.sort((a, b) => a.order - b.order);
    if (levels.length === 0) return;
    const currentOrder = assignment.currentLevelOrder ?? 0;
    const nextLevel = levels.find((l) => l.order > currentOrder);
    if (!nextLevel) {
      await ctx.db.patch(args.assignmentId, {
        status: "completed",
        lastProgressAt: nowIso(),
      });
      const path = await ctx.db.get(assignment.pathId);
      await notifyUser(ctx, {
        userId: assignment.userId,
        type: "career_path_completed",
        title: "Jenjang karier selesai",
        message: `Selamat! Anda telah menyelesaikan jenjang "${path?.title ?? "karier"}".`,
        link: "/career-path",
        actorId: admin._id,
      });
      return;
    }
    await ctx.db.patch(args.assignmentId, {
      currentLevelId: nextLevel._id,
      currentLevelOrder: nextLevel.order,
      targetLevelId: levels.find((l) => l.order > nextLevel.order)?._id,
      status: "in_progress",
      lastProgressAt: nowIso(),
    });
    const path = await ctx.db.get(assignment.pathId);
    await notifyUser(ctx, {
      userId: assignment.userId,
      type: "career_path_promoted",
      title: "Promosi jenjang karier",
      message: `Anda telah naik ke level "${nextLevel.title}" di jenjang "${path?.title ?? "karier"}".`,
      link: "/career-path",
      actorId: admin._id,
    });
  },
});

export const removeAssignment = mutation({
  args: { assignmentId: v.id("careerPathAssignments") },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return;
    const pathId = assignment.pathId;
    await ctx.db.delete(args.assignmentId);
    await recomputePathAssigneeCount(ctx, pathId);
  },
});
