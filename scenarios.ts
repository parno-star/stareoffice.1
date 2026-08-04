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
      message: "Hanya admin yang dapat mengelola skenario",
    });
  }
  return me;
}

type ScenarioSummary = {
  scenario: Doc<"orgScenarios">;
  creator: Doc<"users"> | null;
  changeCount: number;
  approvals: Array<{
    approval: Doc<"orgScenarioApprovals">;
    approver: Doc<"users"> | null;
  }>;
};

// List scenarios visible to user. Admins see everything. Approvers see
// scenarios where they are in the approval chain. Others see only their own.
export const listScenarios = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<ScenarioSummary>> => {
    const me = await requireAuthUser(ctx);
    const { userIds, isMember } = await getOrgScope(ctx);
    const canSeeAll = isAdminRole(me.role);
    let rows: Array<Doc<"orgScenarios">>;
    if (args.status) {
      rows = await ctx.db
        .query("orgScenarios")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      rows = await ctx.db.query("orgScenarios").collect();
    }
    // Tenant scope: only scenarios created by someone in the viewing org.
    if (userIds !== null) {
      rows = rows.filter((s) => isMember(s.createdById));
    }
    rows.sort((a, b) => b._creationTime - a._creationTime);

    const myApprovals = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_approver", (q) => q.eq("approverId", me._id))
      .collect();
    const scenarioIdsImApprover = new Set<string>(
      myApprovals.map((a) => a.scenarioId),
    );

    const visible = rows.filter((s) => {
      if (canSeeAll) return true;
      if (s.createdById === me._id) return true;
      if (scenarioIdsImApprover.has(s._id)) return true;
      return false;
    });

    const out: Array<ScenarioSummary> = [];
    for (const s of visible) {
      const creator = await ctx.db.get(s.createdById);
      const changes = await ctx.db
        .query("orgScenarioChanges")
        .withIndex("by_scenario", (q) => q.eq("scenarioId", s._id))
        .collect();
      const approvals = await ctx.db
        .query("orgScenarioApprovals")
        .withIndex("by_scenario", (q) => q.eq("scenarioId", s._id))
        .collect();
      approvals.sort((a, b) => a.order - b.order);
      const decoratedApprovals: Array<{
        approval: Doc<"orgScenarioApprovals">;
        approver: Doc<"users"> | null;
      }> = [];
      for (const a of approvals) {
        const approver = await ctx.db.get(a.approverId);
        decoratedApprovals.push({ approval: a, approver });
      }
      out.push({
        scenario: s,
        creator,
        changeCount: changes.length,
        approvals: decoratedApprovals,
      });
    }
    return out;
  },
});

export const getScenario = query({
  args: { scenarioId: v.id("orgScenarios") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    scenario: Doc<"orgScenarios"> | null;
    creator: Doc<"users"> | null;
    changes: Array<{
      change: Doc<"orgScenarioChanges">;
      user: Doc<"users"> | null;
      afterManager: Doc<"users"> | null;
    }>;
    approvals: Array<{
      approval: Doc<"orgScenarioApprovals">;
      approver: Doc<"users"> | null;
    }>;
  }> => {
    await requireAuthUser(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      return { scenario: null, creator: null, changes: [], approvals: [] };
    }
    const creator = await ctx.db.get(scenario.createdById);
    const rawChanges = await ctx.db
      .query("orgScenarioChanges")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    const changes: Array<{
      change: Doc<"orgScenarioChanges">;
      user: Doc<"users"> | null;
      afterManager: Doc<"users"> | null;
    }> = [];
    for (const c of rawChanges) {
      const user = await ctx.db.get(c.userId);
      const afterManager = c.afterManagerId
        ? await ctx.db.get(c.afterManagerId)
        : null;
      changes.push({ change: c, user, afterManager });
    }
    const approvalRows = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    approvalRows.sort((a, b) => a.order - b.order);
    const approvals: Array<{
      approval: Doc<"orgScenarioApprovals">;
      approver: Doc<"users"> | null;
    }> = [];
    for (const a of approvalRows) {
      const approver = await ctx.db.get(a.approverId);
      approvals.push({ approval: a, approver });
    }
    return { scenario, creator, changes, approvals };
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    draft: number;
    pending: number;
    approved: number;
    applied: number;
    rejected: number;
    myPendingApprovals: number;
  }> => {
    const me = await requireAuthUser(ctx);
    const { userIds, isMember } = await getOrgScope(ctx);
    const allScenarios = await ctx.db.query("orgScenarios").collect();
    const all =
      userIds === null
        ? allScenarios
        : allScenarios.filter((s) => isMember(s.createdById));
    let draft = 0,
      pending = 0,
      approved = 0,
      applied = 0,
      rejected = 0;
    for (const s of all) {
      if (s.status === "draft") draft += 1;
      else if (s.status === "pending") pending += 1;
      else if (s.status === "approved") approved += 1;
      else if (s.status === "applied") applied += 1;
      else if (s.status === "rejected") rejected += 1;
    }
    const myApprovals = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_approver_and_decision", (q) =>
        q.eq("approverId", me._id).eq("decision", "pending"),
      )
      .collect();
    // Only count those whose scenario is actively "pending"
    let myPendingApprovals = 0;
    for (const a of myApprovals) {
      const s = await ctx.db.get(a.scenarioId);
      if (s && s.status === "pending") myPendingApprovals += 1;
    }
    return {
      draft,
      pending,
      approved,
      applied,
      rejected,
      myPendingApprovals,
    };
  },
});

export const createScenario = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"orgScenarios">> => {
    const me = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama skenario minimal 2 karakter",
      });
    }
    return await ctx.db.insert("orgScenarios", {
      name,
      description: args.description?.trim() || undefined,
      status: "draft",
      createdById: me._id,
      effectiveDate: args.effectiveDate,
    });
  },
});

export const updateScenario = mutation({
  args: {
    scenarioId: v.id("orgScenarios"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Skenario tidak ditemukan",
      });
    }
    if (scenario.status !== "draft" && scenario.createdById !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya draft milik sendiri yang bisa diubah",
      });
    }
    const patch: Partial<Doc<"orgScenarios">> = {};
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (n.length < 2) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Nama skenario minimal 2 karakter",
        });
      }
      patch.name = n;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.effectiveDate !== undefined) {
      patch.effectiveDate = args.effectiveDate || undefined;
    }
    await ctx.db.patch(args.scenarioId, patch);
    return null;
  },
});

export const deleteScenario = mutation({
  args: { scenarioId: v.id("orgScenarios") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) return null;
    if (scenario.status === "applied") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Skenario yang sudah diterapkan tidak dapat dihapus",
      });
    }
    if (scenario.createdById !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berwenang",
      });
    }
    const changes = await ctx.db
      .query("orgScenarioChanges")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    for (const c of changes) await ctx.db.delete(c._id);
    const approvals = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    for (const a of approvals) await ctx.db.delete(a._id);
    await ctx.db.delete(args.scenarioId);
    return null;
  },
});

async function labelForUser(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users"> | undefined | null,
): Promise<string> {
  if (!userId) return "—";
  const u = await ctx.db.get(userId);
  return u?.name ?? "Tanpa Nama";
}

export const addChange = mutation({
  args: {
    scenarioId: v.id("orgScenarios"),
    changeType: v.string(), // "set_manager" | "set_department" | "set_job_title"
    userId: v.id("users"),
    afterValue: v.optional(v.string()),
    afterManagerId: v.optional(v.union(v.id("users"), v.null())),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"orgScenarioChanges">> => {
    await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Skenario tidak ditemukan",
      });
    }
    if (scenario.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Perubahan hanya bisa ditambahkan pada skenario draft",
      });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }
    let beforeValue: string | undefined;
    let afterValue: string | undefined = args.afterValue;
    if (args.changeType === "set_manager") {
      beforeValue = await labelForUser(ctx, target.managerId);
      afterValue =
        args.afterManagerId === null
          ? "— (tanpa atasan)"
          : args.afterManagerId
            ? await labelForUser(ctx, args.afterManagerId)
            : undefined;
    } else if (args.changeType === "set_department") {
      beforeValue = target.department ?? "—";
    } else if (args.changeType === "set_job_title") {
      beforeValue = target.jobTitle ?? "—";
    } else {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe perubahan tidak dikenal",
      });
    }
    return await ctx.db.insert("orgScenarioChanges", {
      scenarioId: args.scenarioId,
      changeType: args.changeType,
      userId: args.userId,
      beforeValue,
      afterValue,
      afterManagerId: args.afterManagerId ?? undefined,
      note: args.note?.trim() || undefined,
    });
  },
});

export const removeChange = mutation({
  args: { changeId: v.id("orgScenarioChanges") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const change = await ctx.db.get(args.changeId);
    if (!change) return null;
    const scenario = await ctx.db.get(change.scenarioId);
    if (!scenario || scenario.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya draft yang dapat diubah",
      });
    }
    await ctx.db.delete(args.changeId);
    return null;
  },
});

export const setApprovers = mutation({
  args: {
    scenarioId: v.id("orgScenarios"),
    approverIds: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Skenario tidak ditemukan",
      });
    }
    if (scenario.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Approver hanya dapat diatur di status draft",
      });
    }
    // Delete existing
    const existing = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    for (const a of existing) await ctx.db.delete(a._id);
    // Insert new
    const seen = new Set<string>();
    let order = 1;
    for (const uid of args.approverIds) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      await ctx.db.insert("orgScenarioApprovals", {
        scenarioId: args.scenarioId,
        approverId: uid,
        order,
        decision: "pending",
      });
      order += 1;
    }
    return null;
  },
});

export const submitForApproval = mutation({
  args: { scenarioId: v.id("orgScenarios") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Skenario tidak ditemukan",
      });
    }
    if (scenario.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya skenario draft yang dapat diajukan",
      });
    }
    const changes = await ctx.db
      .query("orgScenarioChanges")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    if (changes.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Skenario harus memiliki setidaknya 1 perubahan",
      });
    }
    const approvals = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    if (approvals.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Atur minimal 1 approver sebelum mengajukan",
      });
    }
    await ctx.db.patch(args.scenarioId, {
      status: "pending",
      submittedAt: new Date().toISOString(),
    });
    // Notify first approver
    const first = approvals.sort((a, b) => a.order - b.order)[0];
    if (first) {
      await ctx.db.insert("notifications", {
        userId: first.approverId,
        type: "scenario_approval",
        title: "Permintaan persetujuan skenario",
        message: `${me.name ?? "Admin"} mengajukan "${scenario.name}" untuk disetujui`,
        link: `/organization?tab=scenarios&id=${args.scenarioId}`,
        actorId: me._id,
      });
    }
    return null;
  },
});

export const decideApproval = mutation({
  args: {
    scenarioId: v.id("orgScenarios"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAuthUser(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Skenario tidak ditemukan",
      });
    }
    if (scenario.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Skenario tidak sedang menunggu persetujuan",
      });
    }
    const approvals = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    approvals.sort((a, b) => a.order - b.order);
    const myRow = approvals.find(
      (a) => a.approverId === me._id && a.decision === "pending",
    );
    if (!myRow) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan approver aktif pada skenario ini",
      });
    }
    // Ensure all earlier orders have approved already
    for (const a of approvals) {
      if (a.order < myRow.order && a.decision !== "approved") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Tunggu approver sebelumnya memutuskan terlebih dahulu",
        });
      }
    }
    const now = new Date().toISOString();
    await ctx.db.patch(myRow._id, {
      decision: args.approve ? "approved" : "rejected",
      note: args.note?.trim() || undefined,
      decidedAt: now,
    });
    if (!args.approve) {
      await ctx.db.patch(args.scenarioId, {
        status: "rejected",
        decidedAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: scenario.createdById,
        type: "scenario_rejected",
        title: "Skenario ditolak",
        message: `${me.name ?? "Approver"} menolak "${scenario.name}"`,
        link: `/organization?tab=scenarios&id=${args.scenarioId}`,
        actorId: me._id,
      });
      return null;
    }
    // If all approved, mark scenario approved
    const refreshed = await ctx.db
      .query("orgScenarioApprovals")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();
    const allApproved = refreshed.every((a) => a.decision === "approved");
    if (allApproved) {
      await ctx.db.patch(args.scenarioId, {
        status: "approved",
        decidedAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: scenario.createdById,
        type: "scenario_approved",
        title: "Skenario disetujui",
        message: `"${scenario.name}" telah disetujui sepenuhnya dan siap diterapkan`,
        link: `/organization?tab=scenarios&id=${args.scenarioId}`,
        actorId: me._id,
      });
    } else {
      // Notify next approver
      const next = refreshed
        .sort((a, b) => a.order - b.order)
        .find((a) => a.decision === "pending");
      if (next) {
        await ctx.db.insert("notifications", {
          userId: next.approverId,
          type: "scenario_approval",
          title: "Permintaan persetujuan skenario",
          message: `"${scenario.name}" menunggu persetujuan Anda`,
          link: `/organization?tab=scenarios&id=${args.scenarioId}`,
          actorId: me._id,
        });
      }
    }
    return null;
  },
});

export const cancelScenario = mutation({
  args: { scenarioId: v.id("orgScenarios") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) return null;
    if (scenario.status === "applied") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Skenario sudah diterapkan",
      });
    }
    if (scenario.createdById !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berwenang",
      });
    }
    await ctx.db.patch(args.scenarioId, {
      status: "cancelled",
      decidedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const applyScenario = mutation({
  args: { scenarioId: v.id("orgScenarios") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Skenario tidak ditemukan",
      });
    }
    if (scenario.status !== "approved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya skenario yang telah disetujui yang dapat diterapkan",
      });
    }
    const changes = await ctx.db
      .query("orgScenarioChanges")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();

    // Validate all changes first before mutating anything
    for (const c of changes) {
      const target = await ctx.db.get(c.userId);
      if (!target) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Salah satu karyawan target sudah tidak ada",
        });
      }
      if (c.changeType === "set_manager") {
        const newMgrId = c.afterManagerId ?? null;
        if (newMgrId && newMgrId === c.userId) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Karyawan tidak bisa menjadi atasan dirinya sendiri",
          });
        }
        if (newMgrId) {
          let cur: Id<"users"> | undefined = newMgrId;
          const seen = new Set<string>();
          while (cur) {
            if (cur === c.userId) {
              throw new ConvexError({
                code: "BAD_REQUEST",
                message:
                  "Perubahan membuat siklus pada hierarki. Periksa ulang skenario.",
              });
            }
            if (seen.has(cur)) break;
            seen.add(cur);
            const nxt: Doc<"users"> | null = await ctx.db.get(cur);
            cur = nxt?.managerId;
          }
        }
      }
    }

    // Apply
    const now = new Date().toISOString();
    for (const c of changes) {
      const target = await ctx.db.get(c.userId);
      if (!target) continue;
      if (c.changeType === "set_manager") {
        const prev = target.managerId;
        await ctx.db.patch(c.userId, {
          managerId: c.afterManagerId ?? undefined,
        });
        const newMgr = c.afterManagerId ? await ctx.db.get(c.afterManagerId) : null;
        const prevMgr = prev ? await ctx.db.get(prev) : null;
        await ctx.db.insert("orgHistory", {
          eventType: c.afterManagerId ? "manager_changed" : "manager_cleared",
          actorId: me._id,
          subjectType: "user",
          subjectName: target.name ?? "Tanpa Nama",
          summary: c.afterManagerId
            ? `Skenario "${scenario.name}": atasan ${target.name ?? "?"} → ${newMgr?.name ?? "?"} (dari ${prevMgr?.name ?? "—"})`
            : `Skenario "${scenario.name}": atasan ${target.name ?? "?"} dilepas (dari ${prevMgr?.name ?? "—"})`,
          timestamp: now,
        });
      } else if (c.changeType === "set_department") {
        const prev = target.department ?? "—";
        await ctx.db.patch(c.userId, {
          department: c.afterValue || undefined,
        });
        await ctx.db.insert("orgHistory", {
          eventType: "department_updated",
          actorId: me._id,
          subjectType: "user",
          subjectName: target.name ?? "Tanpa Nama",
          summary: `Skenario "${scenario.name}": departemen ${target.name ?? "?"} ${prev} → ${c.afterValue ?? "—"}`,
          timestamp: now,
        });
      } else if (c.changeType === "set_job_title") {
        await ctx.db.patch(c.userId, {
          jobTitle: c.afterValue || undefined,
        });
      }
    }

    await ctx.db.patch(args.scenarioId, {
      status: "applied",
      appliedAt: now,
    });
    await ctx.db.insert("notifications", {
      userId: scenario.createdById,
      type: "scenario_applied",
      title: "Skenario diterapkan",
      message: `"${scenario.name}" berhasil diterapkan ke struktur organisasi`,
      link: `/organization?tab=scenarios&id=${args.scenarioId}`,
      actorId: me._id,
    });
    return null;
  },
});
