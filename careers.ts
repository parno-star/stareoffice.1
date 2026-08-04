import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// ---- Competencies ------------------------------------------------------

export const listCompetencies = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Array<Doc<"competencies">>> => {
    await requireUser(ctx);
    const rows = args.activeOnly
      ? await ctx.db
          .query("competencies")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect()
      : await ctx.db.query("competencies").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getCompetency = query({
  args: { id: v.id("competencies") },
  handler: async (ctx, args): Promise<Doc<"competencies"> | null> => {
    await requireUser(ctx);
    return await ctx.db.get(args.id);
  },
});

export const createCompetency = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.string(),
    levelDescriptors: v.array(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"competencies">> => {
    const admin = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama kompetensi wajib diisi",
      });
    }
    if (args.levelDescriptors.length !== 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Harus menyediakan 5 level deskriptor",
      });
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("competencies", {
      name,
      description: args.description,
      category: args.category,
      levelDescriptors: args.levelDescriptors,
      color: args.color,
      icon: args.icon,
      isActive: args.isActive,
      authorId: admin._id,
      lastEditorId: admin._id,
      lastEditedAt: now,
    });
  },
});

export const updateCompetency = mutation({
  args: {
    id: v.id("competencies"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    levelDescriptors: v.array(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama kompetensi wajib diisi",
      });
    }
    if (args.levelDescriptors.length !== 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Harus menyediakan 5 level deskriptor",
      });
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, {
      name,
      description: args.description,
      category: args.category,
      levelDescriptors: args.levelDescriptors,
      color: args.color,
      icon: args.icon,
      isActive: args.isActive,
      lastEditorId: admin._id,
      lastEditedAt: now,
    });
    return null;
  },
});

export const deleteCompetency = mutation({
  args: { id: v.id("competencies") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Clean up linked expectations, courses, and assessments.
    const expectations = await ctx.db
      .query("careerLevelCompetencies")
      .withIndex("by_competency", (q) => q.eq("competencyId", args.id))
      .collect();
    for (const row of expectations) await ctx.db.delete(row._id);
    const courseLinks = await ctx.db
      .query("competencyCourses")
      .withIndex("by_competency", (q) => q.eq("competencyId", args.id))
      .collect();
    for (const row of courseLinks) await ctx.db.delete(row._id);
    const assessments = await ctx.db
      .query("competencyAssessments")
      .withIndex("by_competency", (q) => q.eq("competencyId", args.id))
      .collect();
    for (const row of assessments) await ctx.db.delete(row._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Career tracks ------------------------------------------------------

export const listTracks = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<Doc<"careerTracks"> & { levels: Array<Doc<"careerLevels">> }>
  > => {
    await requireUser(ctx);
    const tracks = args.activeOnly
      ? await ctx.db
          .query("careerTracks")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect()
      : await ctx.db.query("careerTracks").collect();
    tracks.sort((a, b) => a.name.localeCompare(b.name));
    const result: Array<
      Doc<"careerTracks"> & { levels: Array<Doc<"careerLevels">> }
    > = [];
    for (const t of tracks) {
      const levels = await ctx.db
        .query("careerLevels")
        .withIndex("by_track_and_order", (q) => q.eq("trackId", t._id))
        .collect();
      levels.sort((a, b) => a.order - b.order);
      result.push({ ...t, levels });
    }
    return result;
  },
});

export const getTrackDetail = query({
  args: { id: v.id("careerTracks") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    track: Doc<"careerTracks">;
    levels: Array<
      Omit<Doc<"careerLevels">, "expectations"> & {
        expectationsText?: string;
        expectations: Array<
          Doc<"careerLevelCompetencies"> & {
            competency: Doc<"competencies"> | null;
          }
        >;
      }
    >;
  } | null> => {
    await requireUser(ctx);
    const track = await ctx.db.get(args.id);
    if (!track) return null;
    const levels = await ctx.db
      .query("careerLevels")
      .withIndex("by_track_and_order", (q) => q.eq("trackId", track._id))
      .collect();
    levels.sort((a, b) => a.order - b.order);
    const detailedLevels: Array<
      Omit<Doc<"careerLevels">, "expectations"> & {
        expectationsText?: string;
        expectations: Array<
          Doc<"careerLevelCompetencies"> & {
            competency: Doc<"competencies"> | null;
          }
        >;
      }
    > = [];
    for (const lv of levels) {
      const expectations = await ctx.db
        .query("careerLevelCompetencies")
        .withIndex("by_level", (q) => q.eq("levelId", lv._id))
        .collect();
      const enriched = await Promise.all(
        expectations.map(async (e) => ({
          ...e,
          competency: await ctx.db.get(e.competencyId),
        })),
      );
      const { expectations: expectationsText, ...rest } = lv;
      detailedLevels.push({
        ...rest,
        expectationsText,
        expectations: enriched,
      });
    }
    return { track, levels: detailedLevels };
  },
});

export const createTrack = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    department: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"careerTracks">> => {
    const admin = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama jalur wajib diisi",
      });
    }
    return await ctx.db.insert("careerTracks", {
      name,
      description: args.description,
      department: args.department,
      color: args.color,
      icon: args.icon,
      isActive: args.isActive,
      authorId: admin._id,
      levelCount: 0,
    });
  },
});

export const updateTrack = mutation({
  args: {
    id: v.id("careerTracks"),
    name: v.string(),
    description: v.string(),
    department: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama jalur wajib diisi",
      });
    }
    await ctx.db.patch(args.id, {
      name,
      description: args.description,
      department: args.department,
      color: args.color,
      icon: args.icon,
      isActive: args.isActive,
    });
    return null;
  },
});

export const deleteTrack = mutation({
  args: { id: v.id("careerTracks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const levels = await ctx.db
      .query("careerLevels")
      .withIndex("by_track", (q) => q.eq("trackId", args.id))
      .collect();
    for (const lv of levels) {
      const exp = await ctx.db
        .query("careerLevelCompetencies")
        .withIndex("by_level", (q) => q.eq("levelId", lv._id))
        .collect();
      for (const e of exp) await ctx.db.delete(e._id);
      await ctx.db.delete(lv._id);
    }
    const assignments = await ctx.db
      .query("careerAssignments")
      .withIndex("by_track", (q) => q.eq("trackId", args.id))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Levels -------------------------------------------------------------

async function recalcLevelCount(
  ctx: MutationCtx,
  trackId: Id<"careerTracks">,
) {
  const track = await ctx.db.get(trackId);
  if (!track) return;
  const levels = await ctx.db
    .query("careerLevels")
    .withIndex("by_track", (q) => q.eq("trackId", trackId))
    .collect();
  await ctx.db.patch(trackId, { levelCount: levels.length });
}

export const createLevel = mutation({
  args: {
    trackId: v.id("careerTracks"),
    title: v.string(),
    levelGrade: v.string(),
    description: v.optional(v.string()),
    minYearsInLevel: v.optional(v.number()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    expectations: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"careerLevels">> => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("careerLevels")
      .withIndex("by_track", (q) => q.eq("trackId", args.trackId))
      .collect();
    const order = existing.length + 1;
    const id = await ctx.db.insert("careerLevels", {
      trackId: args.trackId,
      title: args.title.trim(),
      levelGrade: args.levelGrade,
      description: args.description,
      minYearsInLevel: args.minYearsInLevel,
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      expectations: args.expectations,
      order,
    });
    await recalcLevelCount(ctx, args.trackId);
    return id;
  },
});

export const updateLevel = mutation({
  args: {
    id: v.id("careerLevels"),
    title: v.string(),
    levelGrade: v.string(),
    description: v.optional(v.string()),
    minYearsInLevel: v.optional(v.number()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    expectations: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      levelGrade: args.levelGrade,
      description: args.description,
      minYearsInLevel: args.minYearsInLevel,
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      expectations: args.expectations,
    });
    return null;
  },
});

export const deleteLevel = mutation({
  args: { id: v.id("careerLevels") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const level = await ctx.db.get(args.id);
    if (!level) return null;
    // Delete expectations
    const expectations = await ctx.db
      .query("careerLevelCompetencies")
      .withIndex("by_level", (q) => q.eq("levelId", args.id))
      .collect();
    for (const e of expectations) await ctx.db.delete(e._id);
    await ctx.db.delete(args.id);
    // Compact orders
    const rest = await ctx.db
      .query("careerLevels")
      .withIndex("by_track_and_order", (q) => q.eq("trackId", level.trackId))
      .collect();
    rest.sort((a, b) => a.order - b.order);
    for (let i = 0; i < rest.length; i++) {
      const desired = i + 1;
      if (rest[i].order !== desired) {
        await ctx.db.patch(rest[i]._id, { order: desired });
      }
    }
    await recalcLevelCount(ctx, level.trackId);
    return null;
  },
});

export const reorderLevel = mutation({
  args: {
    id: v.id("careerLevels"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const level = await ctx.db.get(args.id);
    if (!level) return null;
    const all = await ctx.db
      .query("careerLevels")
      .withIndex("by_track_and_order", (q) => q.eq("trackId", level.trackId))
      .collect();
    all.sort((a, b) => a.order - b.order);
    const idx = all.findIndex((l) => l._id === args.id);
    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= all.length) return null;
    const other = all[swapIdx];
    await ctx.db.patch(level._id, { order: other.order });
    await ctx.db.patch(other._id, { order: level.order });
    return null;
  },
});

// ---- Level expectations -------------------------------------------------

export const setLevelExpectation = mutation({
  args: {
    levelId: v.id("careerLevels"),
    competencyId: v.id("competencies"),
    expectedLevel: v.number(),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const level = await ctx.db.get(args.levelId);
    if (!level) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Level tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("careerLevelCompetencies")
      .withIndex("by_level_and_competency", (q) =>
        q.eq("levelId", args.levelId).eq("competencyId", args.competencyId),
      )
      .unique();
    const clamped = Math.max(1, Math.min(5, Math.round(args.expectedLevel)));
    if (existing) {
      await ctx.db.patch(existing._id, {
        expectedLevel: clamped,
        weight: args.weight,
      });
    } else {
      await ctx.db.insert("careerLevelCompetencies", {
        levelId: args.levelId,
        trackId: level.trackId,
        competencyId: args.competencyId,
        expectedLevel: clamped,
        weight: args.weight,
      });
    }
    return null;
  },
});

export const removeLevelExpectation = mutation({
  args: { id: v.id("careerLevelCompetencies") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Assignments --------------------------------------------------------

export const listAssignments = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      assignment: Doc<"careerAssignments">;
      user: Doc<"users"> | null;
      track: Doc<"careerTracks"> | null;
      currentLevel: Doc<"careerLevels"> | null;
      targetLevel: Doc<"careerLevels"> | null;
    }>
  > => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("careerAssignments").collect();
    return await Promise.all(
      rows.map(async (a) => ({
        assignment: a,
        user: await ctx.db.get(a.userId),
        track: await ctx.db.get(a.trackId),
        currentLevel: await ctx.db.get(a.currentLevelId),
        targetLevel: a.targetLevelId
          ? await ctx.db.get(a.targetLevelId)
          : null,
      })),
    );
  },
});

export const getMyAssignment = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    assignment: Doc<"careerAssignments">;
    track: Doc<"careerTracks">;
    currentLevel: Doc<"careerLevels">;
    targetLevel: Doc<"careerLevels"> | null;
    allLevels: Array<Doc<"careerLevels">>;
  } | null> => {
    const user = await requireUser(ctx);
    const assignments = await ctx.db
      .query("careerAssignments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (assignments.length === 0) return null;
    const assignment = assignments[0];
    const track = await ctx.db.get(assignment.trackId);
    const currentLevel = await ctx.db.get(assignment.currentLevelId);
    if (!track || !currentLevel) return null;
    const targetLevel = assignment.targetLevelId
      ? await ctx.db.get(assignment.targetLevelId)
      : null;
    const allLevels = await ctx.db
      .query("careerLevels")
      .withIndex("by_track_and_order", (q) => q.eq("trackId", track._id))
      .collect();
    allLevels.sort((a, b) => a.order - b.order);
    return { assignment, track, currentLevel, targetLevel, allLevels };
  },
});

export const upsertAssignment = mutation({
  args: {
    userId: v.id("users"),
    trackId: v.id("careerTracks"),
    currentLevelId: v.id("careerLevels"),
    targetLevelId: v.optional(v.id("careerLevels")),
    startedAt: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"careerAssignments">> => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("careerAssignments")
      .withIndex("by_user_and_track", (q) =>
        q.eq("userId", args.userId).eq("trackId", args.trackId),
      )
      .unique();
    if (existing) {
      const prevLevelId = existing.currentLevelId;
      const promoted =
        prevLevelId !== args.currentLevelId
          ? new Date().toISOString()
          : existing.promotedAt;
      await ctx.db.patch(existing._id, {
        currentLevelId: args.currentLevelId,
        targetLevelId: args.targetLevelId,
        startedAt: args.startedAt,
        note: args.note,
        promotedAt: promoted,
        assignedById: admin._id,
      });
      return existing._id;
    }
    // Remove other assignments so each user has a single primary track.
    const others = await ctx.db
      .query("careerAssignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const other of others) await ctx.db.delete(other._id);
    return await ctx.db.insert("careerAssignments", {
      userId: args.userId,
      trackId: args.trackId,
      currentLevelId: args.currentLevelId,
      targetLevelId: args.targetLevelId,
      startedAt: args.startedAt,
      promotedAt: undefined,
      note: args.note,
      assignedById: admin._id,
    });
  },
});

export const removeAssignment = mutation({
  args: { id: v.id("careerAssignments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Assessments --------------------------------------------------------

export const listMyAssessments = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<Doc<"competencyAssessments">>> => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("competencyAssessments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listAssessmentsForUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"competencyAssessments">>> => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("competencyAssessments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const saveSelfAssessment = mutation({
  args: {
    competencyId: v.id("competencies"),
    level: v.number(),
    notes: v.optional(v.string()),
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const clamped = Math.max(1, Math.min(5, Math.round(args.level)));
    const existing = await ctx.db
      .query("competencyAssessments")
      .withIndex("by_user_and_competency", (q) =>
        q.eq("userId", user._id).eq("competencyId", args.competencyId),
      )
      .filter((q) => q.eq(q.field("kind"), "self"))
      .collect();
    const now = new Date().toISOString();
    if (existing.length > 0) {
      const row = existing[0];
      await ctx.db.patch(row._id, {
        level: clamped,
        notes: args.notes,
        period: args.period,
        periodLabel: args.periodLabel,
        assessedById: user._id,
        assessedAt: now,
      });
      // Clean up duplicates if any legacy dupes exist.
      for (let i = 1; i < existing.length; i++) {
        await ctx.db.delete(existing[i]._id);
      }
      return row._id;
    }
    return await ctx.db.insert("competencyAssessments", {
      userId: user._id,
      competencyId: args.competencyId,
      kind: "self",
      level: clamped,
      notes: args.notes,
      period: args.period,
      periodLabel: args.periodLabel,
      assessedById: user._id,
      assessedAt: now,
    });
  },
});

export const saveManagerAssessment = mutation({
  args: {
    userId: v.id("users"),
    competencyId: v.id("competencies"),
    level: v.number(),
    notes: v.optional(v.string()),
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const clamped = Math.max(1, Math.min(5, Math.round(args.level)));
    const existing = await ctx.db
      .query("competencyAssessments")
      .withIndex("by_user_and_competency", (q) =>
        q.eq("userId", args.userId).eq("competencyId", args.competencyId),
      )
      .filter((q) => q.eq(q.field("kind"), "manager"))
      .collect();
    const now = new Date().toISOString();
    if (existing.length > 0) {
      const row = existing[0];
      await ctx.db.patch(row._id, {
        level: clamped,
        notes: args.notes,
        period: args.period,
        periodLabel: args.periodLabel,
        assessedById: admin._id,
        assessedAt: now,
      });
      for (let i = 1; i < existing.length; i++) {
        await ctx.db.delete(existing[i]._id);
      }
      return row._id;
    }
    return await ctx.db.insert("competencyAssessments", {
      userId: args.userId,
      competencyId: args.competencyId,
      kind: "manager",
      level: clamped,
      notes: args.notes,
      period: args.period,
      periodLabel: args.periodLabel,
      assessedById: admin._id,
      assessedAt: now,
    });
  },
});

// ---- Competency <-> course links ----------------------------------------

export const listCompetencyCourses = query({
  args: { competencyId: v.id("competencies") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<
      Doc<"competencyCourses"> & { course: Doc<"courses"> | null }
    >
  > => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("competencyCourses")
      .withIndex("by_competency", (q) =>
        q.eq("competencyId", args.competencyId),
      )
      .collect();
    return await Promise.all(
      rows.map(async (r) => ({
        ...r,
        course: await ctx.db.get(r.courseId),
      })),
    );
  },
});

export const addCompetencyCourse = mutation({
  args: {
    competencyId: v.id("competencies"),
    courseId: v.id("courses"),
    levelImpact: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("competencyCourses")
      .withIndex("by_competency_and_course", (q) =>
        q.eq("competencyId", args.competencyId).eq("courseId", args.courseId),
      )
      .unique();
    const clamped = Math.max(1, Math.min(5, Math.round(args.levelImpact)));
    if (existing) {
      await ctx.db.patch(existing._id, { levelImpact: clamped });
      return existing._id;
    }
    return await ctx.db.insert("competencyCourses", {
      competencyId: args.competencyId,
      courseId: args.courseId,
      levelImpact: clamped,
    });
  },
});

export const removeCompetencyCourse = mutation({
  args: { id: v.id("competencyCourses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- My career overview -------------------------------------------------

export type CompetencyGap = {
  competency: Doc<"competencies">;
  expectedLevel: number;
  currentLevel: number;
  selfLevel: number | null;
  managerLevel: number | null;
  courseLevel: number | null;
  gap: number;
  // Courses that develop this competency (not yet completed)
  recommendedCourses: Array<{ courseId: Id<"courses">; title: string }>;
};

export const getMyCareerOverview = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    assignment: Doc<"careerAssignments"> | null;
    track: Doc<"careerTracks"> | null;
    currentLevel: Doc<"careerLevels"> | null;
    targetLevel: Doc<"careerLevels"> | null;
    allLevels: Array<Doc<"careerLevels">>;
    targetGaps: Array<CompetencyGap>;
    currentGaps: Array<CompetencyGap>;
    readinessPercent: number;
  }> => {
    const user = await requireUser(ctx);
    const assignments = await ctx.db
      .query("careerAssignments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const assignment = assignments[0] ?? null;
    if (!assignment) {
      return {
        assignment: null,
        track: null,
        currentLevel: null,
        targetLevel: null,
        allLevels: [],
        targetGaps: [],
        currentGaps: [],
        readinessPercent: 0,
      };
    }
    const track = await ctx.db.get(assignment.trackId);
    const currentLevel = await ctx.db.get(assignment.currentLevelId);
    const targetLevel = assignment.targetLevelId
      ? await ctx.db.get(assignment.targetLevelId)
      : null;
    const allLevels = track
      ? await ctx.db
          .query("careerLevels")
          .withIndex("by_track_and_order", (q) =>
            q.eq("trackId", track._id),
          )
          .collect()
      : [];
    allLevels.sort((a, b) => a.order - b.order);

    // Gather all assessments for this user
    const assessments = await ctx.db
      .query("competencyAssessments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Enrolled completed courses -> grants competency levels
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const completedCourseIds = new Set(
      enrollments
        .filter((e) => e.completedAt !== undefined)
        .map((e) => e.courseId),
    );

    async function buildGaps(
      levelId: Id<"careerLevels">,
    ): Promise<Array<CompetencyGap>> {
      const expectations = await ctx.db
        .query("careerLevelCompetencies")
        .withIndex("by_level", (q) => q.eq("levelId", levelId))
        .collect();
      const gaps: Array<CompetencyGap> = [];
      for (const exp of expectations) {
        const competency = await ctx.db.get(exp.competencyId);
        if (!competency) continue;
        const compAssessments = assessments.filter(
          (a) => a.competencyId === exp.competencyId,
        );
        const selfA = compAssessments.find((a) => a.kind === "self");
        const mgrA = compAssessments.find((a) => a.kind === "manager");
        const selfLevel = selfA ? selfA.level : null;
        const managerLevel = mgrA ? mgrA.level : null;

        // Course-granted level
        const links = await ctx.db
          .query("competencyCourses")
          .withIndex("by_competency", (q) =>
            q.eq("competencyId", exp.competencyId),
          )
          .collect();
        let courseLevel: number | null = null;
        const recommendedCourses: Array<{
          courseId: Id<"courses">;
          title: string;
        }> = [];
        for (const link of links) {
          const course = await ctx.db.get(link.courseId);
          if (!course || !course.isPublished) continue;
          if (completedCourseIds.has(link.courseId)) {
            if (courseLevel === null || link.levelImpact > courseLevel) {
              courseLevel = link.levelImpact;
            }
          } else {
            recommendedCourses.push({
              courseId: link.courseId,
              title: course.title,
            });
          }
        }
        const effectiveLevel = Math.max(
          managerLevel ?? 0,
          selfLevel ?? 0,
          courseLevel ?? 0,
        );
        gaps.push({
          competency,
          expectedLevel: exp.expectedLevel,
          currentLevel: effectiveLevel,
          selfLevel,
          managerLevel,
          courseLevel,
          gap: Math.max(0, exp.expectedLevel - effectiveLevel),
          recommendedCourses,
        });
      }
      gaps.sort((a, b) => b.gap - a.gap || a.competency.name.localeCompare(b.competency.name));
      return gaps;
    }

    const targetId = targetLevel?._id ?? currentLevel?._id ?? null;
    const targetGaps = targetId ? await buildGaps(targetId) : [];
    const currentGaps = currentLevel
      ? await buildGaps(currentLevel._id)
      : [];

    // Readiness: percent of expected competency points already covered.
    let totalExpected = 0;
    let totalCovered = 0;
    for (const g of targetGaps) {
      totalExpected += g.expectedLevel;
      totalCovered += Math.min(g.expectedLevel, g.currentLevel);
    }
    const readinessPercent =
      totalExpected === 0 ? 0 : Math.round((totalCovered / totalExpected) * 100);

    return {
      assignment,
      track,
      currentLevel,
      targetLevel,
      allLevels,
      targetGaps,
      currentGaps,
      readinessPercent,
    };
  },
});

// ---- Stats --------------------------------------------------------------

export const getCareerStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    competencyCount: number;
    trackCount: number;
    assignedUsers: number;
    totalUsers: number;
    averageReadiness: number;
  }> => {
    await requireAdmin(ctx);
    const competencies = await ctx.db.query("competencies").collect();
    const tracks = await ctx.db.query("careerTracks").collect();
    const allUsers = await ctx.db.query("users").collect();
    const assignments = await ctx.db.query("careerAssignments").collect();
    const assigned = new Set(assignments.map((a) => a.userId));

    // Compute average readiness across users with assignments
    let totalReadiness = 0;
    let readinessCount = 0;
    for (const assignment of assignments) {
      const targetId =
        assignment.targetLevelId ?? assignment.currentLevelId;
      const expectations = await ctx.db
        .query("careerLevelCompetencies")
        .withIndex("by_level", (q) => q.eq("levelId", targetId))
        .collect();
      if (expectations.length === 0) continue;
      const assessments = await ctx.db
        .query("competencyAssessments")
        .withIndex("by_user", (q) => q.eq("userId", assignment.userId))
        .collect();
      const enrollments = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_user", (q) => q.eq("userId", assignment.userId))
        .collect();
      const completedCourseIds = new Set(
        enrollments.filter((e) => e.completedAt).map((e) => e.courseId),
      );
      let expected = 0;
      let covered = 0;
      for (const exp of expectations) {
        const compAssessments = assessments.filter(
          (a) => a.competencyId === exp.competencyId,
        );
        const selfLevel =
          compAssessments.find((a) => a.kind === "self")?.level ?? 0;
        const managerLevel =
          compAssessments.find((a) => a.kind === "manager")?.level ?? 0;
        const links = await ctx.db
          .query("competencyCourses")
          .withIndex("by_competency", (q) =>
            q.eq("competencyId", exp.competencyId),
          )
          .collect();
        let courseLevel = 0;
        for (const link of links) {
          if (completedCourseIds.has(link.courseId)) {
            courseLevel = Math.max(courseLevel, link.levelImpact);
          }
        }
        const effective = Math.max(selfLevel, managerLevel, courseLevel);
        expected += exp.expectedLevel;
        covered += Math.min(exp.expectedLevel, effective);
      }
      totalReadiness += expected === 0 ? 0 : (covered / expected) * 100;
      readinessCount += 1;
    }
    return {
      competencyCount: competencies.length,
      trackCount: tracks.length,
      assignedUsers: assigned.size,
      totalUsers: allUsers.length,
      averageReadiness:
        readinessCount === 0
          ? 0
          : Math.round(totalReadiness / readinessCount),
    };
  },
});
