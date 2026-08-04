import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { notifyUser } from "../notifications";
import {
  requirePayrollAdmin,
  requireUser,
  canManagePayroll,
  computeUserPayslipLines,
  totalsFromLines,
} from "./_helpers";

const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function monthLabel(period: string): string {
  // period is "YYYY-MM"
  const [y, m] = period.split("-").map((n) => Number(n));
  if (!y || !m) return period;
  return `${INDONESIAN_MONTHS[m - 1] ?? ""} ${y}`;
}

export type PeriodWithStats = Doc<"payrollPeriods"> & {
  publishedCount: number;
};

export const listPeriods = query({
  args: {},
  handler: async (ctx): Promise<Array<PeriodWithStats>> => {
    await requirePayrollAdmin(ctx);
    const periods = await ctx.db
      .query("payrollPeriods")
      .withIndex("by_period")
      .order("desc")
      .take(60);
    const results: Array<PeriodWithStats> = [];
    for (const p of periods) {
      const slips = await ctx.db
        .query("payslips")
        .withIndex("by_period", (q) => q.eq("periodId", p._id))
        .collect();
      const publishedCount = slips.filter((s) => s.status === "published").length;
      results.push({ ...p, publishedCount });
    }
    return results;
  },
});

export const createPeriod = mutation({
  args: {
    period: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    payDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"payrollPeriods">> => {
    const user = await requirePayrollAdmin(ctx);
    if (!/^\d{4}-\d{2}$/.test(args.period)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format periode harus YYYY-MM",
      });
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(args.startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(args.endDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(args.payDate)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format tanggal harus YYYY-MM-DD",
      });
    }
    // Check unique period
    const existing = await ctx.db
      .query("payrollPeriods")
      .withIndex("by_period", (q) => q.eq("period", args.period))
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Periode ${args.period} sudah ada`,
      });
    }
    return await ctx.db.insert("payrollPeriods", {
      period: args.period,
      periodLabel: monthLabel(args.period),
      startDate: args.startDate,
      endDate: args.endDate,
      payDate: args.payDate,
      status: "draft",
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      employeeCount: 0,
      note: args.note,
      createdBy: user._id,
    });
  },
});

export const generatePayslips = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    created: number;
    skipped: number;
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
  }> => {
    await requirePayrollAdmin(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Periode payroll tidak ditemukan",
      });
    }
    if (period.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Periode sudah ditutup, tidak bisa generate ulang",
      });
    }

    // Delete existing payslips + lines for this period (draft regenerate)
    const existing = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", args.periodId))
      .collect();
    for (const p of existing) {
      const lines = await ctx.db
        .query("payslipLines")
        .withIndex("by_payslip", (q) => q.eq("payslipId", p._id))
        .collect();
      for (const l of lines) await ctx.db.delete(l._id);
      await ctx.db.delete(p._id);
    }

    const users = await ctx.db.query("users").collect();
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let created = 0;
    let skipped = 0;

    for (const u of users) {
      const lines = await computeUserPayslipLines(ctx, u._id);
      if (lines.length === 0) {
        skipped += 1;
        continue;
      }
      const totals = totalsFromLines(lines);
      if (totals.grossSalary === 0) {
        // Skip users with no pay configured
        skipped += 1;
        continue;
      }
      const payslipId = await ctx.db.insert("payslips", {
        periodId: period._id,
        userId: u._id,
        period: period.period,
        basicSalary: totals.basicSalary,
        totalEarnings: totals.totalEarnings,
        totalDeductions: totals.totalDeductions,
        grossSalary: totals.grossSalary,
        netSalary: totals.netSalary,
        status: "draft",
        userName: u.name ?? "Karyawan",
        userJobTitle: u.jobTitle,
        userDepartment: u.department,
      });
      for (const l of lines) {
        await ctx.db.insert("payslipLines", {
          payslipId,
          componentId: l.componentId,
          name: l.name,
          code: l.code,
          type: l.type,
          amount: l.amount,
          order: l.order,
        });
      }
      totalGross += totals.grossSalary;
      totalDeductions += totals.totalDeductions;
      totalNet += totals.netSalary;
      created += 1;
    }

    await ctx.db.patch(period._id, {
      status: "processing",
      totalGross,
      totalDeductions,
      totalNet,
      employeeCount: created,
    });

    return { created, skipped, totalGross, totalDeductions, totalNet };
  },
});

export const publishPeriod = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args): Promise<{ published: number }> => {
    const user = await requirePayrollAdmin(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Periode payroll tidak ditemukan",
      });
    }
    if (period.status !== "processing" && period.status !== "published") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Generate slip gaji terlebih dahulu sebelum menerbitkan",
      });
    }
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", args.periodId))
      .collect();
    const now = new Date().toISOString();
    let published = 0;
    for (const s of slips) {
      if (s.status === "published") continue;
      await ctx.db.patch(s._id, {
        status: "published",
        publishedAt: now,
      });
      // Notify employee
      await notifyUser(ctx, {
        userId: s.userId,
        type: "payslip_published",
        title: "Slip gaji Anda telah diterbitkan",
        message: `Slip gaji periode ${period.periodLabel} sudah tersedia.`,
        link: "/payroll",
        actorId: user._id,
      });
      published += 1;
    }
    await ctx.db.patch(period._id, {
      status: "published",
      publishedAt: now,
    });
    return { published };
  },
});

export const closePeriod = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    await requirePayrollAdmin(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Periode payroll tidak ditemukan",
      });
    }
    await ctx.db.patch(period._id, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const deletePeriod = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    await requirePayrollAdmin(ctx);
    const period = await ctx.db.get(args.periodId);
    if (!period) return null;
    if (period.status === "published" || period.status === "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Periode yang sudah diterbitkan/ditutup tidak dapat dihapus",
      });
    }
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", args.periodId))
      .collect();
    for (const s of slips) {
      const lines = await ctx.db
        .query("payslipLines")
        .withIndex("by_payslip", (q) => q.eq("payslipId", s._id))
        .collect();
      for (const l of lines) await ctx.db.delete(l._id);
      await ctx.db.delete(s._id);
    }
    await ctx.db.delete(period._id);
    return null;
  },
});

export type PayslipSummary = {
  _id: Id<"payslips">;
  periodId: Id<"payrollPeriods">;
  period: string;
  periodLabel: string;
  userId: Id<"users">;
  userName: string;
  userJobTitle: string | null;
  userDepartment: string | null;
  userAvatar: string | null;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  grossSalary: number;
  netSalary: number;
  status: string;
  publishedAt: string | null;
  acknowledgedAt: string | null;
  payDate: string;
};

async function enrichSlips(
  ctx: Parameters<typeof requireUser>[0],
  slips: Array<Doc<"payslips">>,
): Promise<Array<PayslipSummary>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const periodCache = new Map<
    Id<"payrollPeriods">,
    Doc<"payrollPeriods"> | null
  >();
  const results: Array<PayslipSummary> = [];
  for (const s of slips) {
    let user = userCache.get(s.userId);
    if (user === undefined) {
      user = await ctx.db.get(s.userId);
      userCache.set(s.userId, user);
    }
    let period = periodCache.get(s.periodId);
    if (period === undefined) {
      period = await ctx.db.get(s.periodId);
      periodCache.set(s.periodId, period);
    }
    results.push({
      _id: s._id,
      periodId: s.periodId,
      period: s.period,
      periodLabel: period?.periodLabel ?? s.period,
      userId: s.userId,
      userName: s.userName,
      userJobTitle: s.userJobTitle ?? null,
      userDepartment: s.userDepartment ?? null,
      userAvatar: user?.avatarUrl ?? null,
      basicSalary: s.basicSalary,
      totalEarnings: s.totalEarnings,
      totalDeductions: s.totalDeductions,
      grossSalary: s.grossSalary,
      netSalary: s.netSalary,
      status: s.status,
      publishedAt: s.publishedAt ?? null,
      acknowledgedAt: s.acknowledgedAt ?? null,
      payDate: period?.payDate ?? "",
    });
  }
  return results;
}

/**
 * List all payslips for a given payroll period. Admin/treasurer only.
 */
export const listPeriodPayslips = query({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args): Promise<Array<PayslipSummary>> => {
    await requirePayrollAdmin(ctx);
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_period", (q) => q.eq("periodId", args.periodId))
      .collect();
    const enriched = await enrichSlips(ctx, slips);
    enriched.sort((a, b) => a.userName.localeCompare(b.userName));
    return enriched;
  },
});

/**
 * List the current user's payslips (only published ones are visible unless
 * the user is a payroll admin).
 */
export const listMyPayslips = query({
  args: {},
  handler: async (ctx): Promise<Array<PayslipSummary>> => {
    const user = await requireUser(ctx);
    const slips = await ctx.db
      .query("payslips")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(60);
    const published = slips.filter((s) => s.status === "published");
    return await enrichSlips(ctx, published);
  },
});

export type PayslipDetail = PayslipSummary & {
  lines: Array<Doc<"payslipLines">>;
  note: string | null;
  workingDays: number | null;
  presentDays: number | null;
  absentDays: number | null;
  leaveDays: number | null;
  lateDays: number | null;
  overtimeHours: number | null;
  overtimeAmount: number | null;
};

export const getPayslip = query({
  args: { payslipId: v.id("payslips") },
  handler: async (ctx, args): Promise<PayslipDetail | null> => {
    const me = await requireUser(ctx);
    const slip = await ctx.db.get(args.payslipId);
    if (!slip) return null;
    if (slip.userId !== me._id && !canManagePayroll(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan slip gaji Anda",
      });
    }
    if (slip.status !== "published" && !canManagePayroll(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Slip gaji belum diterbitkan",
      });
    }
    const enriched = await enrichSlips(ctx, [slip]);
    const summary = enriched[0];
    if (!summary) return null;
    const lines = await ctx.db
      .query("payslipLines")
      .withIndex("by_payslip", (q) => q.eq("payslipId", slip._id))
      .collect();
    lines.sort((a, b) => a.order - b.order);
    return {
      ...summary,
      lines,
      note: slip.note ?? null,
      workingDays: slip.workingDays ?? null,
      presentDays: slip.presentDays ?? null,
      absentDays: slip.absentDays ?? null,
      leaveDays: slip.leaveDays ?? null,
      lateDays: slip.lateDays ?? null,
      overtimeHours: slip.overtimeHours ?? null,
      overtimeAmount: slip.overtimeAmount ?? null,
    };
  },
});

export const acknowledgePayslip = mutation({
  args: { payslipId: v.id("payslips") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const slip = await ctx.db.get(args.payslipId);
    if (!slip) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Slip gaji tidak ditemukan",
      });
    }
    if (slip.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan slip gaji Anda",
      });
    }
    if (slip.status !== "published") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Slip gaji belum diterbitkan",
      });
    }
    if (!slip.acknowledgedAt) {
      await ctx.db.patch(slip._id, {
        acknowledgedAt: new Date().toISOString(),
      });
    }
    return null;
  },
});
