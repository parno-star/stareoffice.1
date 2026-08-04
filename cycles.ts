// Admin-facing queries & mutations for Feedback 360° cycles.

import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import {
  formatPeriodLabel,
  isValidPeriod,
  recomputeCycleCounters,
  recomputeReviewAggregate,
  requireAdmin,
  requireUser,
  TEMPLATE_QUESTIONS,
  type Relationship,
} from "./utils";
import { notifyUser } from "../notifications";

const questionValidator = v.object({
  id: v.string(),
  text: v.string(),
  type: v.string(),
  required: v.boolean(),
  category: v.optional(v.string()),
});

export type CycleListItem = {
  _id: Id<"feedback360Cycles">;
  _creationTime: number;
  title: string;
  description: string | null;
  period: string;
  periodLabel: string;
  status: string;
  startDate: string;
  endDate: string;
  color: string;
  icon: string | null;
  reviewCount: number;
  totalReviewerCount: number;
  completedReviewerCount: number;
  authorId: Id<"users">;
  authorName: string | null;
  questionCount: number;
  publishedAt: string | null;
  closedAt: string | null;
  myReviewId: Id<"feedback360Reviews"> | null;
  myReviewStatus: string | null;
  myPendingAsReviewer: number;
};

export type CycleDetail = CycleListItem & {
  questions: Doc<"feedback360Cycles">["questions"];
};

function toListItem(
  cycle: Doc<"feedback360Cycles">,
  authorName: string | null,
  myReviewId: Id<"feedback360Reviews"> | null,
  myReviewStatus: string | null,
  myPendingAsReviewer: number,
): CycleListItem {
  return {
    _id: cycle._id,
    _creationTime: cycle._creationTime,
    title: cycle.title,
    description: cycle.description ?? null,
    period: cycle.period,
    periodLabel: cycle.periodLabel,
    status: cycle.status,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    color: cycle.color,
    icon: cycle.icon ?? null,
    reviewCount: cycle.reviewCount,
    totalReviewerCount: cycle.totalReviewerCount,
    completedReviewerCount: cycle.completedReviewerCount,
    authorId: cycle.authorId,
    authorName,
    questionCount: cycle.questions.length,
    publishedAt: cycle.publishedAt ?? null,
    closedAt: cycle.closedAt ?? null,
    myReviewId,
    myReviewStatus,
    myPendingAsReviewer,
  };
}

export const listCycles = query({
  args: {
    filter: v.optional(v.string()), // "all" | "active" | "draft" | "closed" | "mine"
  },
  handler: async (ctx, args): Promise<Array<CycleListItem>> => {
    const user = await requireUser(ctx);
    const filter = args.filter ?? "all";
    let cycles = await ctx.db
      .query("feedback360Cycles")
      .order("desc")
      .take(200);

    // Non-admins should never see drafts from other users
    if (!isAdminRole(user.role)) {
      cycles = cycles.filter((c) => c.status !== "draft");
    }
    if (filter === "active") {
      cycles = cycles.filter((c) => c.status === "active");
    } else if (filter === "draft") {
      cycles = cycles.filter((c) => c.status === "draft");
    } else if (filter === "closed") {
      cycles = cycles.filter((c) => c.status === "closed");
    } else if (filter === "mine") {
      cycles = cycles.filter((c) => c.authorId === user._id);
    }

    const authorsCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<CycleListItem> = [];
    for (const c of cycles) {
      let author = authorsCache.get(c.authorId);
      if (author === undefined) {
        author = await ctx.db.get(c.authorId);
        authorsCache.set(c.authorId, author);
      }
      const myReview = await ctx.db
        .query("feedback360Reviews")
        .withIndex("by_cycle_and_reviewee", (q) =>
          q.eq("cycleId", c._id).eq("revieweeId", user._id),
        )
        .first();
      const myInvites = await ctx.db
        .query("feedback360Reviewers")
        .withIndex("by_reviewer_and_status", (q) =>
          q.eq("reviewerId", user._id).eq("status", "pending"),
        )
        .collect();
      const myPending = myInvites.filter((r) => r.cycleId === c._id).length;
      results.push(
        toListItem(
          c,
          author?.name ?? null,
          myReview?._id ?? null,
          myReview?.status ?? null,
          myPending,
        ),
      );
    }
    return results;
  },
});

export const getCycle = query({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (ctx, args): Promise<CycleDetail | null> => {
    const user = await requireUser(ctx);
    const c = await ctx.db.get(args.cycleId);
    if (!c) return null;
    if (!isAdminRole(user.role) && c.status === "draft") return null;
    const author = await ctx.db.get(c.authorId);
    const myReview = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle_and_reviewee", (q) =>
        q.eq("cycleId", c._id).eq("revieweeId", user._id),
      )
      .first();
    const myInvites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_reviewer_and_status", (q) =>
        q.eq("reviewerId", user._id).eq("status", "pending"),
      )
      .collect();
    const myPending = myInvites.filter((r) => r.cycleId === c._id).length;
    const base = toListItem(
      c,
      author?.name ?? null,
      myReview?._id ?? null,
      myReview?.status ?? null,
      myPending,
    );
    return { ...base, questions: c.questions };
  },
});

export const getTemplateQuestions = query({
  args: {},
  handler: async (): Promise<ReadonlyArray<(typeof TEMPLATE_QUESTIONS)[number]>> => {
    return TEMPLATE_QUESTIONS;
  },
});

export const createCycle = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    period: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    questions: v.optional(v.array(questionValidator)),
  },
  handler: async (ctx, args): Promise<Id<"feedback360Cycles">> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Judul wajib diisi" });
    }
    if (!isValidPeriod(args.period)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format periode tidak valid (contoh: 2026-Q1)",
      });
    }
    if (args.startDate > args.endDate) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal mulai tidak boleh setelah tanggal berakhir",
      });
    }
    const questions = (args.questions && args.questions.length > 0
      ? args.questions
      : TEMPLATE_QUESTIONS.map((q) => ({ ...q }))) as Array<
      Doc<"feedback360Cycles">["questions"][number]
    >;
    if (questions.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Minimal satu pertanyaan dibutuhkan",
      });
    }
    return await ctx.db.insert("feedback360Cycles", {
      title,
      description: args.description?.trim() || undefined,
      period: args.period,
      periodLabel: formatPeriodLabel(args.period),
      status: "draft",
      startDate: args.startDate,
      endDate: args.endDate,
      questions,
      color: args.color,
      icon: args.icon?.trim() || undefined,
      reviewCount: 0,
      completedReviewerCount: 0,
      totalReviewerCount: 0,
      authorId: user._id,
    });
  },
});

export const updateCycle = mutation({
  args: {
    cycleId: v.id("feedback360Cycles"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    period: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    questions: v.optional(v.array(questionValidator)),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    if (cycle.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus sudah ditutup dan tidak dapat diubah",
      });
    }
    const patch: Partial<Doc<"feedback360Cycles">> = {};
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Judul wajib diisi",
        });
      }
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.period !== undefined) {
      if (!isValidPeriod(args.period)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format periode tidak valid",
        });
      }
      patch.period = args.period;
      patch.periodLabel = formatPeriodLabel(args.period);
    }
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    const start = patch.startDate ?? cycle.startDate;
    const end = patch.endDate ?? cycle.endDate;
    if (start > end) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal mulai tidak boleh setelah tanggal berakhir",
      });
    }
    if (args.color !== undefined) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon.trim() || undefined;
    if (args.questions !== undefined) {
      if (args.questions.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Minimal satu pertanyaan dibutuhkan",
        });
      }
      // Only allow editing questions when cycle is still a draft - otherwise
      // existing reviewer answers could reference removed question ids.
      if (cycle.status !== "draft") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Pertanyaan hanya dapat diubah saat siklus masih draf",
        });
      }
      patch.questions = args.questions;
    }
    await ctx.db.patch(args.cycleId, patch);
    return null;
  },
});

export const publishCycle = mutation({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    if (cycle.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus sudah aktif atau ditutup",
      });
    }
    const reviews = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    if (reviews.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tambahkan minimal satu karyawan untuk dinilai sebelum mengaktifkan siklus",
      });
    }
    await ctx.db.patch(args.cycleId, {
      status: "active",
      publishedAt: new Date().toISOString(),
    });
    // Notify every reviewer who has a pending invite in this cycle
    const reviewerInvites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    const notified = new Set<Id<"users">>();
    for (const inv of reviewerInvites) {
      if (inv.status !== "pending") continue;
      if (notified.has(inv.reviewerId)) continue;
      notified.add(inv.reviewerId);
      await notifyUser(ctx, {
        userId: inv.reviewerId,
        type: "feedback360_invite",
        title: "Undangan Feedback 360°",
        message: `Anda diminta memberi feedback untuk siklus ${cycle.periodLabel}`,
        link: `/feedback360/${args.cycleId}`,
        actorId: user._id,
      });
    }
    return null;
  },
});

export const closeCycle = mutation({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    if (cycle.status === "closed") return null;
    await ctx.db.patch(args.cycleId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const removeCycle = mutation({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) return null;
    if (cycle.status === "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tutup siklus terlebih dahulu sebelum menghapus",
      });
    }
    // Cascade delete: reviews + reviewer invitations
    const reviews = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    for (const r of reviews) {
      const invites = await ctx.db
        .query("feedback360Reviewers")
        .withIndex("by_review", (q) => q.eq("reviewId", r._id))
        .collect();
      for (const inv of invites) await ctx.db.delete(inv._id);
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.cycleId);
    return null;
  },
});

// ---- Review setup -----------------------------------------------------

export const addReviewee = mutation({
  args: {
    cycleId: v.id("feedback360Cycles"),
    revieweeId: v.id("users"),
    autoInviteManager: v.optional(v.boolean()),
    autoInviteReports: v.optional(v.boolean()),
    autoInviteSelf: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"feedback360Reviews">> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    if (cycle.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus sudah ditutup",
      });
    }
    const reviewee = await ctx.db.get(args.revieweeId);
    if (!reviewee) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle_and_reviewee", (q) =>
        q.eq("cycleId", args.cycleId).eq("revieweeId", args.revieweeId),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Karyawan sudah ada di siklus ini",
      });
    }
    const reviewId = await ctx.db.insert("feedback360Reviews", {
      cycleId: args.cycleId,
      revieweeId: args.revieweeId,
      status: "pending",
      totalReviewers: 0,
      completedReviewers: 0,
      revieweeName: reviewee.name ?? "Tanpa nama",
      revieweeDepartment: reviewee.department,
      revieweeJobTitle: reviewee.jobTitle,
      createdById: user._id,
    });

    // Helper to invite a reviewer
    const invite = async (reviewerId: Id<"users">, relationship: Relationship) => {
      await ctx.db.insert("feedback360Reviewers", {
        reviewId,
        cycleId: args.cycleId,
        revieweeId: args.revieweeId,
        reviewerId,
        relationship,
        status: "pending",
        invitedAt: new Date().toISOString(),
      });
    };

    if (args.autoInviteSelf !== false) {
      await invite(args.revieweeId, "self");
    }
    if (args.autoInviteManager !== false && reviewee.managerId) {
      await invite(reviewee.managerId, "manager");
    }
    if (args.autoInviteReports !== false) {
      const reports = await ctx.db
        .query("users")
        .withIndex("by_manager", (q) => q.eq("managerId", args.revieweeId))
        .collect();
      for (const r of reports) {
        await invite(r._id, "report");
      }
    }

    await recomputeReviewAggregate(ctx, reviewId);
    await recomputeCycleCounters(ctx, args.cycleId);
    return reviewId;
  },
});

export const removeReviewee = mutation({
  args: { reviewId: v.id("feedback360Reviews") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const review = await ctx.db.get(args.reviewId);
    if (!review) return null;
    const cycle = await ctx.db.get(review.cycleId);
    if (cycle?.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus sudah ditutup",
      });
    }
    const invites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_review", (q) => q.eq("reviewId", args.reviewId))
      .collect();
    for (const inv of invites) await ctx.db.delete(inv._id);
    await ctx.db.delete(args.reviewId);
    await recomputeCycleCounters(ctx, review.cycleId);
    return null;
  },
});
