// Reviewer-facing queries & mutations for Feedback 360°.
// Handles listing invitations, submitting feedback, and adding peer reviewers.

import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import {
  computeReviewerScore,
  isRelationship,
  recomputeCycleCounters,
  recomputeReviewAggregate,
  requireAdmin,
  requireUser,
  type Relationship,
} from "./utils";
import { notifyUser } from "../notifications";

const answerValidator = v.object({
  questionId: v.string(),
  value: v.string(),
});

export type ReviewerInviteItem = {
  _id: Id<"feedback360Reviewers">;
  reviewId: Id<"feedback360Reviews">;
  cycleId: Id<"feedback360Cycles">;
  cycleTitle: string;
  cyclePeriodLabel: string;
  cycleEndDate: string;
  cycleStatus: string;
  revieweeId: Id<"users">;
  revieweeName: string;
  revieweeAvatar: string | null;
  revieweeDepartment: string | null;
  revieweeJobTitle: string | null;
  relationship: Relationship;
  status: string;
  invitedAt: string;
  submittedAt: string | null;
};

export type ReviewerFormData = {
  invite: ReviewerInviteItem;
  questions: Doc<"feedback360Cycles">["questions"];
  existingAnswers: Array<{ questionId: string; value: string }>;
  existingStrengths: string | null;
  existingImprovements: string | null;
};

function toReviewerInvite(
  inv: Doc<"feedback360Reviewers">,
  cycle: Doc<"feedback360Cycles">,
  reviewee: Doc<"users"> | null,
): ReviewerInviteItem {
  const rel: Relationship = isRelationship(inv.relationship)
    ? inv.relationship
    : "peer";
  return {
    _id: inv._id,
    reviewId: inv.reviewId,
    cycleId: inv.cycleId,
    cycleTitle: cycle.title,
    cyclePeriodLabel: cycle.periodLabel,
    cycleEndDate: cycle.endDate,
    cycleStatus: cycle.status,
    revieweeId: inv.revieweeId,
    revieweeName: reviewee?.name ?? "Tanpa nama",
    revieweeAvatar: reviewee?.avatarUrl ?? null,
    revieweeDepartment: reviewee?.department ?? null,
    revieweeJobTitle: reviewee?.jobTitle ?? null,
    relationship: rel,
    status: inv.status,
    invitedAt: inv.invitedAt,
    submittedAt: inv.submittedAt ?? null,
  };
}

export const listMyInvites = query({
  args: {
    filter: v.optional(v.string()), // "pending" | "submitted" | "all"
  },
  handler: async (ctx, args): Promise<Array<ReviewerInviteItem>> => {
    const user = await requireUser(ctx);
    const filter = args.filter ?? "all";
    let invites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_reviewer", (q) => q.eq("reviewerId", user._id))
      .order("desc")
      .take(300);

    const cycleCache = new Map<
      Id<"feedback360Cycles">,
      Doc<"feedback360Cycles"> | null
    >();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<ReviewerInviteItem> = [];
    for (const inv of invites) {
      let cycle = cycleCache.get(inv.cycleId);
      if (cycle === undefined) {
        cycle = await ctx.db.get(inv.cycleId);
        cycleCache.set(inv.cycleId, cycle);
      }
      if (!cycle) continue;
      // Only surface invites on active or closed cycles - drafts shouldn't leak
      if (cycle.status === "draft") continue;
      if (filter === "pending" && inv.status !== "pending") continue;
      if (filter === "submitted" && inv.status !== "submitted") continue;

      let reviewee = userCache.get(inv.revieweeId);
      if (reviewee === undefined) {
        reviewee = await ctx.db.get(inv.revieweeId);
        userCache.set(inv.revieweeId, reviewee);
      }
      results.push(toReviewerInvite(inv, cycle, reviewee));
    }
    return results;
  },
});

export const getInviteForm = query({
  args: { reviewerRowId: v.id("feedback360Reviewers") },
  handler: async (ctx, args): Promise<ReviewerFormData | null> => {
    const user = await requireUser(ctx);
    const inv = await ctx.db.get(args.reviewerRowId);
    if (!inv) return null;
    if (inv.reviewerId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan reviewer untuk undangan ini",
      });
    }
    const cycle = await ctx.db.get(inv.cycleId);
    if (!cycle) return null;
    const reviewee = await ctx.db.get(inv.revieweeId);
    return {
      invite: toReviewerInvite(inv, cycle, reviewee),
      questions: cycle.questions,
      existingAnswers: inv.answers ?? [],
      existingStrengths: inv.strengths ?? null,
      existingImprovements: inv.improvements ?? null,
    };
  },
});

export const submitReviewerResponse = mutation({
  args: {
    reviewerRowId: v.id("feedback360Reviewers"),
    answers: v.array(answerValidator),
    strengths: v.optional(v.string()),
    improvements: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const inv = await ctx.db.get(args.reviewerRowId);
    if (!inv) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Undangan tidak ditemukan",
      });
    }
    if (inv.reviewerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan reviewer untuk undangan ini",
      });
    }
    if (inv.status === "submitted") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda sudah mengirim feedback ini",
      });
    }
    if (inv.status === "declined") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Undangan ini sudah ditolak",
      });
    }
    const cycle = await ctx.db.get(inv.cycleId);
    if (!cycle) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Siklus tidak ditemukan",
      });
    }
    if (cycle.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus tidak aktif",
      });
    }

    // Validate answers against the cycle's questions. Missing required answers
    // cause a hard error so reviewers can't submit an incomplete form.
    const byId = new Map(cycle.questions.map((q) => [q.id, q]));
    const seen = new Set<string>();
    for (const a of args.answers) {
      if (seen.has(a.questionId)) continue;
      seen.add(a.questionId);
      const q = byId.get(a.questionId);
      if (!q) continue;
      if (q.type === "rating") {
        const n = Number(a.value);
        if (!Number.isFinite(n) || n < 1 || n > 5) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Nilai rating harus antara 1 sampai 5",
          });
        }
      }
    }
    for (const q of cycle.questions) {
      if (!q.required) continue;
      const a = args.answers.find((x) => x.questionId === q.id);
      if (!a || a.value.trim() === "") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Lengkapi semua pertanyaan yang wajib diisi",
        });
      }
    }

    const overallScore = computeReviewerScore(args.answers, cycle.questions);
    await ctx.db.patch(args.reviewerRowId, {
      status: "submitted",
      answers: args.answers,
      strengths: args.strengths?.trim() || undefined,
      improvements: args.improvements?.trim() || undefined,
      overallScore,
      submittedAt: new Date().toISOString(),
    });

    await recomputeReviewAggregate(ctx, inv.reviewId);
    await recomputeCycleCounters(ctx, inv.cycleId);
    return null;
  },
});

export const declineInvite = mutation({
  args: {
    reviewerRowId: v.id("feedback360Reviewers"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const inv = await ctx.db.get(args.reviewerRowId);
    if (!inv) return null;
    if (inv.reviewerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan reviewer untuk undangan ini",
      });
    }
    if (inv.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Undangan sudah diproses",
      });
    }
    // Self-invitations cannot be declined - the reviewee must self-assess.
    if (inv.relationship === "self") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penilaian diri sendiri tidak dapat ditolak",
      });
    }
    await ctx.db.patch(args.reviewerRowId, {
      status: "declined",
      declineReason: args.reason?.trim() || undefined,
    });
    await recomputeReviewAggregate(ctx, inv.reviewId);
    await recomputeCycleCounters(ctx, inv.cycleId);
    return null;
  },
});

// ---- Peer reviewer nomination -----------------------------------------

export const listMyReviewers = query({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      _id: Id<"feedback360Reviewers">;
      reviewerId: Id<"users">;
      reviewerName: string | null;
      reviewerDepartment: string | null;
      reviewerJobTitle: string | null;
      relationship: string;
      status: string;
    }>
  > => {
    const user = await requireUser(ctx);
    const review = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle_and_reviewee", (q) =>
        q.eq("cycleId", args.cycleId).eq("revieweeId", user._id),
      )
      .first();
    if (!review) return [];
    const invites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_review", (q) => q.eq("reviewId", review._id))
      .collect();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results = [];
    for (const inv of invites) {
      let r = userCache.get(inv.reviewerId);
      if (r === undefined) {
        r = await ctx.db.get(inv.reviewerId);
        userCache.set(inv.reviewerId, r);
      }
      results.push({
        _id: inv._id,
        reviewerId: inv.reviewerId,
        reviewerName: r?.name ?? null,
        reviewerDepartment: r?.department ?? null,
        reviewerJobTitle: r?.jobTitle ?? null,
        relationship: inv.relationship,
        status: inv.status,
      });
    }
    return results;
  },
});

export const nominatePeerReviewer = mutation({
  args: {
    cycleId: v.id("feedback360Cycles"),
    reviewerId: v.id("users"),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    if (cycle.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus tidak aktif",
      });
    }
    const review = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle_and_reviewee", (q) =>
        q.eq("cycleId", args.cycleId).eq("revieweeId", user._id),
      )
      .first();
    if (!review) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Anda belum terdaftar di siklus ini",
      });
    }
    if (args.reviewerId === user._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda tidak dapat menominasikan diri sendiri sebagai peer",
      });
    }
    const target = await ctx.db.get(args.reviewerId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Rekan kerja tidak ditemukan",
      });
    }
    // Prevent duplicate invites
    const duplicate = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_review_and_reviewer", (q) =>
        q.eq("reviewId", review._id).eq("reviewerId", args.reviewerId),
      )
      .first();
    if (duplicate) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Rekan ini sudah diundang",
      });
    }
    await ctx.db.insert("feedback360Reviewers", {
      reviewId: review._id,
      cycleId: args.cycleId,
      revieweeId: user._id,
      reviewerId: args.reviewerId,
      relationship: "peer",
      status: "pending",
      invitedAt: new Date().toISOString(),
    });
    await recomputeReviewAggregate(ctx, review._id);
    await recomputeCycleCounters(ctx, args.cycleId);
    await notifyUser(ctx, {
      userId: args.reviewerId,
      type: "feedback360_invite",
      title: "Undangan Feedback 360°",
      message: `${user.name ?? "Rekan"} meminta feedback dari Anda untuk siklus ${cycle.periodLabel}`,
      link: `/feedback360/${args.cycleId}`,
      actorId: user._id,
    });
    return null;
  },
});

export const adminAddReviewer = mutation({
  args: {
    reviewId: v.id("feedback360Reviews"),
    reviewerId: v.id("users"),
    relationship: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    if (!isRelationship(args.relationship)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hubungan tidak valid",
      });
    }
    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penilaian tidak ditemukan",
      });
    }
    const cycle = await ctx.db.get(review.cycleId);
    if (!cycle || cycle.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus sudah ditutup",
      });
    }
    const duplicate = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_review_and_reviewer", (q) =>
        q.eq("reviewId", args.reviewId).eq("reviewerId", args.reviewerId),
      )
      .first();
    if (duplicate) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Reviewer sudah diundang",
      });
    }
    await ctx.db.insert("feedback360Reviewers", {
      reviewId: args.reviewId,
      cycleId: review.cycleId,
      revieweeId: review.revieweeId,
      reviewerId: args.reviewerId,
      relationship: args.relationship,
      status: "pending",
      invitedAt: new Date().toISOString(),
    });
    await recomputeReviewAggregate(ctx, args.reviewId);
    await recomputeCycleCounters(ctx, review.cycleId);
    if (cycle.status === "active") {
      await notifyUser(ctx, {
        userId: args.reviewerId,
        type: "feedback360_invite",
        title: "Undangan Feedback 360°",
        message: `Anda diminta memberi feedback untuk siklus ${cycle.periodLabel}`,
        link: `/feedback360/${review.cycleId}`,
        actorId: user._id,
      });
    }
    return null;
  },
});

export const adminRemoveReviewer = mutation({
  args: { reviewerRowId: v.id("feedback360Reviewers") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const inv = await ctx.db.get(args.reviewerRowId);
    if (!inv) return null;
    const cycle = await ctx.db.get(inv.cycleId);
    if (cycle?.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Siklus sudah ditutup",
      });
    }
    await ctx.db.delete(args.reviewerRowId);
    await recomputeReviewAggregate(ctx, inv.reviewId);
    await recomputeCycleCounters(ctx, inv.cycleId);
    return null;
  },
});

// ---- Bulk actions (admin) ---------------------------------------------

// Send a reminder notification to every still-pending reviewer of a cycle.
// Admin-only. Only reminds pending invites on an active cycle. Skips the actor
// so nobody reminds themselves. Returns how many reminders were sent.
export const bulkRemindPending = mutation({
  args: {
    cycleId: v.id("feedback360Cycles"),
    reviewerRowIds: v.optional(v.array(v.id("feedback360Reviewers"))),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Siklus tidak ditemukan",
      });
    }
    if (cycle.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengingat hanya dapat dikirim pada siklus aktif",
      });
    }

    // Resolve the set of invites to remind: either the explicit selection or
    // all invites in the cycle when none is provided.
    let invites: Array<Doc<"feedback360Reviewers">>;
    if (args.reviewerRowIds && args.reviewerRowIds.length > 0) {
      if (args.reviewerRowIds.length > 200) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Maksimal 200 reviewer per aksi",
        });
      }
      const rows = await Promise.all(
        args.reviewerRowIds.map((rid) => ctx.db.get(rid)),
      );
      invites = rows.filter(
        (r): r is Doc<"feedback360Reviewers"> =>
          r !== null && r.cycleId === args.cycleId,
      );
    } else {
      invites = await ctx.db
        .query("feedback360Reviewers")
        .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
        .take(500);
    }

    let count = 0;
    for (const inv of invites) {
      if (inv.status !== "pending") continue;
      // Self-assessments can't be reminded via notification loop-back
      if (inv.reviewerId === user._id) continue;
      await notifyUser(ctx, {
        userId: inv.reviewerId,
        type: "feedback360_invite",
        title: "Pengingat Feedback 360°",
        message: `Mohon lengkapi feedback Anda untuk siklus ${cycle.periodLabel}`,
        link: `/feedback360/${args.cycleId}`,
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});
