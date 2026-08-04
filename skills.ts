import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Course skills (skills granted on course completion) and skill-gap analysis.

export const listCourseSkills = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<Array<Doc<"courseSkills">>> => {
    await requireUser(ctx);
    return await ctx.db
      .query("courseSkills")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
  },
});

export const addCourseSkill = mutation({
  args: {
    courseId: v.id("courses"),
    skill: v.string(),
    category: v.string(),
    level: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const skill = args.skill.trim();
    if (skill.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama keahlian wajib diisi",
      });
    }
    await ctx.db.insert("courseSkills", {
      courseId: args.courseId,
      skill,
      category: args.category,
      level: Math.max(1, Math.min(5, Math.round(args.level))),
    });
    return null;
  },
});

export const removeCourseSkill = mutation({
  args: { id: v.id("courseSkills") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// Skill gap: for a given user (self if not admin), compute:
//   - skills user has (from employeeSkills)
//   - skills from completed courses
//   - target skills (aggregated from all courses they haven't completed yet)
export const getMySkillGap = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    owned: Array<{
      skill: string;
      category: string;
      level: number;
      source: "self" | "course";
    }>;
    suggested: Array<{
      skill: string;
      category: string;
      level: number;
      courses: Array<{ courseId: Id<"courses">; title: string }>;
    }>;
  }> => {
    const user = await requireUser(ctx);

    // Owned from employeeSkills
    const selfSkills = await ctx.db
      .query("employeeSkills")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const ownedMap = new Map<
      string,
      {
        skill: string;
        category: string;
        level: number;
        source: "self" | "course";
      }
    >();
    for (const s of selfSkills) {
      ownedMap.set(s.skill.toLowerCase(), {
        skill: s.skill,
        category: s.category,
        level: s.level,
        source: "self",
      });
    }
    // From completed courses
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const completedCourseIds = enrollments
      .filter((e) => e.completedAt)
      .map((e) => e.courseId);
    for (const cid of completedCourseIds) {
      const skills = await ctx.db
        .query("courseSkills")
        .withIndex("by_course", (q) => q.eq("courseId", cid))
        .collect();
      for (const s of skills) {
        const key = s.skill.toLowerCase();
        const existing = ownedMap.get(key);
        if (!existing || existing.level < s.level) {
          ownedMap.set(key, {
            skill: s.skill,
            category: s.category,
            level: s.level,
            source: existing?.source ?? "course",
          });
        }
      }
    }

    // Suggested: from non-completed courses
    const suggestedMap = new Map<
      string,
      {
        skill: string;
        category: string;
        level: number;
        courses: Array<{ courseId: Id<"courses">; title: string }>;
      }
    >();
    const allCourses = await ctx.db.query("courses").collect();
    for (const c of allCourses) {
      if (!c.isPublished) continue;
      const e = enrollments.find((x) => x.courseId === c._id);
      if (e?.completedAt) continue;
      const skills = await ctx.db
        .query("courseSkills")
        .withIndex("by_course", (q) => q.eq("courseId", c._id))
        .collect();
      for (const s of skills) {
        const key = s.skill.toLowerCase();
        const owned = ownedMap.get(key);
        if (owned && owned.level >= s.level) continue;
        const prev = suggestedMap.get(key) ?? {
          skill: s.skill,
          category: s.category,
          level: s.level,
          courses: [],
        };
        if (s.level > prev.level) prev.level = s.level;
        prev.courses.push({ courseId: c._id, title: c.title });
        suggestedMap.set(key, prev);
      }
    }

    return {
      owned: Array.from(ownedMap.values()),
      suggested: Array.from(suggestedMap.values()),
    };
  },
});

// Admin: organization-wide skill-gap overview.
export const getCompanySkillGap = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      skill: string;
      category: string;
      totalEmployees: number;
      employeesWith: number;
      coveragePercent: number;
    }>
  > => {
    await requireAdmin(ctx);
    const allUsers = await ctx.db.query("users").collect();
    const total = allUsers.length;
    const allSkills = await ctx.db.query("courseSkills").collect();
    const skillMap = new Map<
      string,
      { skill: string; category: string }
    >();
    for (const s of allSkills) {
      skillMap.set(s.skill.toLowerCase(), {
        skill: s.skill,
        category: s.category,
      });
    }
    // Count employees with each skill via employeeSkills + completed courses
    const employeeSkills = await ctx.db.query("employeeSkills").collect();
    const skillOwners = new Map<string, Set<Id<"users">>>();
    for (const s of employeeSkills) {
      const key = s.skill.toLowerCase();
      const set = skillOwners.get(key) ?? new Set();
      set.add(s.userId);
      skillOwners.set(key, set);
      if (!skillMap.has(key)) {
        skillMap.set(key, { skill: s.skill, category: s.category });
      }
    }
    const enrollments = await ctx.db.query("courseEnrollments").collect();
    const completedByCourse = new Map<Id<"courses">, Set<Id<"users">>>();
    for (const e of enrollments) {
      if (!e.completedAt) continue;
      const set =
        completedByCourse.get(e.courseId) ?? new Set<Id<"users">>();
      set.add(e.userId);
      completedByCourse.set(e.courseId, set);
    }
    for (const cs of allSkills) {
      const key = cs.skill.toLowerCase();
      const owners = skillOwners.get(key) ?? new Set<Id<"users">>();
      const completions = completedByCourse.get(cs.courseId);
      if (completions) {
        for (const u of completions) owners.add(u);
      }
      skillOwners.set(key, owners);
    }
    return Array.from(skillMap.entries()).map(([key, { skill, category }]) => {
      const owners = skillOwners.get(key) ?? new Set();
      return {
        skill,
        category,
        totalEmployees: total,
        employeesWith: owners.size,
        coveragePercent:
          total === 0 ? 0 : Math.round((owners.size / total) * 100),
      };
    });
  },
});
