import { ConvexError, v } from "convex/values";
import {
  query,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireUser, requireAdmin } from "./_helpers";

export type TrainingAnalytics = {
  totals: {
    courseCount: number;
    publishedCount: number;
    enrollmentCount: number;
    completedEnrollmentCount: number;
    certificateCount: number;
    activeLearners: number;
    averageCompletionRate: number;
  };
  topCourses: Array<{
    courseId: Id<"courses">;
    title: string;
    enrollmentCount: number;
    completedCount: number;
    completionRate: number;
    averageRating: number | null;
  }>;
  byDepartment: Array<{
    department: string;
    enrollmentCount: number;
    completedCount: number;
    completionRate: number;
  }>;
  byCategory: Array<{
    category: string;
    courseCount: number;
    enrollmentCount: number;
  }>;
  recentCertificates: Array<{
    serial: string;
    issuedAt: string;
    userName: string;
    courseTitle: string;
  }>;
};

export const getAnalytics = query({
  args: {},
  handler: async (ctx): Promise<TrainingAnalytics> => {
    await requireAdmin(ctx);
    const courses = await ctx.db.query("courses").collect();
    const enrollments = await ctx.db.query("courseEnrollments").collect();
    const certificates = await ctx.db
      .query("courseCertificates")
      .order("desc")
      .take(10);

    const publishedCount = courses.filter((c) => c.isPublished).length;
    const completedEnrollments = enrollments.filter((e) => e.completedAt);
    const averageCompletionRate =
      enrollments.length === 0
        ? 0
        : Math.round(
            (completedEnrollments.length / enrollments.length) * 100,
          );
    const activeLearners = new Set(enrollments.map((e) => String(e.userId)))
      .size;

    // Top courses (by enrollment)
    const topCourses = courses
      .map((c) => {
        const forCourse = enrollments.filter((e) => e.courseId === c._id);
        const completed = forCourse.filter((e) => e.completedAt).length;
        return {
          courseId: c._id,
          title: c.title,
          enrollmentCount: forCourse.length,
          completedCount: completed,
          completionRate:
            forCourse.length === 0
              ? 0
              : Math.round((completed / forCourse.length) * 100),
          averageRating: c.averageRating ?? null,
        };
      })
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 8);

    // By department (based on enrolled user)
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };
    const deptMap = new Map<
      string,
      { enrollmentCount: number; completedCount: number }
    >();
    for (const e of enrollments) {
      const u = await getUser(e.userId);
      const dept = u?.department ?? "Tanpa Departemen";
      const cur = deptMap.get(dept) ?? {
        enrollmentCount: 0,
        completedCount: 0,
      };
      cur.enrollmentCount += 1;
      if (e.completedAt) cur.completedCount += 1;
      deptMap.set(dept, cur);
    }
    const byDepartment = Array.from(deptMap.entries())
      .map(([department, v]) => ({
        department,
        enrollmentCount: v.enrollmentCount,
        completedCount: v.completedCount,
        completionRate:
          v.enrollmentCount === 0
            ? 0
            : Math.round((v.completedCount / v.enrollmentCount) * 100),
      }))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount);

    // By category
    const catMap = new Map<
      string,
      { courseCount: number; enrollmentCount: number }
    >();
    for (const c of courses) {
      const cur = catMap.get(c.category) ?? {
        courseCount: 0,
        enrollmentCount: 0,
      };
      cur.courseCount += 1;
      cur.enrollmentCount += c.enrollmentCount;
      catMap.set(c.category, cur);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, v]) => ({
        category,
        courseCount: v.courseCount,
        enrollmentCount: v.enrollmentCount,
      }))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount);

    const recentCertificates = certificates.map((c) => ({
      serial: c.serial,
      issuedAt: c.issuedAt,
      userName: c.userName,
      courseTitle: c.courseTitle,
    }));

    return {
      totals: {
        courseCount: courses.length,
        publishedCount,
        enrollmentCount: enrollments.length,
        completedEnrollmentCount: completedEnrollments.length,
        certificateCount: certificates.length,
        activeLearners,
        averageCompletionRate,
      },
      topCourses,
      byDepartment,
      byCategory,
      recentCertificates,
    };
  },
});

// Courses assignment completion matrix
export const getCourseAssignmentCompletion = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      userId: Id<"users">;
      userName: string | null;
      userDepartment: string | null;
      dueDate: string | null;
      progress: number;
      completedAt: string | null;
      overdue: boolean;
    }>
  > => {
    await requireAdmin(ctx);
    const assignments = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    if (assignments.length === 0) return [];
    const allUsers = await ctx.db.query("users").collect();
    const affected = new Map<
      Id<"users">,
      { user: Doc<"users">; dueDate: string | null }
    >();
    for (const a of assignments) {
      const due = a.dueDate ?? null;
      if (a.targetType === "all") {
        for (const u of allUsers) {
          const prev = affected.get(u._id);
          if (!prev || (due && (!prev.dueDate || due < prev.dueDate))) {
            affected.set(u._id, { user: u, dueDate: due });
          }
        }
      } else if (a.targetType === "user" && a.targetValue) {
        const u = allUsers.find(
          (x) => String(x._id) === a.targetValue,
        );
        if (u) {
          const prev = affected.get(u._id);
          if (!prev || (due && (!prev.dueDate || due < prev.dueDate))) {
            affected.set(u._id, { user: u, dueDate: due });
          }
        }
      } else if (a.targetType === "department" && a.targetValue) {
        for (const u of allUsers.filter(
          (x) => x.department === a.targetValue,
        )) {
          const prev = affected.get(u._id);
          if (!prev || (due && (!prev.dueDate || due < prev.dueDate))) {
            affected.set(u._id, { user: u, dueDate: due });
          }
        }
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const out: Array<{
      userId: Id<"users">;
      userName: string | null;
      userDepartment: string | null;
      dueDate: string | null;
      progress: number;
      completedAt: string | null;
      overdue: boolean;
    }> = [];
    for (const [userId, { user, dueDate }] of affected.entries()) {
      const enrollment = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", args.courseId).eq("userId", userId),
        )
        .unique();
      const overdue = Boolean(
        dueDate &&
          !enrollment?.completedAt &&
          dueDate < today,
      );
      out.push({
        userId,
        userName: user.name ?? null,
        userDepartment: user.department ?? null,
        dueDate,
        progress: enrollment?.progress ?? 0,
        completedAt: enrollment?.completedAt ?? null,
        overdue,
      });
    }
    out.sort((a, b) => {
      if (a.completedAt && !b.completedAt) return 1;
      if (!a.completedAt && b.completedAt) return -1;
      const ad = a.dueDate ?? "9999-12-31";
      const bd = b.dueDate ?? "9999-12-31";
      return ad.localeCompare(bd);
    });
    return out;
  },
});

// My certificates wallet
export const getMyCertificates = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<Doc<"courseCertificates">>> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("courseCertificates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort(
      (a, b) =>
        new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
    );
    return rows;
  },
});

export const getCertificate = query({
  args: { id: v.id("courseCertificates") },
  handler: async (
    ctx,
    args,
  ): Promise<Doc<"courseCertificates"> | null> => {
    const user = await requireUser(ctx);
    const cert = await ctx.db.get(args.id);
    if (!cert) return null;
    if (cert.userId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan sertifikat Anda",
      });
    }
    return cert;
  },
});

export const getCertificateBySerial = query({
  args: { serial: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<Doc<"courseCertificates"> | null> => {
    // Public verification by serial (still requires auth)
    await requireUser(ctx);
    return (
      (await ctx.db
        .query("courseCertificates")
        .withIndex("by_serial", (q) => q.eq("serial", args.serial))
        .unique()) ?? null
    );
  },
});
