import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { isSuperAdminBlocked } from "./superAdminDataAccess";
import { filterCountableEmployees } from "./lib/countableUsers";

type EOfficeStats = {
  suratMasuk: number;
  suratKeluar: number;
  disposisiPending: number;
  approvalPending: number;
  totalKaryawan: number;
  suratDraft: number;
  suratBulanIni: number;
  suratBulanLalu: number;
};

export const getEOfficeStats = query({
  args: {},
  handler: async (ctx): Promise<EOfficeStats> => {
    const { userId, organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Super admin data-access gate for letter data. When blocked, letter-derived
    // counts are hidden (shown as 0); employee count is handled by its own category.
    const lettersBlocked = await isSuperAdminBlocked(ctx, isSuperAdmin, "letters");

    const [allMasuk, allKeluar, allDrafts, pendingApprovals, pendingDispositions, allUsers] =
      await Promise.all([
        ctx.db
          .query("letters")
          .withIndex("by_type", (q) => q.eq("type", "masuk"))
          .collect(),
        ctx.db
          .query("letters")
          .withIndex("by_type", (q) => q.eq("type", "keluar"))
          .collect(),
        ctx.db
          .query("letters")
          .withIndex("by_status", (q) => q.eq("status", "draft"))
          .collect(),
        ctx.db
          .query("letterApprovals")
          .withIndex("by_approver_and_status", (q) =>
            q.eq("approverId", userId).eq("status", "pending"),
          )
          .collect(),
        ctx.db
          .query("letterDispositions")
          .withIndex("by_to_user_and_status", (q) =>
            q.eq("toUserId", userId).eq("status", "pending"),
          )
          .collect(),
        organizationId
          ? ctx.db
              .query("users")
              .withIndex("by_organization", (q) =>
                q.eq("organizationId", organizationId),
              )
              .collect()
          : Promise.resolve([]),
      ]);

    // Apply org filter for tables without by_organization index. A super admin
    // without an active grant has organizationId === null → empty result.
    const filterByOrg = <T extends { organizationId?: Id<"organizations"> | null }>(
      items: T[],
    ): T[] => {
      if (organizationId) return items.filter((i) => i.organizationId === organizationId);
      return [];
    };

    const masuk = filterByOrg(allMasuk);
    const keluar = filterByOrg(allKeluar);
    const drafts = filterByOrg(allDrafts);

    // Count letters this month vs last month
    const allLetters = [...masuk, ...keluar];
    const suratBulanIni = allLetters.filter(
      (l) => l._creationTime >= new Date(startOfMonth).getTime(),
    ).length;
    const suratBulanLalu = allLetters.filter(
      (l) =>
        l._creationTime >= new Date(startOfLastMonth).getTime() &&
        l._creationTime <= new Date(endOfLastMonth).getTime(),
    ).length;

    return {
      suratMasuk: lettersBlocked ? 0 : masuk.length,
      suratKeluar: lettersBlocked ? 0 : keluar.length,
      disposisiPending: lettersBlocked ? 0 : pendingDispositions.length,
      approvalPending: lettersBlocked ? 0 : pendingApprovals.length,
      totalKaryawan: filterCountableEmployees(allUsers).length,
      suratDraft: lettersBlocked ? 0 : drafts.length,
      suratBulanIni: lettersBlocked ? 0 : suratBulanIni,
      suratBulanLalu: lettersBlocked ? 0 : suratBulanLalu,
    };
  },
});

type RecentLetterItem = {
  _id: string;
  subject: string;
  type: string;
  status: string;
  letterNumber: string | undefined;
  fromName: string;
  toName: string;
  letterDate: string;
  category: string;
  _creationTime: number;
  authorName: string;
};

export const getRecentLetters = query({
  args: {},
  handler: async (ctx): Promise<RecentLetterItem[]> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "letters")) return [];

    const allLetters = await ctx.db.query("letters").order("desc").take(50);

    // Always scope to the caller's org. A super admin without an active grant
    // has organizationId === null → no letters.
    const letters = organizationId
      ? allLetters.filter((l) => l.organizationId === organizationId).slice(0, 8)
      : [];

    return await Promise.all(
      letters.slice(0, 8).map(async (l) => {
        const author = l.authorId ? await ctx.db.get(l.authorId) : null;
        return {
          _id: l._id,
          subject: l.subject,
          type: l.type,
          status: l.status,
          letterNumber: l.letterNumber,
          fromName: l.fromName,
          toName: l.toName,
          letterDate: l.letterDate,
          category: l.category,
          _creationTime: l._creationTime,
          authorName: author?.name ?? "Tidak diketahui",
        };
      }),
    );
  },
});

type RecentActivityItem = {
  _id: string;
  action: string;
  detail: string | undefined;
  occurredAt: string;
  actorName: string;
  letterSubject: string;
};

export const getRecentActivity = query({
  args: {},
  handler: async (ctx): Promise<RecentActivityItem[]> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "letters")) return [];

    const allHistory = await ctx.db.query("letterHistory").order("desc").take(100);

    // Filter history by checking the associated letter's org. A super admin
    // without an active grant has organizationId === null → nothing.
    const filtered: typeof allHistory = [];
    for (const h of allHistory) {
      if (filtered.length >= 10) break;
      if (!organizationId) break;
      const letter = await ctx.db.get(h.letterId);
      if (letter?.organizationId === organizationId) {
        filtered.push(h);
      }
    }

    return await Promise.all(
      filtered.map(async (h) => {
        const actor = await ctx.db.get(h.actorId);
        const letter = await ctx.db.get(h.letterId);
        return {
          _id: h._id,
          action: h.action,
          detail: h.detail,
          occurredAt: h.occurredAt,
          actorName: actor?.name ?? "Tidak diketahui",
          letterSubject: letter?.subject ?? "Surat dihapus",
        };
      }),
    );
  },
});

type PendingDispositionItem = {
  _id: string;
  instructions: string;
  status: string;
  dueDate: string | undefined;
  _creationTime: number;
  fromUserName: string;
  letterSubject: string;
  letterId: string;
};

export const getMyPendingDispositions = query({
  args: {},
  handler: async (ctx): Promise<PendingDispositionItem[]> => {
    const { userId, organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "letters")) return [];

    const allDispositions = await ctx.db
      .query("letterDispositions")
      .withIndex("by_to_user_and_status", (q) =>
        q.eq("toUserId", userId).eq("status", "pending"),
      )
      .order("desc")
      .take(50);

    // Filter by org via in-memory check on the associated letter. A super admin
    // without an active grant has organizationId === null → nothing.
    const dispositions: typeof allDispositions = [];
    for (const d of allDispositions) {
      if (dispositions.length >= 5) break;
      if (!organizationId) break;
      const letter = await ctx.db.get(d.letterId);
      if (letter?.organizationId === organizationId) {
        dispositions.push(d);
      }
    }

    return await Promise.all(
      dispositions.map(async (d) => {
        const fromUser = await ctx.db.get(d.fromUserId);
        const letter = await ctx.db.get(d.letterId);
        return {
          _id: d._id,
          instructions: d.instructions,
          status: d.status,
          dueDate: d.dueDate,
          _creationTime: d._creationTime,
          fromUserName: fromUser?.name ?? "Tidak diketahui",
          letterSubject: letter?.subject ?? "Surat dihapus",
          letterId: d.letterId,
        };
      }),
    );
  },
});
