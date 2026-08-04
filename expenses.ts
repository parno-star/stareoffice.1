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
import { getActiveCategoryKeys } from "./expenseCategories";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

export type ExpenseWithUser = Doc<"expenseReports"> & {
  userName: string | null;
  userAvatar: string | null;
  reviewerName: string | null;
  receiptUrl: string | null;
  cashAdvanceTitle: string | null;
};

const VALID_PAYMENT_METHODS = ["transfer", "cash", "petty_cash", "other"];

async function enrichExpenses(
  ctx: QueryCtx,
  expenses: Array<Doc<"expenseReports">>,
): Promise<Array<ExpenseWithUser>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const advanceCache = new Map<Id<"cashAdvances">, Doc<"cashAdvances"> | null>();
  const getUser = async (id: Id<"users">) => {
    const cached = userCache.get(id);
    if (cached !== undefined) return cached;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  };
  const results: Array<ExpenseWithUser> = [];
  for (const e of expenses) {
    const user = await getUser(e.userId);
    const reviewer = e.reviewerId ? await getUser(e.reviewerId) : null;
    const receiptUrl = e.receiptStorageId
      ? await ctx.storage.getUrl(e.receiptStorageId)
      : null;
    let advance: Doc<"cashAdvances"> | null = null;
    if (e.cashAdvanceId) {
      const cached = advanceCache.get(e.cashAdvanceId);
      if (cached !== undefined) {
        advance = cached;
      } else {
        advance = await ctx.db.get(e.cashAdvanceId);
        advanceCache.set(e.cashAdvanceId, advance);
      }
    }
    results.push({
      ...e,
      userName: user?.name ?? null,
      userAvatar: user?.avatarUrl ?? null,
      reviewerName: reviewer?.name ?? null,
      receiptUrl,
      cashAdvanceTitle: advance?.title ?? null,
    });
  }
  return results;
}

async function getActivePolicy(
  ctx: QueryCtx | MutationCtx,
  category: string,
): Promise<Doc<"expensePolicies"> | null> {
  const p = await ctx.db
    .query("expensePolicies")
    .withIndex("by_category", (q) => q.eq("category", category))
    .unique();
  return p && p.isActive ? p : null;
}

async function sumCurrentMonthForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  category: string,
  dateIso: string,
): Promise<number> {
  // dateIso = YYYY-MM-DD
  const [y, m] = dateIso.split("-");
  const prefix = `${y}-${m}`;
  const all = await ctx.db
    .query("expenseReports")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(500);
  return all
    .filter(
      (e) =>
        e.category === category &&
        e.expenseDate.startsWith(prefix) &&
        e.status !== "rejected",
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireTenant(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    category: v.string(),
    amount: v.number(),
    expenseDate: v.string(),
    description: v.string(),
    receiptStorageId: v.optional(v.id("_storage")),
    receiptFileName: v.optional(v.string()),
    cashAdvanceId: v.optional(v.id("cashAdvances")),
  },
  handler: async (ctx, args): Promise<Id<"expenseReports">> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul pengeluaran wajib diisi",
      });
    }
    const activeCategoryKeys = await getActiveCategoryKeys(ctx, organizationId);
    if (!activeCategoryKeys.has(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    const amount = Math.round(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nominal harus lebih dari 0",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.expenseDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal pengeluaran tidak valid",
      });
    }

    // Validate against active policy
    const policy = await getActivePolicy(ctx, args.category);
    if (policy) {
      if (policy.maxAmountPerRequest && amount > policy.maxAmountPerRequest) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Nominal melebihi batas maksimal per pengajuan (Rp ${policy.maxAmountPerRequest.toLocaleString("id-ID")})`,
        });
      }
      if (
        policy.receiptRequiredAbove !== undefined &&
        amount > policy.receiptRequiredAbove &&
        !args.receiptStorageId
      ) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Bukti / kuitansi wajib untuk pengeluaran di atas Rp ${policy.receiptRequiredAbove.toLocaleString("id-ID")}`,
        });
      }
      if (policy.requireDescription && args.description.trim().length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Deskripsi wajib diisi untuk kategori ini",
        });
      }
      if (policy.monthlyLimitPerUser) {
        const existing = await sumCurrentMonthForUser(
          ctx,
          user._id,
          args.category,
          args.expenseDate,
        );
        if (existing + amount > policy.monthlyLimitPerUser) {
          const remaining = Math.max(
            policy.monthlyLimitPerUser - existing,
            0,
          );
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: `Melebihi batas bulanan. Sisa kuota: Rp ${remaining.toLocaleString("id-ID")}`,
          });
        }
      }
    }

    // Validate cash advance link if provided
    if (args.cashAdvanceId) {
      const adv = await ctx.db.get(args.cashAdvanceId);
      if (!adv || adv.userId !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Uang muka tidak valid",
        });
      }
      if (adv.status !== "disbursed") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Uang muka belum dicairkan atau sudah diselesaikan",
        });
      }
    }

    // Enforce plan storage limit when a receipt file is attached.
    if (args.receiptStorageId) {
      const incomingBytes = await getStorageSizeBytes(ctx, args.receiptStorageId);
      await assertStorageWithinLimit(ctx, organizationId, incomingBytes);
    }

    const id = await ctx.db.insert("expenseReports", {
      userId: user._id,
      title,
      category: args.category,
      amount,
      expenseDate: args.expenseDate,
      description: args.description.trim(),
      receiptStorageId: args.receiptStorageId,
      receiptFileName: args.receiptFileName,
      status: "pending",
      cashAdvanceId: args.cashAdvanceId,
      userDepartment: user.department,
      organizationId: organizationId ?? undefined,
    });

    if (args.receiptStorageId) {
      await trackStorageAdded(ctx, organizationId, args.receiptStorageId);
    }

    await notifyAdmins(ctx, {
      type: "expense_new",
      title: "Pengajuan reimbursement baru",
      message: `${user.name ?? "Karyawan"} mengajukan "${title}"`,
      link: "/expenses",
      actorId: user._id,
    });

    return id;
  },
});

export const listMine = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ExpenseWithUser>> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    let expenses: Array<Doc<"expenseReports">>;
    if (args.status && args.status !== "all") {
      expenses = await ctx.db
        .query("expenseReports")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status as string),
        )
        .order("desc")
        .take(200);
    } else {
      expenses = await ctx.db
        .query("expenseReports")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(200);
    }
    return await enrichExpenses(ctx, expenses);
  },
});

export const listAll = query({
  args: {
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    department: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ExpenseWithUser>> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat melihat semua pengajuan",
      });
    }
    let expenses: Array<Doc<"expenseReports">>;
    if (organizationId !== null) {
      // Org-scoped: use by_organization index, filter status in memory
      expenses = await ctx.db
        .query("expenseReports")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(500);
    } else if (args.status && args.status !== "all") {
      expenses = await ctx.db
        .query("expenseReports")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .order("desc")
        .take(500);
    } else {
      expenses = await ctx.db
        .query("expenseReports")
        .order("desc")
        .take(500);
    }
    // Apply additional in-memory filters
    expenses = expenses.filter((e) => {
      if (args.status && args.status !== "all" && e.status !== args.status) return false;
      if (args.category && args.category !== "all" && e.category !== args.category) return false;
      if (args.department && args.department !== "all" && (e.userDepartment ?? "") !== args.department) return false;
      if (args.userId && e.userId !== args.userId) return false;
      if (args.startDate && e.expenseDate < args.startDate) return false;
      if (args.endDate && e.expenseDate > args.endDate) return false;
      return true;
    });
    return await enrichExpenses(ctx, expenses);
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    myTotal: number;
    myPending: number;
    myApprovedAmount: number;
    myPaidAmount: number;
    adminPendingCount: number;
    adminPendingAmount: number;
  }> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const mine = await ctx.db
      .query("expenseReports")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    let myPending = 0;
    let myApprovedAmount = 0;
    let myPaidAmount = 0;
    for (const e of mine) {
      if (e.status === "pending") myPending += 1;
      if (e.status === "approved") myApprovedAmount += e.amount;
      if (e.status === "paid") myPaidAmount += e.amount;
    }

    let adminPendingCount = 0;
    let adminPendingAmount = 0;
    if (canManageFinance(user.role)) {
      let pending: Array<Doc<"expenseReports">>;
      if (organizationId !== null) {
        const orgExpenses = await ctx.db
          .query("expenseReports")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .take(500);
        pending = orgExpenses.filter((e) => e.status === "pending");
      } else {
        pending = await ctx.db
          .query("expenseReports")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .take(500);
      }
      adminPendingCount = pending.length;
      adminPendingAmount = pending.reduce((sum, e) => sum + e.amount, 0);
    }

    return {
      myTotal: mine.length,
      myPending,
      myApprovedAmount,
      myPaidAmount,
      adminPendingCount,
      adminPendingAmount,
    };
  },
});

// Lightweight sidebar badge count for "Reimbursement".
// Only finance managers/admins have an approval queue here, so regular users
// get 0. Safe for the always-rendered sidebar: never throws.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return 0;
    if (!canManageFinance(user.role)) return 0;

    // super_admin scopes to their selected org (viewingOrganizationId) or all
    // orgs when none is selected; everyone else scopes to their own org.
    const orgId =
      user.role === "super_admin"
        ? (user.viewingOrganizationId ?? null)
        : (user.organizationId ?? null);

    if (orgId !== null) {
      const rows = await ctx.db
        .query("expenseReports")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(500);
      return rows.filter((e) => e.status === "pending").length;
    }
    const pending = await ctx.db
      .query("expenseReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(500);
    return pending.length;
  },
});

export const review = mutation({
  args: {
    id: v.id("expenseReports"),
    status: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat memproses pengajuan",
      });
    }
    if (args.status !== "approved" && args.status !== "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status review tidak valid",
      });
    }
    const expense = await ctx.db.get(args.id);
    if (!expense) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (expense.status !== "pending") {
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
      userId: expense.userId,
      type: "expense_reviewed",
      title:
        args.status === "approved"
          ? "Reimbursement disetujui"
          : "Reimbursement ditolak",
      message: `"${expense.title}"${args.note ? `: ${args.note}` : ""}`,
      link: "/expenses",
      actorId: user._id,
    });

    return null;
  },
});

export const bulkReview = mutation({
  args: {
    ids: v.array(v.id("expenseReports")),
    status: v.string(), // "approved" | "rejected"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat memproses pengajuan",
      });
    }
    if (args.status !== "approved" && args.status !== "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status review tidak valid",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 pengajuan per aksi",
      });
    }
    const now = new Date().toISOString();
    let count = 0;
    for (const id of args.ids) {
      const exp = await ctx.db.get(id);
      if (!exp || exp.status !== "pending") continue;
      await ctx.db.patch(id, {
        status: args.status,
        reviewerId: user._id,
        reviewedAt: now,
        reviewNote: args.note?.trim() || undefined,
      });
      await notifyUser(ctx, {
        userId: exp.userId,
        type: "expense_reviewed",
        title:
          args.status === "approved"
            ? "Reimbursement disetujui"
            : "Reimbursement ditolak",
        message: `"${exp.title}"${args.note ? `: ${args.note}` : ""}`,
        link: "/expenses",
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});

export const markPaid = mutation({
  args: {
    id: v.id("expenseReports"),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat menandai pembayaran",
      });
    }
    const expense = await ctx.db.get(args.id);
    if (!expense) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (expense.status !== "approved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya pengajuan yang sudah disetujui yang bisa dibayar",
      });
    }
    if (
      args.paymentMethod &&
      !VALID_PAYMENT_METHODS.includes(args.paymentMethod)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Metode pembayaran tidak valid",
      });
    }
    await ctx.db.patch(args.id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentMethod: args.paymentMethod,
      paymentReference: args.paymentReference?.trim() || undefined,
    });

    await notifyUser(ctx, {
      userId: expense.userId,
      type: "expense_paid",
      title: "Reimbursement telah dibayarkan",
      message: `"${expense.title}" telah dibayarkan`,
      link: "/expenses",
      actorId: user._id,
    });

    return null;
  },
});

export const bulkMarkPaid = mutation({
  args: {
    ids: v.array(v.id("expenseReports")),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat menandai pembayaran",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 pengajuan per aksi",
      });
    }
    const now = new Date().toISOString();
    let count = 0;
    for (const id of args.ids) {
      const exp = await ctx.db.get(id);
      if (!exp || exp.status !== "approved") continue;
      await ctx.db.patch(id, {
        status: "paid",
        paidAt: now,
        paymentMethod: args.paymentMethod,
        paymentReference: args.paymentReference?.trim() || undefined,
      });
      await notifyUser(ctx, {
        userId: exp.userId,
        type: "expense_paid",
        title: "Reimbursement telah dibayarkan",
        message: `"${exp.title}" telah dibayarkan`,
        link: "/expenses",
        actorId: user._id,
      });
      count += 1;
    }
    return { count };
  },
});

export const remove = mutation({
  args: { id: v.id("expenseReports") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const expense = await ctx.db.get(args.id);
    if (!expense) return null;
    const isOwner = expense.userId === user._id;
    const isAdmin = isAdminRole(user.role) || canManageFinance(user.role);
    if (!isOwner && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }
    // Non-admin owners can only delete pending items
    if (!isAdmin && expense.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan yang sudah diproses tidak dapat dihapus",
      });
    }
    if (expense.receiptStorageId) {
      await trackStorageRemoved(ctx, expense.organizationId, expense.receiptStorageId);
      await ctx.storage.delete(expense.receiptStorageId);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type ExpenseAnalytics = {
  total: number;
  totalAmount: number;
  approvedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  rejectedAmount: number;
  byCategory: Array<{ category: string; amount: number; count: number }>;
  byDepartment: Array<{ department: string; amount: number; count: number }>;
  byMonth: Array<{ month: string; amount: number; count: number }>;
  topSpenders: Array<{
    userId: Id<"users">;
    userName: string | null;
    userAvatar: string | null;
    amount: number;
    count: number;
  }>;
  avgApprovalHours: number | null;
};

export const getAnalytics = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExpenseAnalytics> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau bendahara yang dapat melihat analitik",
      });
    }
    let all: Array<Doc<"expenseReports">>;
    if (organizationId !== null) {
      all = await ctx.db
        .query("expenseReports")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(2000);
    } else {
      all = await ctx.db
        .query("expenseReports")
        .order("desc")
        .take(2000);
    }
    const scoped = all.filter((e) => {
      if (args.startDate && e.expenseDate < args.startDate) return false;
      if (args.endDate && e.expenseDate > args.endDate) return false;
      return true;
    });

    const byCategoryMap = new Map<string, { amount: number; count: number }>();
    const byDeptMap = new Map<string, { amount: number; count: number }>();
    const byMonthMap = new Map<string, { amount: number; count: number }>();
    const byUserMap = new Map<
      Id<"users">,
      { amount: number; count: number }
    >();

    let approvedAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;
    let totalAmount = 0;
    let approvalDurationSum = 0;
    let approvalDurationCount = 0;

    for (const e of scoped) {
      totalAmount += e.amount;
      if (e.status === "approved") approvedAmount += e.amount;
      if (e.status === "paid") paidAmount += e.amount;
      if (e.status === "pending") pendingAmount += e.amount;
      if (e.status === "rejected") rejectedAmount += e.amount;

      const cat = byCategoryMap.get(e.category) ?? { amount: 0, count: 0 };
      cat.amount += e.amount;
      cat.count += 1;
      byCategoryMap.set(e.category, cat);

      const dept = e.userDepartment ?? "Tidak Ditentukan";
      const d = byDeptMap.get(dept) ?? { amount: 0, count: 0 };
      d.amount += e.amount;
      d.count += 1;
      byDeptMap.set(dept, d);

      const month = e.expenseDate.slice(0, 7);
      const m = byMonthMap.get(month) ?? { amount: 0, count: 0 };
      m.amount += e.amount;
      m.count += 1;
      byMonthMap.set(month, m);

      const u = byUserMap.get(e.userId) ?? { amount: 0, count: 0 };
      u.amount += e.amount;
      u.count += 1;
      byUserMap.set(e.userId, u);

      if (e.reviewedAt) {
        const dur =
          new Date(e.reviewedAt).getTime() - e._creationTime;
        if (dur > 0) {
          approvalDurationSum += dur;
          approvalDurationCount += 1;
        }
      }
    }

    // Resolve top spenders
    const topEntries = [...byUserMap.entries()].sort(
      (a, b) => b[1].amount - a[1].amount,
    );
    const topSlice = topEntries.slice(0, 5);
    const topSpenders: Array<{
      userId: Id<"users">;
      userName: string | null;
      userAvatar: string | null;
      amount: number;
      count: number;
    }> = [];
    for (const [uid, data] of topSlice) {
      const u = await ctx.db.get(uid);
      topSpenders.push({
        userId: uid,
        userName: u?.name ?? null,
        userAvatar: u?.avatarUrl ?? null,
        amount: data.amount,
        count: data.count,
      });
    }

    const byCategory = [...byCategoryMap.entries()]
      .map(([category, val]) => ({ category, ...val }))
      .sort((a, b) => b.amount - a.amount);
    const byDepartment = [...byDeptMap.entries()]
      .map(([department, val]) => ({ department, ...val }))
      .sort((a, b) => b.amount - a.amount);
    const byMonth = [...byMonthMap.entries()]
      .map(([month, val]) => ({ month, ...val }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total: scoped.length,
      totalAmount,
      approvedAmount,
      paidAmount,
      pendingAmount,
      rejectedAmount,
      byCategory,
      byDepartment,
      byMonth,
      topSpenders,
      avgApprovalHours:
        approvalDurationCount > 0
          ? approvalDurationSum / approvalDurationCount / (1000 * 60 * 60)
          : null,
    };
  },
});

export const listDepartments = query({
  args: {},
  handler: async (ctx): Promise<Array<string>> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canManageFinance(user.role)) return [];
    let users: Array<Doc<"users">>;
    if (organizationId !== null) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .take(1000);
    } else {
      users = await ctx.db.query("users").take(1000);
    }
    const set = new Set<string>();
    for (const u of users) {
      if (u.department) set.add(u.department);
    }
    return [...set].sort();
  },
});
