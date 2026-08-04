import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser, notifyAllUsers } from "./notifications";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

export type AwardListItem = Doc<"awards"> & {
  recipientName: string | null;
  recipientAvatar: string | null;
  recipientJobTitle: string | null;
  recipientDepartment: string | null;
  awardedByName: string | null;
  awardedByAvatar: string | null;
  certificateUrl: string | null;
  hasCongratulated: boolean;
};

export type AwardCongratulation = Doc<"awardCongratulations"> & {
  userName: string | null;
  userAvatar: string | null;
};

export type AwardStats = {
  total: number;
  thisYear: number;
  thisMonth: number;
  receivedByMe: number;
};

export type HallOfFameEntry = {
  userId: Id<"users">;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  awardCount: number;
  latestAwardTitle: string;
  latestAwardDate: string;
};

async function requireUserTenant(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { userId, organizationId } = await requireTenant(ctx);
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { user, organizationId };
}

async function requireAdminTenant(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { user, organizationId } = await requireUserTenant(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya administrator yang dapat memberikan penghargaan",
    });
  }
  return { user, organizationId };
}

/** Filter awards to those belonging to the caller's org.
 *  A super admin without an active grant has organizationId === null and sees
 *  nothing. Legacy records with no organizationId are visible to real tenants. */
function filterByOrg<T extends { organizationId?: Id<"organizations"> }>(
  rows: T[],
  organizationId: Id<"organizations"> | null,
): T[] {
  if (organizationId === null) return [];
  return rows.filter(
    (r) => !r.organizationId || r.organizationId === organizationId,
  );
}

async function enrichAwards(
  ctx: QueryCtx,
  currentUserId: Id<"users">,
  items: Array<Doc<"awards">>,
): Promise<Array<AwardListItem>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    let cached = userCache.get(id);
    if (cached === undefined) {
      cached = await ctx.db.get(id);
      userCache.set(id, cached);
    }
    return cached;
  };

  const results: Array<AwardListItem> = [];
  for (const a of items) {
    const recipient = await getUser(a.recipientId);
    const awardedBy = await getUser(a.awardedById);

    let certificateUrl: string | null = null;
    if (a.certificateStorageId) {
      certificateUrl = await ctx.storage.getUrl(a.certificateStorageId);
    }

    const congrats = await ctx.db
      .query("awardCongratulations")
      .withIndex("by_user_and_award", (q) =>
        q.eq("userId", currentUserId).eq("awardId", a._id),
      )
      .unique();

    results.push({
      ...a,
      recipientName: recipient?.name ?? null,
      recipientAvatar: recipient?.avatarUrl ?? null,
      recipientJobTitle: recipient?.jobTitle ?? null,
      recipientDepartment: recipient?.department ?? null,
      awardedByName: awardedBy?.name ?? null,
      awardedByAvatar: awardedBy?.avatarUrl ?? null,
      certificateUrl,
      hasCongratulated: congrats !== null,
    });
  }
  return results;
}

export const listAwards = query({
  args: {
    category: v.optional(v.string()),
    recipientId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<AwardListItem>> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    let items: Array<Doc<"awards">>;
    if (args.recipientId) {
      items = await ctx.db
        .query("awards")
        .withIndex("by_recipient", (q) =>
          q.eq("recipientId", args.recipientId!),
        )
        .order("desc")
        .take(limit);
    } else {
      items = await ctx.db
        .query("awards")
        .withIndex("by_awarded_on")
        .order("desc")
        .take(limit * 2);
    }

    items = filterByOrg(items, organizationId);

    if (args.category && args.category !== "all") {
      items = items.filter((a) => a.category === args.category);
    }
    items = items.slice(0, limit);
    return await enrichAwards(ctx, user._id, items);
  },
});

export const getAwardById = query({
  args: { awardId: v.id("awards") },
  handler: async (ctx, args): Promise<AwardListItem | null> => {
    const { user } = await requireUserTenant(ctx);
    const award = await ctx.db.get(args.awardId);
    if (!award) return null;
    const [enriched] = await enrichAwards(ctx, user._id, [award]);
    return enriched ?? null;
  },
});

export const listCongratulations = query({
  args: { awardId: v.id("awards") },
  handler: async (ctx, args): Promise<Array<AwardCongratulation>> => {
    await requireUserTenant(ctx);
    const congrats = await ctx.db
      .query("awardCongratulations")
      .withIndex("by_award", (q) => q.eq("awardId", args.awardId))
      .order("desc")
      .collect();

    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<AwardCongratulation> = [];
    for (const c of congrats) {
      let u = cache.get(c.userId);
      if (u === undefined) {
        u = await ctx.db.get(c.userId);
        cache.set(c.userId, u);
      }
      results.push({
        ...c,
        userName: u?.name ?? null,
        userAvatar: u?.avatarUrl ?? null,
      });
    }
    return results;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<AwardStats> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const allRows = await ctx.db.query("awards").collect();
    const all = filterByOrg(allRows, organizationId);
    const now = new Date();
    const year = now.getUTCFullYear();
    const startOfYear = `${year}-01-01`;
    const startOfMonth = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    let thisYear = 0;
    let thisMonth = 0;
    let receivedByMe = 0;
    for (const a of all) {
      if (a.awardedOn >= startOfYear) thisYear++;
      if (a.awardedOn >= startOfMonth) thisMonth++;
      if (a.recipientId === user._id) receivedByMe++;
    }
    return { total: all.length, thisYear, thisMonth, receivedByMe };
  },
});

export const getHallOfFame = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<HallOfFameEntry>> => {
    const { organizationId } = await requireUserTenant(ctx);
    const limit = Math.min(args.limit ?? 10, 50);
    const allRows = await ctx.db
      .query("awards")
      .withIndex("by_awarded_on")
      .order("desc")
      .take(500);
    const all = filterByOrg(allRows, organizationId);

    type Acc = {
      count: number;
      latestTitle: string;
      latestDate: string;
    };
    const counts = new Map<Id<"users">, Acc>();
    for (const a of all) {
      const existing = counts.get(a.recipientId);
      if (existing) {
        existing.count++;
        if (a.awardedOn > existing.latestDate) {
          existing.latestDate = a.awardedOn;
          existing.latestTitle = a.title;
        }
      } else {
        counts.set(a.recipientId, {
          count: 1,
          latestTitle: a.title,
          latestDate: a.awardedOn,
        });
      }
    }

    const sorted = Array.from(counts.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].latestDate.localeCompare(a[1].latestDate);
      })
      .slice(0, limit);

    const results: Array<HallOfFameEntry> = [];
    for (const [userId, acc] of sorted) {
      const u = await ctx.db.get(userId);
      if (!u) continue;
      results.push({
        userId,
        name: u.name ?? "Karyawan",
        avatarUrl: u.avatarUrl ?? null,
        jobTitle: u.jobTitle ?? null,
        department: u.department ?? null,
        awardCount: acc.count,
        latestAwardTitle: acc.latestTitle,
        latestAwardDate: acc.latestDate,
      });
    }
    return results;
  },
});

export const generateCertificateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdminTenant(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

const VALID_CATEGORIES = [
  "employee_of_month",
  "employee_of_quarter",
  "employee_of_year",
  "excellence",
  "innovation",
  "leadership",
  "teamwork",
  "long_service",
  "rookie",
  "custom",
];

export const createAward = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    recipientId: v.id("users"),
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
    awardedOn: v.string(),
    bonusAmount: v.optional(v.number()),
    certificateStorageId: v.optional(v.id("_storage")),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"awards">> => {
    const { user: admin, organizationId } = await requireAdminTenant(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul penghargaan wajib diisi",
      });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penerima tidak ditemukan",
      });
    }
    if (args.bonusAmount !== undefined && args.bonusAmount < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Bonus tidak boleh negatif",
      });
    }

    // Enforce plan storage limit when a certificate file is attached.
    if (args.certificateStorageId) {
      const incomingBytes = await getStorageSizeBytes(ctx, args.certificateStorageId);
      await assertStorageWithinLimit(ctx, organizationId, incomingBytes);
    }

    const awardId = await ctx.db.insert("awards", {
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      recipientId: args.recipientId,
      period: args.period,
      periodLabel: args.periodLabel,
      awardedOn: args.awardedOn,
      bonusAmount: args.bonusAmount,
      certificateStorageId: args.certificateStorageId,
      awardedById: admin._id,
      isFeatured: args.isFeatured ?? false,
      congratulationCount: 0,
      organizationId: organizationId ?? undefined,
    });

    if (args.certificateStorageId) {
      await trackStorageAdded(ctx, organizationId, args.certificateStorageId);
    }

    // Notify the recipient
    await notifyUser(ctx, {
      userId: args.recipientId,
      type: "award_received",
      title: "Selamat! Anda menerima penghargaan",
      message: `${admin.name ?? "Administrator"} memberi Anda penghargaan "${title}"`,
      link: `/awards/${awardId}`,
      actorId: admin._id,
    });

    // Broadcast to everyone else so the team can celebrate together
    await notifyAllUsers(ctx, {
      type: "award_announced",
      title: "Penghargaan baru diumumkan",
      message: `${recipient.name ?? "Seorang karyawan"} menerima penghargaan "${title}"`,
      link: `/awards/${awardId}`,
      actorId: args.recipientId,
    });

    return awardId;
  },
});

export const updateAward = mutation({
  args: {
    awardId: v.id("awards"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
    awardedOn: v.optional(v.string()),
    bonusAmount: v.optional(v.number()),
    certificateStorageId: v.optional(v.id("_storage")),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminTenant(ctx);
    const award = await ctx.db.get(args.awardId);
    if (!award) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penghargaan tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"awards">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.category !== undefined) {
      if (!VALID_CATEGORIES.includes(args.category)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kategori tidak valid",
        });
      }
      patch.category = args.category;
    }
    if (args.period !== undefined) patch.period = args.period;
    if (args.periodLabel !== undefined) patch.periodLabel = args.periodLabel;
    if (args.awardedOn !== undefined) patch.awardedOn = args.awardedOn;
    if (args.bonusAmount !== undefined) patch.bonusAmount = args.bonusAmount;
    if (args.certificateStorageId !== undefined)
      patch.certificateStorageId = args.certificateStorageId;
    if (args.isFeatured !== undefined) patch.isFeatured = args.isFeatured;

    await ctx.db.patch(args.awardId, patch);
    return null;
  },
});

export const deleteAward = mutation({
  args: { awardId: v.id("awards") },
  handler: async (ctx, args) => {
    await requireAdminTenant(ctx);
    const award = await ctx.db.get(args.awardId);
    if (!award) return null;

    // Clean up congratulations
    const congrats = await ctx.db
      .query("awardCongratulations")
      .withIndex("by_award", (q) => q.eq("awardId", args.awardId))
      .collect();
    for (const c of congrats) {
      await ctx.db.delete(c._id);
    }

    // Best-effort clean up certificate storage
    if (award.certificateStorageId) {
      await trackStorageRemoved(ctx, award.organizationId, award.certificateStorageId);
      try {
        await ctx.storage.delete(award.certificateStorageId);
      } catch {
        // ignore - storage may already be gone
      }
    }
    await ctx.db.delete(args.awardId);
    return null;
  },
});

export const toggleCongratulations = mutation({
  args: {
    awardId: v.id("awards"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ congratulated: boolean }> => {
    const { user, organizationId } = await requireUserTenant(ctx);
    const award = await ctx.db.get(args.awardId);
    if (!award) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Penghargaan tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("awardCongratulations")
      .withIndex("by_user_and_award", (q) =>
        q.eq("userId", user._id).eq("awardId", args.awardId),
      )
      .unique();

    const currentCount = award.congratulationCount ?? 0;
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.awardId, {
        congratulationCount: Math.max(0, currentCount - 1),
      });
      return { congratulated: false };
    }
    await ctx.db.insert("awardCongratulations", {
      awardId: args.awardId,
      userId: user._id,
      message: args.message?.trim() || undefined,
      organizationId: organizationId ?? undefined,
    });
    await ctx.db.patch(args.awardId, {
      congratulationCount: currentCount + 1,
    });

    // Notify the recipient that someone congratulated them
    if (award.recipientId !== user._id) {
      await notifyUser(ctx, {
        userId: award.recipientId,
        type: "award_congratulation",
        title: "Ucapan selamat baru",
        message: `${user.name ?? "Seorang rekan"} mengucapkan selamat atas penghargaan Anda`,
        link: `/awards/${args.awardId}`,
        actorId: user._id,
      });
    }
    return { congratulated: true };
  },
});
