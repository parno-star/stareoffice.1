import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyAdmins, notifyUser } from "./notifications";
import { canManageFinance, isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

export type CashAdvanceWithUser = Doc<"cashAdvances"> & {
  userName: string | null;
  userAvatar: string | null;
  reviewerName: string | null;
  disbursedByName: string | null;
  relatedExpenseCount: number;
  relatedExpenseTotal: number;
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

async function enrich(
  ctx: QueryCtx,
  advances: Array<Doc<"cashAdvances">>,
): Promise<Array<CashAdvanceWithUser>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = userCache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  };
  const results: Array<CashAdvanceWithUser> = [];
  for (const a of advances) {
    const user = await getUser(a.userId);
    const reviewer = a.reviewerId ? await getUser(a.reviewerId) : null;
    const disbursedBy = a.disbursedById ? await getUser(a.disbursedById) : null;
    const relatedExpenses = await ctx.db
      .query("expenseReports")
      .withIndex("by_cash_advance", (q) => q.eq("cashAdvanceId", a._id))
      .collect();
    const relatedExpenseTotal = relatedExpenses.reduce(
      (sum, e) => sum + e.amount,
      0,
    );
    results.push({
      ...a,
      userName: user?.name ?? null,
      userAvatar: user?.avatarUrl ?? null,
      reviewerName: reviewer?.name ?? null,
      disbursedByName: disbursedBy?.name ?? null,
      relatedExpenseCount: relatedExpenses.length,
      relatedExpenseTotal,
    });
  }
  return results;
}

export const listMine = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<CashAdvanceWithUser>> => {
    const user = await requireUser(ctx);
    let advances: Array<Doc<"cashAdvances">>;
    if (args.status && args.status !== "all") {
      advances = await ctx.db
        .query("cashAdvances")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status as string),
        )
        .order("desc")
        .take(200);
    } else {
      advances = await ctx.db
        .query("cashAdvances")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(200);
    }
    return await enrich(ctx, advances);
  },
});

export const listAll = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<CashAdvanceWithUser>> => {
    const user = await requireUser(ctx);
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat melihat semua uang muka",
      });
    }
    let advances: Array<Doc<"cashAdvances">>;
    if (args.status && args.status !== "all") {
      advances = await ctx.db
        .query("cashAdvances")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(300);
    } else {
      advances = await ctx.db
        .query("cashAdvances")
        .order("desc")
        .take(300);
    }
    return await enrich(ctx, advances);
  },
});

export const listApprovedForMe = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"cashAdvances">>> => {
    const user = await requireUser(ctx);
    // Return disbursed advances not yet settled that belong to current user
    const disbursed = await ctx.db
      .query("cashAdvances")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "disbursed"),
      )
      .order("desc")
      .take(50);
    return disbursed;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    purpose: v.string(),
    amount: v.number(),
    neededBy: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"cashAdvances">> => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    const purpose = args.purpose.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul uang muka wajib diisi",
      });
    }
    if (purpose.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tujuan penggunaan wajib diisi",
      });
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nominal harus lebih dari 0",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.neededBy)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal tidak valid",
      });
    }
    const id = await ctx.db.insert("cashAdvances", {
      userId: user._id,
      title,
      purpose,
      amount: Math.round(args.amount),
      neededBy: args.neededBy,
      status: "pending",
      userDepartment: user.department,
    });
    await notifyAdmins(ctx, {
      type: "expense_new",
      title: "Pengajuan uang muka baru",
      message: `${user.name ?? "Karyawan"} mengajukan uang muka "${title}"`,
      link: "/expenses",
      actorId: user._id,
    });
    return id;
  },
});

export const review = mutation({
  args: {
    id: v.id("cashAdvances"),
    status: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat memproses uang muka",
      });
    }
    if (args.status !== "approved" && args.status !== "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status review tidak valid",
      });
    }
    const advance = await ctx.db.get(args.id);
    if (!advance) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (advance.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya pengajuan pending yang dapat direview",
      });
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewerId: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.note?.trim() || undefined,
    });
    await notifyUser(ctx, {
      userId: advance.userId,
      type: "expense_reviewed",
      title:
        args.status === "approved"
          ? "Uang muka disetujui"
          : "Uang muka ditolak",
      message: `"${advance.title}"${args.note ? `: ${args.note}` : ""}`,
      link: "/expenses",
      actorId: user._id,
    });
    return null;
  },
});

export const disburse = mutation({
  args: { id: v.id("cashAdvances") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat mencairkan dana",
      });
    }
    const advance = await ctx.db.get(args.id);
    if (!advance) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (advance.status !== "approved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya pengajuan yang sudah disetujui yang dapat dicairkan",
      });
    }
    await ctx.db.patch(args.id, {
      status: "disbursed",
      disbursedAt: new Date().toISOString(),
      disbursedById: user._id,
    });
    await notifyUser(ctx, {
      userId: advance.userId,
      type: "expense_paid",
      title: "Uang muka sudah dicairkan",
      message: `Uang muka "${advance.title}" telah dicairkan`,
      link: "/expenses",
      actorId: user._id,
    });
    return null;
  },
});

export const settle = mutation({
  args: {
    id: v.id("cashAdvances"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const advance = await ctx.db.get(args.id);
    if (!advance) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    const isOwner = advance.userId === user._id;
    const allowed = canManageFinance(user.role) || isOwner;
    if (!allowed) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (advance.status !== "disbursed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya uang muka yang sudah dicairkan yang bisa diselesaikan",
      });
    }
    const related = await ctx.db
      .query("expenseReports")
      .withIndex("by_cash_advance", (q) => q.eq("cashAdvanceId", args.id))
      .collect();
    const settled = related.reduce((sum, e) => sum + e.amount, 0);

    await ctx.db.patch(args.id, {
      status: "settled",
      settledAt: new Date().toISOString(),
      settledAmount: settled,
      settlementNote: args.note?.trim() || undefined,
    });

    // Notify admins of settlement
    await notifyAdmins(ctx, {
      type: "expense_reviewed",
      title: "Uang muka diselesaikan",
      message: `"${advance.title}" diselesaikan dengan Rp ${settled.toLocaleString("id-ID")}`,
      link: "/expenses",
      actorId: user._id,
    });
    return null;
  },
});

export const cancel = mutation({
  args: { id: v.id("cashAdvances") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const advance = await ctx.db.get(args.id);
    if (!advance) return null;
    const isOwner = advance.userId === user._id;
    const isAdmin = isAdminRole(user.role) || canManageFinance(user.role);
    if (!isOwner && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (advance.status !== "pending" && !isAdmin) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya pengajuan pending yang bisa dibatalkan",
      });
    }
    if (advance.status === "settled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Uang muka yang sudah diselesaikan tidak bisa dibatalkan",
      });
    }
    await ctx.db.patch(args.id, { status: "cancelled" });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("cashAdvances") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const advance = await ctx.db.get(args.id);
    if (!advance) return null;
    const isOwner = advance.userId === user._id;
    const isAdmin = isAdminRole(user.role) || canManageFinance(user.role);
    if (!isOwner && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    if (!isAdmin && advance.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Uang muka yang sudah diproses tidak dapat dihapus",
      });
    }
    // Clear links on related expenses
    const related = await ctx.db
      .query("expenseReports")
      .withIndex("by_cash_advance", (q) => q.eq("cashAdvanceId", args.id))
      .collect();
    for (const e of related) {
      await ctx.db.patch(e._id, { cashAdvanceId: undefined });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    myPendingCount: number;
    myActiveCount: number;
    myOutstandingAmount: number;
    adminPendingCount: number;
    adminOutstandingAmount: number;
  }> => {
    const user = await requireUser(ctx);
    const mine = await ctx.db
      .query("cashAdvances")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);
    let myPendingCount = 0;
    let myActiveCount = 0;
    let myOutstandingAmount = 0;
    for (const a of mine) {
      if (a.status === "pending") myPendingCount += 1;
      if (a.status === "disbursed") {
        myActiveCount += 1;
        myOutstandingAmount += a.amount;
      }
    }
    let adminPendingCount = 0;
    let adminOutstandingAmount = 0;
    if (canManageFinance(user.role)) {
      const pending = await ctx.db
        .query("cashAdvances")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .take(500);
      adminPendingCount = pending.length;
      const disbursed = await ctx.db
        .query("cashAdvances")
        .withIndex("by_status", (q) => q.eq("status", "disbursed"))
        .take(500);
      adminOutstandingAmount = disbursed.reduce((s, a) => s + a.amount, 0);
    }
    return {
      myPendingCount,
      myActiveCount,
      myOutstandingAmount,
      adminPendingCount,
      adminOutstandingAmount,
    };
  },
});
