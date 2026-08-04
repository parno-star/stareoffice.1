import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { notifyUser } from "../notifications";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";

export type CheckinWithUser = Doc<"onboardingCheckins"> & {
  userName: string | null;
  userAvatar: string | null;
  userJobTitle: string | null;
  userDepartment: string | null;
  reviewerName: string | null;
};

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true, allowPending: true });
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

async function enrich(
  ctx: QueryCtx,
  rows: Array<Doc<"onboardingCheckins">>,
): Promise<Array<CheckinWithUser>> {
  const cache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const c = cache.get(id);
    if (c !== undefined) return c;
    const u = await ctx.db.get(id);
    cache.set(id, u);
    return u;
  };
  const out: Array<CheckinWithUser> = [];
  for (const r of rows) {
    const user = await getUser(r.userId);
    const reviewer = r.reviewerId ? await getUser(r.reviewerId) : null;
    out.push({
      ...r,
      userName: user?.name ?? null,
      userAvatar: user?.avatarUrl ?? null,
      userJobTitle: user?.jobTitle ?? null,
      userDepartment: user?.department ?? null,
      reviewerName: reviewer?.name ?? null,
    });
  }
  return out;
}

export const listMine = query({
  args: {},
  handler: async (ctx): Promise<Array<CheckinWithUser>> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("onboardingCheckins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    return await enrich(ctx, rows);
  },
});

export const listByOnboarding = query({
  args: { onboardingId: v.id("onboardingEmployees") },
  handler: async (ctx, args): Promise<Array<CheckinWithUser>> => {
    const viewer = await requireUser(ctx);
    const onb = await ctx.db.get(args.onboardingId);
    if (!onb) return [];
    if (!isAdminRole(viewer.role) && viewer._id !== onb.userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    const rows = await ctx.db
      .query("onboardingCheckins")
      .withIndex("by_onboarding", (q) =>
        q.eq("onboardingId", args.onboardingId),
      )
      .collect();
    rows.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    return await enrich(ctx, rows);
  },
});

export const listForReview = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<CheckinWithUser>> => {
    await requireAdmin(ctx);
    let rows: Array<Doc<"onboardingCheckins">>;
    if (args.status && args.status !== "all") {
      rows = await ctx.db
        .query("onboardingCheckins")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(200);
    } else {
      rows = await ctx.db
        .query("onboardingCheckins")
        .order("desc")
        .take(200);
    }
    return await enrich(ctx, rows);
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    pending: number;
    submitted: number;
    reviewed: number;
    avgMood: number | null;
  }> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      return { pending: 0, submitted: 0, reviewed: 0, avgMood: null };
    }
    const all = await ctx.db.query("onboardingCheckins").collect();
    const pending = all.filter((c) => c.status === "pending").length;
    const submitted = all.filter((c) => c.status === "submitted").length;
    const reviewed = all.filter((c) => c.status === "reviewed").length;
    const withMood = all.filter(
      (c) => typeof c.moodScore === "number" && c.status !== "pending",
    );
    const avgMood =
      withMood.length === 0
        ? null
        : Math.round(
            (withMood.reduce((acc, c) => acc + (c.moodScore ?? 0), 0) /
              withMood.length) *
              10,
          ) / 10;
    return { pending, submitted, reviewed, avgMood };
  },
});

export const submit = mutation({
  args: {
    id: v.id("onboardingCheckins"),
    moodScore: v.number(),
    highlights: v.optional(v.string()),
    challenges: v.optional(v.string()),
    supportNeeded: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const checkin = await ctx.db.get(args.id);
    if (!checkin) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Check-in tidak ditemukan",
      });
    }
    if (checkin.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya karyawan terkait yang dapat mengisi check-in",
      });
    }
    if (args.moodScore < 1 || args.moodScore > 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nilai mood harus antara 1 dan 5",
      });
    }
    await ctx.db.patch(args.id, {
      moodScore: Math.round(args.moodScore),
      highlights: args.highlights?.trim() || undefined,
      challenges: args.challenges?.trim() || undefined,
      supportNeeded: args.supportNeeded?.trim() || undefined,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    });

    // Notify admins (find first admin)
    const admins = await ctx.db
      .query("users")
      .take(200);
    for (const admin of admins) {
      if (isAdminRole(admin.role) && admin._id !== user._id) {
        await notifyUser(ctx, {
          userId: admin._id,
          type: "onboarding_checkin_submitted",
          title: `Check-in ${checkin.label} dikirim`,
          message: `${user.name ?? "Karyawan baru"} telah mengisi check-in onboarding.`,
          link: "/onboarding",
          actorId: user._id,
        });
      }
    }
    return null;
  },
});

export const review = mutation({
  args: {
    id: v.id("onboardingCheckins"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const checkin = await ctx.db.get(args.id);
    if (!checkin) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Check-in tidak ditemukan",
      });
    }
    if (checkin.status !== "submitted") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Check-in belum dikirim oleh karyawan",
      });
    }
    await ctx.db.patch(args.id, {
      reviewerId: admin._id,
      reviewNote: args.reviewNote?.trim() || undefined,
      status: "reviewed",
      reviewedAt: new Date().toISOString(),
    });
    await notifyUser(ctx, {
      userId: checkin.userId,
      type: "onboarding_checkin_reviewed",
      title: `Check-in ${checkin.label} telah ditinjau`,
      message: "HR telah membaca check-in Anda. Terima kasih atas feedback-nya!",
      link: "/onboarding",
      actorId: admin._id,
    });
    return null;
  },
});

export const addCustom = mutation({
  args: {
    onboardingId: v.id("onboardingEmployees"),
    label: v.string(),
    scheduledDate: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"onboardingCheckins">> => {
    await requireAdmin(ctx);
    const onb = await ctx.db.get(args.onboardingId);
    if (!onb) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Onboarding tidak ditemukan",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.scheduledDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal tidak valid",
      });
    }
    const label = args.label.trim();
    if (label.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Label wajib diisi",
      });
    }
    return await ctx.db.insert("onboardingCheckins", {
      onboardingId: args.onboardingId,
      userId: onb.userId,
      kind: "custom",
      label,
      scheduledDate: args.scheduledDate,
      status: "pending",
    });
  },
});

export const remove = mutation({
  args: { id: v.id("onboardingCheckins") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});
