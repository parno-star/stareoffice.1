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
import { awardXpForUser } from "./training/gamification";
import { requireTenant } from "./lib/tenant";

export type CourseWithMeta = Doc<"courses"> & {
  authorName: string | null;
  authorAvatar: string | null;
  enrollment:
    | (Doc<"courseEnrollments"> & {
        completedLessonCount: number;
      })
    | null;
  // True when the viewer has a passing quiz attempt for this course.
  hasPassedQuiz: boolean;
  // True when the course has an assignment targeting the viewer (for listing).
  isAssigned: boolean;
  assignmentDueDate: string | null;
};

export type LessonPreview = Pick<
  Doc<"courseLessons">,
  "_id" | "title" | "durationMinutes" | "order"
> & { hasVideo: boolean };

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

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat melakukan tindakan ini",
    });
  }
  return user;
}

const VALID_CATEGORIES = [
  "onboarding",
  "leadership",
  "technical",
  "soft_skills",
  "compliance",
  "product",
  "other",
];
const VALID_LEVELS = ["beginner", "intermediate", "advanced"];
const VALID_COLORS = [
  "blue",
  "green",
  "orange",
  "purple",
  "pink",
  "red",
  "teal",
  "indigo",
];

async function getEnrollmentForUser(
  ctx: QueryCtx,
  courseId: Id<"courses">,
  userId: Id<"users">,
): Promise<Doc<"courseEnrollments"> | null> {
  return await ctx.db
    .query("courseEnrollments")
    .withIndex("by_course_and_user", (q) =>
      q.eq("courseId", courseId).eq("userId", userId),
    )
    .unique();
}

async function computeProgressForEnrollment(
  ctx: QueryCtx,
  enrollment: Doc<"courseEnrollments">,
  lessonCountOverride?: number,
): Promise<number> {
  const course = await ctx.db.get(enrollment.courseId);
  const total =
    lessonCountOverride ?? (course ? course.lessonCount : 0);
  if (total === 0) return 0;
  // Recompute completed lessons that still exist to avoid stale ids
  const completed = enrollment.completedLessonIds.length;
  return Math.min(100, Math.round((completed / total) * 100));
}

function randomSerial(): string {
  const year = new Date().getFullYear();
  const alpha = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alpha[Math.floor(Math.random() * alpha.length)];
  }
  return `HR-${year}-${code}`;
}

export async function issueCertificateIfMissing(
  ctx: MutationCtx,
  courseId: Id<"courses">,
  userId: Id<"users">,
): Promise<Id<"courseCertificates"> | null> {
  const existing = await ctx.db
    .query("courseCertificates")
    .withIndex("by_user_and_course", (q) =>
      q.eq("userId", userId).eq("courseId", courseId),
    )
    .unique();
  if (existing) return existing._id;
  const course = await ctx.db.get(courseId);
  const user = await ctx.db.get(userId);
  if (!course || !user) return null;
  // Try up to 5 times to get a unique serial
  let serial = randomSerial();
  for (let i = 0; i < 5; i += 1) {
    const conflict = await ctx.db
      .query("courseCertificates")
      .withIndex("by_serial", (q) => q.eq("serial", serial))
      .first();
    if (!conflict) break;
    serial = randomSerial();
  }
  return await ctx.db.insert("courseCertificates", {
    courseId,
    userId,
    issuedAt: new Date().toISOString(),
    serial,
    courseTitle: course.title,
    userName: user.name ?? "Karyawan",
    instructorName: course.instructorName,
    durationMinutes: course.durationMinutes,
  });
}

async function enrichCourses(
  ctx: QueryCtx,
  viewerId: Id<"users">,
  courses: Array<Doc<"courses">>,
): Promise<Array<CourseWithMeta>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = userCache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  };
  const viewer = await ctx.db.get(viewerId);
  const viewerDept = viewer?.department ?? null;
  const out: Array<CourseWithMeta> = [];
  for (const c of courses) {
    const author = await getUser(c.authorId);
    const enrollment = await getEnrollmentForUser(ctx, c._id, viewerId);
    const hasPassedQuiz = await viewerHasPassedQuiz(ctx, c._id, viewerId);
    const assignmentInfo = await viewerAssignmentForCourse(
      ctx,
      c._id,
      viewerId,
      viewerDept,
    );
    out.push({
      ...c,
      authorName: author?.name ?? null,
      authorAvatar: author?.avatarUrl ?? null,
      enrollment: enrollment
        ? {
            ...enrollment,
            completedLessonCount: enrollment.completedLessonIds.length,
          }
        : null,
      hasPassedQuiz,
      isAssigned: assignmentInfo !== null,
      assignmentDueDate: assignmentInfo?.dueDate ?? null,
    });
  }
  return out;
}

export async function viewerHasPassedQuiz(
  ctx: QueryCtx,
  courseId: Id<"courses">,
  viewerId: Id<"users">,
): Promise<boolean> {
  const attempts = await ctx.db
    .query("courseQuizAttempts")
    .withIndex("by_user_and_course", (q) =>
      q.eq("userId", viewerId).eq("courseId", courseId),
    )
    .collect();
  return attempts.some((a) => a.passed);
}

export async function viewerAssignmentForCourse(
  ctx: QueryCtx,
  courseId: Id<"courses">,
  viewerId: Id<"users">,
  viewerDept: string | null,
): Promise<Doc<"courseAssignments"> | null> {
  const rows = await ctx.db
    .query("courseAssignments")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  for (const row of rows) {
    if (row.targetType === "all") return row;
    if (
      row.targetType === "user" &&
      row.targetValue === String(viewerId)
    ) {
      return row;
    }
    if (
      row.targetType === "department" &&
      viewerDept &&
      row.targetValue === viewerDept
    ) {
      return row;
    }
  }
  return null;
}

// -------- Course queries --------

export const listCourses = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    // "all" | "enrolled" | "published" | "draft" | "mandatory"
    filter: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<CourseWithMeta>> => {
    const viewer = await requireUser(ctx);
    const isAdmin = isAdminRole(viewer.role);

    let courses: Array<Doc<"courses">>;
    const search = args.search?.trim();
    if (search && search.length > 0) {
      courses = await ctx.db
        .query("courses")
        .withSearchIndex("search_title", (q) => {
          let sq = q.search("title", search);
          if (args.category && args.category !== "all") {
            sq = sq.eq("category", args.category);
          }
          if (!isAdmin) sq = sq.eq("isPublished", true);
          return sq;
        })
        .take(200);
    } else if (args.category && args.category !== "all") {
      courses = await ctx.db
        .query("courses")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc")
        .take(200);
      if (!isAdmin) courses = courses.filter((c) => c.isPublished);
    } else {
      const all = await ctx.db.query("courses").order("desc").take(200);
      courses = isAdmin ? all : all.filter((c) => c.isPublished);
    }

    // Additional filters
    if (args.filter === "draft") {
      courses = courses.filter((c) => !c.isPublished);
    } else if (args.filter === "published") {
      courses = courses.filter((c) => c.isPublished);
    }

    const enriched = await enrichCourses(ctx, viewer._id, courses);
    if (args.filter === "enrolled") {
      return enriched.filter((c) => c.enrollment !== null);
    }
    if (args.filter === "mandatory") {
      return enriched.filter((c) => c.isAssigned);
    }
    return enriched;
  },
});

export const getCourse = query({
  args: { id: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (CourseWithMeta & {
        lessons: Array<LessonPreview>;
        quiz:
          | {
              _id: Id<"courseQuizzes">;
              title: string;
              description?: string;
              passingScore: number;
              maxAttempts?: number;
              questionCount: number;
              attemptCount: number;
              bestScore: number | null;
              hasPassed: boolean;
            }
          | null;
        certificate: Doc<"courseCertificates"> | null;
      })
    | null
  > => {
    const viewer = await requireUser(ctx);
    const course = await ctx.db.get(args.id);
    if (!course) return null;
    if (!course.isPublished && !isAdminRole(viewer.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Kelas ini belum dipublikasikan",
      });
    }
    const [enriched] = await enrichCourses(ctx, viewer._id, [course]);
    const lessons = await ctx.db
      .query("courseLessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    lessons.sort((a, b) => a.order - b.order);
    const previews: Array<LessonPreview> = lessons.map((l) => ({
      _id: l._id,
      title: l.title,
      durationMinutes: l.durationMinutes,
      order: l.order,
      hasVideo: Boolean(l.videoUrl),
    }));

    // Quiz info (single quiz per course)
    const quizDoc = await ctx.db
      .query("courseQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .first();
    let quizInfo: {
      _id: Id<"courseQuizzes">;
      title: string;
      description?: string;
      passingScore: number;
      maxAttempts?: number;
      questionCount: number;
      attemptCount: number;
      bestScore: number | null;
      hasPassed: boolean;
    } | null = null;
    if (quizDoc) {
      const attempts = await ctx.db
        .query("courseQuizAttempts")
        .withIndex("by_user_and_course", (q) =>
          q.eq("userId", viewer._id).eq("courseId", args.id),
        )
        .collect();
      const bestScore =
        attempts.length === 0
          ? null
          : attempts.reduce((m, a) => Math.max(m, a.score), 0);
      quizInfo = {
        _id: quizDoc._id,
        title: quizDoc.title,
        description: quizDoc.description,
        passingScore: quizDoc.passingScore,
        maxAttempts: quizDoc.maxAttempts,
        questionCount: quizDoc.questions.length,
        attemptCount: attempts.length,
        bestScore,
        hasPassed: attempts.some((a) => a.passed),
      };
    }

    const certificate = await ctx.db
      .query("courseCertificates")
      .withIndex("by_user_and_course", (q) =>
        q.eq("userId", viewer._id).eq("courseId", args.id),
      )
      .unique();

    return {
      ...enriched,
      lessons: previews,
      quiz: quizInfo,
      certificate: certificate ?? null,
    };
  },
});

export const getLesson = query({
  args: { id: v.id("courseLessons") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (Doc<"courseLessons"> & {
        courseTitle: string;
        isCompleted: boolean;
      })
    | null
  > => {
    const viewer = await requireUser(ctx);
    const lesson = await ctx.db.get(args.id);
    if (!lesson) return null;
    const course = await ctx.db.get(lesson.courseId);
    if (!course) return null;
    if (!course.isPublished && !isAdminRole(viewer.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Kelas ini belum dipublikasikan",
      });
    }
    const enrollment = await getEnrollmentForUser(
      ctx,
      lesson.courseId,
      viewer._id,
    );
    const isCompleted = enrollment
      ? enrollment.completedLessonIds.some((id) => id === lesson._id)
      : false;
    return {
      ...lesson,
      courseTitle: course.title,
      isCompleted,
    };
  },
});

export const getMyEnrollments = query({
  args: {},
  handler: async (ctx): Promise<Array<CourseWithMeta>> => {
    const viewer = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect();
    enrollments.sort((a, b) => {
      return (
        new Date(b.lastAccessedAt).getTime() -
        new Date(a.lastAccessedAt).getTime()
      );
    });
    const courses: Array<Doc<"courses">> = [];
    for (const e of enrollments) {
      const c = await ctx.db.get(e.courseId);
      if (c) courses.push(c);
    }
    return await enrichCourses(ctx, viewer._id, courses);
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    enrolledCount: number;
    inProgressCount: number;
    completedCount: number;
    totalMinutes: number;
  }> => {
    const viewer = await requireUser(ctx);
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect();
    let completed = 0;
    let inProgress = 0;
    let minutes = 0;
    for (const e of enrollments) {
      if (e.completedAt) completed += 1;
      else if (e.progress > 0) inProgress += 1;
      const course = await ctx.db.get(e.courseId);
      if (course) minutes += course.durationMinutes;
    }
    return {
      enrolledCount: enrollments.length,
      inProgressCount: inProgress,
      completedCount: completed,
      totalMinutes: minutes,
    };
  },
});

// -------- Course mutations --------

export const createCourse = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    level: v.string(),
    durationMinutes: v.number(),
    coverColor: v.string(),
    instructorName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"courses">> => {
    const user = await requireAdmin(ctx);
    const title = args.title.trim();
    const description = args.description.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul kelas wajib diisi",
      });
    }
    if (description.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Deskripsi kelas wajib diisi",
      });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    if (!VALID_LEVELS.includes(args.level)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Level tidak valid",
      });
    }
    const coverColor = VALID_COLORS.includes(args.coverColor)
      ? args.coverColor
      : "blue";
    return await ctx.db.insert("courses", {
      title,
      description,
      category: args.category,
      level: args.level,
      durationMinutes: Math.max(0, Math.round(args.durationMinutes)),
      coverColor,
      instructorName: args.instructorName?.trim() || undefined,
      authorId: user._id,
      isPublished: false,
      lessonCount: 0,
      enrollmentCount: 0,
    });
  },
});

export const updateCourse = mutation({
  args: {
    id: v.id("courses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    level: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    coverColor: v.optional(v.string()),
    instructorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const course = await ctx.db.get(args.id);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"courses">> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (t.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Judul tidak boleh kosong",
        });
      }
      patch.title = t;
    }
    if (args.description !== undefined) {
      const d = args.description.trim();
      if (d.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Deskripsi tidak boleh kosong",
        });
      }
      patch.description = d;
    }
    if (args.category !== undefined) {
      if (!VALID_CATEGORIES.includes(args.category)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kategori tidak valid",
        });
      }
      patch.category = args.category;
    }
    if (args.level !== undefined) {
      if (!VALID_LEVELS.includes(args.level)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Level tidak valid",
        });
      }
      patch.level = args.level;
    }
    if (args.durationMinutes !== undefined) {
      patch.durationMinutes = Math.max(0, Math.round(args.durationMinutes));
    }
    if (args.coverColor !== undefined) {
      patch.coverColor = VALID_COLORS.includes(args.coverColor)
        ? args.coverColor
        : "blue";
    }
    if (args.instructorName !== undefined) {
      patch.instructorName = args.instructorName.trim() || undefined;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const setPublished = mutation({
  args: { id: v.id("courses"), isPublished: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const course = await ctx.db.get(args.id);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    if (args.isPublished && course.lessonCount === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tambahkan minimal satu pelajaran sebelum publikasi",
      });
    }
    await ctx.db.patch(args.id, { isPublished: args.isPublished });

    if (args.isPublished && !course.isPublished) {
      // Notify all users about a new published course
      const users = await ctx.db.query("users").collect();
      for (const u of users) {
        if (u._id === admin._id) continue;
        await notifyUser(ctx, {
          userId: u._id,
          type: "course_published",
          title: "Kelas baru tersedia",
          message: `"${course.title}" kini tersedia untuk diikuti.`,
          link: `/training/${course._id}`,
          actorId: admin._id,
        });
      }
    }
    return null;
  },
});

export const removeCourse = mutation({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Delete lessons
    const lessons = await ctx.db
      .query("courseLessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const l of lessons) {
      // Delete lesson comments
      const comments = await ctx.db
        .query("lessonComments")
        .withIndex("by_lesson", (q) => q.eq("lessonId", l._id))
        .collect();
      for (const c of comments) await ctx.db.delete(c._id);
      await ctx.db.delete(l._id);
    }
    // Delete enrollments
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const e of enrollments) await ctx.db.delete(e._id);
    // Delete quiz + attempts
    const quizzes = await ctx.db
      .query("courseQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const qz of quizzes) {
      const attempts = await ctx.db
        .query("courseQuizAttempts")
        .withIndex("by_quiz", (q) => q.eq("quizId", qz._id))
        .collect();
      for (const a of attempts) await ctx.db.delete(a._id);
      await ctx.db.delete(qz._id);
    }
    // Delete certificates
    const certs = await ctx.db
      .query("courseCertificates")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const c of certs) await ctx.db.delete(c._id);
    // Delete assignments
    const assigns = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const a of assigns) await ctx.db.delete(a._id);
    // Delete reviews
    const reviews = await ctx.db
      .query("courseReviews")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const r of reviews) await ctx.db.delete(r._id);
    // Remove from learning paths
    const pathCourses = await ctx.db
      .query("learningPathCourses")
      .filter((q) => q.eq(q.field("courseId"), args.id))
      .collect();
    for (const pc of pathCourses) {
      await ctx.db.delete(pc._id);
      const path = await ctx.db.get(pc.pathId);
      if (path) {
        await ctx.db.patch(path._id, {
          courseCount: Math.max(0, path.courseCount - 1),
        });
      }
    }
    // Delete course skills
    const courseSkills = await ctx.db
      .query("courseSkills")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const s of courseSkills) await ctx.db.delete(s._id);
    // Delete prereqs referring to this course
    const prereqs = await ctx.db
      .query("coursePrerequisites")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const p of prereqs) await ctx.db.delete(p._id);
    const dependants = await ctx.db
      .query("coursePrerequisites")
      .withIndex("by_prerequisite", (q) => q.eq("prerequisiteId", args.id))
      .collect();
    for (const p of dependants) await ctx.db.delete(p._id);
    // Delete bookmarks for this course
    const bookmarks = await ctx.db
      .query("courseBookmarks")
      .filter((q) => q.eq(q.field("courseId"), args.id))
      .collect();
    for (const b of bookmarks) await ctx.db.delete(b._id);
    // Delete surveys + responses
    const surveys = await ctx.db
      .query("courseSurveys")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const s of surveys) {
      const responses = await ctx.db
        .query("courseSurveyResponses")
        .withIndex("by_survey", (q) => q.eq("surveyId", s._id))
        .collect();
      for (const r of responses) await ctx.db.delete(r._id);
      await ctx.db.delete(s._id);
    }
    // Delete sessions + registrations
    const sessions = await ctx.db
      .query("trainingSessions")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .collect();
    for (const s of sessions) {
      const regs = await ctx.db
        .query("trainingSessionRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();
      for (const r of regs) await ctx.db.delete(r._id);
      await ctx.db.delete(s._id);
    }
    // Delete course cost
    const cost = await ctx.db
      .query("courseCosts")
      .withIndex("by_course", (q) => q.eq("courseId", args.id))
      .first();
    if (cost) await ctx.db.delete(cost._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

// -------- Lessons --------

export const addLesson = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    content: v.string(),
    videoUrl: v.optional(v.string()),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"courseLessons">> => {
    await requireAdmin(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul pelajaran wajib diisi",
      });
    }
    const existing = await ctx.db
      .query("courseLessons")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((l) => l.order)) + 1;
    const videoUrl = args.videoUrl?.trim();
    const lessonId = await ctx.db.insert("courseLessons", {
      courseId: args.courseId,
      title,
      content: args.content,
      videoUrl: videoUrl && videoUrl.length > 0 ? videoUrl : undefined,
      durationMinutes: Math.max(0, Math.round(args.durationMinutes)),
      order: nextOrder,
    });
    await ctx.db.patch(args.courseId, {
      lessonCount: existing.length + 1,
    });
    return lessonId;
  },
});

export const updateLesson = mutation({
  args: {
    id: v.id("courseLessons"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const lesson = await ctx.db.get(args.id);
    if (!lesson) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pelajaran tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"courseLessons">> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (t.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Judul tidak boleh kosong",
        });
      }
      patch.title = t;
    }
    if (args.content !== undefined) patch.content = args.content;
    if (args.videoUrl !== undefined) {
      const url = args.videoUrl.trim();
      patch.videoUrl = url.length > 0 ? url : undefined;
    }
    if (args.durationMinutes !== undefined) {
      patch.durationMinutes = Math.max(0, Math.round(args.durationMinutes));
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const removeLesson = mutation({
  args: { id: v.id("courseLessons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const lesson = await ctx.db.get(args.id);
    if (!lesson) return null;
    // Delete comments for this lesson
    const comments = await ctx.db
      .query("lessonComments")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.id))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);
    await ctx.db.delete(args.id);

    // Decrement lessonCount; update enrollments to remove reference
    const course = await ctx.db.get(lesson.courseId);
    if (course) {
      await ctx.db.patch(course._id, {
        lessonCount: Math.max(0, course.lessonCount - 1),
      });
    }
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_course", (q) => q.eq("courseId", lesson.courseId))
      .collect();
    for (const e of enrollments) {
      const next = e.completedLessonIds.filter((id) => id !== args.id);
      if (next.length !== e.completedLessonIds.length) {
        const newProgress = await computeProgressForEnrollment(
          ctx,
          { ...e, completedLessonIds: next },
          course ? course.lessonCount - 1 : undefined,
        );
        await ctx.db.patch(e._id, {
          completedLessonIds: next,
          progress: newProgress,
          completedAt: newProgress >= 100 ? e.completedAt : undefined,
        });
      }
    }
    return null;
  },
});

export const reorderLessons = mutation({
  args: {
    courseId: v.id("courses"),
    orderedIds: v.array(v.id("courseLessons")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (let i = 0; i < args.orderedIds.length; i += 1) {
      const lesson = await ctx.db.get(args.orderedIds[i]);
      if (lesson && lesson.courseId === args.courseId) {
        await ctx.db.patch(lesson._id, { order: i });
      }
    }
    return null;
  },
});

// -------- Enrollments --------

export const enroll = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<Id<"courseEnrollments">> => {
    const user = await requireUser(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    if (!course.isPublished) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kelas belum dipublikasikan",
      });
    }
    // Enforce prerequisites
    const prereqs = await ctx.db
      .query("coursePrerequisites")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    for (const p of prereqs) {
      const e = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", p.prerequisiteId).eq("userId", user._id),
        )
        .unique();
      if (!e?.completedAt) {
        const pc = await ctx.db.get(p.prerequisiteId);
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Selesaikan prasyarat terlebih dahulu: ${pc?.title ?? "kelas prasyarat"}`,
        });
      }
    }
    const existing = await getEnrollmentForUser(ctx, args.courseId, user._id);
    if (existing) return existing._id;
    const now = new Date().toISOString();
    const enrollmentId = await ctx.db.insert("courseEnrollments", {
      courseId: args.courseId,
      userId: user._id,
      enrolledAt: now,
      completedLessonIds: [],
      progress: 0,
      lastAccessedAt: now,
    });
    await ctx.db.patch(args.courseId, {
      enrollmentCount: course.enrollmentCount + 1,
    });
    return enrollmentId;
  },
});

export const unenroll = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await getEnrollmentForUser(ctx, args.courseId, user._id);
    if (!existing) return null;
    await ctx.db.delete(existing._id);
    const course = await ctx.db.get(args.courseId);
    if (course) {
      await ctx.db.patch(course._id, {
        enrollmentCount: Math.max(0, course.enrollmentCount - 1),
      });
    }
    return null;
  },
});

export const toggleLessonComplete = mutation({
  args: { lessonId: v.id("courseLessons") },
  handler: async (
    ctx,
    args,
  ): Promise<{ progress: number; completed: boolean }> => {
    const user = await requireUser(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pelajaran tidak ditemukan",
      });
    }
    const course = await ctx.db.get(lesson.courseId);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    let enrollment = await getEnrollmentForUser(
      ctx,
      lesson.courseId,
      user._id,
    );
    const now = new Date().toISOString();
    if (!enrollment) {
      // Auto-enroll on first lesson completion
      if (!course.isPublished) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kelas belum dipublikasikan",
        });
      }
      const id = await ctx.db.insert("courseEnrollments", {
        courseId: lesson.courseId,
        userId: user._id,
        enrolledAt: now,
        completedLessonIds: [],
        progress: 0,
        lastAccessedAt: now,
      });
      await ctx.db.patch(course._id, {
        enrollmentCount: course.enrollmentCount + 1,
      });
      enrollment = await ctx.db.get(id);
      if (!enrollment) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Gagal membuat pendaftaran",
        });
      }
    }
    const already = enrollment.completedLessonIds.some(
      (id) => id === args.lessonId,
    );
    const nextCompleted = already
      ? enrollment.completedLessonIds.filter((id) => id !== args.lessonId)
      : [...enrollment.completedLessonIds, args.lessonId];
    const newProgress = await computeProgressForEnrollment(
      ctx,
      { ...enrollment, completedLessonIds: nextCompleted },
    );
    // Course completion requires passing the quiz when the course has one
    const lessonsDone = newProgress >= 100;
    const quizPassed = course.hasQuiz
      ? await viewerHasPassedQuiz(ctx, course._id, user._id)
      : true;
    const courseCompleted = lessonsDone && quizPassed;
    const wasCompleted = Boolean(enrollment.completedAt);
    const justCompleted = !wasCompleted && courseCompleted && !already;
    await ctx.db.patch(enrollment._id, {
      completedLessonIds: nextCompleted,
      progress: newProgress,
      lastAccessedAt: now,
      completedAt: courseCompleted
        ? enrollment.completedAt ?? now
        : undefined,
    });
    if (justCompleted) {
      await issueCertificateIfMissing(ctx, course._id, user._id);
      await awardXpForUser(ctx, user._id, "course_completed", {
        coursesCompleted: 1,
        certificatesEarned: 1,
      });
      await notifyUser(ctx, {
        userId: user._id,
        type: "course_completed",
        title: "Kelas diselesaikan",
        message: `Selamat! Anda telah menyelesaikan "${course.title}".`,
        link: `/training/${course._id}`,
      });
    } else if (!already) {
      // Award smaller XP for lesson completion
      await awardXpForUser(ctx, user._id, "lesson_completed");
    }
    return {
      progress: newProgress,
      completed: !already,
    };
  },
});

export const touchLastAccessed = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const enrollment = await getEnrollmentForUser(
      ctx,
      args.courseId,
      user._id,
    );
    if (!enrollment) return null;
    await ctx.db.patch(enrollment._id, {
      lastAccessedAt: new Date().toISOString(),
    });
    return null;
  },
});

// -------- Admin analytics --------

export const getCourseEnrollees = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      userId: Id<"users">;
      userName: string | null;
      userAvatar: string | null;
      userDepartment: string | null;
      enrolledAt: string;
      progress: number;
      completedAt: string | null;
    }>
  > => {
    await requireAdmin(ctx);
    const enrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    enrollments.sort((a, b) => b.progress - a.progress);
    const out: Array<{
      userId: Id<"users">;
      userName: string | null;
      userAvatar: string | null;
      userDepartment: string | null;
      enrolledAt: string;
      progress: number;
      completedAt: string | null;
    }> = [];
    for (const e of enrollments) {
      const u = await ctx.db.get(e.userId);
      out.push({
        userId: e.userId,
        userName: u?.name ?? null,
        userAvatar: u?.avatarUrl ?? null,
        userDepartment: u?.department ?? null,
        enrolledAt: e.enrolledAt,
        progress: e.progress,
        completedAt: e.completedAt ?? null,
      });
    }
    return out;
  },
});
