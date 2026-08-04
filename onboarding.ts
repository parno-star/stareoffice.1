import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

export type OnboardingWithUser = Doc<"onboardingEmployees"> & {
  userName: string | null;
  userAvatar: string | null;
  userEmail: string | null;
  userJobTitle: string | null;
  userDepartment: string | null;
  buddyName: string | null;
  buddyAvatar: string | null;
  managerName: string | null;
  progress: {
    total: number;
    done: number;
    percent: number;
  };
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

const VALID_CATEGORIES = [
  "paperwork",
  "equipment",
  "training",
  "meeting",
  "access",
  "other",
];
const VALID_OWNERS = ["hr", "it", "manager", "employee", "other"];
const VALID_PHASES = [
  "preboarding",
  "day_one",
  "first_week",
  "first_month",
  "first_quarter",
];

function phaseFromOffset(offset: number): string {
  if (offset < 0) return "preboarding";
  if (offset === 0) return "day_one";
  if (offset <= 7) return "first_week";
  if (offset <= 30) return "first_month";
  return "first_quarter";
}

function dateIsoOffset(isoDate: string, offsetDays: number): string {
  // isoDate: YYYY-MM-DD (interpreted as local date)
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function computeProgress(
  ctx: QueryCtx,
  onboardingId: Id<"onboardingEmployees">,
): Promise<{ total: number; done: number; percent: number }> {
  const tasks = await ctx.db
    .query("onboardingTasks")
    .withIndex("by_onboarding", (q) => q.eq("onboardingId", onboardingId))
    .take(500);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

async function enrichOnboardings(
  ctx: QueryCtx,
  records: Array<Doc<"onboardingEmployees">>,
): Promise<Array<OnboardingWithUser>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = userCache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  };
  const out: Array<OnboardingWithUser> = [];
  for (const r of records) {
    const user = await getUser(r.userId);
    const buddy = r.buddyId ? await getUser(r.buddyId) : null;
    const manager = r.managerId ? await getUser(r.managerId) : null;
    const progress = await computeProgress(ctx, r._id);
    out.push({
      ...r,
      userName: user?.name ?? null,
      userAvatar: user?.avatarUrl ?? null,
      userEmail: user?.email ?? null,
      userJobTitle: user?.jobTitle ?? null,
      userDepartment: user?.department ?? null,
      buddyName: buddy?.name ?? null,
      buddyAvatar: buddy?.avatarUrl ?? null,
      managerName: manager?.name ?? null,
      progress,
    });
  }
  return out;
}

// -------- Templates --------

export const listTemplates = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"onboardingTemplates">>> => {
    await requireUser(ctx);
    const all = await ctx.db
      .query("onboardingTemplates")
      .withIndex("by_order")
      .collect();
    return all.sort((a, b) => a.order - b.order);
  },
});

export const createTemplate = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    dueOffsetDays: v.number(),
    ownerRole: v.string(),
    phase: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"onboardingTemplates">> => {
    const user = await requireAdmin(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul tugas wajib diisi",
      });
    }
    if (!VALID_CATEGORIES.includes(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    if (!VALID_OWNERS.includes(args.ownerRole)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penanggung jawab tidak valid",
      });
    }
    if (args.phase !== undefined && !VALID_PHASES.includes(args.phase)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Fase tidak valid",
      });
    }
    // Place new template at the end
    const existing = await ctx.db.query("onboardingTemplates").collect();
    const nextOrder = existing.length === 0
      ? 0
      : Math.max(...existing.map((t) => t.order)) + 1;

    const offset = Math.round(args.dueOffsetDays);
    return await ctx.db.insert("onboardingTemplates", {
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      dueOffsetDays: offset,
      ownerRole: args.ownerRole,
      phase: args.phase ?? phaseFromOffset(offset),
      order: nextOrder,
      isActive: true,
      authorId: user._id,
    });
  },
});

export const updateTemplate = mutation({
  args: {
    id: v.id("onboardingTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    dueOffsetDays: v.optional(v.number()),
    ownerRole: v.optional(v.string()),
    phase: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tpl = await ctx.db.get(args.id);
    if (!tpl) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Template tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"onboardingTemplates">> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (t.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Judul tidak boleh kosong",
        });
      }
      patch.title = t;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.category !== undefined) {
      if (!VALID_CATEGORIES.includes(args.category)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kategori tidak valid",
        });
      }
      patch.category = args.category;
    }
    if (args.dueOffsetDays !== undefined) {
      patch.dueOffsetDays = Math.round(args.dueOffsetDays);
    }
    if (args.ownerRole !== undefined) {
      if (!VALID_OWNERS.includes(args.ownerRole)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Penanggung jawab tidak valid",
        });
      }
      patch.ownerRole = args.ownerRole;
    }
    if (args.phase !== undefined) {
      if (!VALID_PHASES.includes(args.phase)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Fase tidak valid",
        });
      }
      patch.phase = args.phase;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const removeTemplate = mutation({
  args: { id: v.id("onboardingTemplates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// -------- Employee onboardings --------

export const listActive = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<OnboardingWithUser>> => {
    await requireAdmin(ctx);
    let records: Array<Doc<"onboardingEmployees">>;
    if (args.status && args.status !== "all") {
      records = await ctx.db
        .query("onboardingEmployees")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(200);
    } else {
      records = await ctx.db
        .query("onboardingEmployees")
        .order("desc")
        .take(200);
    }
    return await enrichOnboardings(ctx, records);
  },
});

export const getMine = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    | (OnboardingWithUser & { tasks: Array<Doc<"onboardingTasks">> })
    | null
  > => {
    const user = await requireUser(ctx);
    const onb = await ctx.db
      .query("onboardingEmployees")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!onb) return null;
    const enriched = await enrichOnboardings(ctx, [onb]);
    const tasks = await ctx.db
      .query("onboardingTasks")
      .withIndex("by_onboarding", (q) => q.eq("onboardingId", onb._id))
      .collect();
    tasks.sort((a, b) => a.order - b.order);
    return { ...enriched[0], tasks };
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (OnboardingWithUser & { tasks: Array<Doc<"onboardingTasks">> })
    | null
  > => {
    const viewer = await requireUser(ctx);
    const isSelf = viewer._id === args.userId;
    const isAdmin = isAdminRole(viewer.role);
    if (!isSelf && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    const onb = await ctx.db
      .query("onboardingEmployees")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!onb) return null;
    const enriched = await enrichOnboardings(ctx, [onb]);
    const tasks = await ctx.db
      .query("onboardingTasks")
      .withIndex("by_onboarding", (q) => q.eq("onboardingId", onb._id))
      .collect();
    tasks.sort((a, b) => a.order - b.order);
    return { ...enriched[0], tasks };
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    activeCount: number;
    completedCount: number;
    templateCount: number;
    averageProgress: number;
  }> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      return {
        activeCount: 0,
        completedCount: 0,
        templateCount: 0,
        averageProgress: 0,
      };
    }
    const all = await ctx.db.query("onboardingEmployees").collect();
    const active = all.filter((o) => o.status === "active");
    const completed = all.filter((o) => o.status === "completed");
    const templates = await ctx.db.query("onboardingTemplates").collect();

    let totalPercent = 0;
    for (const o of active) {
      const p = await computeProgress(ctx, o._id);
      totalPercent += p.percent;
    }
    const avg = active.length === 0 ? 0 : Math.round(totalPercent / active.length);

    return {
      activeCount: active.length,
      completedCount: completed.length,
      templateCount: templates.length,
      averageProgress: avg,
    };
  },
});

export const startOnboarding = mutation({
  args: {
    userId: v.id("users"),
    startDate: v.string(),
    buddyId: v.optional(v.id("users")),
    managerId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"onboardingEmployees">> => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format tanggal mulai tidak valid",
      });
    }
    const existing = await ctx.db
      .query("onboardingEmployees")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Karyawan ini sudah memiliki onboarding",
      });
    }

    const onboardingId = await ctx.db.insert("onboardingEmployees", {
      userId: args.userId,
      startDate: args.startDate,
      buddyId: args.buddyId,
      managerId: args.managerId,
      status: "active",
      notes: args.notes?.trim() || undefined,
    });

    // Update user's startDate if not already set
    if (!target.startDate) {
      await ctx.db.patch(args.userId, { startDate: args.startDate });
    }

    // Seed tasks from active templates
    const templates = await ctx.db
      .query("onboardingTemplates")
      .collect();
    const active = templates
      .filter((t) => t.isActive)
      .sort((a, b) => a.order - b.order);
    for (let i = 0; i < active.length; i += 1) {
      const t = active[i];
      await ctx.db.insert("onboardingTasks", {
        onboardingId,
        userId: args.userId,
        title: t.title,
        description: t.description,
        category: t.category,
        ownerRole: t.ownerRole,
        phase: t.phase ?? phaseFromOffset(t.dueOffsetDays),
        dueDate: dateIsoOffset(args.startDate, t.dueOffsetDays),
        status: "todo",
        order: i,
      });
    }

    // Seed 30/60/90 check-ins
    const checkinPlan: Array<{ kind: string; label: string; days: number }> = [
      { kind: "day_30", label: "Check-in 30 Hari", days: 30 },
      { kind: "day_60", label: "Check-in 60 Hari", days: 60 },
      { kind: "day_90", label: "Check-in 90 Hari", days: 90 },
    ];
    for (const p of checkinPlan) {
      await ctx.db.insert("onboardingCheckins", {
        onboardingId,
        userId: args.userId,
        kind: p.kind,
        label: p.label,
        scheduledDate: dateIsoOffset(args.startDate, p.days),
        status: "pending",
      });
    }

    await notifyUser(ctx, {
      userId: args.userId,
      type: "onboarding_started",
      title: "Onboarding telah dimulai",
      message:
        "Selamat datang! Checklist onboarding Anda sudah siap untuk dilengkapi.",
      link: "/onboarding",
      actorId: admin._id,
    });

    return onboardingId;
  },
});

export const updateOnboarding = mutation({
  args: {
    id: v.id("onboardingEmployees"),
    buddyId: v.optional(v.id("users")),
    managerId: v.optional(v.id("users")),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const onb = await ctx.db.get(args.id);
    if (!onb) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Onboarding tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"onboardingEmployees">> = {};
    if (args.buddyId !== undefined) patch.buddyId = args.buddyId;
    if (args.managerId !== undefined) patch.managerId = args.managerId;
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    if (args.status !== undefined) {
      if (!["active", "completed", "paused"].includes(args.status)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Status tidak valid",
        });
      }
      patch.status = args.status;
      patch.completedAt =
        args.status === "completed" ? new Date().toISOString() : undefined;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const removeOnboarding = mutation({
  args: { id: v.id("onboardingEmployees") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tasks = await ctx.db
      .query("onboardingTasks")
      .withIndex("by_onboarding", (q) => q.eq("onboardingId", args.id))
      .collect();
    for (const t of tasks) {
      await ctx.db.delete(t._id);
    }
    const checkins = await ctx.db
      .query("onboardingCheckins")
      .withIndex("by_onboarding", (q) => q.eq("onboardingId", args.id))
      .collect();
    for (const c of checkins) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// -------- Task operations --------

export const toggleTask = mutation({
  args: {
    id: v.id("onboardingTasks"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tugas tidak ditemukan",
      });
    }
    const isOwner = task.userId === user._id;
    const isAdmin = isAdminRole(user.role);
    const onb = await ctx.db.get(task.onboardingId);
    const isBuddy = onb?.buddyId === user._id;
    const isManager = onb?.managerId === user._id;
    if (!isOwner && !isAdmin && !isBuddy && !isManager) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    const nextStatus = task.status === "done" ? "todo" : "done";
    await ctx.db.patch(args.id, {
      status: nextStatus,
      completedAt:
        nextStatus === "done" ? new Date().toISOString() : undefined,
      completedBy: nextStatus === "done" ? user._id : undefined,
    });

    // Auto-complete onboarding when all tasks done
    if (nextStatus === "done" && onb && onb.status === "active") {
      const allTasks = await ctx.db
        .query("onboardingTasks")
        .withIndex("by_onboarding", (q) => q.eq("onboardingId", onb._id))
        .collect();
      const allDone = allTasks.every((t) =>
        t._id === args.id ? true : t.status === "done",
      );
      if (allDone) {
        await ctx.db.patch(onb._id, {
          status: "completed",
          completedAt: new Date().toISOString(),
        });
        await notifyUser(ctx, {
          userId: onb.userId,
          type: "onboarding_completed",
          title: "Selamat! Onboarding selesai",
          message:
            "Anda telah menyelesaikan semua tugas onboarding. Semangat bekerja!",
          link: "/onboarding",
          actorId: user._id,
        });
      }
    }
    return null;
  },
});

export const addCustomTask = mutation({
  args: {
    onboardingId: v.id("onboardingEmployees"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    ownerRole: v.string(),
    phase: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"onboardingTasks">> => {
    await requireAdmin(ctx);
    const onb = await ctx.db.get(args.onboardingId);
    if (!onb) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Onboarding tidak ditemukan",
      });
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    if (args.phase !== undefined && !VALID_PHASES.includes(args.phase)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Fase tidak valid",
      });
    }
    const existing = await ctx.db
      .query("onboardingTasks")
      .withIndex("by_onboarding", (q) =>
        q.eq("onboardingId", args.onboardingId),
      )
      .collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((t) => t.order)) + 1;
    // Derive phase from dueDate - startDate if not provided
    let phase = args.phase;
    if (!phase && args.dueDate) {
      const [sy, sm, sd] = onb.startDate.split("-").map((n) => Number(n));
      const [dy, dm, dd] = args.dueDate.split("-").map((n) => Number(n));
      const diff = Math.round(
        (new Date(dy, dm - 1, dd).getTime() -
          new Date(sy, sm - 1, sd).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      phase = phaseFromOffset(diff);
    }
    return await ctx.db.insert("onboardingTasks", {
      onboardingId: args.onboardingId,
      userId: onb.userId,
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      ownerRole: args.ownerRole,
      phase: phase ?? "first_week",
      dueDate: args.dueDate,
      status: "todo",
      order: nextOrder,
    });
  },
});

export const removeTask = mutation({
  args: { id: v.id("onboardingTasks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});
