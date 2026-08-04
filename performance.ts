import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";
import { canManageTeam, isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

export type ReviewWithUsers = Doc<"performanceReviews"> & {
  revieweeName: string | null;
  revieweeAvatar: string | null;
  revieweeJobTitle: string | null;
  revieweeDepartment: string | null;
  reviewerName: string | null;
  reviewerAvatar: string | null;
};

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

function isRating(n: number | undefined): boolean {
  if (n === undefined) return true;
  return Number.isFinite(n) && n >= 1 && n <= 5;
}

// Validates the period key format: YYYY-Q1..Q4, YYYY-H1/H2, YYYY-annual.
function isValidPeriod(period: string): boolean {
  return /^\d{4}-(Q[1-4]|H[1-2]|annual)$/.test(period);
}

function formatPeriodLabel(period: string): string {
  const [year, kind] = period.split("-");
  if (kind === "annual") return `Tahunan ${year}`;
  if (kind === "H1") return `Semester 1 ${year}`;
  if (kind === "H2") return `Semester 2 ${year}`;
  return `${kind} ${year}`;
}

async function hydrate(
  ctx: QueryCtx,
  reviews: Array<Doc<"performanceReviews">>,
): Promise<Array<ReviewWithUsers>> {
  const cache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    cache.set(id, u);
    return u;
  };
  const out: Array<ReviewWithUsers> = [];
  for (const r of reviews) {
    const reviewee = await getUser(r.revieweeId);
    const reviewer = await getUser(r.reviewerId);
    out.push({
      ...r,
      revieweeName: reviewee?.name ?? null,
      revieweeAvatar: reviewee?.avatarUrl ?? null,
      revieweeJobTitle: reviewee?.jobTitle ?? null,
      revieweeDepartment: reviewee?.department ?? null,
      reviewerName: reviewer?.name ?? null,
      reviewerAvatar: reviewer?.avatarUrl ?? null,
    });
  }
  return out;
}

// ---- Queries -----------------------------------------------------------

export const listMine = query({
  args: {},
  handler: async (ctx): Promise<Array<ReviewWithUsers>> => {
    const user = await requireUser(ctx);
    // Employee sees their own submitted/acknowledged reviews (never drafts)
    const reviews = await ctx.db
      .query("performanceReviews")
      .withIndex("by_reviewee", (q) => q.eq("revieweeId", user._id))
      .order("desc")
      .take(200);
    // Hide drafts the reviewer hasn't submitted yet
    const visible = reviews.filter((r) => r.status !== "draft");
    return await hydrate(ctx, visible);
  },
});

export const listAsReviewer = query({
  args: {
    status: v.optional(v.string()), // "all" | "draft" | "submitted" | "acknowledged"
  },
  handler: async (ctx, args): Promise<Array<ReviewWithUsers>> => {
    const user = await requireUser(ctx);
    let reviews: Array<Doc<"performanceReviews">>;
    if (args.status && args.status !== "all") {
      reviews = await ctx.db
        .query("performanceReviews")
        .withIndex("by_reviewer_and_status", (q) =>
          q.eq("reviewerId", user._id).eq("status", args.status as string),
        )
        .order("desc")
        .take(300);
    } else {
      reviews = await ctx.db
        .query("performanceReviews")
        .withIndex("by_reviewer", (q) => q.eq("reviewerId", user._id))
        .order("desc")
        .take(300);
    }
    return await hydrate(ctx, reviews);
  },
});

// Lightweight sidebar badge count for "Penilaian Kinerja".
// Counts reviews the current user must still complete as the reviewer (status
// "draft" = not yet submitted). Never throws.
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

    const drafts = await ctx.db
      .query("performanceReviews")
      .withIndex("by_reviewer_and_status", (q) =>
        q.eq("reviewerId", user._id).eq("status", "draft"),
      )
      .take(500);
    return drafts.length;
  },
});

export const listAll = query({
  args: {
    period: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ReviewWithUsers>> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat melihat semua penilaian",
      });
    }
    let reviews: Array<Doc<"performanceReviews">>;
    if (args.period && args.period !== "all") {
      reviews = await ctx.db
        .query("performanceReviews")
        .withIndex("by_period", (q) => q.eq("period", args.period as string))
        .order("desc")
        .take(500);
    } else {
      reviews = await ctx.db
        .query("performanceReviews")
        .order("desc")
        .take(500);
    }
    if (args.status && args.status !== "all") {
      reviews = reviews.filter((r) => r.status === args.status);
    }
    return await hydrate(ctx, reviews);
  },
});

export const listPeriods = query({
  args: {},
  handler: async (ctx): Promise<Array<string>> => {
    await requireUser(ctx);
    const rows = await ctx.db.query("performanceReviews").take(500);
    const set = new Set<string>();
    for (const r of rows) set.add(r.period);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  },
});

export const getById = query({
  args: { id: v.id("performanceReviews") },
  handler: async (ctx, args): Promise<ReviewWithUsers | null> => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review) return null;
    const canSee =
      review.reviewerId === user._id ||
      (review.revieweeId === user._id && review.status !== "draft") ||
      isAdminRole(user.role);
    if (!canSee) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin untuk melihat penilaian ini",
      });
    }
    const arr = await hydrate(ctx, [review]);
    return arr[0];
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    myTotal: number;
    myAvgRating: number | null;
    myLatestPeriod: string | null;
    myLatestRating: number | null;
    myPendingAck: number;
    asReviewerDraft: number;
    asReviewerSubmitted: number;
    asReviewerTotal: number;
    canReview: boolean;
  }> => {
    const user = await requireUser(ctx);
    const mine = await ctx.db
      .query("performanceReviews")
      .withIndex("by_reviewee", (q) => q.eq("revieweeId", user._id))
      .take(200);
    const visible = mine.filter((r) => r.status !== "draft");
    const withRating = visible.filter((r) => r.overallRating !== undefined);
    const avg =
      withRating.length === 0
        ? null
        : withRating.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) /
          withRating.length;
    const latest = [...visible].sort((a, b) =>
      b.period.localeCompare(a.period),
    )[0];

    const pendingAck = visible.filter((r) => r.status === "submitted").length;

    const asReviewerAll = await ctx.db
      .query("performanceReviews")
      .withIndex("by_reviewer", (q) => q.eq("reviewerId", user._id))
      .take(300);
    const asReviewerDraft = asReviewerAll.filter(
      (r) => r.status === "draft",
    ).length;
    const asReviewerSubmitted = asReviewerAll.filter(
      (r) => r.status === "submitted",
    ).length;

    return {
      myTotal: visible.length,
      myAvgRating: avg,
      myLatestPeriod: latest?.period ?? null,
      myLatestRating: latest?.overallRating ?? null,
      myPendingAck: pendingAck,
      asReviewerDraft,
      asReviewerSubmitted,
      asReviewerTotal: asReviewerAll.length,
      canReview: canManageTeam(user.role),
    };
  },
});

export const listReviewableEmployees = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      _id: Id<"users">;
      name: string;
      avatarUrl: string | null;
      jobTitle: string | null;
      department: string | null;
    }>
  > => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) return [];
    const allUsers = await ctx.db.query("users").collect();
    // Admins may review anyone. Supervisors review their direct reports.
    const eligible = isAdminRole(user.role)
      ? allUsers.filter((u) => u._id !== user._id)
      : allUsers.filter((u) => u.managerId === user._id);
    return eligible.map((u) => ({
      _id: u._id,
      name: u.name ?? "Tanpa nama",
      avatarUrl: u.avatarUrl ?? null,
      jobTitle: u.jobTitle ?? null,
      department: u.department ?? null,
    }));
  },
});

// ---- Mutations ---------------------------------------------------------

export const create = mutation({
  args: {
    revieweeId: v.id("users"),
    period: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"performanceReviews">> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya atasan atau admin yang dapat membuat penilaian",
      });
    }
    if (args.revieweeId === user._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda tidak dapat menilai diri sendiri",
      });
    }
    if (!isValidPeriod(args.period)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format periode tidak valid (contoh: 2026-Q1)",
      });
    }
    const reviewee = await ctx.db.get(args.revieweeId);
    if (!reviewee) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }
    // Supervisors can only review their direct reports
    if (!isAdminRole(user.role) && reviewee.managerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda hanya dapat menilai karyawan yang berada di bawah Anda",
      });
    }
    const existing = await ctx.db
      .query("performanceReviews")
      .withIndex("by_reviewee_and_period", (q) =>
        q.eq("revieweeId", args.revieweeId).eq("period", args.period),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Penilaian untuk periode ini sudah ada",
      });
    }
    const id = await ctx.db.insert("performanceReviews", {
      revieweeId: args.revieweeId,
      reviewerId: user._id,
      period: args.period,
      periodLabel: formatPeriodLabel(args.period),
      status: "draft",
    });
    return id;
  },
});

const updateFields = {
  overallRating: v.optional(v.number()),
  qualityRating: v.optional(v.number()),
  productivityRating: v.optional(v.number()),
  communicationRating: v.optional(v.number()),
  teamworkRating: v.optional(v.number()),
  initiativeRating: v.optional(v.number()),
  strengths: v.optional(v.string()),
  improvements: v.optional(v.string()),
  goals: v.optional(v.string()),
  reviewerComments: v.optional(v.string()),
};

export const updateDraft = mutation({
  args: {
    id: v.id("performanceReviews"),
    ...updateFields,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penilaian tidak ditemukan",
      });
    }
    if (review.reviewerId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya reviewer yang dapat mengubah penilaian",
      });
    }
    if (review.status === "acknowledged") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penilaian yang sudah dikonfirmasi tidak dapat diubah",
      });
    }
    const ratings: Array<number | undefined> = [
      args.overallRating,
      args.qualityRating,
      args.productivityRating,
      args.communicationRating,
      args.teamworkRating,
      args.initiativeRating,
    ];
    for (const r of ratings) {
      if (!isRating(r)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Nilai harus antara 1 sampai 5",
        });
      }
    }
    await ctx.db.patch(args.id, {
      overallRating: args.overallRating,
      qualityRating: args.qualityRating,
      productivityRating: args.productivityRating,
      communicationRating: args.communicationRating,
      teamworkRating: args.teamworkRating,
      initiativeRating: args.initiativeRating,
      strengths: args.strengths?.trim() || undefined,
      improvements: args.improvements?.trim() || undefined,
      goals: args.goals?.trim() || undefined,
      reviewerComments: args.reviewerComments?.trim() || undefined,
    });
    return null;
  },
});

export const submit = mutation({
  args: {
    id: v.id("performanceReviews"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penilaian tidak ditemukan",
      });
    }
    if (review.reviewerId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya reviewer yang dapat mengirim penilaian",
      });
    }
    if (review.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penilaian sudah dikirim sebelumnya",
      });
    }
    if (review.overallRating === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Isi rating keseluruhan sebelum mengirim penilaian",
      });
    }
    await ctx.db.patch(args.id, {
      status: "submitted",
      submittedAt: new Date().toISOString(),
    });
    await notifyUser(ctx, {
      userId: review.revieweeId,
      type: "performance_submitted",
      title: "Penilaian kinerja baru",
      message: `Atasan Anda mengirim penilaian periode ${review.periodLabel}`,
      link: `/performance/${review._id}`,
      actorId: user._id,
    });
    return null;
  },
});

export const acknowledge = mutation({
  args: {
    id: v.id("performanceReviews"),
    employeeComments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penilaian tidak ditemukan",
      });
    }
    if (review.revieweeId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya karyawan yang dinilai yang dapat mengonfirmasi",
      });
    }
    if (review.status !== "submitted") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penilaian belum dapat dikonfirmasi",
      });
    }
    await ctx.db.patch(args.id, {
      status: "acknowledged",
      acknowledgedAt: new Date().toISOString(),
      employeeComments: args.employeeComments?.trim() || undefined,
    });
    await notifyUser(ctx, {
      userId: review.reviewerId,
      type: "performance_acknowledged",
      title: "Penilaian dikonfirmasi",
      message: `${user.name ?? "Karyawan"} mengonfirmasi penilaian ${review.periodLabel}`,
      link: `/performance/${review._id}`,
      actorId: user._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("performanceReviews") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const review = await ctx.db.get(args.id);
    if (!review) return null;
    const isReviewer = review.reviewerId === user._id;
    if (!isReviewer && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya reviewer atau admin yang dapat menghapus",
      });
    }
    if (review.status === "acknowledged") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penilaian yang sudah dikonfirmasi tidak dapat dihapus",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Bulk mutations ----------------------------------------------------

// Submit several draft reviews at once. Only the reviewer (or an admin) may
// submit, only drafts move, and only when an overall rating is set. Invalid
// rows are skipped so one bad row never blocks the batch.
export const bulkSubmit = mutation({
  args: { ids: v.array(v.id("performanceReviews")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya atasan atau admin yang dapat mengirim penilaian",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 penilaian per aksi",
      });
    }
    const now = new Date().toISOString();
    let count = 0;
    for (const id of args.ids) {
      const review = await ctx.db.get(id);
      if (!review) continue;
      if (review.reviewerId !== user._id && !isAdminRole(user.role)) continue;
      if (review.status !== "draft") continue;
      if (review.overallRating === undefined) continue;
      await ctx.db.patch(id, { status: "submitted", submittedAt: now });
      await notifyUser(ctx, {
        userId: review.revieweeId,
        type: "performance_submitted",
        title: "Penilaian kinerja baru",
        message: `Atasan Anda mengirim penilaian periode ${review.periodLabel}`,
        link: `/performance/${review._id}`,
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});

// Re-notify reviewees who still haven't acknowledged a submitted review.
export const bulkRemind = mutation({
  args: { ids: v.array(v.id("performanceReviews")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya atasan atau admin yang dapat mengirim pengingat",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 penilaian per aksi",
      });
    }
    let count = 0;
    for (const id of args.ids) {
      const review = await ctx.db.get(id);
      if (!review) continue;
      if (review.reviewerId !== user._id && !isAdminRole(user.role)) continue;
      if (review.status !== "submitted") continue;
      await notifyUser(ctx, {
        userId: review.revieweeId,
        type: "performance_submitted",
        title: "Pengingat konfirmasi penilaian",
        message: `Mohon konfirmasi penilaian kinerja periode ${review.periodLabel}`,
        link: `/performance/${review._id}`,
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});

// Delete several draft/submitted reviews at once. Acknowledged reviews are
// preserved. Only the reviewer or an admin may delete.
export const bulkRemove = mutation({
  args: { ids: v.array(v.id("performanceReviews")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (!canManageTeam(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya atasan atau admin yang dapat menghapus",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 penilaian per aksi",
      });
    }
    let count = 0;
    for (const id of args.ids) {
      const review = await ctx.db.get(id);
      if (!review) continue;
      if (review.reviewerId !== user._id && !isAdminRole(user.role)) continue;
      if (review.status === "acknowledged") continue;
      await ctx.db.delete(id);
      count += 1;
    }
    return { count };
  },
});
