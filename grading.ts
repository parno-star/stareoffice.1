// WTW Global Grading System (GGS) backend.
// Provides position management, committee-based job evaluation, salary band
// management, employee-to-position mapping, re-grading history, and analytics.
//
// GGS scoring: 7 factors rated 1..7 each, weighted & summed into a 0..100 score.
// Final score -> global grade 1..25 via thresholds, adjusted by company size.
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ---- Factor definitions -------------------------------------------------
const FACTORS = [
  "functional_knowledge",
  "business_expertise",
  "leadership",
  "problem_solving",
  "nature_of_impact",
  "area_of_impact",
  "interpersonal_skills",
] as const;
type Factor = (typeof FACTORS)[number];

// Factor weights (must sum to 1.0). Based on WTW GGS guidance where Impact
// and Knowledge dominate for most roles.
const FACTOR_WEIGHTS: Record<Factor, number> = {
  functional_knowledge: 0.18,
  business_expertise: 0.12,
  leadership: 0.15,
  problem_solving: 0.15,
  nature_of_impact: 0.15,
  area_of_impact: 0.1,
  interpersonal_skills: 0.15,
};

// Size band adjustment (applied additively to final grade before clamping).
// Smaller companies have slightly lower grades; larger organizations shift up.
const SIZE_BAND_GRADE_SHIFT: Record<string, number> = {
  A: -2, // small
  B: -1,
  C: 0, // medium-large (default)
  D: 1,
  E: 2, // global enterprise
};

// Map weighted score (0..100) -> base global grade 1..25 (linear mapping).
function scoreToBaseGrade(score: number): number {
  // Score range: weights sum to 1; each factor 1..7 -> score 1..7 (avg).
  // We scale: base score = (avg * 100 / 7) so 1->~14, 7->100.
  // Map 14..100 to 1..25.
  const clamped = Math.max(14, Math.min(100, score));
  const normalized = (clamped - 14) / (100 - 14); // 0..1
  const grade = 1 + normalized * 24;
  return Math.round(grade);
}

function bandLabelForGrade(grade: number): string {
  if (grade <= 5) return "Support";
  if (grade <= 10) return "Professional";
  if (grade <= 15) return "Senior Professional";
  if (grade <= 19) return "Manager";
  if (grade <= 22) return "Senior Manager / Director";
  return "Executive";
}

// ---- Auth helpers -------------------------------------------------------
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

function requireAdmin(user: Doc<"users">) {
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat melakukan aksi ini",
    });
  }
}

// ---- Positions ----------------------------------------------------------

export const listPositions = query({
  args: {
    search: v.optional(v.string()),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const search = args.search?.trim();
    let positions: Array<Doc<"ggsPositions">>;
    if (search && search.length > 0) {
      positions = await ctx.db
        .query("ggsPositions")
        .withSearchIndex("search_title", (q) => {
          const base = q.search("title", search);
          if (args.department && args.department !== "all") {
            return base.eq("department", args.department);
          }
          return base;
        })
        .take(200);
    } else {
      positions = await ctx.db.query("ggsPositions").collect();
      if (args.department && args.department !== "all") {
        positions = positions.filter((p) => p.department === args.department);
      }
    }
    if (args.status && args.status !== "all") {
      positions = positions.filter((p) => p.status === args.status);
    }
    // Enrich with employee count and salary band
    const results = await Promise.all(
      positions.map(async (p) => {
        const assignments = await ctx.db
          .query("ggsEmployeeAssignments")
          .withIndex("by_position_and_status", (q) =>
            q.eq("positionId", p._id).eq("status", "active"),
          )
          .collect();
        const band = p.currentSalaryBandId
          ? await ctx.db.get(p.currentSalaryBandId)
          : null;
        return {
          ...p,
          employeeCount: assignments.length,
          salaryBand: band,
        };
      }),
    );
    return results.sort((a, b) => {
      const ga = a.currentGrade ?? -1;
      const gb = b.currentGrade ?? -1;
      if (gb !== ga) return gb - ga;
      return a.title.localeCompare(b.title, "id");
    });
  },
});

export const getPositionDetail = query({
  args: { positionId: v.id("ggsPositions") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const position = await ctx.db.get(args.positionId);
    if (!position) return null;
    // Current evaluation & band
    const currentEval = position.currentEvaluationId
      ? await ctx.db.get(position.currentEvaluationId)
      : null;
    const band = position.currentSalaryBandId
      ? await ctx.db.get(position.currentSalaryBandId)
      : null;
    // All evaluations (history)
    const evaluations = await ctx.db
      .query("ggsEvaluations")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();
    evaluations.sort((a, b) => b._creationTime - a._creationTime);
    // Active assignments (employees)
    const assignments = await ctx.db
      .query("ggsEmployeeAssignments")
      .withIndex("by_position_and_status", (q) =>
        q.eq("positionId", args.positionId).eq("status", "active"),
      )
      .collect();
    const assignmentsWithUsers = await Promise.all(
      assignments.map(async (a) => {
        const user = await ctx.db.get(a.userId);
        return { ...a, user };
      }),
    );
    // Grade history
    const history = await ctx.db
      .query("ggsGradeHistory")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();
    history.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

    return {
      position,
      currentEvaluation: currentEval,
      salaryBand: band,
      evaluations,
      assignments: assignmentsWithUsers,
      history,
    };
  },
});

export const createPosition = mutation({
  args: {
    title: v.string(),
    department: v.string(),
    jobFamily: v.optional(v.string()),
    summary: v.string(),
    jobDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("ggsPositions", {
      title: args.title.trim(),
      department: args.department.trim(),
      jobFamily: args.jobFamily?.trim(),
      summary: args.summary.trim(),
      jobDescription: args.jobDescription,
      status: "active",
      authorId: user._id,
      lastEditorId: user._id,
      lastEditedAt: now,
    });
    return id;
  },
});

export const updatePosition = mutation({
  args: {
    positionId: v.id("ggsPositions"),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    jobFamily: v.optional(v.string()),
    summary: v.optional(v.string()),
    jobDescription: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const position = await ctx.db.get(args.positionId);
    if (!position) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jabatan tidak ditemukan" });
    }
    const patch: Partial<Doc<"ggsPositions">> = {
      lastEditorId: user._id,
      lastEditedAt: new Date().toISOString(),
    };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.department !== undefined) patch.department = args.department.trim();
    if (args.jobFamily !== undefined) patch.jobFamily = args.jobFamily.trim();
    if (args.summary !== undefined) patch.summary = args.summary.trim();
    if (args.jobDescription !== undefined)
      patch.jobDescription = args.jobDescription;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.positionId, patch);
  },
});

export const deletePosition = mutation({
  args: { positionId: v.id("ggsPositions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    // Soft-clean: delete evaluations, scores, evaluators, assignments, history
    const evaluations = await ctx.db
      .query("ggsEvaluations")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();
    for (const ev of evaluations) {
      const scores = await ctx.db
        .query("ggsFactorScores")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", ev._id))
        .collect();
      for (const s of scores) await ctx.db.delete(s._id);
      const evaluators = await ctx.db
        .query("ggsEvaluators")
        .withIndex("by_evaluation", (q) => q.eq("evaluationId", ev._id))
        .collect();
      for (const e of evaluators) await ctx.db.delete(e._id);
      await ctx.db.delete(ev._id);
    }
    const assignments = await ctx.db
      .query("ggsEmployeeAssignments")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    const history = await ctx.db
      .query("ggsGradeHistory")
      .withIndex("by_position", (q) => q.eq("positionId", args.positionId))
      .collect();
    for (const h of history) await ctx.db.delete(h._id);
    await ctx.db.delete(args.positionId);
  },
});

// ---- Evaluations --------------------------------------------------------

export const createEvaluation = mutation({
  args: {
    positionId: v.id("ggsPositions"),
    periodLabel: v.string(),
    reason: v.optional(v.string()),
    evaluatorIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const position = await ctx.db.get(args.positionId);
    if (!position) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jabatan tidak ditemukan" });
    }
    if (args.evaluatorIds.length < 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih minimal satu anggota komite penilai",
      });
    }
    // Don't allow a second draft/in-review for same position
    const existing = await ctx.db
      .query("ggsEvaluations")
      .withIndex("by_position_and_status", (q) =>
        q.eq("positionId", args.positionId).eq("status", "draft"),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Sudah ada evaluasi draft untuk jabatan ini",
      });
    }

    const evaluationId = await ctx.db.insert("ggsEvaluations", {
      positionId: args.positionId,
      periodLabel: args.periodLabel.trim(),
      reason: args.reason?.trim(),
      status: "in_review",
      previousGrade: position.currentGrade,
      createdById: user._id,
    });
    // Assign evaluators
    const now = new Date().toISOString();
    const seen = new Set<Id<"users">>();
    for (const uid of args.evaluatorIds) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      await ctx.db.insert("ggsEvaluators", {
        evaluationId,
        userId: uid,
        status: "pending",
        invitedById: user._id,
        invitedAt: now,
      });
      // Notify the evaluator
      await ctx.db.insert("notifications", {
        userId: uid,
        type: "ggs_evaluation_invite",
        title: "Undangan Penilaian Jabatan",
        message: `Anda diundang menilai jabatan "${position.title}" (${args.periodLabel})`,
        link: `/grading/${args.positionId}?evalId=${evaluationId}`,
        actorId: user._id,
      });
    }
    return evaluationId;
  },
});

export const getEvaluation = query({
  args: { evaluationId: v.id("ggsEvaluations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const evalDoc = await ctx.db.get(args.evaluationId);
    if (!evalDoc) return null;
    const position = await ctx.db.get(evalDoc.positionId);
    const evaluators = await ctx.db
      .query("ggsEvaluators")
      .withIndex("by_evaluation", (q) => q.eq("evaluationId", args.evaluationId))
      .collect();
    const evaluatorsWithUsers = await Promise.all(
      evaluators.map(async (e) => {
        const u = await ctx.db.get(e.userId);
        return { ...e, user: u };
      }),
    );
    const scores = await ctx.db
      .query("ggsFactorScores")
      .withIndex("by_evaluation", (q) => q.eq("evaluationId", args.evaluationId))
      .collect();
    // Current user's own scores for form state
    const myScores = scores.filter((s) => s.evaluatorId === user._id);
    const isEvaluator = evaluators.some((e) => e.userId === user._id);
    const isAdmin = isAdminRole(user.role);
    return {
      evaluation: evalDoc,
      position,
      evaluators: evaluatorsWithUsers,
      allScores: isAdmin || evalDoc.status === "approved" ? scores : [],
      myScores,
      currentUserId: user._id,
      isEvaluator,
      isAdmin,
    };
  },
});

export const submitMyScores = mutation({
  args: {
    evaluationId: v.id("ggsEvaluations"),
    scores: v.array(
      v.object({
        factor: v.string(),
        level: v.number(),
        justification: v.optional(v.string()),
      }),
    ),
    overallNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const evalDoc = await ctx.db.get(args.evaluationId);
    if (!evalDoc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Evaluasi tidak ditemukan" });
    }
    if (evalDoc.status !== "in_review" && evalDoc.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Evaluasi sudah ditutup untuk penilaian",
      });
    }
    // Find this user's evaluator row
    const evaluator = await ctx.db
      .query("ggsEvaluators")
      .withIndex("by_evaluation_and_user", (q) =>
        q.eq("evaluationId", args.evaluationId).eq("userId", user._id),
      )
      .unique();
    if (!evaluator) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan anggota komite untuk evaluasi ini",
      });
    }
    // Validate factor coverage
    const gotFactors = new Set(args.scores.map((s) => s.factor));
    for (const f of FACTORS) {
      if (!gotFactors.has(f)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Nilai untuk semua faktor wajib diisi`,
        });
      }
    }
    // Remove existing scores from this evaluator
    const existing = await ctx.db
      .query("ggsFactorScores")
      .withIndex("by_evaluation_and_evaluator", (q) =>
        q.eq("evaluationId", args.evaluationId).eq("evaluatorId", user._id),
      )
      .collect();
    for (const s of existing) await ctx.db.delete(s._id);
    // Insert new
    for (const s of args.scores) {
      if (!(FACTORS as ReadonlyArray<string>).includes(s.factor)) continue;
      const level = Math.max(1, Math.min(7, Math.round(s.level)));
      await ctx.db.insert("ggsFactorScores", {
        evaluationId: args.evaluationId,
        evaluatorId: user._id,
        factor: s.factor,
        level,
        justification: s.justification?.trim(),
      });
    }
    await ctx.db.patch(evaluator._id, {
      status: "submitted",
      submittedAt: new Date().toISOString(),
      overallNote: args.overallNote?.trim(),
    });
  },
});

export const approveEvaluation = mutation({
  args: {
    evaluationId: v.id("ggsEvaluations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const evalDoc = await ctx.db.get(args.evaluationId);
    if (!evalDoc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Evaluasi tidak ditemukan" });
    }
    if (evalDoc.status === "approved") return;
    const position = await ctx.db.get(evalDoc.positionId);
    if (!position) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jabatan tidak ditemukan" });
    }
    // Aggregate: compute average level per factor across submitted evaluators
    const scores = await ctx.db
      .query("ggsFactorScores")
      .withIndex("by_evaluation", (q) => q.eq("evaluationId", args.evaluationId))
      .collect();
    if (scores.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Belum ada penilaian yang masuk",
      });
    }
    const byFactor = new Map<string, Array<number>>();
    for (const s of scores) {
      const arr = byFactor.get(s.factor) ?? [];
      arr.push(s.level);
      byFactor.set(s.factor, arr);
    }
    const avg = (xs: Array<number>) =>
      xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
    const avgs: Record<Factor, number> = {
      functional_knowledge: avg(byFactor.get("functional_knowledge") ?? []),
      business_expertise: avg(byFactor.get("business_expertise") ?? []),
      leadership: avg(byFactor.get("leadership") ?? []),
      problem_solving: avg(byFactor.get("problem_solving") ?? []),
      nature_of_impact: avg(byFactor.get("nature_of_impact") ?? []),
      area_of_impact: avg(byFactor.get("area_of_impact") ?? []),
      interpersonal_skills: avg(byFactor.get("interpersonal_skills") ?? []),
    };
    // Weighted score (1..7 range) -> scale to 0..100 via (x/7)*100
    let weighted = 0;
    for (const f of FACTORS) weighted += avgs[f] * FACTOR_WEIGHTS[f];
    const finalScore = Math.round((weighted / 7) * 10000) / 100; // 2 decimals
    // Apply company size band
    const companySize = await getEffectiveSizeBand(ctx, position.department);
    const shift = SIZE_BAND_GRADE_SHIFT[companySize] ?? 0;
    const baseGrade = scoreToBaseGrade((weighted / 7) * 100);
    const finalGrade = Math.max(1, Math.min(25, baseGrade + shift));
    const bandLabel = bandLabelForGrade(finalGrade);
    // Find salary band
    const salaryBand = await ctx.db
      .query("ggsSalaryBands")
      .withIndex("by_grade", (q) => q.eq("grade", finalGrade))
      .first();

    await ctx.db.patch(args.evaluationId, {
      status: "approved",
      finalFunctionalKnowledge: avgs.functional_knowledge,
      finalBusinessExpertise: avgs.business_expertise,
      finalLeadership: avgs.leadership,
      finalProblemSolving: avgs.problem_solving,
      finalNatureOfImpact: avgs.nature_of_impact,
      finalAreaOfImpact: avgs.area_of_impact,
      finalInterpersonalSkills: avgs.interpersonal_skills,
      finalScore,
      finalGrade,
      finalBandLabel: bandLabel,
      sizeBandUsed: companySize,
      approvedById: user._id,
      approvedAt: new Date().toISOString(),
    });
    // Update position
    const prevGrade = position.currentGrade;
    const prevScore = 0;
    await ctx.db.patch(position._id, {
      currentEvaluationId: args.evaluationId,
      currentGrade: finalGrade,
      currentSalaryBandId: salaryBand?._id,
      lastEditorId: user._id,
      lastEditedAt: new Date().toISOString(),
    });
    // Log history
    await ctx.db.insert("ggsGradeHistory", {
      positionId: position._id,
      evaluationId: args.evaluationId,
      previousGrade: prevGrade,
      newGrade: finalGrade,
      previousScore: prevScore,
      newScore: finalScore,
      reason: evalDoc.reason,
      changedById: user._id,
      changedAt: new Date().toISOString(),
    });
  },
});

export const rejectEvaluation = mutation({
  args: {
    evaluationId: v.id("ggsEvaluations"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const evalDoc = await ctx.db.get(args.evaluationId);
    if (!evalDoc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Evaluasi tidak ditemukan" });
    }
    await ctx.db.patch(args.evaluationId, {
      status: "rejected",
      rejectedReason: args.reason.trim(),
    });
  },
});

// ---- Company size -------------------------------------------------------

async function getEffectiveSizeBand(
  ctx: QueryCtx | MutationCtx,
  department: string,
): Promise<string> {
  const deptRow = await ctx.db
    .query("ggsCompanySizes")
    .withIndex("by_scope", (q) => q.eq("scope", department))
    .unique();
  if (deptRow) return deptRow.sizeBand;
  const defaultRow = await ctx.db
    .query("ggsCompanySizes")
    .withIndex("by_scope", (q) => q.eq("scope", ""))
    .unique();
  if (defaultRow) return defaultRow.sizeBand;
  return "C";
}

export const listCompanySizes = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("ggsCompanySizes").collect();
    return rows.sort((a, b) => a.scope.localeCompare(b.scope));
  },
});

export const setCompanySize = mutation({
  args: {
    scope: v.string(),
    sizeBand: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    if (!["A", "B", "C", "D", "E"].includes(args.sizeBand)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Size band harus A, B, C, D, atau E",
      });
    }
    const existing = await ctx.db
      .query("ggsCompanySizes")
      .withIndex("by_scope", (q) => q.eq("scope", args.scope))
      .unique();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sizeBand: args.sizeBand,
        note: args.note?.trim(),
        updatedBy: user._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("ggsCompanySizes", {
        scope: args.scope,
        sizeBand: args.sizeBand,
        note: args.note?.trim(),
        updatedBy: user._id,
        updatedAt: now,
      });
    }
  },
});

export const deleteCompanySize = mutation({
  args: { id: v.id("ggsCompanySizes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    await ctx.db.delete(args.id);
  },
});

// ---- Salary bands -------------------------------------------------------

export const listSalaryBands = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("ggsSalaryBands").collect();
    return rows.sort((a, b) => a.grade - b.grade);
  },
});

export const upsertSalaryBand = mutation({
  args: {
    grade: v.number(),
    bandLabel: v.string(),
    minSalary: v.number(),
    midSalary: v.number(),
    maxSalary: v.number(),
    currency: v.optional(v.string()),
    note: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    if (args.grade < 1 || args.grade > 25) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Grade harus 1..25",
      });
    }
    if (
      args.minSalary < 0 ||
      args.midSalary < args.minSalary ||
      args.maxSalary < args.midSalary
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Rentang gaji harus: min <= mid <= max",
      });
    }
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("ggsSalaryBands")
      .withIndex("by_grade", (q) => q.eq("grade", args.grade))
      .first();
    const patch = {
      grade: args.grade,
      bandLabel: args.bandLabel.trim(),
      minSalary: args.minSalary,
      midSalary: args.midSalary,
      maxSalary: args.maxSalary,
      currency: args.currency ?? "IDR",
      note: args.note?.trim(),
      isActive: args.isActive ?? true,
      updatedBy: user._id,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("ggsSalaryBands", patch);
    }
  },
});

export const deleteSalaryBand = mutation({
  args: { id: v.id("ggsSalaryBands") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    await ctx.db.delete(args.id);
  },
});

// ---- Employee assignments ----------------------------------------------

export const listEmployeeAssignments = query({
  args: { positionId: v.optional(v.id("ggsPositions")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let rows: Array<Doc<"ggsEmployeeAssignments">>;
    if (args.positionId) {
      rows = await ctx.db
        .query("ggsEmployeeAssignments")
        .withIndex("by_position_and_status", (q) =>
          q.eq("positionId", args.positionId!).eq("status", "active"),
        )
        .collect();
    } else {
      rows = await ctx.db.query("ggsEmployeeAssignments").collect();
      rows = rows.filter((r) => r.status === "active");
    }
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const position = await ctx.db.get(r.positionId);
        const band = position?.currentSalaryBandId
          ? await ctx.db.get(position.currentSalaryBandId)
          : null;
        const compaRatio =
          band && r.currentSalary
            ? Math.round((r.currentSalary / band.midSalary) * 1000) / 10
            : null;
        return { ...r, user, position, salaryBand: band, compaRatio };
      }),
    );
    return enriched;
  },
});

export const assignEmployee = mutation({
  args: {
    userId: v.id("users"),
    positionId: v.id("ggsPositions"),
    currentSalary: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    // Archive any existing active assignment for this user
    const existing = await ctx.db
      .query("ggsEmployeeAssignments")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", args.userId).eq("status", "active"),
      )
      .collect();
    for (const e of existing) {
      await ctx.db.patch(e._id, { status: "archived" });
    }
    const id = await ctx.db.insert("ggsEmployeeAssignments", {
      userId: args.userId,
      positionId: args.positionId,
      currentSalary: args.currentSalary,
      status: "active",
      assignedAt: new Date().toISOString(),
      assignedById: user._id,
      note: args.note?.trim(),
    });
    return id;
  },
});

export const updateAssignmentSalary = mutation({
  args: {
    id: v.id("ggsEmployeeAssignments"),
    currentSalary: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    if (args.currentSalary < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Gaji tidak valid" });
    }
    await ctx.db.patch(args.id, { currentSalary: args.currentSalary });
  },
});

export const archiveAssignment = mutation({
  args: { id: v.id("ggsEmployeeAssignments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    await ctx.db.patch(args.id, { status: "archived" });
  },
});

// ---- Dashboard stats ----------------------------------------------------

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const positions = await ctx.db.query("ggsPositions").collect();
    const evaluations = await ctx.db.query("ggsEvaluations").collect();
    const assignments = await ctx.db.query("ggsEmployeeAssignments").collect();
    const activeAssignments = assignments.filter((a) => a.status === "active");
    const pending = evaluations.filter((e) => e.status === "in_review").length;
    const approved = evaluations.filter((e) => e.status === "approved").length;
    // Grade distribution
    const gradeDistribution: Record<number, number> = {};
    for (const p of positions) {
      if (p.currentGrade !== undefined) {
        gradeDistribution[p.currentGrade] =
          (gradeDistribution[p.currentGrade] ?? 0) + 1;
      }
    }
    // Compa-ratio distribution
    const bands = await ctx.db.query("ggsSalaryBands").collect();
    const bandByGrade = new Map<number, Doc<"ggsSalaryBands">>();
    for (const b of bands) bandByGrade.set(b.grade, b);
    let sumCompa = 0;
    let cntCompa = 0;
    for (const a of activeAssignments) {
      if (!a.currentSalary) continue;
      const pos = positions.find((p) => p._id === a.positionId);
      if (!pos?.currentGrade) continue;
      const band = bandByGrade.get(pos.currentGrade);
      if (!band) continue;
      sumCompa += (a.currentSalary / band.midSalary) * 100;
      cntCompa += 1;
    }
    const avgCompaRatio = cntCompa > 0 ? Math.round((sumCompa / cntCompa) * 10) / 10 : null;
    // Department distribution
    const deptMap = new Map<string, { count: number; grades: Array<number> }>();
    for (const p of positions) {
      const entry = deptMap.get(p.department) ?? { count: 0, grades: [] };
      entry.count += 1;
      if (p.currentGrade !== undefined) entry.grades.push(p.currentGrade);
      deptMap.set(p.department, entry);
    }
    const byDepartment = Array.from(deptMap.entries()).map(([dept, v]) => ({
      department: dept,
      count: v.count,
      avgGrade:
        v.grades.length > 0
          ? Math.round(
              (v.grades.reduce((a, b) => a + b, 0) / v.grades.length) * 10,
            ) / 10
          : null,
    }));
    return {
      totalPositions: positions.length,
      activePositions: positions.filter((p) => p.status === "active").length,
      gradedPositions: positions.filter((p) => p.currentGrade !== undefined)
        .length,
      pendingEvaluations: pending,
      approvedEvaluations: approved,
      totalAssignments: activeAssignments.length,
      avgCompaRatio,
      gradeDistribution,
      byDepartment,
    };
  },
});

// ---- Benchmark: positions side by side ---------------------------------

export const benchmarkPositions = query({
  args: { positionIds: v.array(v.id("ggsPositions")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const results = await Promise.all(
      args.positionIds.map(async (id) => {
        const position = await ctx.db.get(id);
        if (!position) return null;
        const evalDoc = position.currentEvaluationId
          ? await ctx.db.get(position.currentEvaluationId)
          : null;
        const band = position.currentSalaryBandId
          ? await ctx.db.get(position.currentSalaryBandId)
          : null;
        return { position, evaluation: evalDoc, salaryBand: band };
      }),
    );
    return results.filter(Boolean);
  },
});

// ---- Query: evaluations assigned to me ---------------------------------

export const myPendingEvaluations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("ggsEvaluators")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const evalDoc = await ctx.db.get(r.evaluationId);
        if (!evalDoc) return null;
        const position = await ctx.db.get(evalDoc.positionId);
        return { evaluator: r, evaluation: evalDoc, position };
      }),
    );
    return enriched
      .filter(
        (
          x,
        ): x is {
          evaluator: Doc<"ggsEvaluators">;
          evaluation: Doc<"ggsEvaluations">;
          position: Doc<"ggsPositions"> | null;
        } => x !== null,
      )
      .sort((a, b) => b.evaluation._creationTime - a.evaluation._creationTime);
  },
});
