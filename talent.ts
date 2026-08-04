// Talent Management: Nine Box review cycles with manager draft → committee
// calibration flow, IDP action plans, succession ready-now lookups, analytics,
// and talent movement history. Visibility is HR + manager (reuses existing
// successionPlans table for succession candidates).

import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, canManageTeam } from "./roles";
import { requireTenant } from "./lib/tenant";

// ---- Auth helpers ------------------------------------------------------

async function requireAuthUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  // Gunakan organisasi EFEKTIF dari requireTenant. Untuk super admin ini adalah
  // tenant yang sedang dipilih (viewingOrganizationId), bukan organisasi milik
  // super admin sendiri — agar semua penyaringan data mengikuti tenant aktif.
  const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { ...user, organizationId: organizationId ?? undefined };
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const me = await requireAuthUser(ctx);
  if (!isAdminRole(me.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya HR/admin yang dapat melakukan tindakan ini.",
    });
  }
  return me;
}

function isMemberOfCommittee(
  cycle: Doc<"talentCycles">,
  userId: Id<"users">,
): boolean {
  return cycle.committeeIds.some((id) => id === userId);
}

async function canManage(
  ctx: QueryCtx | MutationCtx,
  cycle: Doc<"talentCycles">,
  me: Doc<"users">,
): Promise<boolean> {
  if (isAdminRole(me.role)) return true;
  if (isMemberOfCommittee(cycle, me._id)) return true;
  return false;
}

// ---- Box code helpers --------------------------------------------------

function boxCodeFor(performance: number, potential: number): string {
  // Match convex/orgAdvanced/nineBox.ts CELL_META codes.
  const key = `${Math.max(1, Math.min(3, Math.round(performance)))}-${Math.max(1, Math.min(3, Math.round(potential)))}`;
  const map: Record<string, string> = {
    "1-1": "risk",
    "2-1": "effective",
    "3-1": "solid_performer",
    "1-2": "enigma",
    "2-2": "core",
    "3-2": "high_performer",
    "1-3": "rough_diamond",
    "2-3": "growth",
    "3-3": "star",
  };
  return map[key] ?? "core";
}

function clampBox(n: number): number {
  if (n < 1) return 1;
  if (n > 3) return 3;
  return Math.round(n);
}

// ---- KPI integration (performance score helper) ------------------------

async function computeKpiScore(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<number | undefined> {
  // Aggregate latest kpiMeasurements statuses into a 1..3 score using
  // on_track=3 / at_risk=2 / off_track=1, weighted by KPI weight when set.
  const rows = await ctx.db
    .query("kpiMeasurements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (rows.length === 0) return undefined;
  // Keep only the latest measurement per KPI
  rows.sort((a, b) => b._creationTime - a._creationTime);
  const seen = new Set<string>();
  const latest: Array<Doc<"kpiMeasurements">> = [];
  for (const r of rows) {
    const key = r.kpiId as unknown as string;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(r);
  }
  let total = 0;
  let weightSum = 0;
  for (const r of latest) {
    const kpi = await ctx.db.get(r.kpiId);
    const weight = kpi?.weight ?? 1;
    const s =
      r.status === "on_track" ? 3 : r.status === "at_risk" ? 2 : 1;
    total += s * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return undefined;
  return total / weightSum;
}

// ---- Public queries ----------------------------------------------------

export type CycleSummary = {
  cycle: Doc<"talentCycles">;
  placementCount: number;
  finalizedCount: number;
  pendingCount: number;
  submittedCount: number;
};

export const listCycles = query({
  args: {},
  handler: async (ctx): Promise<Array<CycleSummary>> => {
    await requireAuthUser(ctx);
    const cycles = await ctx.db.query("talentCycles").collect();
    cycles.sort((a, b) => (a.period < b.period ? 1 : -1));
    const out: Array<CycleSummary> = [];
    for (const c of cycles) {
      const placements = await ctx.db
        .query("talentPlacements")
        .withIndex("by_cycle", (q) => q.eq("cycleId", c._id))
        .collect();
      let finalized = 0;
      let submitted = 0;
      let pending = 0;
      for (const p of placements) {
        if (p.status === "finalized") finalized++;
        else if (p.status === "submitted" || p.status === "calibrated")
          submitted++;
        else pending++;
      }
      out.push({
        cycle: c,
        placementCount: placements.length,
        finalizedCount: finalized,
        submittedCount: submitted,
        pendingCount: pending,
      });
    }
    return out;
  },
});

export const getCycle = query({
  args: { cycleId: v.id("talentCycles") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    cycle: Doc<"talentCycles">;
    committee: Array<Doc<"users">>;
    creator: Doc<"users"> | null;
    canManage: boolean;
  }> => {
    const me = await requireAuthUser(ctx);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    const committee: Array<Doc<"users">> = [];
    for (const id of cycle.committeeIds) {
      const u = await ctx.db.get(id);
      if (u) committee.push(u);
    }
    const creator = await ctx.db.get(cycle.createdById);
    return {
      cycle,
      committee,
      creator,
      canManage: await canManage(ctx, cycle, me),
    };
  },
});

export type PlacementRow = {
  placement: Doc<"talentPlacements">;
  user: Doc<"users"> | null;
  manager: Doc<"users"> | null;
};

export const listPlacements = query({
  args: {
    cycleId: v.id("talentCycles"),
    filter: v.optional(v.string()), // "all" | "mine" | "pending" | "submitted" | "finalized"
  },
  handler: async (ctx, args): Promise<Array<PlacementRow>> => {
    const me = await requireAuthUser(ctx);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) return [];
    const filter = args.filter ?? "all";
    const isManager = canManageTeam(me.role);
    const canSeeAll = isAdminRole(me.role) || isMemberOfCommittee(cycle, me._id);

    let placements = await ctx.db
      .query("talentPlacements")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    // Visibility: HR/committee sees all. Otherwise only their direct reports.
    if (!canSeeAll) {
      if (!isManager) return [];
      placements = placements.filter((p) => p.managerId === me._id);
    }

    if (filter === "mine") {
      placements = placements.filter((p) => p.managerId === me._id);
    } else if (filter === "pending") {
      placements = placements.filter((p) => p.status === "pending" || p.status === "draft");
    } else if (filter === "submitted") {
      placements = placements.filter(
        (p) => p.status === "submitted" || p.status === "calibrated",
      );
    } else if (filter === "finalized") {
      placements = placements.filter((p) => p.status === "finalized");
    }

    const rows: Array<PlacementRow> = [];
    for (const p of placements) {
      const user = await ctx.db.get(p.userId);
      const manager = p.managerId ? await ctx.db.get(p.managerId) : null;
      rows.push({ placement: p, user, manager });
    }
    // Sort: department, then name
    rows.sort((a, b) => {
      const da = (a.placement.userDepartment ?? "").localeCompare(
        b.placement.userDepartment ?? "",
      );
      if (da !== 0) return da;
      return (a.placement.userName ?? "").localeCompare(b.placement.userName ?? "");
    });
    return rows;
  },
});

export const getPlacement = query({
  args: { placementId: v.id("talentPlacements") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    placement: Doc<"talentPlacements">;
    cycle: Doc<"talentCycles"> | null;
    user: Doc<"users"> | null;
    manager: Doc<"users"> | null;
    idp: Doc<"talentIdps"> | null;
    idpItems: Array<Doc<"talentIdpItems">>;
    history: Array<Doc<"talentPlacements">>;
    canEditBox: boolean;
    canCalibrate: boolean;
    canFinalize: boolean;
  }> => {
    const me = await requireAuthUser(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Placement tidak ditemukan",
      });
    }
    const cycle = await ctx.db.get(placement.cycleId);
    const user = await ctx.db.get(placement.userId);
    const manager = placement.managerId ? await ctx.db.get(placement.managerId) : null;

    const idp = await ctx.db
      .query("talentIdps")
      .withIndex("by_cycle_and_user", (q) =>
        q.eq("cycleId", placement.cycleId).eq("userId", placement.userId),
      )
      .first();
    const idpItems = idp
      ? await ctx.db
          .query("talentIdpItems")
          .withIndex("by_idp", (q) => q.eq("idpId", idp._id))
          .collect()
      : [];
    idpItems.sort((a, b) => a.order - b.order);

    // Full history across all cycles
    const allHistory = await ctx.db
      .query("talentPlacements")
      .withIndex("by_user", (q) => q.eq("userId", placement.userId))
      .collect();
    allHistory.sort((a, b) => b._creationTime - a._creationTime);

    const isManager = placement.managerId === me._id;
    const isCommittee = cycle ? isMemberOfCommittee(cycle, me._id) : false;
    const isAdmin = isAdminRole(me.role);
    const cycleOpen =
      cycle !== null &&
      (cycle.status === "active" || cycle.status === "calibration");

    return {
      placement,
      cycle,
      user,
      manager,
      idp,
      idpItems,
      history: allHistory,
      canEditBox:
        cycleOpen &&
        placement.status !== "finalized" &&
        (isManager || isCommittee || isAdmin),
      canCalibrate:
        cycleOpen &&
        (isCommittee || isAdmin) &&
        (placement.status === "submitted" || placement.status === "calibrated"),
      canFinalize:
        cycleOpen &&
        isAdmin &&
        (placement.status === "submitted" || placement.status === "calibrated"),
    };
  },
});

// ---- Analytics ---------------------------------------------------------

export type CycleAnalytics = {
  total: number;
  bySegment: Record<string, number>; // boxCode -> count
  byDepartment: Array<{ department: string; total: number; counts: Record<string, number> }>;
  movement: {
    improved: number;
    declined: number;
    same: number;
    newlyAdded: number;
  };
  topTalentCount: number; // star + high_performer + growth
  riskCount: number; // risk + enigma + effective
};

export const getCycleAnalytics = query({
  args: { cycleId: v.id("talentCycles") },
  handler: async (ctx, args): Promise<CycleAnalytics> => {
    await requireAuthUser(ctx);
    const placements = await ctx.db
      .query("talentPlacements")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();

    const bySegment: Record<string, number> = {};
    const byDept = new Map<string, { total: number; counts: Record<string, number> }>();
    let improved = 0;
    let declined = 0;
    let same = 0;
    let newlyAdded = 0;
    let topTalent = 0;
    let risk = 0;

    const RANK: Record<string, number> = {
      risk: 1,
      enigma: 2,
      effective: 2,
      rough_diamond: 3,
      core: 3,
      solid_performer: 3,
      growth: 4,
      high_performer: 4,
      star: 5,
    };

    for (const p of placements) {
      if (!p.boxCode) continue;
      bySegment[p.boxCode] = (bySegment[p.boxCode] ?? 0) + 1;
      const dept = p.userDepartment ?? "Lainnya";
      if (!byDept.has(dept)) byDept.set(dept, { total: 0, counts: {} });
      const dd = byDept.get(dept);
      if (!dd) continue;
      dd.total++;
      dd.counts[p.boxCode] = (dd.counts[p.boxCode] ?? 0) + 1;
      if (["star", "high_performer", "growth"].includes(p.boxCode)) topTalent++;
      if (["risk", "enigma", "effective"].includes(p.boxCode)) risk++;
      if (!p.previousBoxCode) {
        newlyAdded++;
      } else {
        const before = RANK[p.previousBoxCode] ?? 3;
        const after = RANK[p.boxCode] ?? 3;
        if (after > before) improved++;
        else if (after < before) declined++;
        else same++;
      }
    }
    return {
      total: placements.length,
      bySegment,
      byDepartment: Array.from(byDept.entries())
        .map(([department, v]) => ({ department, total: v.total, counts: v.counts }))
        .sort((a, b) => b.total - a.total),
      movement: { improved, declined, same, newlyAdded },
      topTalentCount: topTalent,
      riskCount: risk,
    };
  },
});

// ---- Admin mutations: cycle ------------------------------------------

export const createCycle = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    period: v.string(),
    periodLabel: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    calibrationDate: v.optional(v.string()),
    performanceSource: v.string(),
    committeeIds: v.array(v.id("users")),
    departments: v.array(v.string()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"talentCycles">> => {
    const me = await requireAdmin(ctx);
    if (!args.name.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama siklus wajib diisi",
      });
    }
    if (!["manual", "kpi", "hybrid"].includes(args.performanceSource)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sumber kinerja tidak valid",
      });
    }
    return await ctx.db.insert("talentCycles", {
      name: args.name.trim(),
      description: args.description,
      period: args.period,
      periodLabel: args.periodLabel,
      status: "draft",
      startDate: args.startDate,
      endDate: args.endDate,
      calibrationDate: args.calibrationDate,
      performanceSource: args.performanceSource,
      committeeIds: args.committeeIds,
      departments: args.departments,
      instructions: args.instructions,
      createdById: me._id,
      placementCount: 0,
      finalizedCount: 0,
    });
  },
});

export const updateCycle = mutation({
  args: {
    cycleId: v.id("talentCycles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    calibrationDate: v.optional(v.string()),
    performanceSource: v.optional(v.string()),
    committeeIds: v.optional(v.array(v.id("users"))),
    departments: v.optional(v.array(v.string())),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    const patch: Partial<Doc<"talentCycles">> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.description !== undefined) patch.description = args.description;
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    if (args.calibrationDate !== undefined)
      patch.calibrationDate = args.calibrationDate;
    if (args.performanceSource !== undefined)
      patch.performanceSource = args.performanceSource;
    if (args.committeeIds !== undefined) patch.committeeIds = args.committeeIds;
    if (args.departments !== undefined) patch.departments = args.departments;
    if (args.instructions !== undefined) patch.instructions = args.instructions;
    await ctx.db.patch(args.cycleId, patch);
    return null;
  },
});

// Populate placements: creates a pending placement for each employee in scope.
export const startCycle = mutation({
  args: { cycleId: v.id("talentCycles") },
  handler: async (ctx, args): Promise<{ created: number }> => {
    await requireAdmin(ctx);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    }
    // Collect existing placements for this cycle so we don't duplicate
    const existing = await ctx.db
      .query("talentPlacements")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    const existingUserIds = new Set<string>(
      existing.map((p) => p.userId as unknown as string),
    );

    let users = await ctx.db.query("users").collect();
    if (cycle.departments.length > 0) {
      const set = new Set(cycle.departments);
      users = users.filter((u) => u.department && set.has(u.department));
    }
    let created = 0;
    for (const u of users) {
      if (existingUserIds.has(u._id as unknown as string)) continue;

      // Look up prior placement to set previousBoxCode (most recent finalized).
      const prior = await ctx.db
        .query("talentPlacements")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      prior.sort((a, b) => b._creationTime - a._creationTime);
      const priorFinal = prior.find((p) => p.status === "finalized" && p.boxCode);

      let kpiScore: number | undefined;
      if (
        cycle.performanceSource === "kpi" ||
        cycle.performanceSource === "hybrid"
      ) {
        kpiScore = await computeKpiScore(ctx, u._id);
      }

      await ctx.db.insert("talentPlacements", {
        cycleId: args.cycleId,
        userId: u._id,
        managerId: u.managerId,
        status: "pending",
        userName: u.name ?? "Tanpa nama",
        userDepartment: u.department,
        userJobTitle: u.jobTitle,
        previousBoxCode: priorFinal?.boxCode,
        kpiScore,
      });
      created++;
    }
    const placementCount = existing.length + created;
    await ctx.db.patch(args.cycleId, {
      status: "active",
      placementCount,
    });
    return { created };
  },
});

export const setCycleStatus = mutation({
  args: {
    cycleId: v.id("talentCycles"),
    status: v.string(), // "draft" | "active" | "calibration" | "finalized" | "closed"
  },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    if (
      !["draft", "active", "calibration", "finalized", "closed"].includes(
        args.status,
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const patch: Partial<Doc<"talentCycles">> = { status: args.status };
    if (args.status === "finalized")
      patch.finalizedAt = new Date().toISOString();
    if (args.status === "closed") patch.closedAt = new Date().toISOString();
    await ctx.db.patch(args.cycleId, patch);
    return null;
  },
});

export const deleteCycle = mutation({
  args: { cycleId: v.id("talentCycles") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    // Cascade: placements, idps, idp items
    const placements = await ctx.db
      .query("talentPlacements")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    for (const p of placements) await ctx.db.delete(p._id);
    const idps = await ctx.db
      .query("talentIdps")
      .withIndex("by_cycle", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    for (const i of idps) await ctx.db.delete(i._id);
    const items = await ctx.db
      .query("talentIdpItems")
      .withIndex("by_cycle_and_user", (q) => q.eq("cycleId", args.cycleId))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);
    await ctx.db.delete(args.cycleId);
    return null;
  },
});

// ---- Placement mutations ----------------------------------------------

export const addPlacement = mutation({
  args: {
    cycleId: v.id("talentCycles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Id<"talentPlacements">> => {
    const me = await requireAuthUser(ctx);
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle)
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    if (!(await canManage(ctx, cycle, me))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya HR/komite yang dapat menambah placement",
      });
    }
    const existing = await ctx.db
      .query("talentPlacements")
      .withIndex("by_cycle_and_user", (q) =>
        q.eq("cycleId", args.cycleId).eq("userId", args.userId),
      )
      .first();
    if (existing) return existing._id;
    const u = await ctx.db.get(args.userId);
    if (!u)
      throw new ConvexError({ code: "NOT_FOUND", message: "Karyawan tidak ditemukan" });

    const prior = await ctx.db
      .query("talentPlacements")
      .withIndex("by_user", (q) => q.eq("userId", u._id))
      .collect();
    prior.sort((a, b) => b._creationTime - a._creationTime);
    const priorFinal = prior.find((p) => p.status === "finalized" && p.boxCode);

    let kpiScore: number | undefined;
    if (
      cycle.performanceSource === "kpi" ||
      cycle.performanceSource === "hybrid"
    ) {
      kpiScore = await computeKpiScore(ctx, u._id);
    }

    const id = await ctx.db.insert("talentPlacements", {
      cycleId: args.cycleId,
      userId: u._id,
      managerId: u.managerId,
      status: "pending",
      userName: u.name ?? "Tanpa nama",
      userDepartment: u.department,
      userJobTitle: u.jobTitle,
      previousBoxCode: priorFinal?.boxCode,
      kpiScore,
    });
    await ctx.db.patch(args.cycleId, {
      placementCount: cycle.placementCount + 1,
    });
    return id;
  },
});

export const draftPlacement = mutation({
  args: {
    placementId: v.id("talentPlacements"),
    performance: v.number(),
    potential: v.number(),
    managerNotes: v.optional(v.string()),
    strengths: v.optional(v.string()),
    developmentAreas: v.optional(v.string()),
    submit: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAuthUser(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Placement tidak ditemukan",
      });
    const cycle = await ctx.db.get(placement.cycleId);
    if (!cycle)
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    if (cycle.status === "closed" || cycle.status === "finalized") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Siklus sudah ditutup",
      });
    }
    if (placement.status === "finalized") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Placement sudah difinalisasi",
      });
    }
    const canEdit =
      placement.managerId === me._id ||
      isMemberOfCommittee(cycle, me._id) ||
      isAdminRole(me.role);
    if (!canEdit) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan manajer/komite untuk placement ini",
      });
    }
    const perf = clampBox(args.performance);
    const pot = clampBox(args.potential);
    const nextStatus = args.submit ? "submitted" : "draft";
    await ctx.db.patch(args.placementId, {
      performance: perf,
      potential: pot,
      boxCode: boxCodeFor(perf, pot),
      managerNotes: args.managerNotes,
      strengths: args.strengths,
      developmentAreas: args.developmentAreas,
      status: nextStatus,
      submittedAt: args.submit ? new Date().toISOString() : placement.submittedAt,
    });
    return null;
  },
});

export const calibratePlacement = mutation({
  args: {
    placementId: v.id("talentPlacements"),
    performance: v.number(),
    potential: v.number(),
    committeeNotes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAuthUser(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Placement tidak ditemukan",
      });
    const cycle = await ctx.db.get(placement.cycleId);
    if (!cycle)
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    if (!isMemberOfCommittee(cycle, me._id) && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya komite kalibrasi yang dapat menyesuaikan",
      });
    }
    const perf = clampBox(args.performance);
    const pot = clampBox(args.potential);
    await ctx.db.patch(args.placementId, {
      performance: perf,
      potential: pot,
      boxCode: boxCodeFor(perf, pot),
      committeeNotes: args.committeeNotes,
      status: "calibrated",
      calibratedAt: new Date().toISOString(),
      calibratedById: me._id,
    });
    return null;
  },
});

export const finalizePlacement = mutation({
  args: { placementId: v.id("talentPlacements") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Placement tidak ditemukan",
      });
    if (placement.performance === undefined || placement.potential === undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Performa dan potensi belum diisi",
      });
    }
    await ctx.db.patch(args.placementId, {
      status: "finalized",
      finalizedAt: new Date().toISOString(),
      finalizedById: me._id,
    });
    const cycle = await ctx.db.get(placement.cycleId);
    if (cycle) {
      await ctx.db.patch(cycle._id, {
        finalizedCount: cycle.finalizedCount + 1,
      });
    }
    // Mirror into nineBoxAssessments so existing org dashboards keep working.
    await ctx.db.insert("nineBoxAssessments", {
      userId: placement.userId,
      performance: placement.performance,
      potential: placement.potential,
      period: cycle?.period,
      periodLabel: cycle?.periodLabel,
      notes: placement.committeeNotes ?? placement.managerNotes,
      assessedById: me._id,
      assessedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const removePlacement = mutation({
  args: { placementId: v.id("talentPlacements") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const p = await ctx.db.get(args.placementId);
    if (!p) return null;
    // Remove IDPs
    const idps = await ctx.db
      .query("talentIdps")
      .withIndex("by_cycle_and_user", (q) =>
        q.eq("cycleId", p.cycleId).eq("userId", p.userId),
      )
      .collect();
    for (const i of idps) {
      const items = await ctx.db
        .query("talentIdpItems")
        .withIndex("by_idp", (q) => q.eq("idpId", i._id))
        .collect();
      for (const it of items) await ctx.db.delete(it._id);
      await ctx.db.delete(i._id);
    }
    await ctx.db.delete(args.placementId);
    const cycle = await ctx.db.get(p.cycleId);
    if (cycle) {
      await ctx.db.patch(cycle._id, {
        placementCount: Math.max(0, cycle.placementCount - 1),
        finalizedCount:
          p.status === "finalized"
            ? Math.max(0, cycle.finalizedCount - 1)
            : cycle.finalizedCount,
      });
    }
    return null;
  },
});

// ---- IDP mutations ----------------------------------------------------

export const upsertIdp = mutation({
  args: {
    placementId: v.id("talentPlacements"),
    summary: v.optional(v.string()),
    careerAspiration: v.optional(v.string()),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"talentIdps">> => {
    const me = await requireAuthUser(ctx);
    const placement = await ctx.db.get(args.placementId);
    if (!placement)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Placement tidak ditemukan",
      });
    const cycle = await ctx.db.get(placement.cycleId);
    if (!cycle)
      throw new ConvexError({ code: "NOT_FOUND", message: "Siklus tidak ditemukan" });
    const allowed =
      placement.managerId === me._id ||
      isMemberOfCommittee(cycle, me._id) ||
      isAdminRole(me.role);
    if (!allowed) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak berhak menulis IDP untuk karyawan ini",
      });
    }
    const existing = await ctx.db
      .query("talentIdps")
      .withIndex("by_cycle_and_user", (q) =>
        q.eq("cycleId", placement.cycleId).eq("userId", placement.userId),
      )
      .first();
    const now = new Date().toISOString();
    const status = args.publish ? "published" : "draft";
    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary,
        careerAspiration: args.careerAspiration,
        status,
        lastEditorId: me._id,
        lastEditedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("talentIdps", {
      cycleId: placement.cycleId,
      userId: placement.userId,
      placementId: placement._id,
      summary: args.summary,
      careerAspiration: args.careerAspiration,
      status,
      lastEditorId: me._id,
      lastEditedAt: now,
    });
  },
});

export const addIdpItem = mutation({
  args: {
    idpId: v.id("talentIdps"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    horizon: v.string(),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"talentIdpItems">> => {
    const me = await requireAuthUser(ctx);
    const idp = await ctx.db.get(args.idpId);
    if (!idp)
      throw new ConvexError({ code: "NOT_FOUND", message: "IDP tidak ditemukan" });
    const placement = idp.placementId ? await ctx.db.get(idp.placementId) : null;
    const cycle = await ctx.db.get(idp.cycleId);
    const allowed =
      isAdminRole(me.role) ||
      (cycle && isMemberOfCommittee(cycle, me._id)) ||
      (placement && placement.managerId === me._id);
    if (!allowed) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak mengubah rencana ini",
      });
    }
    const existing = await ctx.db
      .query("talentIdpItems")
      .withIndex("by_idp", (q) => q.eq("idpId", args.idpId))
      .collect();
    const order = existing.length;
    return await ctx.db.insert("talentIdpItems", {
      idpId: args.idpId,
      cycleId: idp.cycleId,
      userId: idp.userId,
      title: args.title.trim(),
      description: args.description,
      category: args.category,
      horizon: args.horizon,
      targetDate: args.targetDate,
      status: "planned",
      progress: 0,
      order,
    });
  },
});

export const updateIdpItem = mutation({
  args: {
    itemId: v.id("talentIdpItems"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    horizon: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    status: v.optional(v.string()),
    progress: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAuthUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item)
      throw new ConvexError({ code: "NOT_FOUND", message: "Item tidak ditemukan" });
    const idp = await ctx.db.get(item.idpId);
    const placement = idp?.placementId ? await ctx.db.get(idp.placementId) : null;
    const cycle = await ctx.db.get(item.cycleId);
    const allowed =
      isAdminRole(me.role) ||
      (cycle && isMemberOfCommittee(cycle, me._id)) ||
      (placement && placement.managerId === me._id);
    if (!allowed) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak mengubah item ini",
      });
    }
    const patch: Partial<Doc<"talentIdpItems">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.description !== undefined) patch.description = args.description;
    if (args.category !== undefined) patch.category = args.category;
    if (args.horizon !== undefined) patch.horizon = args.horizon;
    if (args.targetDate !== undefined) patch.targetDate = args.targetDate;
    if (args.status !== undefined) patch.status = args.status;
    if (args.progress !== undefined) patch.progress = args.progress;
    if (args.note !== undefined) patch.note = args.note;
    await ctx.db.patch(args.itemId, patch);
    return null;
  },
});

export const removeIdpItem = mutation({
  args: { itemId: v.id("talentIdpItems") },
  handler: async (ctx, args): Promise<null> => {
    await requireAuthUser(ctx);
    await ctx.db.delete(args.itemId);
    return null;
  },
});

// ---- Succession helpers -----------------------------------------------
// Returns ready-now candidates for a user's role, reading existing
// successionPlans table. Also looks at talentPlacements for high-potential
// suggestions when no plan exists.

export const getSuccessionForUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      candidate: Doc<"users"> | null;
      readiness: string;
      strengths?: string;
      development?: string;
      priority: number;
      plan: Doc<"successionPlans"> | null;
      latestBoxCode?: string;
    }>
  > => {
    await requireAuthUser(ctx);
    const plans = await ctx.db
      .query("successionPlans")
      .withIndex("by_incumbent", (q) => q.eq("incumbentId", args.userId))
      .collect();
    plans.sort((a, b) => a.priority - b.priority);
    const out: Array<{
      candidate: Doc<"users"> | null;
      readiness: string;
      strengths?: string;
      development?: string;
      priority: number;
      plan: Doc<"successionPlans"> | null;
      latestBoxCode?: string;
    }> = [];
    for (const p of plans) {
      const candidate = await ctx.db.get(p.candidateId);
      // Look up candidate's latest talent box
      const placements = await ctx.db
        .query("talentPlacements")
        .withIndex("by_user", (q) => q.eq("userId", p.candidateId))
        .collect();
      placements.sort((a, b) => b._creationTime - a._creationTime);
      const latest = placements.find((pl) => pl.boxCode);
      out.push({
        candidate,
        readiness: p.readiness,
        strengths: p.strengths,
        development: p.development,
        priority: p.priority,
        plan: p,
        latestBoxCode: latest?.boxCode,
      });
    }
    return out;
  },
});

export const upsertSuccessionCandidate = mutation({
  args: {
    incumbentId: v.id("users"),
    candidateId: v.id("users"),
    readiness: v.string(),
    strengths: v.optional(v.string()),
    development: v.optional(v.string()),
    priority: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"successionPlans">> => {
    const me = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("successionPlans")
      .withIndex("by_incumbent_and_candidate", (q) =>
        q.eq("incumbentId", args.incumbentId).eq("candidateId", args.candidateId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        readiness: args.readiness,
        strengths: args.strengths,
        development: args.development,
        priority: args.priority,
      });
      return existing._id;
    }
    return await ctx.db.insert("successionPlans", {
      incumbentId: args.incumbentId,
      candidateId: args.candidateId,
      readiness: args.readiness,
      strengths: args.strengths,
      development: args.development,
      priority: args.priority,
      createdBy: me._id,
    });
  },
});

export const removeSuccessionCandidate = mutation({
  args: { planId: v.id("successionPlans") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.planId);
    return null;
  },
});

// Global succession readiness overview (for analytics).
export const getSuccessionOverview = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalIncumbents: number;
    totalCandidates: number;
    byReadiness: Record<string, number>;
    positionsWithoutSuccessor: number;
  }> => {
    await requireAuthUser(ctx);
    const plans = await ctx.db.query("successionPlans").collect();
    const byReadiness: Record<string, number> = {};
    const incumbents = new Set<string>();
    for (const p of plans) {
      incumbents.add(p.incumbentId as unknown as string);
      byReadiness[p.readiness] = (byReadiness[p.readiness] ?? 0) + 1;
    }
    // Estimate uncovered roles: all supervisors/managers without a plan.
    const users = await ctx.db.query("users").collect();
    const leaders = users.filter(
      (u) =>
        u.jobTitle &&
        /(manager|head|lead|director|ceo|cto|cfo|supervisor)/i.test(
          u.jobTitle,
        ),
    );
    const uncovered = leaders.filter(
      (u) => !incumbents.has(u._id as unknown as string),
    ).length;
    return {
      totalIncumbents: incumbents.size,
      totalCandidates: plans.length,
      byReadiness,
      positionsWithoutSuccessor: uncovered,
    };
  },
});

// ---- History & timeline -----------------------------------------------

export type TalentMovementEntry = {
  placement: Doc<"talentPlacements">;
  cycle: Doc<"talentCycles"> | null;
};

export const getUserTalentHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Array<TalentMovementEntry>> => {
    await requireAuthUser(ctx);
    const rows = await ctx.db
      .query("talentPlacements")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const out: Array<TalentMovementEntry> = [];
    for (const r of rows) {
      const c = await ctx.db.get(r.cycleId);
      out.push({ placement: r, cycle: c });
    }
    return out;
  },
});
