// Review-report queries & mutations for Feedback 360°.
// - Admins: list all reviews inside a cycle, view aggregate report, share.
// - Reviewees: view their own shared report with anonymized peer/report feedback.

import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import {
  isAnonymousRelationship,
  isRelationship,
  requireAdmin,
  requireUser,
  type Relationship,
} from "./utils";
import { notifyUser } from "../notifications";

export type ReviewListItem = {
  _id: Id<"feedback360Reviews">;
  cycleId: Id<"feedback360Cycles">;
  revieweeId: Id<"users">;
  revieweeName: string;
  revieweeAvatar: string | null;
  revieweeDepartment: string | null;
  revieweeJobTitle: string | null;
  status: string;
  totalReviewers: number;
  completedReviewers: number;
  overallScore: number | null;
  selfScore: number | null;
  managerScore: number | null;
  peerScore: number | null;
  reportScore: number | null;
  sharedAt: string | null;
};

export type QuestionBreakdown = {
  questionId: string;
  text: string;
  type: string;
  category: string | null;
  // Rating averages per relationship (0..100) - undefined when no responses
  self: number | null;
  manager: number | null;
  peer: number | null;
  report: number | null;
  overall: number | null;
  // Free-form text answers grouped by relationship (anonymized for peer/report)
  textAnswers: Array<{
    author: string | null; // null when anonymized
    relationship: Relationship;
    value: string;
  }>;
};

export type ReviewReport = {
  review: ReviewListItem;
  cycle: {
    _id: Id<"feedback360Cycles">;
    title: string;
    periodLabel: string;
    endDate: string;
    status: string;
  };
  reviewee: {
    _id: Id<"users">;
    name: string;
    avatarUrl: string | null;
    jobTitle: string | null;
    department: string | null;
  } | null;
  questions: Array<QuestionBreakdown>;
  strengthsByRelationship: Array<{
    author: string | null;
    relationship: Relationship;
    value: string;
  }>;
  improvementsByRelationship: Array<{
    author: string | null;
    relationship: Relationship;
    value: string;
  }>;
  reviewerSummary: {
    self: { total: number; submitted: number };
    manager: { total: number; submitted: number };
    peer: { total: number; submitted: number };
    report: { total: number; submitted: number };
  };
  canViewDetails: boolean;
  // If false, the caller is the reviewee and the report hasn't been shared yet
  isShared: boolean;
};

function toListItem(
  review: Doc<"feedback360Reviews">,
  reviewee: Doc<"users"> | null,
): ReviewListItem {
  return {
    _id: review._id,
    cycleId: review.cycleId,
    revieweeId: review.revieweeId,
    revieweeName: reviewee?.name ?? review.revieweeName,
    revieweeAvatar: reviewee?.avatarUrl ?? null,
    revieweeDepartment: reviewee?.department ?? review.revieweeDepartment ?? null,
    revieweeJobTitle: reviewee?.jobTitle ?? review.revieweeJobTitle ?? null,
    status: review.status,
    totalReviewers: review.totalReviewers,
    completedReviewers: review.completedReviewers,
    overallScore: review.overallScore ?? null,
    selfScore: review.selfScore ?? null,
    managerScore: review.managerScore ?? null,
    peerScore: review.peerScore ?? null,
    reportScore: review.reportScore ?? null,
    sharedAt: review.sharedAt ?? null,
  };
}

export const listReviewsForCycle = query({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (ctx, args): Promise<Array<ReviewListItem>> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const reviews = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const out: Array<ReviewListItem> = [];
    for (const r of reviews) {
      let u = userCache.get(r.revieweeId);
      if (u === undefined) {
        u = await ctx.db.get(r.revieweeId);
        userCache.set(r.revieweeId, u);
      }
      out.push(toListItem(r, u));
    }
    out.sort((a, b) => a.revieweeName.localeCompare(b.revieweeName));
    return out;
  },
});

// Review reports I (the reviewee) can see (only shared ones)
export const listMyReports = query({
  args: {},
  handler: async (ctx): Promise<Array<ReviewListItem & { cycleTitle: string; periodLabel: string }>> => {
    const user = await requireUser(ctx);
    const reviews = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_reviewee", (q) => q.eq("revieweeId", user._id))
      .collect();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const cycleCache = new Map<Id<"feedback360Cycles">, Doc<"feedback360Cycles"> | null>();
    const out = [];
    for (const r of reviews) {
      if (r.status !== "shared") continue;
      let u = userCache.get(r.revieweeId);
      if (u === undefined) {
        u = await ctx.db.get(r.revieweeId);
        userCache.set(r.revieweeId, u);
      }
      let c = cycleCache.get(r.cycleId);
      if (c === undefined) {
        c = await ctx.db.get(r.cycleId);
        cycleCache.set(r.cycleId, c);
      }
      if (!c) continue;
      out.push({
        ...toListItem(r, u),
        cycleTitle: c.title,
        periodLabel: c.periodLabel,
      });
    }
    out.sort((a, b) => (b.sharedAt ?? "").localeCompare(a.sharedAt ?? ""));
    return out;
  },
});

function emptyBreakdown(
  q: Doc<"feedback360Cycles">["questions"][number],
): QuestionBreakdown {
  return {
    questionId: q.id,
    text: q.text,
    type: q.type,
    category: q.category ?? null,
    self: null,
    manager: null,
    peer: null,
    report: null,
    overall: null,
    textAnswers: [],
  };
}

export const getReviewReport = query({
  args: { reviewId: v.id("feedback360Reviews") },
  handler: async (ctx, args): Promise<ReviewReport | null> => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.reviewId);
    if (!review) return null;
    const cycle = await ctx.db.get(review.cycleId);
    if (!cycle) return null;

    const isReviewee = review.revieweeId === user._id;
    const canAdminView = isAdminRole(user.role);
    // Reviewees only see the report after admin has shared it
    if (!canAdminView && isReviewee && review.status !== "shared") {
      return null;
    }
    if (!canAdminView && !isReviewee) return null;

    const reviewee = await ctx.db.get(review.revieweeId);
    const invites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_review", (q) => q.eq("reviewId", args.reviewId))
      .collect();

    const reviewerCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getName = async (id: Id<"users">) => {
      const cached = reviewerCache.get(id);
      if (cached !== undefined) return cached?.name ?? null;
      const u = await ctx.db.get(id);
      reviewerCache.set(id, u);
      return u?.name ?? null;
    };

    // Build per-question breakdown
    const breakdowns: Record<string, QuestionBreakdown> = {};
    for (const q of cycle.questions) breakdowns[q.id] = emptyBreakdown(q);

    // Track rating buckets per (questionId, relationship) for averaging
    const buckets: Record<
      string,
      Record<Relationship, Array<number>>
    > = {};
    for (const q of cycle.questions) {
      buckets[q.id] = { self: [], manager: [], peer: [], report: [] };
    }

    const strengthsAll: Array<{
      author: string | null;
      relationship: Relationship;
      value: string;
    }> = [];
    const improvementsAll: Array<{
      author: string | null;
      relationship: Relationship;
      value: string;
    }> = [];

    const reviewerSummary = {
      self: { total: 0, submitted: 0 },
      manager: { total: 0, submitted: 0 },
      peer: { total: 0, submitted: 0 },
      report: { total: 0, submitted: 0 },
    };

    for (const inv of invites) {
      if (!isRelationship(inv.relationship)) continue;
      const rel = inv.relationship;
      reviewerSummary[rel].total += 1;
      if (inv.status !== "submitted") continue;
      reviewerSummary[rel].submitted += 1;
      // Hide identities for anonymous roles; keep for self/manager
      const anonymous = isAnonymousRelationship(rel) && !canAdminView;
      const authorName = anonymous ? null : await getName(inv.reviewerId);

      for (const a of inv.answers ?? []) {
        const q = cycle.questions.find((x) => x.id === a.questionId);
        if (!q) continue;
        if (q.type === "rating") {
          const n = Number(a.value);
          if (!Number.isFinite(n)) continue;
          const scaled = Math.round(((n - 1) / 4) * 100);
          buckets[q.id][rel].push(scaled);
        } else {
          const text = a.value.trim();
          if (!text) continue;
          breakdowns[q.id].textAnswers.push({
            author: authorName,
            relationship: rel,
            value: text,
          });
        }
      }
      if (inv.strengths && inv.strengths.trim()) {
        strengthsAll.push({
          author: authorName,
          relationship: rel,
          value: inv.strengths.trim(),
        });
      }
      if (inv.improvements && inv.improvements.trim()) {
        improvementsAll.push({
          author: authorName,
          relationship: rel,
          value: inv.improvements.trim(),
        });
      }
    }

    // Compute averages per question
    for (const q of cycle.questions) {
      const b = buckets[q.id];
      const br = breakdowns[q.id];
      const avg = (arr: Array<number>) =>
        arr.length === 0
          ? null
          : Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);
      br.self = avg(b.self);
      br.manager = avg(b.manager);
      br.peer = avg(b.peer);
      br.report = avg(b.report);
      const groupAverages = [br.self, br.manager, br.peer, br.report].filter(
        (n): n is number => n !== null,
      );
      br.overall =
        groupAverages.length === 0
          ? null
          : Math.round(
              groupAverages.reduce((s, n) => s + n, 0) / groupAverages.length,
            );
    }

    return {
      review: toListItem(review, reviewee),
      cycle: {
        _id: cycle._id,
        title: cycle.title,
        periodLabel: cycle.periodLabel,
        endDate: cycle.endDate,
        status: cycle.status,
      },
      reviewee: reviewee
        ? {
            _id: reviewee._id,
            name: reviewee.name ?? review.revieweeName,
            avatarUrl: reviewee.avatarUrl ?? null,
            jobTitle: reviewee.jobTitle ?? null,
            department: reviewee.department ?? null,
          }
        : null,
      questions: cycle.questions.map((q) => breakdowns[q.id]),
      strengthsByRelationship: strengthsAll,
      improvementsByRelationship: improvementsAll,
      reviewerSummary,
      canViewDetails: canAdminView || review.status === "shared",
      isShared: review.status === "shared",
    };
  },
});

export const shareReview = mutation({
  args: {
    reviewId: v.id("feedback360Reviews"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penilaian tidak ditemukan",
      });
    }
    if (review.completedReviewers === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Belum ada feedback yang terkumpul",
      });
    }
    const cycle = await ctx.db.get(review.cycleId);
    await ctx.db.patch(args.reviewId, {
      status: "shared",
      sharedAt: new Date().toISOString(),
      sharedNote: args.note?.trim() || undefined,
    });
    await notifyUser(ctx, {
      userId: review.revieweeId,
      type: "feedback360_shared",
      title: "Hasil Feedback 360° dibagikan",
      message: `Hasil feedback 360° untuk ${cycle?.periodLabel ?? "siklus"} kini dapat Anda lihat`,
      link: `/feedback360/${review.cycleId}`,
      actorId: user._id,
    });
    return null;
  },
});

export const unshareReview = mutation({
  args: { reviewId: v.id("feedback360Reviews") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const review = await ctx.db.get(args.reviewId);
    if (!review) return null;
    if (review.status !== "shared") return null;
    const nextStatus =
      review.completedReviewers === 0
        ? "pending"
        : review.completedReviewers >= review.totalReviewers &&
            review.totalReviewers > 0
          ? "completed"
          : "in_progress";
    await ctx.db.patch(args.reviewId, {
      status: nextStatus,
      sharedAt: undefined,
      sharedNote: undefined,
    });
    return null;
  },
});

// Dashboard / stat helper for the feedback360 landing page.
export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    pendingAsReviewer: number;
    submittedAsReviewer: number;
    myActiveAsReviewee: number;
    mySharedReports: number;
    activeCycles: number;
    totalCycles: number;
    canManage: boolean;
  }> => {
    const user = await requireUser(ctx);
    const reviewerInvites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_reviewer", (q) => q.eq("reviewerId", user._id))
      .take(300);
    let pendingAsReviewer = 0;
    let submittedAsReviewer = 0;
    const cycleCache = new Map<Id<"feedback360Cycles">, Doc<"feedback360Cycles"> | null>();
    for (const inv of reviewerInvites) {
      let cycle = cycleCache.get(inv.cycleId);
      if (cycle === undefined) {
        cycle = await ctx.db.get(inv.cycleId);
        cycleCache.set(inv.cycleId, cycle);
      }
      if (!cycle || cycle.status !== "active") continue;
      if (inv.status === "pending") pendingAsReviewer += 1;
      else if (inv.status === "submitted") submittedAsReviewer += 1;
    }
    const myReviews = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_reviewee", (q) => q.eq("revieweeId", user._id))
      .collect();
    const myActiveAsReviewee = myReviews.filter(
      (r) => r.status === "pending" || r.status === "in_progress" || r.status === "completed",
    ).length;
    const mySharedReports = myReviews.filter((r) => r.status === "shared").length;

    const cycles = await ctx.db.query("feedback360Cycles").take(200);
    const activeCycles = cycles.filter((c) => c.status === "active").length;
    return {
      pendingAsReviewer,
      submittedAsReviewer,
      myActiveAsReviewee,
      mySharedReports,
      activeCycles,
      totalCycles: cycles.length,
      canManage: isAdminRole(user.role),
    };
  },
});

// Lightweight sidebar badge count for "Feedback 360°".
// Counts feedback the current user must still submit as a reviewer: pending
// invites that belong to a currently-active cycle. Never throws.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return 0;

    const pendingInvites = await ctx.db
      .query("feedback360Reviewers")
      .withIndex("by_reviewer_and_status", (q) =>
        q.eq("reviewerId", user._id).eq("status", "pending"),
      )
      .take(300);

    let count = 0;
    const cycleCache = new Map<
      Id<"feedback360Cycles">,
      Doc<"feedback360Cycles"> | null
    >();
    for (const inv of pendingInvites) {
      let cycle = cycleCache.get(inv.cycleId);
      if (cycle === undefined) {
        cycle = await ctx.db.get(inv.cycleId);
        cycleCache.set(inv.cycleId, cycle);
      }
      if (cycle && cycle.status === "active") count += 1;
    }
    return count;
  },
});

// Helper for admin cycle-detail page: list all reviewees + their invite state
export const listCycleReviewers = query({
  args: { cycleId: v.id("feedback360Cycles") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      reviewId: Id<"feedback360Reviews">;
      revieweeId: Id<"users">;
      revieweeName: string;
      reviewers: Array<{
        _id: Id<"feedback360Reviewers">;
        reviewerId: Id<"users">;
        reviewerName: string | null;
        relationship: string;
        status: string;
      }>;
    }>
  > => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const reviews = await ctx.db
      .query("feedback360Reviews")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const out = [];
    for (const review of reviews) {
      const invites = await ctx.db
        .query("feedback360Reviewers")
        .withIndex("by_review", (q) => q.eq("reviewId", review._id))
        .collect();
      const reviewersOut = [];
      for (const inv of invites) {
        let u = userCache.get(inv.reviewerId);
        if (u === undefined) {
          u = await ctx.db.get(inv.reviewerId);
          userCache.set(inv.reviewerId, u);
        }
        reviewersOut.push({
          _id: inv._id,
          reviewerId: inv.reviewerId,
          reviewerName: u?.name ?? null,
          relationship: inv.relationship,
          status: inv.status,
        });
      }
      let reviewee = userCache.get(review.revieweeId);
      if (reviewee === undefined) {
        reviewee = await ctx.db.get(review.revieweeId);
        userCache.set(review.revieweeId, reviewee);
      }
      out.push({
        reviewId: review._id,
        revieweeId: review.revieweeId,
        revieweeName: reviewee?.name ?? review.revieweeName,
        reviewers: reviewersOut,
      });
    }
    out.sort((a, b) => a.revieweeName.localeCompare(b.revieweeName));
    return out;
  },
});
