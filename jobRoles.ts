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
      message: "Hanya admin yang dapat mengelola job description, SOP, dan KPI",
    });
  }
  return me;
}

// ---- Job roles ---------------------------------------------------------

export type JobRoleSummary = {
  role: Doc<"jobRoles">;
  sopCount: number;
  kpiCount: number;
  holderCount: number;
};

export const listRoles = query({
  args: { department: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<JobRoleSummary>> => {
    const { organizationId, users } = await getOrgScope(ctx);
    let roles: Array<Doc<"jobRoles">>;
    if (args.department !== undefined && args.department !== "") {
      roles = await ctx.db
        .query("jobRoles")
        .withIndex("by_department", (q) =>
          q.eq("department", args.department ?? ""),
        )
        .collect();
    } else {
      roles = await ctx.db.query("jobRoles").collect();
    }
    // Scope to the viewing org: keep roles whose department exists in the org,
    // plus company-wide roles (department === ""). When no org is in scope
    // (super admin without an active grant), show nothing.
    if (organizationId === null) {
      roles = [];
    } else {
      const orgDeptNames = new Set(
        users
          .map((u) => (u.department ?? "").trim())
          .filter((d) => d.length > 0),
      );
      roles = roles.filter(
        (r) => r.department === "" || orgDeptNames.has(r.department),
      );
    }
    const orgUsers = users;
    const result: Array<JobRoleSummary> = [];
    for (const r of roles) {
      const sops = await ctx.db
        .query("jobRoleSops")
        .withIndex("by_role", (q) => q.eq("roleId", r._id))
        .collect();
      const kpis = await ctx.db
        .query("jobRoleKpis")
        .withIndex("by_role", (q) => q.eq("roleId", r._id))
        .collect();
      const holderCount = orgUsers.filter((u) => {
        const titleMatch = (u.jobTitle ?? "").trim() === r.title;
        if (!titleMatch) return false;
        if (r.department === "") return true;
        return (u.department ?? "") === r.department;
      }).length;
      result.push({
        role: r,
        sopCount: sops.length,
        kpiCount: kpis.length,
        holderCount,
      });
    }
    result.sort((a, b) => {
      if (a.role.department !== b.role.department) {
        return a.role.department.localeCompare(b.role.department);
      }
      return a.role.title.localeCompare(b.role.title);
    });
    return result;
  },
});

export const getRole = query({
  args: { roleId: v.id("jobRoles") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    role: Doc<"jobRoles"> | null;
    sops: Array<Doc<"jobRoleSops">>;
    kpis: Array<Doc<"jobRoleKpis">>;
    holders: Array<Doc<"users">>;
  }> => {
    await requireAuthUser(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) return { role: null, sops: [], kpis: [], holders: [] };
    const sops = await ctx.db
      .query("jobRoleSops")
      .withIndex("by_role", (q) => q.eq("roleId", role._id))
      .collect();
    sops.sort((a, b) => {
      if (a.procedureName !== b.procedureName)
        return a.procedureName.localeCompare(b.procedureName);
      return a.order - b.order;
    });
    const kpis = await ctx.db
      .query("jobRoleKpis")
      .withIndex("by_role", (q) => q.eq("roleId", role._id))
      .collect();
    kpis.sort((a, b) => a.order - b.order);
    const users = await ctx.db.query("users").collect();
    const holders = users.filter((u) => {
      const titleMatch = (u.jobTitle ?? "").trim() === role.title;
      if (!titleMatch) return false;
      if (role.department === "") return true;
      return (u.department ?? "") === role.department;
    });
    holders.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return { role, sops, kpis, holders };
  },
});

// Lookup role for a specific user based on their jobTitle + department.
export const getRoleForUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    role: Doc<"jobRoles"> | null;
    sops: Array<Doc<"jobRoleSops">>;
    kpis: Array<Doc<"jobRoleKpis">>;
  }> => {
    await requireAuthUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || !user.jobTitle)
      return { role: null, sops: [], kpis: [] };
    const title = user.jobTitle.trim();
    if (title.length === 0) return { role: null, sops: [], kpis: [] };
    const dept = (user.department ?? "").trim();
    // First, try exact title + department match.
    let role: Doc<"jobRoles"> | null = null;
    if (dept.length > 0) {
      role = await ctx.db
        .query("jobRoles")
        .withIndex("by_title_and_department", (q) =>
          q.eq("title", title).eq("department", dept),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
    }
    // Fallback: company-wide role with empty department.
    if (!role) {
      role = await ctx.db
        .query("jobRoles")
        .withIndex("by_title_and_department", (q) =>
          q.eq("title", title).eq("department", ""),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
    }
    if (!role) return { role: null, sops: [], kpis: [] };
    const sops = await ctx.db
      .query("jobRoleSops")
      .withIndex("by_role", (q) => q.eq("roleId", role!._id))
      .collect();
    sops.sort((a, b) => {
      if (a.procedureName !== b.procedureName)
        return a.procedureName.localeCompare(b.procedureName);
      return a.order - b.order;
    });
    const kpis = await ctx.db
      .query("jobRoleKpis")
      .withIndex("by_role", (q) => q.eq("roleId", role!._id))
      .collect();
    kpis.sort((a, b) => a.order - b.order);
    return { role, sops, kpis };
  },
});

export const createRole = mutation({
  args: {
    title: v.string(),
    department: v.string(),
    level: v.string(),
    purpose: v.string(),
    responsibilities: v.string(),
    requirements: v.string(),
    extraNotes: v.optional(v.string()),
    color: v.string(),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"jobRoles">> => {
    const me = await requireAdmin(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul jabatan tidak boleh kosong",
      });
    }
    const dept = args.department.trim();
    const existing = await ctx.db
      .query("jobRoles")
      .withIndex("by_title_and_department", (q) =>
        q.eq("title", title).eq("department", dept),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Job description untuk jabatan dan departemen ini sudah ada",
      });
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("jobRoles", {
      title,
      department: dept,
      level: args.level,
      purpose: args.purpose,
      responsibilities: args.responsibilities,
      requirements: args.requirements,
      extraNotes: args.extraNotes,
      color: args.color,
      isActive: true,
      version: args.version ?? "1.0",
      authorId: me._id,
      lastEditorId: me._id,
      lastEditedAt: now,
    });
  },
});

export const updateRole = mutation({
  args: {
    roleId: v.id("jobRoles"),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    level: v.optional(v.string()),
    purpose: v.optional(v.string()),
    responsibilities: v.optional(v.string()),
    requirements: v.optional(v.string()),
    extraNotes: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"jobRoles">> => {
    const me = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.roleId);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Jabatan tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"jobRoles">> = {
      lastEditorId: me._id,
      lastEditedAt: new Date().toISOString(),
    };
    if (args.title !== undefined && args.title.trim().length > 0) {
      patch.title = args.title.trim();
    }
    if (args.department !== undefined) {
      patch.department = args.department.trim();
    }
    if (args.level !== undefined) patch.level = args.level;
    if (args.purpose !== undefined) patch.purpose = args.purpose;
    if (args.responsibilities !== undefined)
      patch.responsibilities = args.responsibilities;
    if (args.requirements !== undefined) patch.requirements = args.requirements;
    if (args.extraNotes !== undefined) patch.extraNotes = args.extraNotes;
    if (args.color !== undefined) patch.color = args.color;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.version !== undefined) patch.version = args.version;
    await ctx.db.patch(args.roleId, patch);
    return args.roleId;
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("jobRoles") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const sops = await ctx.db
      .query("jobRoleSops")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();
    for (const s of sops) await ctx.db.delete(s._id);
    const kpis = await ctx.db
      .query("jobRoleKpis")
      .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
      .collect();
    for (const k of kpis) {
      const measurements = await ctx.db
        .query("kpiMeasurements")
        .withIndex("by_kpi", (q) => q.eq("kpiId", k._id))
        .collect();
      for (const m of measurements) await ctx.db.delete(m._id);
      await ctx.db.delete(k._id);
    }
    await ctx.db.delete(args.roleId);
    return null;
  },
});

// ---- SOPs --------------------------------------------------------------

export const upsertSop = mutation({
  args: {
    sopId: v.optional(v.id("jobRoleSops")),
    roleId: v.id("jobRoles"),
    procedureName: v.string(),
    order: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    frequency: v.optional(v.string()),
    ownerRole: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"jobRoleSops">> => {
    await requireAdmin(ctx);
    if (args.sopId) {
      await ctx.db.patch(args.sopId, {
        procedureName: args.procedureName.trim(),
        order: args.order,
        title: args.title.trim(),
        description: args.description,
        frequency: args.frequency,
        ownerRole: args.ownerRole,
      });
      return args.sopId;
    }
    return await ctx.db.insert("jobRoleSops", {
      roleId: args.roleId,
      procedureName: args.procedureName.trim() || "SOP Utama",
      order: args.order,
      title: args.title.trim(),
      description: args.description,
      frequency: args.frequency,
      ownerRole: args.ownerRole,
    });
  },
});

export const deleteSop = mutation({
  args: { sopId: v.id("jobRoleSops") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.sopId);
    return null;
  },
});

export const reorderSops = mutation({
  args: {
    updates: v.array(
      v.object({ sopId: v.id("jobRoleSops"), order: v.number() }),
    ),
  },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    for (const u of args.updates) {
      await ctx.db.patch(u.sopId, { order: u.order });
    }
    return null;
  },
});

// ---- KPIs --------------------------------------------------------------

export const upsertKpi = mutation({
  args: {
    kpiId: v.optional(v.id("jobRoleKpis")),
    roleId: v.id("jobRoles"),
    name: v.string(),
    description: v.optional(v.string()),
    unit: v.string(),
    target: v.optional(v.number()),
    direction: v.string(),
    frequency: v.string(),
    priority: v.string(),
    weight: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"jobRoleKpis">> => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama KPI tidak boleh kosong",
      });
    }
    if (args.kpiId) {
      await ctx.db.patch(args.kpiId, {
        name,
        description: args.description,
        unit: args.unit,
        target: args.target,
        direction: args.direction,
        frequency: args.frequency,
        priority: args.priority,
        weight: args.weight,
        order: args.order,
      });
      return args.kpiId;
    }
    return await ctx.db.insert("jobRoleKpis", {
      roleId: args.roleId,
      name,
      description: args.description,
      unit: args.unit,
      target: args.target,
      direction: args.direction,
      frequency: args.frequency,
      priority: args.priority,
      weight: args.weight,
      order: args.order,
    });
  },
});

export const deleteKpi = mutation({
  args: { kpiId: v.id("jobRoleKpis") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const measurements = await ctx.db
      .query("kpiMeasurements")
      .withIndex("by_kpi", (q) => q.eq("kpiId", args.kpiId))
      .collect();
    for (const m of measurements) await ctx.db.delete(m._id);
    await ctx.db.delete(args.kpiId);
    return null;
  },
});

// ---- KPI measurements --------------------------------------------------

function deriveStatus(
  actual: number,
  target: number | undefined,
  direction: string,
): "on_track" | "at_risk" | "off_track" {
  if (target === undefined) return "on_track";
  if (direction === "higher_is_better") {
    if (actual >= target) return "on_track";
    if (actual >= target * 0.8) return "at_risk";
    return "off_track";
  }
  if (direction === "lower_is_better") {
    if (actual <= target) return "on_track";
    if (actual <= target * 1.2) return "at_risk";
    return "off_track";
  }
  // range: within ±15% of target
  const delta = Math.abs(actual - target);
  if (delta <= target * 0.1) return "on_track";
  if (delta <= target * 0.25) return "at_risk";
  return "off_track";
}

export const listMeasurementsForKpi = query({
  args: { kpiId: v.id("jobRoleKpis"), limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      measurement: Doc<"kpiMeasurements">;
      user: Doc<"users"> | null;
    }>
  > => {
    await requireAuthUser(ctx);
    const rows = await ctx.db
      .query("kpiMeasurements")
      .withIndex("by_kpi", (q) => q.eq("kpiId", args.kpiId))
      .collect();
    rows.sort((a, b) => {
      if (a.period !== b.period) return b.period.localeCompare(a.period);
      return b._creationTime - a._creationTime;
    });
    const limit = args.limit ?? 5;
    const limited = rows.slice(0, limit);
    const result: Array<{
      measurement: Doc<"kpiMeasurements">;
      user: Doc<"users"> | null;
    }> = [];
    for (const r of limited) {
      const u = await ctx.db.get(r.userId);
      result.push({ measurement: r, user: u });
    }
    return result;
  },
});

export const listMeasurementsForUser = query({
  args: { userId: v.id("users"), period: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      measurement: Doc<"kpiMeasurements">;
      kpi: Doc<"jobRoleKpis"> | null;
    }>
  > => {
    await requireAuthUser(ctx);
    let rows: Array<Doc<"kpiMeasurements">>;
    if (args.period) {
      rows = await ctx.db
        .query("kpiMeasurements")
        .withIndex("by_user_and_period", (q) =>
          q.eq("userId", args.userId).eq("period", args.period ?? ""),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("kpiMeasurements")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    }
    rows.sort((a, b) => b.period.localeCompare(a.period));
    const result: Array<{
      measurement: Doc<"kpiMeasurements">;
      kpi: Doc<"jobRoleKpis"> | null;
    }> = [];
    for (const r of rows) {
      const kpi = await ctx.db.get(r.kpiId);
      result.push({ measurement: r, kpi });
    }
    return result;
  },
});

export const upsertMeasurement = mutation({
  args: {
    kpiId: v.id("jobRoleKpis"),
    userId: v.id("users"),
    period: v.string(),
    periodLabel: v.string(),
    actualValue: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"kpiMeasurements">> => {
    const me = await requireAuthUser(ctx);
    const kpi = await ctx.db.get(args.kpiId);
    if (!kpi) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "KPI tidak ditemukan",
      });
    }
    // Only admins or the user's direct manager can record. (Here we allow
    // admins + the user themselves + their manager for flexibility.)
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }
    const allowed =
      isAdminRole(me.role) ||
      me._id === targetUser.managerId ||
      me._id === targetUser._id;
    if (!allowed) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak diizinkan mencatat KPI untuk karyawan ini",
      });
    }
    const status = deriveStatus(args.actualValue, kpi.target, kpi.direction);
    const existing = await ctx.db
      .query("kpiMeasurements")
      .withIndex("by_kpi_and_user_and_period", (q) =>
        q
          .eq("kpiId", args.kpiId)
          .eq("userId", args.userId)
          .eq("period", args.period),
      )
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        actualValue: args.actualValue,
        periodLabel: args.periodLabel,
        note: args.note,
        status,
        recordedById: me._id,
        recordedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("kpiMeasurements", {
      kpiId: args.kpiId,
      userId: args.userId,
      period: args.period,
      periodLabel: args.periodLabel,
      actualValue: args.actualValue,
      note: args.note,
      status,
      recordedById: me._id,
      recordedAt: now,
    });
  },
});

export const deleteMeasurement = mutation({
  args: { measurementId: v.id("kpiMeasurements") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAuthUser(ctx);
    const row = await ctx.db.get(args.measurementId);
    if (!row) return null;
    if (!isAdminRole(me.role) && row.recordedById !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak diizinkan menghapus pencatatan ini",
      });
    }
    await ctx.db.delete(args.measurementId);
    return null;
  },
});

// Global KPI summary for admin dashboards: average score per role.
export const getKpiSummary = query({
  args: { period: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    totalRoles: number;
    totalKpis: number;
    measurementsThisPeriod: number;
    onTrack: number;
    atRisk: number;
    offTrack: number;
  }> => {
    const { organizationId, users } = await getOrgScope(ctx);
    const memberIds = new Set(users.map((u) => u._id));
    const orgDeptNames = new Set(
      users.map((u) => (u.department ?? "").trim()).filter((d) => d.length > 0),
    );
    // No org in scope (super admin without an active grant) → empty summary.
    if (organizationId === null) {
      return {
        totalRoles: 0,
        totalKpis: 0,
        measurementsThisPeriod: 0,
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
      };
    }
    const allRoles = await ctx.db.query("jobRoles").collect();
    const roles = allRoles.filter(
      (r) => r.department === "" || orgDeptNames.has(r.department),
    );
    const roleIds = new Set(roles.map((r) => r._id));
    const allKpis = await ctx.db.query("jobRoleKpis").collect();
    const kpis = allKpis.filter((k) => roleIds.has(k.roleId));
    let rows: Array<Doc<"kpiMeasurements">>;
    if (args.period) {
      const period = args.period;
      rows = (await ctx.db.query("kpiMeasurements").collect()).filter(
        (m) => m.period === period,
      );
    } else {
      rows = await ctx.db.query("kpiMeasurements").collect();
    }
    // Only count measurements recorded for employees in the viewing org.
    rows = rows.filter((m) => memberIds.has(m.userId));
    let onTrack = 0;
    let atRisk = 0;
    let offTrack = 0;
    for (const r of rows) {
      if (r.status === "on_track") onTrack += 1;
      else if (r.status === "at_risk") atRisk += 1;
      else offTrack += 1;
    }
    return {
      totalRoles: roles.length,
      totalKpis: kpis.length,
      measurementsThisPeriod: rows.length,
      onTrack,
      atRisk,
      offTrack,
    };
  },
});
