// Shared helpers for the Feedback 360° feature.
// Keeps the other files focused on queries/mutations.

import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";

// "self" | "manager" | "peer" | "report"
export type Relationship = "self" | "manager" | "peer" | "report";

export const RELATIONSHIPS: ReadonlyArray<Relationship> = [
  "self",
  "manager",
  "peer",
  "report",
];

export function isRelationship(value: string): value is Relationship {
  return (
    value === "self" ||
    value === "manager" ||
    value === "peer" ||
    value === "report"
  );
}

// Peer and direct-report reviewers are anonymous when their feedback is
// shown back to the reviewee. Self and manager are named.
export function isAnonymousRelationship(rel: string): boolean {
  return rel === "peer" || rel === "report";
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

export function requireAdmin(user: Doc<"users">): void {
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola siklus feedback 360°",
    });
  }
}

// Validates the period format used across performance / feedback features.
export function isValidPeriod(period: string): boolean {
  return /^\d{4}(-(Q[1-4]|H[1-2]|annual))?$/.test(period);
}

export function formatPeriodLabel(period: string): string {
  const parts = period.split("-");
  if (parts.length === 1) return `Tahunan ${parts[0]}`;
  const [year, kind] = parts;
  if (kind === "annual") return `Tahunan ${year}`;
  if (kind === "H1") return `Semester 1 ${year}`;
  if (kind === "H2") return `Semester 2 ${year}`;
  return `${kind} ${year}`;
}

// ---- Default template questions ---------------------------------------

export type CycleQuestion = {
  id: string;
  text: string;
  type: string; // "rating" | "text"
  required: boolean;
  category?: string;
};

export const TEMPLATE_QUESTIONS: ReadonlyArray<CycleQuestion> = [
  {
    id: "q-collab",
    text: "Seberapa baik orang ini bekerja sama dengan rekan kerja lainnya?",
    type: "rating",
    required: true,
    category: "Kolaborasi",
  },
  {
    id: "q-communication",
    text: "Seberapa efektif komunikasi orang ini dalam tim?",
    type: "rating",
    required: true,
    category: "Komunikasi",
  },
  {
    id: "q-initiative",
    text: "Seberapa baik orang ini menunjukkan inisiatif dan rasa memiliki?",
    type: "rating",
    required: true,
    category: "Inisiatif",
  },
  {
    id: "q-quality",
    text: "Bagaimana kualitas hasil kerja orang ini?",
    type: "rating",
    required: true,
    category: "Kualitas",
  },
  {
    id: "q-leadership",
    text: "Seberapa baik orang ini memimpin atau mendukung orang lain?",
    type: "rating",
    required: true,
    category: "Kepemimpinan",
  },
  {
    id: "q-growth",
    text: "Seberapa baik orang ini dalam menerima umpan balik dan berkembang?",
    type: "rating",
    required: true,
    category: "Pertumbuhan",
  },
  {
    id: "q-strengths",
    text: "Apa kekuatan utama orang ini?",
    type: "text",
    required: false,
    category: "Kekuatan",
  },
  {
    id: "q-improvements",
    text: "Area mana yang paling perlu ditingkatkan oleh orang ini?",
    type: "text",
    required: false,
    category: "Pengembangan",
  },
];

// ---- Score helpers ----------------------------------------------------

/**
 * Converts a single reviewer's rating answers to a 0..100 score.
 * Each rating question uses a 1..5 scale; we average them then rescale to 100.
 */
export function computeReviewerScore(
  answers: Array<{ questionId: string; value: string }>,
  questions: ReadonlyArray<CycleQuestion>,
): number | undefined {
  const ratingIds = new Set(
    questions.filter((q) => q.type === "rating").map((q) => q.id),
  );
  const ratings: Array<number> = [];
  for (const a of answers) {
    if (!ratingIds.has(a.questionId)) continue;
    const n = Number(a.value);
    if (Number.isFinite(n) && n >= 1 && n <= 5) ratings.push(n);
  }
  if (ratings.length === 0) return undefined;
  const avg = ratings.reduce((sum, n) => sum + n, 0) / ratings.length;
  // Rescale 1..5 to 0..100: (avg - 1) / 4 * 100
  return Math.round(((avg - 1) / 4) * 100);
}

/**
 * Aggregates all submitted reviewer scores into per-group averages.
 * `overallScore` gives each present group equal weight.
 */
export function aggregateReviewerScores(
  reviewers: Array<Doc<"feedback360Reviewers">>,
): {
  overall: number | undefined;
  self: number | undefined;
  manager: number | undefined;
  peer: number | undefined;
  report: number | undefined;
} {
  const buckets: Record<Relationship, Array<number>> = {
    self: [],
    manager: [],
    peer: [],
    report: [],
  };
  for (const r of reviewers) {
    if (r.status !== "submitted" || r.overallScore === undefined) continue;
    if (!isRelationship(r.relationship)) continue;
    buckets[r.relationship].push(r.overallScore);
  }
  const avg = (arr: Array<number>) =>
    arr.length === 0
      ? undefined
      : Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);
  const self = avg(buckets.self);
  const manager = avg(buckets.manager);
  const peer = avg(buckets.peer);
  const report = avg(buckets.report);
  const groupAverages = [self, manager, peer, report].filter(
    (n): n is number => n !== undefined,
  );
  const overall =
    groupAverages.length === 0
      ? undefined
      : Math.round(
          groupAverages.reduce((s, n) => s + n, 0) / groupAverages.length,
        );
  return { overall, self, manager, peer, report };
}

/**
 * Recomputes aggregate fields on a single feedback360Reviews row based on all
 * its reviewer invitations. Also updates the row's status accordingly.
 */
export async function recomputeReviewAggregate(
  ctx: MutationCtx,
  reviewId: Id<"feedback360Reviews">,
): Promise<void> {
  const review = await ctx.db.get(reviewId);
  if (!review) return;
  const reviewers = await ctx.db
    .query("feedback360Reviewers")
    .withIndex("by_review", (q) => q.eq("reviewId", reviewId))
    .collect();
  const total = reviewers.length;
  const submitted = reviewers.filter((r) => r.status === "submitted").length;
  const scores = aggregateReviewerScores(reviewers);
  // Keep "shared" status sticky: once admin shares the result, further edits
  // keep the shared flag unless explicitly revoked.
  const nextStatus = review.status === "shared"
    ? "shared"
    : submitted === 0
      ? "pending"
      : submitted >= total && total > 0
        ? "completed"
        : "in_progress";
  await ctx.db.patch(reviewId, {
    status: nextStatus,
    totalReviewers: total,
    completedReviewers: submitted,
    overallScore: scores.overall,
    selfScore: scores.self,
    managerScore: scores.manager,
    peerScore: scores.peer,
    reportScore: scores.report,
  });
}

/**
 * Recomputes denormalized counters on the cycle based on all its reviews.
 */
export async function recomputeCycleCounters(
  ctx: MutationCtx,
  cycleId: Id<"feedback360Cycles">,
): Promise<void> {
  const cycle = await ctx.db.get(cycleId);
  if (!cycle) return;
  const reviews = await ctx.db
    .query("feedback360Reviews")
    .withIndex("by_cycle", (q) => q.eq("cycleId", cycleId))
    .collect();
  let total = 0;
  let completed = 0;
  for (const r of reviews) {
    total += r.totalReviewers;
    completed += r.completedReviewers;
  }
  await ctx.db.patch(cycleId, {
    reviewCount: reviews.length,
    totalReviewerCount: total,
    completedReviewerCount: completed,
  });
}
