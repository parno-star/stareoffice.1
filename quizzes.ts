import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { issueCertificateIfMissing, viewerHasPassedQuiz } from "../courses";
import { notifyUser } from "../notifications";
import { awardXpForUser } from "./gamification";
import { requireUser, requireAdmin } from "./_helpers";

const questionValidator = v.object({
  id: v.string(),
  text: v.string(),
  options: v.array(
    v.object({
      id: v.string(),
      text: v.string(),
    }),
  ),
  correctOptionId: v.string(),
  explanation: v.optional(v.string()),
});

// -------- Admin quiz CRUD --------

export const getQuizForAdmin = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<Doc<"courseQuizzes"> | null> => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("courseQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
  },
});

export const upsertQuiz = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    passingScore: v.number(),
    maxAttempts: v.optional(v.number()),
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args): Promise<Id<"courseQuizzes">> => {
    const admin = await requireAdmin(ctx);
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
        message: "Judul kuis wajib diisi",
      });
    }
    if (args.passingScore < 0 || args.passingScore > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nilai kelulusan harus antara 0-100",
      });
    }
    // Validate questions
    for (const q of args.questions) {
      if (q.text.trim().length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Pertanyaan tidak boleh kosong",
        });
      }
      if (q.options.length < 2) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Setiap pertanyaan butuh minimal 2 opsi",
        });
      }
      if (!q.options.some((o) => o.id === q.correctOptionId)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Opsi benar harus salah satu opsi yang tersedia",
        });
      }
    }
    const existing = await ctx.db
      .query("courseQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    const patch = {
      courseId: args.courseId,
      title,
      description: args.description?.trim() || undefined,
      passingScore: Math.round(args.passingScore),
      maxAttempts:
        args.maxAttempts && args.maxAttempts > 0
          ? Math.round(args.maxAttempts)
          : undefined,
      questions: args.questions,
      authorId: admin._id,
    };
    let quizId: Id<"courseQuizzes">;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      quizId = existing._id;
    } else {
      quizId = await ctx.db.insert("courseQuizzes", patch);
    }
    // Flip hasQuiz flag on the course if questions is non-empty
    await ctx.db.patch(args.courseId, {
      hasQuiz: args.questions.length > 0,
    });
    return quizId;
  },
});

export const removeQuiz = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const quiz = await ctx.db
      .query("courseQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    if (!quiz) return null;
    const attempts = await ctx.db
      .query("courseQuizAttempts")
      .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
      .collect();
    for (const a of attempts) await ctx.db.delete(a._id);
    await ctx.db.delete(quiz._id);
    await ctx.db.patch(args.courseId, { hasQuiz: false });
    return null;
  },
});

// -------- Employee quiz taking --------

// Public quiz for taking: hides correctOptionId
export type PublicQuiz = {
  _id: Id<"courseQuizzes">;
  courseId: Id<"courses">;
  title: string;
  description?: string;
  passingScore: number;
  maxAttempts?: number;
  questions: Array<{
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
  }>;
  attemptsUsed: number;
  hasPassed: boolean;
  bestScore: number | null;
};

export const getQuizForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<PublicQuiz | null> => {
    const user = await requireUser(ctx);
    const quiz = await ctx.db
      .query("courseQuizzes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    if (!quiz) return null;
    const attempts = await ctx.db
      .query("courseQuizAttempts")
      .withIndex("by_user_and_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .collect();
    const bestScore =
      attempts.length === 0
        ? null
        : attempts.reduce((m, a) => Math.max(m, a.score), 0);
    return {
      _id: quiz._id,
      courseId: quiz.courseId,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
      })),
      attemptsUsed: attempts.length,
      hasPassed: attempts.some((a) => a.passed),
      bestScore,
    };
  },
});

export const submitQuizAttempt = mutation({
  args: {
    quizId: v.id("courseQuizzes"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        optionId: v.string(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    attemptId: Id<"courseQuizAttempts">;
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    results: Array<{
      questionId: string;
      correct: boolean;
      correctOptionId: string;
      explanation?: string;
    }>;
  }> => {
    const user = await requireUser(ctx);
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kuis tidak ditemukan",
      });
    }
    const course = await ctx.db.get(quiz.courseId);
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
    const prevAttempts = await ctx.db
      .query("courseQuizAttempts")
      .withIndex("by_user_and_course", (q) =>
        q.eq("userId", user._id).eq("courseId", quiz.courseId),
      )
      .collect();
    if (
      quiz.maxAttempts &&
      prevAttempts.length >= quiz.maxAttempts &&
      !prevAttempts.some((a) => a.passed)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Batas percobaan kuis telah habis",
      });
    }

    // Compute score
    let correctCount = 0;
    const results: Array<{
      questionId: string;
      correct: boolean;
      correctOptionId: string;
      explanation?: string;
    }> = [];
    for (const q of quiz.questions) {
      const answer = args.answers.find((a) => a.questionId === q.id);
      const correct = answer?.optionId === q.correctOptionId;
      if (correct) correctCount += 1;
      results.push({
        questionId: q.id,
        correct,
        correctOptionId: q.correctOptionId,
        explanation: q.explanation,
      });
    }
    const totalQuestions = quiz.questions.length;
    const score =
      totalQuestions === 0
        ? 0
        : Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= quiz.passingScore;

    const attemptId = await ctx.db.insert("courseQuizAttempts", {
      quizId: quiz._id,
      courseId: quiz.courseId,
      userId: user._id,
      answers: args.answers,
      score,
      passed,
      submittedAt: new Date().toISOString(),
    });

    if (passed) {
      // Award quiz XP only on first pass
      const alreadyPassed = prevAttempts.some((a) => a.passed);
      if (!alreadyPassed) {
        await awardXpForUser(ctx, user._id, "quiz_passed", {
          quizzesPassed: 1,
        });
      }
      // Check if course should now be marked complete
      const enrollment = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", quiz.courseId).eq("userId", user._id),
        )
        .unique();
      const lessonsDone =
        enrollment !== null &&
        course.lessonCount > 0 &&
        enrollment.completedLessonIds.length >= course.lessonCount;
      const quizPassed = await viewerHasPassedQuiz(
        ctx,
        quiz.courseId,
        user._id,
      );
      if (enrollment && lessonsDone && quizPassed && !enrollment.completedAt) {
        const now = new Date().toISOString();
        await ctx.db.patch(enrollment._id, { completedAt: now });
        await issueCertificateIfMissing(ctx, course._id, user._id);
        await awardXpForUser(ctx, user._id, "course_completed", {
          coursesCompleted: 1,
          certificatesEarned: 1,
        });
        await notifyUser(ctx, {
          userId: user._id,
          type: "course_completed",
          title: "Kelas diselesaikan",
          message: `Selamat! Anda menyelesaikan "${course.title}" setelah lulus kuis.`,
          link: `/training/${course._id}`,
        });
      }
    }

    return {
      attemptId,
      score,
      passed,
      correctCount,
      totalQuestions,
      results,
    };
  },
});

export const getMyAttempts = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"courseQuizAttempts">>> => {
    const user = await requireUser(ctx);
    const attempts = await ctx.db
      .query("courseQuizAttempts")
      .withIndex("by_user_and_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .collect();
    attempts.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime(),
    );
    return attempts;
  },
});
