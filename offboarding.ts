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

// ---- Constants ---------------------------------------------------------

export const EXIT_TYPES = [
  "resignation",
  "termination",
  "retirement",
  "contract_end",
  "mutual",
] as const;

export const REASON_CATEGORIES = [
  "voluntary",
  "involuntary",
  "retirement",
  "contract_end",
  "other",
] as const;

export const TASK_CATEGORIES = [
  "asset_return",
  "access_revoke",
  "handover",
  "payroll",
  "exit_interview",
  "it",
  "hr",
  "finance",
  "legal",
  "other",
] as const;

export const OWNER_ROLES = [
  "hr",
  "it",
  "manager",
  "employee",
  "finance",
  "legal",
  "other",
] as const;

// ---- Helpers -----------------------------------------------------------

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
      message: "Hanya admin/HR yang dapat melakukan tindakan ini",
    });
  }
  return user;
}

function dateIsoOffset(isoDate: string, offsetDays: number): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function calcTenureYears(startDate: string | undefined | null): number | undefined {
  if (!startDate) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return undefined;
  const [y, m, d] = startDate.split("-").map((n) => Number(n));
  const start = new Date(y, m - 1, d).getTime();
  const now = Date.now();
  const years = (now - start) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(Math.max(0, years) * 10) / 10;
}

// ---- Types -------------------------------------------------------------

export type ResignationWithUser = Omit<
  Doc<"resignationRequests">,
  "userJobTitle" | "userDepartment"
> & {
  userName: string;
  userAvatar: string | null;
  userEmail: string | null;
  userJobTitle: string | null;
  userDepartment: string | null;
  reviewerName: string | null;
};

export type CaseWithUser = Omit<
  Doc<"offboardingCases">,
  "userName" | "userDepartment" | "userJobTitle"
> & {
  userName: string;
  userDepartment: string | null;
  userJobTitle: string | null;
  userAvatar: string | null;
  userEmail: string | null;
  managerName: string | null;
  progress: { total: number; done: number; percent: number };
};

async function enrichResignations(
  ctx: QueryCtx,
  rows: Array<Doc<"resignationRequests">>,
): Promise<Array<ResignationWithUser>> {
  const cache = new Map<Id<"users">, Doc<"users"> | null>();
  const getU = async (id: Id<"users">) => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    cache.set(id, u);
    return u;
  };
  const out: Array<ResignationWithUser> = [];
  for (const r of rows) {
    const user = await getU(r.userId);
    const reviewer = r.reviewerId ? await getU(r.reviewerId) : null;
    out.push({
      ...r,
      userName: user?.name ?? r.userName,
      userAvatar: user?.avatarUrl ?? null,
      userEmail: user?.email ?? null,
      userJobTitle: user?.jobTitle ?? r.userJobTitle ?? null,
      userDepartment: user?.department ?? r.userDepartment ?? null,
      reviewerName: reviewer?.name ?? null,
    });
  }
  return out;
}

async function computeCaseProgress(
  ctx: QueryCtx,
  caseId: Id<"offboardingCases">,
): Promise<{ total: number; done: number; percent: number }> {
  const tasks = await ctx.db
    .query("offboardingTasks")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .take(500);
  const total = tasks.length;
  const done = tasks.filter(
    (t) => t.status === "done" || t.status === "skipped",
  ).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

async function enrichCases(
  ctx: QueryCtx,
  rows: Array<Doc<"offboardingCases">>,
): Promise<Array<CaseWithUser>> {
  const cache = new Map<Id<"users">, Doc<"users"> | null>();
  const getU = async (id: Id<"users">) => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    cache.set(id, u);
    return u;
  };
  const out: Array<CaseWithUser> = [];
  for (const r of rows) {
    const user = await getU(r.userId);
    const manager = r.managerId ? await getU(r.managerId) : null;
    const progress = await computeCaseProgress(ctx, r._id);
    out.push({
      ...r,
      userName: user?.name ?? r.userName,
      userDepartment: user?.department ?? r.userDepartment ?? null,
      userJobTitle: user?.jobTitle ?? r.userJobTitle ?? null,
      userAvatar: user?.avatarUrl ?? null,
      userEmail: user?.email ?? null,
      managerName: manager?.name ?? null,
      progress,
    });
  }
  return out;
}

// ---- Checklist Templates -----------------------------------------------

export const listTemplates = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Array<Doc<"offboardingChecklistTemplates">>> => {
    await requireUser(ctx);
    const all = await ctx.db
      .query("offboardingChecklistTemplates")
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
    ownerRole: v.string(),
    dueOffsetDays: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Id<"offboardingChecklistTemplates">> => {
    const admin = await requireAdmin(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    if (!TASK_CATEGORIES.includes(args.category as (typeof TASK_CATEGORIES)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    if (!OWNER_ROLES.includes(args.ownerRole as (typeof OWNER_ROLES)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Penanggung jawab tidak valid",
      });
    }
    const existing = await ctx.db
      .query("offboardingChecklistTemplates")
      .collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((t) => t.order)) + 1;
    return await ctx.db.insert("offboardingChecklistTemplates", {
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      ownerRole: args.ownerRole,
      dueOffsetDays: Math.round(args.dueOffsetDays),
      order: nextOrder,
      isActive: true,
      authorId: admin._id,
    });
  },
});

export const updateTemplate = mutation({
  args: {
    id: v.id("offboardingChecklistTemplates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    ownerRole: v.optional(v.string()),
    dueOffsetDays: v.optional(v.number()),
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
    const patch: Partial<Doc<"offboardingChecklistTemplates">> = {};
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
      if (!TASK_CATEGORIES.includes(args.category as (typeof TASK_CATEGORIES)[number])) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kategori tidak valid",
        });
      }
      patch.category = args.category;
    }
    if (args.ownerRole !== undefined) {
      if (!OWNER_ROLES.includes(args.ownerRole as (typeof OWNER_ROLES)[number])) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Penanggung jawab tidak valid",
        });
      }
      patch.ownerRole = args.ownerRole;
    }
    if (args.dueOffsetDays !== undefined) {
      patch.dueOffsetDays = Math.round(args.dueOffsetDays);
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const removeTemplate = mutation({
  args: { id: v.id("offboardingChecklistTemplates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Resignation Requests ----------------------------------------------

export const submitResignation = mutation({
  args: {
    exitType: v.string(),
    lastWorkingDay: v.string(),
    noticeDate: v.string(),
    reasonCategory: v.string(),
    reason: v.string(),
    futureEmployer: v.optional(v.string()),
    onBehalfOfUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"resignationRequests">> => {
    const actor = await requireUser(ctx);
    let targetUser: Doc<"users"> = actor;
    if (args.onBehalfOfUserId && args.onBehalfOfUserId !== actor._id) {
      if (!isAdminRole(actor.role)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Hanya admin yang dapat mengajukan atas nama karyawan lain",
        });
      }
      const target = await ctx.db.get(args.onBehalfOfUserId);
      if (!target) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Karyawan tidak ditemukan",
        });
      }
      targetUser = target;
    }
    if (!EXIT_TYPES.includes(args.exitType as (typeof EXIT_TYPES)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jenis exit tidak valid",
      });
    }
    if (
      !REASON_CATEGORIES.includes(
        args.reasonCategory as (typeof REASON_CATEGORIES)[number],
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori alasan tidak valid",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.lastWorkingDay)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal terakhir bekerja tidak valid",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.noticeDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal notice tidak valid",
      });
    }
    const reason = args.reason.trim();
    if (reason.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Alasan wajib diisi",
      });
    }
    // Prevent duplicate pending request for same user
    const existing = await ctx.db
      .query("resignationRequests")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", targetUser._id).eq("status", "pending"),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Sudah ada pengajuan yang menunggu review",
      });
    }

    const requestId = await ctx.db.insert("resignationRequests", {
      userId: targetUser._id,
      exitType: args.exitType,
      lastWorkingDay: args.lastWorkingDay,
      noticeDate: args.noticeDate,
      reasonCategory: args.reasonCategory,
      reason,
      futureEmployer: args.futureEmployer?.trim() || undefined,
      status: "pending",
      userName: targetUser.name ?? "Karyawan",
      userDepartment: targetUser.department,
      userJobTitle: targetUser.jobTitle,
      tenureYears: calcTenureYears(targetUser.startDate),
    });

    // Notify admins (best-effort: notify all admin-ish users)
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if (isAdminRole(u.role) && u._id !== actor._id) {
        await notifyUser(ctx, {
          userId: u._id,
          type: "offboarding_request",
          title: "Pengajuan resign baru",
          message: `${targetUser.name ?? "Karyawan"} mengajukan pengunduran diri`,
          link: "/offboarding",
          actorId: actor._id,
        });
      }
    }
    return requestId;
  },
});

export const withdrawResignation = mutation({
  args: { id: v.id("resignationRequests") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (req.userId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan tidak dapat dibatalkan",
      });
    }
    await ctx.db.patch(args.id, { status: "withdrawn" });
    return null;
  },
});

export const reviewResignation = mutation({
  args: {
    id: v.id("resignationRequests"),
    decision: v.string(), // "approve" | "reject"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"offboardingCases"> | null> => {
    const admin = await requireAdmin(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan sudah direview",
      });
    }
    const now = new Date().toISOString();
    if (args.decision === "reject") {
      await ctx.db.patch(args.id, {
        status: "rejected",
        reviewerId: admin._id,
        reviewedAt: now,
        reviewNote: args.note?.trim() || undefined,
      });
      await notifyUser(ctx, {
        userId: req.userId,
        type: "offboarding_rejected",
        title: "Pengajuan resign ditolak",
        message: args.note?.trim() || "Silakan diskusikan dengan atasan Anda.",
        link: "/offboarding",
        actorId: admin._id,
      });
      return null;
    }
    if (args.decision !== "approve") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Keputusan tidak valid",
      });
    }

    // Approve: create offboarding case & seed tasks.
    const caseId = await ctx.db.insert("offboardingCases", {
      userId: req.userId,
      resignationRequestId: req._id,
      exitType: req.exitType,
      lastWorkingDay: req.lastWorkingDay,
      startDate: now.slice(0, 10),
      managerId: undefined,
      status: "in_progress",
      totalTasks: 0,
      completedTasks: 0,
      userName: req.userName,
      userDepartment: req.userDepartment,
      userJobTitle: req.userJobTitle,
      tenureYears: req.tenureYears,
      exitInterviewStatus: "pending",
    });

    // Seed tasks from active templates
    const templates = await ctx.db
      .query("offboardingChecklistTemplates")
      .collect();
    const active = templates
      .filter((t) => t.isActive)
      .sort((a, b) => a.order - b.order);
    for (let i = 0; i < active.length; i += 1) {
      const t = active[i];
      await ctx.db.insert("offboardingTasks", {
        caseId,
        userId: req.userId,
        title: t.title,
        description: t.description,
        category: t.category,
        ownerRole: t.ownerRole,
        dueDate: dateIsoOffset(req.lastWorkingDay, t.dueOffsetDays),
        status: "todo",
        order: i,
      });
    }
    await ctx.db.patch(caseId, { totalTasks: active.length });

    // Seed exit interview record (pending)
    await ctx.db.insert("exitInterviews", {
      caseId,
      userId: req.userId,
      status: "pending",
      isAnonymous: false,
      userDepartment: req.userDepartment,
      tenureYears: req.tenureYears,
    });

    // Update resignation request
    await ctx.db.patch(args.id, {
      status: "approved",
      reviewerId: admin._id,
      reviewedAt: now,
      reviewNote: args.note?.trim() || undefined,
      caseId,
    });

    await notifyUser(ctx, {
      userId: req.userId,
      type: "offboarding_approved",
      title: "Pengajuan resign disetujui",
      message:
        "Checklist offboarding telah dibuat. Silakan lengkapi sebelum hari terakhir.",
      link: "/offboarding",
      actorId: admin._id,
    });

    return caseId;
  },
});

export const listResignations = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ResignationWithUser>> => {
    await requireAdmin(ctx);
    let rows: Array<Doc<"resignationRequests">>;
    if (args.status && args.status !== "all") {
      rows = await ctx.db
        .query("resignationRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(300);
    } else {
      rows = await ctx.db
        .query("resignationRequests")
        .order("desc")
        .take(300);
    }
    return await enrichResignations(ctx, rows);
  },
});

export const getMyResignations = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"resignationRequests">>> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("resignationRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    return rows;
  },
});

// ---- Offboarding Cases -------------------------------------------------

export const listCases = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<CaseWithUser>> => {
    await requireAdmin(ctx);
    let rows: Array<Doc<"offboardingCases">>;
    if (args.status && args.status !== "all") {
      rows = await ctx.db
        .query("offboardingCases")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(300);
    } else {
      rows = await ctx.db
        .query("offboardingCases")
        .order("desc")
        .take(300);
    }
    return await enrichCases(ctx, rows);
  },
});

export const getMyCase = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    | (CaseWithUser & {
        tasks: Array<Doc<"offboardingTasks">>;
        handovers: Array<Doc<"offboardingHandovers">>;
        exitInterview: Doc<"exitInterviews"> | null;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const cases = await ctx.db
      .query("offboardingCases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(5);
    const active = cases.find((c) => c.status === "in_progress") ?? cases[0];
    if (!active) return null;
    const enriched = await enrichCases(ctx, [active]);
    const tasks = await ctx.db
      .query("offboardingTasks")
      .withIndex("by_case", (q) => q.eq("caseId", active._id))
      .collect();
    tasks.sort((a, b) => a.order - b.order);
    const handovers = await ctx.db
      .query("offboardingHandovers")
      .withIndex("by_case", (q) => q.eq("caseId", active._id))
      .collect();
    handovers.sort((a, b) => a.order - b.order);
    const exitInterview = await ctx.db
      .query("exitInterviews")
      .withIndex("by_case", (q) => q.eq("caseId", active._id))
      .unique();
    return {
      ...enriched[0],
      tasks,
      handovers,
      exitInterview: exitInterview ?? null,
    };
  },
});

export const getCase = query({
  args: { id: v.id("offboardingCases") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (CaseWithUser & {
        tasks: Array<Doc<"offboardingTasks">>;
        handovers: Array<Doc<"offboardingHandovers">>;
        exitInterview: Doc<"exitInterviews"> | null;
      })
    | null
  > => {
    const viewer = await requireUser(ctx);
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    const isSelf = c.userId === viewer._id;
    const isMgr = c.managerId === viewer._id;
    if (!isSelf && !isMgr && !isAdminRole(viewer.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    const enriched = await enrichCases(ctx, [c]);
    const tasks = await ctx.db
      .query("offboardingTasks")
      .withIndex("by_case", (q) => q.eq("caseId", c._id))
      .collect();
    tasks.sort((a, b) => a.order - b.order);
    const handovers = await ctx.db
      .query("offboardingHandovers")
      .withIndex("by_case", (q) => q.eq("caseId", c._id))
      .collect();
    handovers.sort((a, b) => a.order - b.order);
    const exitInterview = await ctx.db
      .query("exitInterviews")
      .withIndex("by_case", (q) => q.eq("caseId", c._id))
      .unique();
    // Hide anonymous exit interview content from non-admins
    let ei = exitInterview;
    if (ei && ei.isAnonymous && !isAdminRole(viewer.role)) {
      ei = {
        ...ei,
        likedMost: undefined,
        areasForImprovement: undefined,
        whyLeaving: undefined,
        suggestions: undefined,
      };
    }
    return {
      ...enriched[0],
      tasks,
      handovers,
      exitInterview: ei ?? null,
    };
  },
});

export const updateCase = mutation({
  args: {
    id: v.id("offboardingCases"),
    managerId: v.optional(v.id("users")),
    status: v.optional(v.string()),
    closeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const c = await ctx.db.get(args.id);
    if (!c) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Case tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"offboardingCases">> = {};
    if (args.managerId !== undefined) patch.managerId = args.managerId;
    if (args.closeNote !== undefined) {
      patch.closeNote = args.closeNote.trim() || undefined;
    }
    if (args.status !== undefined) {
      if (!["in_progress", "completed", "cancelled"].includes(args.status)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Status tidak valid",
        });
      }
      patch.status = args.status;
      patch.completedAt =
        args.status === "completed"
          ? new Date().toISOString()
          : args.status === "cancelled"
            ? new Date().toISOString()
            : undefined;
      if (args.status === "completed") {
        await notifyUser(ctx, {
          userId: c.userId,
          type: "offboarding_completed",
          title: "Offboarding selesai",
          message: "Semua tugas offboarding telah diselesaikan. Terima kasih!",
          link: "/offboarding",
        });
      }
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

// ---- Tasks -------------------------------------------------------------

export const addCaseTask = mutation({
  args: {
    caseId: v.id("offboardingCases"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    ownerRole: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"offboardingTasks">> => {
    await requireAdmin(ctx);
    const c = await ctx.db.get(args.caseId);
    if (!c) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Case tidak ditemukan",
      });
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    const existing = await ctx.db
      .query("offboardingTasks")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((t) => t.order)) + 1;
    const taskId = await ctx.db.insert("offboardingTasks", {
      caseId: args.caseId,
      userId: c.userId,
      title,
      description: args.description?.trim() || undefined,
      category: args.category,
      ownerRole: args.ownerRole,
      dueDate: args.dueDate,
      status: "todo",
      order: nextOrder,
    });
    await ctx.db.patch(args.caseId, { totalTasks: existing.length + 1 });
    return taskId;
  },
});

export const updateTaskStatus = mutation({
  args: {
    id: v.id("offboardingTasks"),
    status: v.string(), // "todo" | "in_progress" | "done" | "skipped"
    note: v.optional(v.string()),
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
    const c = await ctx.db.get(task.caseId);
    const isAdmin = isAdminRole(user.role);
    const isOwner = task.userId === user._id;
    const isManager = c?.managerId === user._id;
    if (!isAdmin && !isOwner && !isManager) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (!["todo", "in_progress", "done", "skipped"].includes(args.status)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const now = new Date().toISOString();
    const isDone = args.status === "done" || args.status === "skipped";
    await ctx.db.patch(args.id, {
      status: args.status,
      completedAt: isDone ? now : undefined,
      completedBy: isDone ? user._id : undefined,
      note: args.note?.trim() || task.note,
    });
    // Update case counters
    if (c) {
      const all = await ctx.db
        .query("offboardingTasks")
        .withIndex("by_case", (q) => q.eq("caseId", c._id))
        .collect();
      const done = all.filter(
        (t) =>
          (t._id === args.id
            ? isDone
            : t.status === "done" || t.status === "skipped"),
      ).length;
      await ctx.db.patch(c._id, {
        completedTasks: done,
        totalTasks: all.length,
      });
    }
    return null;
  },
});

export const removeTask = mutation({
  args: { id: v.id("offboardingTasks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    await ctx.db.delete(args.id);
    const c = await ctx.db.get(task.caseId);
    if (c) {
      const all = await ctx.db
        .query("offboardingTasks")
        .withIndex("by_case", (q) => q.eq("caseId", c._id))
        .collect();
      const done = all.filter(
        (t) => t.status === "done" || t.status === "skipped",
      ).length;
      await ctx.db.patch(c._id, {
        totalTasks: all.length,
        completedTasks: done,
      });
    }
    return null;
  },
});

// ---- Handovers ---------------------------------------------------------

export const addHandover = mutation({
  args: {
    caseId: v.id("offboardingCases"),
    topic: v.string(),
    description: v.optional(v.string()),
    successorId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"offboardingHandovers">> => {
    const user = await requireUser(ctx);
    const c = await ctx.db.get(args.caseId);
    if (!c) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Case tidak ditemukan",
      });
    }
    const isOwner = c.userId === user._id;
    const isAdmin = isAdminRole(user.role);
    const isManager = c.managerId === user._id;
    if (!isOwner && !isAdmin && !isManager) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    const topic = args.topic.trim();
    if (topic.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Topik wajib diisi",
      });
    }
    const existing = await ctx.db
      .query("offboardingHandovers")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((h) => h.order)) + 1;
    return await ctx.db.insert("offboardingHandovers", {
      caseId: args.caseId,
      userId: c.userId,
      topic,
      description: args.description?.trim() || undefined,
      successorId: args.successorId,
      status: "pending",
      dueDate: args.dueDate,
      order: nextOrder,
    });
  },
});

export const updateHandover = mutation({
  args: {
    id: v.id("offboardingHandovers"),
    status: v.optional(v.string()),
    successorId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const h = await ctx.db.get(args.id);
    if (!h) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Handover tidak ditemukan",
      });
    }
    const c = await ctx.db.get(h.caseId);
    const isOwner = h.userId === user._id;
    const isAdmin = isAdminRole(user.role);
    const isManager = c?.managerId === user._id;
    if (!isOwner && !isAdmin && !isManager) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    const patch: Partial<Doc<"offboardingHandovers">> = {};
    if (args.status !== undefined) {
      if (!["pending", "in_progress", "completed"].includes(args.status)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Status tidak valid",
        });
      }
      patch.status = args.status;
    }
    if (args.successorId !== undefined) patch.successorId = args.successorId;
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const removeHandover = mutation({
  args: { id: v.id("offboardingHandovers") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const h = await ctx.db.get(args.id);
    if (!h) return null;
    const isOwner = h.userId === user._id;
    const isAdmin = isAdminRole(user.role);
    if (!isOwner && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Exit Interviews ---------------------------------------------------

export const submitExitInterview = mutation({
  args: {
    id: v.id("exitInterviews"),
    isAnonymous: v.boolean(),
    overallSatisfaction: v.optional(v.number()),
    recommendScore: v.optional(v.number()),
    wouldReturnScore: v.optional(v.number()),
    compensationRating: v.optional(v.number()),
    managementRating: v.optional(v.number()),
    workLifeBalanceRating: v.optional(v.number()),
    growthRating: v.optional(v.number()),
    cultureRating: v.optional(v.number()),
    primaryReason: v.optional(v.string()),
    likedMost: v.optional(v.string()),
    areasForImprovement: v.optional(v.string()),
    whyLeaving: v.optional(v.string()),
    suggestions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ei = await ctx.db.get(args.id);
    if (!ei) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Exit interview tidak ditemukan",
      });
    }
    if (ei.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (ei.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Exit interview sudah disubmit",
      });
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, {
      isAnonymous: args.isAnonymous,
      overallSatisfaction: args.overallSatisfaction,
      recommendScore: args.recommendScore,
      wouldReturnScore: args.wouldReturnScore,
      compensationRating: args.compensationRating,
      managementRating: args.managementRating,
      workLifeBalanceRating: args.workLifeBalanceRating,
      growthRating: args.growthRating,
      cultureRating: args.cultureRating,
      primaryReason: args.primaryReason,
      likedMost: args.likedMost?.trim() || undefined,
      areasForImprovement: args.areasForImprovement?.trim() || undefined,
      whyLeaving: args.whyLeaving?.trim() || undefined,
      suggestions: args.suggestions?.trim() || undefined,
      status: "submitted",
      submittedAt: now,
    });
    await ctx.db.patch(ei.caseId, { exitInterviewStatus: "submitted" });
    return null;
  },
});

export const reviewExitInterview = mutation({
  args: {
    id: v.id("exitInterviews"),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const ei = await ctx.db.get(args.id);
    if (!ei) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Exit interview tidak ditemukan",
      });
    }
    if (ei.status !== "submitted") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Exit interview belum disubmit",
      });
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, {
      status: "reviewed",
      reviewerId: admin._id,
      reviewedAt: now,
      reviewNote: args.reviewNote?.trim() || undefined,
    });
    await ctx.db.patch(ei.caseId, { exitInterviewStatus: "reviewed" });
    return null;
  },
});

// ---- Analytics ---------------------------------------------------------

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    pendingRequests: number;
    activeCases: number;
    completedCases: number;
    avgTenure: number | null;
    avgSatisfaction: number | null;
    avgRecommend: number | null;
    reasonBreakdown: Array<{ key: string; count: number }>;
    departmentBreakdown: Array<{ department: string; count: number }>;
  }> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      return {
        pendingRequests: 0,
        activeCases: 0,
        completedCases: 0,
        avgTenure: null,
        avgSatisfaction: null,
        avgRecommend: null,
        reasonBreakdown: [],
        departmentBreakdown: [],
      };
    }
    const reqs = await ctx.db.query("resignationRequests").collect();
    const cases = await ctx.db.query("offboardingCases").collect();
    const eis = await ctx.db.query("exitInterviews").collect();

    const pending = reqs.filter((r) => r.status === "pending").length;
    const active = cases.filter((c) => c.status === "in_progress").length;
    const completed = cases.filter((c) => c.status === "completed").length;

    const tenures = cases
      .map((c) => c.tenureYears)
      .filter((t): t is number => typeof t === "number");
    const avgTenure =
      tenures.length === 0
        ? null
        : Math.round(
            (tenures.reduce((a, b) => a + b, 0) / tenures.length) * 10,
          ) / 10;

    const submitted = eis.filter(
      (e) => e.status === "submitted" || e.status === "reviewed",
    );
    const sats = submitted
      .map((e) => e.overallSatisfaction)
      .filter((s): s is number => typeof s === "number");
    const avgSat =
      sats.length === 0
        ? null
        : Math.round((sats.reduce((a, b) => a + b, 0) / sats.length) * 10) / 10;
    const recs = submitted
      .map((e) => e.recommendScore)
      .filter((s): s is number => typeof s === "number");
    const avgRec =
      recs.length === 0
        ? null
        : Math.round((recs.reduce((a, b) => a + b, 0) / recs.length) * 10) / 10;

    const reasonMap = new Map<string, number>();
    for (const r of reqs) {
      if (r.status === "approved" || r.status === "completed") {
        reasonMap.set(
          r.reasonCategory,
          (reasonMap.get(r.reasonCategory) ?? 0) + 1,
        );
      }
    }
    const reasonBreakdown = Array.from(reasonMap.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const deptMap = new Map<string, number>();
    for (const c of cases) {
      const d = c.userDepartment ?? "Tidak diketahui";
      deptMap.set(d, (deptMap.get(d) ?? 0) + 1);
    }
    const departmentBreakdown = Array.from(deptMap.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);

    return {
      pendingRequests: pending,
      activeCases: active,
      completedCases: completed,
      avgTenure,
      avgSatisfaction: avgSat,
      avgRecommend: avgRec,
      reasonBreakdown,
      departmentBreakdown,
    };
  },
});

export const listSubmittedExitInterviews = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<
      Doc<"exitInterviews"> & {
        userName: string | null;
        userDepartmentDisplay: string | null;
      }
    >
  > => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("exitInterviews")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .order("desc")
      .take(200);
    const reviewed = await ctx.db
      .query("exitInterviews")
      .withIndex("by_status", (q) => q.eq("status", "reviewed"))
      .order("desc")
      .take(200);
    const all = [...rows, ...reviewed].sort(
      (a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""),
    );
    const out: Array<
      Doc<"exitInterviews"> & {
        userName: string | null;
        userDepartmentDisplay: string | null;
      }
    > = [];
    for (const ei of all) {
      if (ei.isAnonymous) {
        out.push({
          ...ei,
          userName: null,
          userDepartmentDisplay: ei.userDepartment ?? null,
        });
      } else {
        const u = await ctx.db.get(ei.userId);
        out.push({
          ...ei,
          userName: u?.name ?? null,
          userDepartmentDisplay: ei.userDepartment ?? u?.department ?? null,
        });
      }
    }
    return out;
  },
});
