import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireUser } from "./_helpers";
import { isAdminRole } from "../roles";

// AI-style (rule-based) course recommendations for the current user.
// Scores each course by: matches user's department category, uses their
// skill set, and isn't completed yet.

export type CourseRecommendation = Doc<"courses"> & {
  score: number;
  reasons: Array<string>;
};

export const getRecommendations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<CourseRecommendation>> => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 6, 20);

    const allCourses = await ctx.db
      .query("courses")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const enrolledIds = new Set(enrollments.map((e) => String(e.courseId)));
    const completedCourseIds = new Set(
      enrollments.filter((e) => e.completedAt).map((e) => String(e.courseId)),
    );

    const userSkills = await ctx.db
      .query("employeeSkills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const userSkillSet = new Set(
      userSkills.map((s) => s.skill.toLowerCase()),
    );

    const userDept = user.department ?? null;

    // Department peers' popular categories
    let peerCategories = new Set<string>();
    if (userDept) {
      const peers = (await ctx.db.query("users").collect()).filter(
        (u) => u.department === userDept && u._id !== user._id,
      );
      const peerIds = peers.map((p) => p._id);
      const peerEnrolls: Array<Doc<"courseEnrollments">> = [];
      for (const pid of peerIds) {
        const es = await ctx.db
          .query("courseEnrollments")
          .withIndex("by_user", (q) => q.eq("userId", pid))
          .collect();
        peerEnrolls.push(...es);
      }
      const catCount = new Map<string, number>();
      for (const e of peerEnrolls) {
        const c = await ctx.db.get(e.courseId);
        if (c) catCount.set(c.category, (catCount.get(c.category) ?? 0) + 1);
      }
      const sorted = Array.from(catCount.entries()).sort(
        (a, b) => b[1] - a[1],
      );
      peerCategories = new Set(sorted.slice(0, 3).map(([k]) => k));
    }

    // Score courses
    const results: Array<CourseRecommendation> = [];
    for (const c of allCourses) {
      if (completedCourseIds.has(String(c._id))) continue;
      let score = 0;
      const reasons: Array<string> = [];
      if (peerCategories.has(c.category)) {
        score += 20;
        reasons.push("Populer di departemen Anda");
      }
      // Check course skills related to user skills
      const courseSkills = await ctx.db
        .query("courseSkills")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .collect();
      const matchingSkills = courseSkills.filter((cs) =>
        userSkillSet.has(cs.skill.toLowerCase()),
      );
      if (matchingSkills.length > 0) {
        score += matchingSkills.length * 10;
        reasons.push(
          `Memperdalam ${matchingSkills.length} keahlian yang sudah Anda miliki`,
        );
      }
      const newSkills = courseSkills.filter(
        (cs) => !userSkillSet.has(cs.skill.toLowerCase()),
      );
      if (newSkills.length > 0) {
        score += newSkills.length * 5;
        reasons.push(`Tambah ${newSkills.length} keahlian baru`);
      }
      // Assignment bonus
      const assignments = await ctx.db
        .query("courseAssignments")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .collect();
      const assigned = assignments.some((a) => {
        if (a.targetType === "all") return true;
        if (a.targetType === "user" && a.targetValue === String(user._id))
          return true;
        if (
          a.targetType === "department" &&
          userDept &&
          a.targetValue === userDept
        )
          return true;
        return false;
      });
      if (assigned) {
        score += 40;
        reasons.push("Pelatihan wajib untuk Anda");
      }
      // Rating bonus
      if ((c.averageRating ?? 0) >= 4) {
        score += 10;
        reasons.push("Rating tinggi dari peserta lain");
      }
      // Enrollment bonus (popular)
      if (c.enrollmentCount >= 5) {
        score += 5;
        reasons.push("Banyak peserta");
      }
      // Penalty if already enrolled in progress
      if (enrolledIds.has(String(c._id))) {
        score += 5;
        reasons.push("Lanjutkan belajar");
      }
      if (score > 0) {
        results.push({ ...c, score, reasons });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  },
});

// Similar courses suggestion for a course detail page
export const getSimilarCourses = query({
  args: { courseId: v.id("courses"), limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"courses"> & { score: number }>> => {
    await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) return [];
    const limit = Math.min(args.limit ?? 4, 10);
    const all = await ctx.db
      .query("courses")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    const courseSkills = await ctx.db
      .query("courseSkills")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    const skillSet = new Set(courseSkills.map((s) => s.skill.toLowerCase()));
    const results: Array<{ course: Doc<"courses">; score: number }> = [];
    for (const c of all) {
      if (c._id === course._id) continue;
      let score = 0;
      if (c.category === course.category) score += 10;
      if (c.level === course.level) score += 5;
      const theirSkills = await ctx.db
        .query("courseSkills")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .collect();
      for (const s of theirSkills) {
        if (skillSet.has(s.skill.toLowerCase())) score += 3;
      }
      if (score > 0) {
        results.push({ course: c, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => ({ ...r.course, score: r.score }));
  },
});

type UserOverview = {
  userId: Id<"users">;
  userName: string | null;
  userAvatar: string | null;
  userDepartment: string | null;
  totalXp: number;
  coursesCompleted: number;
  certificatesEarned: number;
  badgeCount: number;
  pendingExternalTrainings: number;
  recommendationCount: number;
};

export const getOverviewForAdmin = query({
  args: {},
  handler: async (ctx): Promise<Array<UserOverview>> => {
    const viewer = await requireUser(ctx);
    if (!isAdminRole(viewer.role)) return [];
    const users = await ctx.db.query("users").collect();
    const stats = await ctx.db.query("learnerStats").collect();
    const statsMap = new Map(stats.map((s) => [String(s.userId), s]));
    const out: Array<UserOverview> = [];
    for (const u of users) {
      const s = statsMap.get(String(u._id));
      const pending = await ctx.db
        .query("externalTrainings")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", u._id).eq("status", "pending"),
        )
        .collect();
      out.push({
        userId: u._id,
        userName: u.name ?? null,
        userAvatar: u.avatarUrl ?? null,
        userDepartment: u.department ?? null,
        totalXp: s?.totalXp ?? 0,
        coursesCompleted: s?.coursesCompleted ?? 0,
        certificatesEarned: s?.certificatesEarned ?? 0,
        badgeCount: s?.badges.length ?? 0,
        pendingExternalTrainings: pending.length,
        recommendationCount: 0,
      });
    }
    out.sort((a, b) => b.totalXp - a.totalXp);
    return out;
  },
});
