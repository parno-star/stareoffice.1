import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel.d.ts";
import {
  requireUser,
  requireOkrManager,
  canEditObjective,
  recomputeObjective,
  formatPeriodLabel,
  OKR_SCOPES,
  OKR_OBJECTIVE_STATUSES,
  OKR_CATEGORIES,
} from "./_helpers";
import { isAdminRole } from "../roles";

type OwnerInfo = {
  _id: Id<"users">;
  name?: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
};

async function enrichObjective(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  obj: Doc<"objectives">,
): Promise<
  Doc<"objectives"> & {
    owner: OwnerInfo | null;
  }
> {
  const owner = await ctx.db.get(obj.ownerId);
  return {
    ...obj,
    owner: owner
      ? {
          _id: owner._id,
          name: owner.name,
          avatarUrl: owner.avatarUrl,
          department: owner.department,
          jobTitle: owner.jobTitle,
        }
      : null,
  };
}

export const listObjectives = query({
  args: {
    period: v.optional(v.string()),
    scope: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let rows: Array<Doc<"objectives">>;
    if (args.ownerId && args.period) {
      rows = await ctx.db
        .query("objectives")
        .withIndex("by_owner_and_period", (q) =>
          q.eq("ownerId", args.ownerId as Id<"users">).eq("period", args.period as string),
        )
        .collect();
    } else if (args.ownerId) {
      rows = await ctx.db
        .query("objectives")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId as Id<"users">))
        .collect();
    } else if (args.scope && args.period) {
      rows = await ctx.db
        .query("objectives")
        .withIndex("by_scope_and_period", (q) =>
          q.eq("scope", args.scope as string).eq("period", args.period as string),
        )
        .collect();
    } else if (args.period) {
      rows = await ctx.db
        .query("objectives")
        .withIndex("by_period", (q) => q.eq("period", args.period as string))
        .collect();
    } else if (args.scope) {
      rows = await ctx.db
        .query("objectives")
        .withIndex("by_scope", (q) => q.eq("scope", args.scope as string))
        .collect();
    } else {
      rows = await ctx.db.query("objectives").collect();
    }
    if (args.status) {
      rows = rows.filter((o) => o.status === args.status);
    }
    // Enrich with owner details
    const enriched = await Promise.all(rows.map((o) => enrichObjective(ctx, o)));
    enriched.sort((a, b) => {
      if (a.period !== b.period) return b.period.localeCompare(a.period);
      return b._creationTime - a._creationTime;
    });
    return enriched;
  },
});

export const getObjective = query({
  args: { objectiveId: v.id("objectives") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) return null;
    const owner = await ctx.db.get(obj.ownerId);
    const author = await ctx.db.get(obj.authorId);
    const parent = obj.parentObjectiveId
      ? await ctx.db.get(obj.parentObjectiveId)
      : null;
    const children = await ctx.db
      .query("objectives")
      .withIndex("by_parent", (q) =>
        q.eq("parentObjectiveId", obj._id),
      )
      .collect();
    return {
      ...obj,
      owner: owner
        ? {
            _id: owner._id,
            name: owner.name,
            avatarUrl: owner.avatarUrl,
            department: owner.department,
            jobTitle: owner.jobTitle,
          }
        : null,
      author: author
        ? { _id: author._id, name: author.name, avatarUrl: author.avatarUrl }
        : null,
      parent: parent
        ? { _id: parent._id, title: parent.title, progress: parent.progress }
        : null,
      children: children.map((c) => ({
        _id: c._id,
        title: c.title,
        progress: c.progress,
        health: c.health,
      })),
    };
  },
});

export const listAvailablePeriods = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const objectives = await ctx.db.query("objectives").collect();
    const set = new Set<string>();
    for (const o of objectives) set.add(o.period);
    const arr = Array.from(set).sort().reverse();
    return arr.map((period) => ({
      period,
      label: formatPeriodLabel(period),
    }));
  },
});

export const listParentOptions = query({
  args: { period: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("objectives")
      .withIndex("by_period", (q) => q.eq("period", args.period))
      .collect();
    return rows
      .filter((o) => o.scope !== "individual" && o.status !== "archived")
      .map((o) => ({
        _id: o._id,
        title: o.title,
        scope: o.scope,
        period: o.period,
      }));
  },
});

export const createObjective = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    period: v.string(),
    periodLabel: v.optional(v.string()),
    scope: v.string(),
    ownerId: v.id("users"),
    department: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    parentObjectiveId: v.optional(v.id("objectives")),
    category: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Judul wajib diisi" });
    }
    if (!OKR_SCOPES.includes(args.scope as (typeof OKR_SCOPES)[number])) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Scope tidak valid" });
    }
    if (!OKR_CATEGORIES.includes(args.category as (typeof OKR_CATEGORIES)[number])) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Kategori tidak valid" });
    }
    // Company / department / team objectives require admin/supervisor
    if (args.scope !== "individual") {
      await requireOkrManager(ctx);
    }
    // Individual objectives: only admin/supervisor can set owner to another user
    if (args.scope === "individual" && args.ownerId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda hanya dapat membuat OKR pribadi untuk diri sendiri",
      });
    }
    const now = new Date().toISOString();
    const periodLabel =
      args.periodLabel && args.periodLabel.trim()
        ? args.periodLabel.trim()
        : formatPeriodLabel(args.period);
    const id = await ctx.db.insert("objectives", {
      title,
      description: args.description?.trim() || undefined,
      period: args.period,
      periodLabel,
      scope: args.scope,
      ownerId: args.ownerId,
      department: args.department?.trim() || undefined,
      teamId: args.teamId,
      parentObjectiveId: args.parentObjectiveId,
      status: "active",
      progress: 0,
      health: "on_track",
      color: args.color ?? "blue",
      icon: args.icon,
      category: args.category,
      startDate: args.startDate,
      endDate: args.endDate,
      keyResultCount: 0,
      authorId: user._id,
      lastUpdatedAt: now,
    });
    // Notify owner if different from author
    if (args.ownerId !== user._id) {
      await ctx.db.insert("notifications", {
        userId: args.ownerId,
        type: "okr_assigned",
        title: "OKR baru",
        message: `Anda menjadi pemilik OKR "${title}"`,
        link: `/okr?objective=${id}`,
        actorId: user._id,
      });
    }
    return id;
  },
});

export const updateObjective = mutation({
  args: {
    objectiveId: v.id("objectives"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    period: v.optional(v.string()),
    periodLabel: v.optional(v.string()),
    scope: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    department: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    parentObjectiveId: v.optional(v.union(v.id("objectives"), v.null())),
    category: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) throw new ConvexError({ code: "NOT_FOUND", message: "OKR tidak ditemukan" });
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak dapat mengedit OKR ini" });
    }
    // Scope change to non-individual requires manager permission
    if (args.scope && args.scope !== obj.scope && args.scope !== "individual") {
      await requireOkrManager(ctx);
    }
    const patch: Partial<Doc<"objectives">> = {
      lastUpdatedAt: new Date().toISOString(),
    };
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new ConvexError({ code: "BAD_REQUEST", message: "Judul wajib" });
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.period) {
      patch.period = args.period;
      patch.periodLabel =
        args.periodLabel?.trim() || formatPeriodLabel(args.period);
    } else if (args.periodLabel) {
      patch.periodLabel = args.periodLabel.trim();
    }
    if (args.scope) patch.scope = args.scope;
    if (args.ownerId) patch.ownerId = args.ownerId;
    if (args.department !== undefined) {
      patch.department = args.department.trim() || undefined;
    }
    if (args.teamId !== undefined) patch.teamId = args.teamId;
    if (args.parentObjectiveId !== undefined) {
      patch.parentObjectiveId = args.parentObjectiveId ?? undefined;
    }
    if (args.category) patch.category = args.category;
    if (args.color) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    await ctx.db.patch(args.objectiveId, patch);
  },
});

export const setObjectiveStatus = mutation({
  args: {
    objectiveId: v.id("objectives"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) throw new ConvexError({ code: "NOT_FOUND", message: "OKR tidak ditemukan" });
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak dapat mengubah status" });
    }
    if (!OKR_OBJECTIVE_STATUSES.includes(args.status as (typeof OKR_OBJECTIVE_STATUSES)[number])) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Status tidak valid" });
    }
    const now = new Date().toISOString();
    const patch: Partial<Doc<"objectives">> = {
      status: args.status,
      lastUpdatedAt: now,
    };
    if (args.status === "completed") patch.completedAt = now;
    if (args.status === "archived") patch.archivedAt = now;
    await ctx.db.patch(args.objectiveId, patch);
  },
});

export const deleteObjective = mutation({
  args: { objectiveId: v.id("objectives") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) return;
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak dapat menghapus OKR ini" });
    }
    // Delete all key results & check-ins first
    const krs = await ctx.db
      .query("keyResults")
      .withIndex("by_objective", (q) => q.eq("objectiveId", args.objectiveId))
      .collect();
    for (const kr of krs) {
      const checkins = await ctx.db
        .query("okrCheckins")
        .withIndex("by_key_result", (q) => q.eq("keyResultId", kr._id))
        .collect();
      for (const c of checkins) await ctx.db.delete(c._id);
      await ctx.db.delete(kr._id);
    }
    // Clear child parents (unlink)
    const children = await ctx.db
      .query("objectives")
      .withIndex("by_parent", (q) => q.eq("parentObjectiveId", args.objectiveId))
      .collect();
    for (const c of children) {
      await ctx.db.patch(c._id, { parentObjectiveId: undefined });
    }
    await ctx.db.delete(args.objectiveId);
  },
});

/** Recompute progress (useful after schema changes / manual fixes). */
export const recomputeObjectiveProgress = mutation({
  args: { objectiveId: v.id("objectives") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const obj = await ctx.db.get(args.objectiveId);
    if (!obj) return;
    if (!canEditObjective(user, obj)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Tidak diizinkan" });
    }
    await recomputeObjective(ctx, args.objectiveId);
  },
});
