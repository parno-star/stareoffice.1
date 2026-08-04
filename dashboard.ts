import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel.d.ts";
import {
  requireUser,
  canManagePayroll,
  computeUserPayslipLines,
  totalsFromLines,
} from "./_helpers";
import { isScopeBlocked } from "../lib/tenant";

export type PayrollDashboardStats = {
  isAdmin: boolean;
  // Admin-only
  componentCount: number;
  activePeriods: number;
  draftPeriods: number;
  latestPeriod: {
    _id: Id<"payrollPeriods">;
    period: string;
    periodLabel: string;
    status: string;
    totalNet: number;
    totalGross: number;
    employeeCount: number;
    payDate: string;
  } | null;
  employeeWithoutSalary: number;
  // User-facing (always available)
  myLatestNet: number;
  myLatestPeriod: string | null;
  myNextPayDate: string | null;
  myAcknowledgmentNeeded: number;
  myLifetimeEarnings: number;
};

export const getDashboard = query({
  args: {},
  handler: async (ctx): Promise<PayrollDashboardStats> => {
    const user = await requireUser(ctx);
    // Scoped consent gate: a vendor without the "Keuangan & Penggajian" scope
    // must not see company-wide payroll aggregates.
    const scopeBlocked = await isScopeBlocked(ctx, "finance_payroll");
    const isAdmin = canManagePayroll(user.role) && !scopeBlocked;

    const mySlips = await ctx.db
      .query("payslips")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(60);
    const publishedSlips = mySlips.filter((s) => s.status === "published");
    const myLatest = publishedSlips[0] ?? null;
    const myLatestPeriod = myLatest
      ? (await ctx.db.get(myLatest.periodId))?.periodLabel ?? myLatest.period
      : null;
    const myNextPeriod = myLatest
      ? await ctx.db.get(myLatest.periodId)
      : null;
    const myLifetimeEarnings = publishedSlips.reduce(
      (sum, s) => sum + s.netSalary,
      0,
    );
    const myAcknowledgmentNeeded = publishedSlips.filter(
      (s) => !s.acknowledgedAt,
    ).length;

    let componentCount = 0;
    let activePeriods = 0;
    let draftPeriods = 0;
    let latestPeriodSummary: PayrollDashboardStats["latestPeriod"] = null;
    let employeeWithoutSalary = 0;
    if (isAdmin) {
      const components = await ctx.db
        .query("payrollComponents")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
      componentCount = components.length;
      const periods = await ctx.db
        .query("payrollPeriods")
        .withIndex("by_period")
        .order("desc")
        .take(24);
      for (const p of periods) {
        if (p.status === "published") activePeriods += 1;
        if (p.status === "draft") draftPeriods += 1;
      }
      const latest = periods[0];
      if (latest) {
        latestPeriodSummary = {
          _id: latest._id,
          period: latest.period,
          periodLabel: latest.periodLabel,
          status: latest.status,
          totalNet: latest.totalNet,
          totalGross: latest.totalGross,
          employeeCount: latest.employeeCount,
          payDate: latest.payDate,
        };
      }
      const users = await ctx.db.query("users").collect();
      for (const u of users) {
        const lines = await computeUserPayslipLines(ctx, u._id);
        const totals = totalsFromLines(lines);
        if (totals.grossSalary === 0) employeeWithoutSalary += 1;
      }
    }

    return {
      isAdmin,
      componentCount,
      activePeriods,
      draftPeriods,
      latestPeriod: latestPeriodSummary,
      employeeWithoutSalary,
      myLatestNet: myLatest?.netSalary ?? 0,
      myLatestPeriod,
      myNextPayDate: myNextPeriod?.payDate ?? null,
      myAcknowledgmentNeeded,
      myLifetimeEarnings,
    };
  },
});
