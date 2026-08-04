import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";
import { getOrgScope } from "./_scope";

async function requireAuthUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const me = await requireAuthUser(ctx);
  if (!isAdminRole(me.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola penilaian 9-box",
    });
  }
  return me;
}

function clampBox(n: number): number {
  if (n < 1) return 1;
  if (n > 3) return 3;
  return Math.round(n);
}

// 9-box cell categories by (performance, potential) 1..3.
export const CELL_META: Record<
  string,
  { code: string; label: string; description: string; tone: string }
> = {
  "1-1": {
    code: "risk",
    label: "Risiko",
    description: "Performa dan potensi rendah. Perlu tindakan perbaikan.",
    tone: "rose",
  },
  "2-1": {
    code: "effective",
    label: "Kontributor Efektif",
    description: "Performa cukup dengan potensi terbatas untuk berkembang.",
    tone: "amber",
  },
  "3-1": {
    code: "solid_performer",
    label: "Performer Solid",
    description: "Performa tinggi tetapi potensi pertumbuhan terbatas.",
    tone: "emerald",
  },
  "1-2": {
    code: "enigma",
    label: "Teka-teki",
    description: "Potensi menengah tetapi performa perlu didorong.",
    tone: "amber",
  },
  "2-2": {
    code: "core",
    label: "Inti Tim",
    description: "Tulang punggung tim dengan performa dan potensi stabil.",
    tone: "sky",
  },
  "3-2": {
    code: "high_performer",
    label: "Performer Tinggi",
    description: "Performa tinggi dengan potensi pertumbuhan baik.",
    tone: "emerald",
  },
  "1-3": {
    code: "rough_diamond",
    label: "Berlian Kasar",
    description: "Potensi tinggi, performa belum maksimal. Perlu bimbingan.",
    tone: "violet",
  },
  "2-3": {
    code: "growth",
    label: "Bintang Berkembang",
    description: "Potensi tinggi dengan performa yang sedang meningkat.",
    tone: "violet",
  },
  "3-3": {
    code: "star",
    label: "Bintang",
    description: "Talenta kunci - performa dan potensi tertinggi.",
    tone: "violet",
  },
};

export type NineBoxEntry = {
  assessment: Doc<"nineBoxAssessments">;
  user: Doc<"users"> | null;
  assessor: Doc<"users"> | null;
};

export const listAll = query({
  args: { period: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<NineBoxEntry>> => {
    const { userIds: scopeUserIds, isMember } = await getOrgScope(ctx);
    let rows: Array<Doc<"nineBoxAssessments">>;
    if (args.period) {
      rows = await ctx.db
        .query("nineBoxAssessments")
        .withIndex("by_period", (q) => q.eq("period", args.period))
        .collect();
    } else {
      rows = await ctx.db.query("nineBoxAssessments").collect();
    }
    // Scope to the viewing organization's employees.
    if (scopeUserIds !== null) {
      rows = rows.filter((r) => isMember(r.userId));
    }
    // Keep only the latest assessment per user within the filter.
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const seen = new Set<string>();
    const latest: Array<Doc<"nineBoxAssessments">> = [];
    for (const r of rows) {
      if (seen.has(r.userId)) continue;
      seen.add(r.userId);
      latest.push(r);
    }
    const userIds = new Set<Id<"users">>();
    for (const r of latest) {
      userIds.add(r.userId);
      userIds.add(r.assessedById);
    }
    const userById = new Map<Id<"users">, Doc<"users">>();
    for (const id of userIds) {
      const u = await ctx.db.get(id);
      if (u) userById.set(id, u);
    }
    return latest.map((r) => ({
      assessment: r,
      user: userById.get(r.userId) ?? null,
      assessor: userById.get(r.assessedById) ?? null,
    }));
  },
});

export const getForUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"nineBoxAssessments">>> => {
    await requireAuthUser(ctx);
    const rows = await ctx.db
      .query("nineBoxAssessments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows;
  },
});

export const upsertAssessment = mutation({
  args: {
    userId: v.id("users"),
    performance: v.number(),
    potential: v.number(),
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"nineBoxAssessments">> => {
    const me = await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }
    const performance = clampBox(args.performance);
    const potential = clampBox(args.potential);
    const period = args.period;
    // If an assessment for this (user, period) exists, update it; otherwise insert.
    let existing: Doc<"nineBoxAssessments"> | null = null;
    if (period) {
      existing = await ctx.db
        .query("nineBoxAssessments")
        .withIndex("by_user_and_period", (q) =>
          q.eq("userId", args.userId).eq("period", period),
        )
        .first();
    } else {
      existing = await ctx.db
        .query("nineBoxAssessments")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .first();
    }
    const now = new Date().toISOString();
    if (existing && (!period || existing.period === period)) {
      await ctx.db.patch(existing._id, {
        performance,
        potential,
        periodLabel: args.periodLabel,
        notes: args.notes,
        assessedById: me._id,
        assessedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("nineBoxAssessments", {
      userId: args.userId,
      performance,
      potential,
      period,
      periodLabel: args.periodLabel,
      notes: args.notes,
      assessedById: me._id,
      assessedAt: now,
    });
  },
});

export const deleteAssessment = mutation({
  args: { assessmentId: v.id("nineBoxAssessments") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.assessmentId);
    if (!row) return null;
    await ctx.db.delete(args.assessmentId);
    return null;
  },
});
