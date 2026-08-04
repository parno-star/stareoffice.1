import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { canManageOperations } from "./roles";
import { requireTenant } from "./lib/tenant";

// ── Shared color whitelist (kept in sync with the frontend ops-utils.ts) ──
const VALID_COLORS = [
  "slate",
  "blue",
  "amber",
  "green",
  "orange",
  "red",
  "violet",
  "rose",
  "cyan",
  "teal",
  "indigo",
  "emerald",
];

// Built-in default task stages, used when an org has not customized theirs.
export const DEFAULT_TASK_STATUSES: Array<{
  key: string;
  label: string;
  color: string;
  order: number;
  isCompleted: boolean;
}> = [
  { key: "todo", label: "Belum Dimulai", color: "slate", order: 1, isCompleted: false },
  { key: "in_progress", label: "Dikerjakan", color: "blue", order: 2, isCompleted: false },
  { key: "review", label: "Peninjauan", color: "amber", order: 3, isCompleted: false },
  { key: "done", label: "Selesai", color: "green", order: 4, isCompleted: true },
];

// Built-in default task priorities. Higher order = more urgent (sorted first).
export const DEFAULT_TASK_PRIORITIES: Array<{
  key: string;
  label: string;
  color: string;
  order: number;
}> = [
  { key: "low", label: "Rendah", color: "slate", order: 1 },
  { key: "medium", label: "Sedang", color: "blue", order: 2 },
  { key: "high", label: "Tinggi", color: "orange", order: 3 },
  { key: "urgent", label: "Urgent", color: "red", order: 4 },
];

export type ResolvedStatus = {
  key: string;
  label: string;
  color: string;
  order: number;
  isActive: boolean;
  isCompleted: boolean;
  id: Id<"taskStatuses"> | null;
};

export type ResolvedPriority = {
  key: string;
  label: string;
  color: string;
  order: number;
  isActive: boolean;
  id: Id<"taskPriorities"> | null;
};

// ── Internal helpers ────────────────────────────────────────────────────────

async function requireOperationsAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!canManageOperations(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola tahapan & prioritas tugas",
    });
  }
  return user;
}

/** Effective task stages for an org (custom rows or built-in defaults). */
export async function resolveStatusesForOrg(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Array<ResolvedStatus>> {
  if (!organizationId) {
    return DEFAULT_TASK_STATUSES.map((s) => ({ ...s, isActive: true, id: null }));
  }
  const rows = await ctx.db
    .query("taskStatuses")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  if (rows.length === 0) {
    return DEFAULT_TASK_STATUSES.map((s) => ({ ...s, isActive: true, id: null }));
  }
  return rows
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      key: r.key,
      label: r.label,
      color: r.color,
      order: r.order,
      isActive: r.isActive,
      isCompleted: r.isCompleted,
      id: r._id,
    }));
}

/** Effective task priorities for an org (custom rows or built-in defaults). */
export async function resolvePrioritiesForOrg(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Array<ResolvedPriority>> {
  if (!organizationId) {
    return DEFAULT_TASK_PRIORITIES.map((p) => ({ ...p, isActive: true, id: null }));
  }
  const rows = await ctx.db
    .query("taskPriorities")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  if (rows.length === 0) {
    return DEFAULT_TASK_PRIORITIES.map((p) => ({ ...p, isActive: true, id: null }));
  }
  return rows
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      key: r.key,
      label: r.label,
      color: r.color,
      order: r.order,
      isActive: r.isActive,
      id: r._id,
    }));
}

/** Set of status keys that count as "completed / done" for an org. */
export async function getCompletedStatusKeys(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Set<string>> {
  const resolved = await resolveStatusesForOrg(ctx, organizationId);
  return new Set(resolved.filter((s) => s.isCompleted).map((s) => s.key));
}

/** The default (first active) status key a new task should start in. */
export async function getDefaultStatusKey(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<string> {
  const resolved = await resolveStatusesForOrg(ctx, organizationId);
  const firstActive = resolved.find((s) => s.isActive && !s.isCompleted);
  return firstActive?.key ?? resolved[0]?.key ?? "todo";
}

/** Map of priority key -> severity order for an org (higher = more urgent). */
export async function getPriorityOrderMap(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Record<string, number>> {
  const resolved = await resolvePrioritiesForOrg(ctx, organizationId);
  const map: Record<string, number> = {};
  for (const p of resolved) map[p.key] = p.order;
  return map;
}

/**
 * True when any task within the caller's organization uses the given status or
 * priority key. Tasks are not reliably org-tagged, so we scope through the
 * org's projects (bounded set) to avoid cross-tenant false positives.
 */
async function isKeyInUse(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
  field: "status" | "priority",
  key: string,
): Promise<boolean> {
  const allProjects = await ctx.db.query("projects").collect();
  const projects = organizationId
    ? allProjects.filter((p) => p.organizationId === organizationId)
    : allProjects;
  for (const project of projects) {
    const match = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .filter((q) => q.eq(q.field(field), key))
      .first();
    if (match) return true;
  }
  return false;
}

// ── Queries ─────────────────────────────────────────────────────────────────

// Combined config used by the operations UI. Available to any authenticated
// tenant so boards, cards and forms can render.
export const getConfig = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    statuses: Array<ResolvedStatus>;
    priorities: Array<ResolvedPriority>;
  }> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const [statuses, priorities] = await Promise.all([
      resolveStatusesForOrg(ctx, organizationId),
      resolvePrioritiesForOrg(ctx, organizationId),
    ]);
    return { statuses, priorities };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────

function cleanKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Materialize the default stages into real rows for the org (lazy seed). */
async function ensureStatusesSeeded(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const existing = await ctx.db
    .query("taskStatuses")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (existing) return;
  for (const s of DEFAULT_TASK_STATUSES) {
    await ctx.db.insert("taskStatuses", {
      organizationId,
      key: s.key,
      label: s.label,
      color: s.color,
      order: s.order,
      isActive: true,
      isCompleted: s.isCompleted,
    });
  }
}

/** Materialize the default priorities into real rows for the org (lazy seed). */
async function ensurePrioritiesSeeded(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const existing = await ctx.db
    .query("taskPriorities")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (existing) return;
  for (const p of DEFAULT_TASK_PRIORITIES) {
    await ctx.db.insert("taskPriorities", {
      organizationId,
      key: p.key,
      label: p.label,
      color: p.color,
      order: p.order,
      isActive: true,
    });
  }
}

// ── Status mutations ────────────────────────────────────────────────────────

export const createStatus = mutation({
  args: {
    label: v.string(),
    color: v.string(),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"taskStatuses">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organisasi belum ditentukan",
      });
    }
    await requireOperationsAdmin(ctx);

    const label = args.label.trim();
    if (label.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama tahapan minimal 2 karakter",
      });
    }
    if (!VALID_COLORS.includes(args.color)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Warna tidak valid" });
    }

    await ensureStatusesSeeded(ctx, organizationId);

    const key = cleanKey(label);
    if (!key || key.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama tahapan harus mengandung huruf atau angka",
      });
    }

    const existing = await ctx.db
      .query("taskStatuses")
      .withIndex("by_org_and_key", (q) =>
        q.eq("organizationId", organizationId).eq("key", key),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Tahapan "${label}" sudah ada`,
      });
    }

    const all = await ctx.db
      .query("taskStatuses")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const maxOrder = all.reduce((m, s) => Math.max(m, s.order), 0);

    return await ctx.db.insert("taskStatuses", {
      organizationId,
      key,
      label,
      color: args.color,
      order: maxOrder + 1,
      isActive: true,
      isCompleted: args.isCompleted ?? false,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("taskStatuses"),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"taskStatuses">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireOperationsAdmin(ctx);

    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tahapan tidak ditemukan" });
    }
    if (organizationId && row.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tahapan tidak ditemukan di organisasi Anda",
      });
    }

    const patch: Partial<Doc<"taskStatuses">> = {};
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (label.length < 2) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Nama tahapan minimal 2 karakter",
        });
      }
      patch.label = label;
    }
    if (args.color !== undefined) {
      if (!VALID_COLORS.includes(args.color)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Warna tidak valid" });
      }
      patch.color = args.color;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.isCompleted !== undefined) patch.isCompleted = args.isCompleted;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const removeStatus = mutation({
  args: { id: v.id("taskStatuses") },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireOperationsAdmin(ctx);

    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tahapan tidak ditemukan" });
    }
    if (organizationId && row.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tahapan tidak ditemukan di organisasi Anda",
      });
    }

    // Prevent deleting the last active stage.
    const all = await ctx.db
      .query("taskStatuses")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId!))
      .collect();
    const activeCount = all.filter((s) => s.isActive).length;
    if (row.isActive && activeCount <= 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Minimal satu tahapan harus tetap aktif",
      });
    }

    // Prevent deleting a stage that is in use; deactivate instead.
    const used = await isKeyInUse(ctx, organizationId, "status", row.key);
    if (used) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          "Tahapan sudah dipakai pada tugas. Non-aktifkan saja agar riwayat tetap utuh.",
      });
    }

    await ctx.db.delete(args.id);
  },
});

export const reorderStatuses = mutation({
  args: { orderedIds: v.array(v.id("taskStatuses")) },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireOperationsAdmin(ctx);

    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i];
      if (!id) continue;
      const row = await ctx.db.get(id);
      if (!row) continue;
      if (organizationId && row.organizationId !== organizationId) continue;
      await ctx.db.patch(id, { order: i + 1 });
    }
  },
});

// ── Priority mutations ──────────────────────────────────────────────────────

export const createPriority = mutation({
  args: {
    label: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"taskPriorities">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organisasi belum ditentukan",
      });
    }
    await requireOperationsAdmin(ctx);

    const label = args.label.trim();
    if (label.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama prioritas minimal 2 karakter",
      });
    }
    if (!VALID_COLORS.includes(args.color)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Warna tidak valid" });
    }

    await ensurePrioritiesSeeded(ctx, organizationId);

    const key = cleanKey(label);
    if (!key || key.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama prioritas harus mengandung huruf atau angka",
      });
    }

    const existing = await ctx.db
      .query("taskPriorities")
      .withIndex("by_org_and_key", (q) =>
        q.eq("organizationId", organizationId).eq("key", key),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Prioritas "${label}" sudah ada`,
      });
    }

    const all = await ctx.db
      .query("taskPriorities")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const maxOrder = all.reduce((m, p) => Math.max(m, p.order), 0);

    return await ctx.db.insert("taskPriorities", {
      organizationId,
      key,
      label,
      color: args.color,
      order: maxOrder + 1,
      isActive: true,
    });
  },
});

export const updatePriority = mutation({
  args: {
    id: v.id("taskPriorities"),
    label: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"taskPriorities">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireOperationsAdmin(ctx);

    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Prioritas tidak ditemukan" });
    }
    if (organizationId && row.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Prioritas tidak ditemukan di organisasi Anda",
      });
    }

    const patch: Partial<Doc<"taskPriorities">> = {};
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (label.length < 2) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Nama prioritas minimal 2 karakter",
        });
      }
      patch.label = label;
    }
    if (args.color !== undefined) {
      if (!VALID_COLORS.includes(args.color)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Warna tidak valid" });
      }
      patch.color = args.color;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const removePriority = mutation({
  args: { id: v.id("taskPriorities") },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireOperationsAdmin(ctx);

    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Prioritas tidak ditemukan" });
    }
    if (organizationId && row.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Prioritas tidak ditemukan di organisasi Anda",
      });
    }

    const all = await ctx.db
      .query("taskPriorities")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId!))
      .collect();
    const activeCount = all.filter((p) => p.isActive).length;
    if (row.isActive && activeCount <= 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Minimal satu prioritas harus tetap aktif",
      });
    }

    const used = await isKeyInUse(ctx, organizationId, "priority", row.key);
    if (used) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          "Prioritas sudah dipakai pada tugas. Non-aktifkan saja agar riwayat tetap utuh.",
      });
    }

    await ctx.db.delete(args.id);
  },
});

export const reorderPriorities = mutation({
  args: { orderedIds: v.array(v.id("taskPriorities")) },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireOperationsAdmin(ctx);

    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i];
      if (!id) continue;
      const row = await ctx.db.get(id);
      if (!row) continue;
      if (organizationId && row.organizationId !== organizationId) continue;
      await ctx.db.patch(id, { order: i + 1 });
    }
  },
});
