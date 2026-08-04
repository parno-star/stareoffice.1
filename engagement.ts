import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { awardXpForUser } from "./gamification";
import { requireUser } from "./_helpers";

// -------- Reviews --------

export type ReviewWithAuthor = Doc<"courseReviews"> & {
  authorName: string | null;
  authorAvatar: string | null;
};

export const listReviews = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<ReviewWithAuthor>> => {
    await requireUser(ctx);
    const reviews = await ctx.db
      .query("courseReviews")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    reviews.sort((a, b) => b._creationTime - a._creationTime);
    const out: Array<ReviewWithAuthor> = [];
    for (const r of reviews) {
      const u = await ctx.db.get(r.userId);
      out.push({
        ...r,
        authorName: u?.name ?? null,
        authorAvatar: u?.avatarUrl ?? null,
      });
    }
    return out;
  },
});

export const getMyReview = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<Doc<"courseReviews"> | null> => {
    const user = await requireUser(ctx);
    return (
      (await ctx.db
        .query("courseReviews")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", args.courseId).eq("userId", user._id),
        )
        .unique()) ?? null
    );
  },
});

async function recomputeCourseRating(
  ctx: MutationCtx,
  courseId: Id<"courses">,
): Promise<void> {
  const reviews = await ctx.db
    .query("courseReviews")
    .withIndex("by_course", (q) => q.eq("courseId", courseId))
    .collect();
  const count = reviews.length;
  const avg =
    count === 0
      ? 0
      : Math.round(
          (reviews.reduce((s, r) => s + r.rating, 0) / count) * 10,
        ) / 10;
  await ctx.db.patch(courseId, {
    averageRating: count === 0 ? undefined : avg,
    reviewCount: count,
  });
}

export const upsertReview = mutation({
  args: {
    courseId: v.id("courses"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.rating < 1 || args.rating > 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Rating harus 1-5",
      });
    }
    // Must have an enrollment (encourage honest reviews)
    const enrollment = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_course_and_user", (q) =>
        q.eq("courseId", args.courseId).eq("userId", user._id),
      )
      .unique();
    if (!enrollment) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Daftar kelas terlebih dahulu sebelum memberi ulasan",
      });
    }
    const existing = await ctx.db
      .query("courseReviews")
      .withIndex("by_course_and_user", (q) =>
        q.eq("courseId", args.courseId).eq("userId", user._id),
      )
      .unique();
    const comment = args.comment?.trim() || undefined;
    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: Math.round(args.rating),
        comment,
      });
    } else {
      await ctx.db.insert("courseReviews", {
        courseId: args.courseId,
        userId: user._id,
        rating: Math.round(args.rating),
        comment,
      });
      // Award XP for first time review only
      await awardXpForUser(ctx, user._id, "review_submitted");
    }
    await recomputeCourseRating(ctx, args.courseId);
    return null;
  },
});

export const removeReview = mutation({
  args: { id: v.id("courseReviews") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review) return null;
    if (review.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Ulasan ini bukan milik Anda",
      });
    }
    const courseId = review.courseId;
    await ctx.db.delete(args.id);
    await recomputeCourseRating(ctx, courseId);
    return null;
  },
});

// -------- Lesson comments --------

export type LessonCommentWithAuthor = Doc<"lessonComments"> & {
  authorName: string | null;
  authorAvatar: string | null;
};

export const listComments = query({
  args: { lessonId: v.id("courseLessons") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<LessonCommentWithAuthor>> => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("lessonComments")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();
    rows.sort((a, b) => a._creationTime - b._creationTime);
    const out: Array<LessonCommentWithAuthor> = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.authorId);
      out.push({
        ...r,
        authorName: u?.name ?? null,
        authorAvatar: u?.avatarUrl ?? null,
      });
    }
    return out;
  },
});

export const addComment = mutation({
  args: {
    lessonId: v.id("courseLessons"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"lessonComments">> => {
    const user = await requireUser(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pelajaran tidak ditemukan",
      });
    }
    const content = args.content.trim();
    if (content.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Komentar tidak boleh kosong",
      });
    }
    return await ctx.db.insert("lessonComments", {
      lessonId: args.lessonId,
      courseId: lesson.courseId,
      authorId: user._id,
      content,
    });
  },
});

export const removeComment = mutation({
  args: { id: v.id("lessonComments") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    // Author or admin can delete
    if (c.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Komentar ini bukan milik Anda",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
