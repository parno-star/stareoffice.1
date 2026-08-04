import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import {
  requirePayrollAdmin,
  requireUser,
  canManagePayroll,
  computeUserPayslipLines,
  totalsFromLines,
} from "./_helpers";

export type SalaryStructureLine = {
  componentId: Id<"payrollComponents">;
  componentName: string;
  componentCode: string;
  componentType: "earning" | "deduction";
  calculation: string;
  defaultAmount: number;
  amount: number; // effective amount (override or default)
  // Raw configured value: % for percent_of_basic, IDR for fixed.
  // Equals defaultAmount when no override is set.
  configuredValue: number;
  isOverride: boolean;
  overrideId: Id<"employeeSalaryComponents"> | null;
};

/**
 * Return the salary structure for a user: list of all active payroll
 * components with the effective amount (override or default) and metadata.
 */
export const getUserStructure = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    user: {
      _id: Id<"users">;
      name: string;
      email: string | null;
      jobTitle: string | null;
      department: string | null;
      avatarUrl: string | null;
    } | null;
    lines: Array<SalaryStructureLine>;
    totals: {
      totalEarnings: number;
      totalDeductions: number;
      grossSalary: number;
      netSalary: number;
      basicSalary: number;
    };
  }> => {
    const me = await requireUser(ctx);
    if (!canManagePayroll(me.role) && me._id !== args.userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin/bendahara yang dapat melihat struktur gaji karyawan lain",
      });
    }
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return {
        user: null,
        lines: [],
        totals: {
          totalEarnings: 0,
          totalDeductions: 0,
          grossSalary: 0,
          netSalary: 0,
          basicSalary: 0,
        },
      };
    }
    const allComponents = await ctx.db
      .query("payrollComponents")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const overrides = await ctx.db
      .query("employeeSalaryComponents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const overrideMap = new Map<
      Id<"payrollComponents">,
      Doc<"employeeSalaryComponents">
    >();
    for (const o of overrides) overrideMap.set(o.componentId, o);

    // Compute basic salary the same way computeUserPayslipLines does
    const sorted = [...allComponents].sort((a, b) => a.order - b.order);
    let basic = 0;
    for (const c of sorted) {
      if (c.type !== "earning") continue;
      if (c.calculation !== "fixed") continue;
      const amount = overrideMap.get(c._id)?.amount ?? c.defaultAmount;
      if (c.code.toUpperCase() === "BASIC" || basic === 0) {
        basic = amount;
        if (c.code.toUpperCase() === "BASIC") break;
      }
    }

    const lines: Array<SalaryStructureLine> = sorted.map((c) => {
      const override = overrideMap.get(c._id);
      const configured = override?.amount ?? c.defaultAmount;
      const effective =
        c.calculation === "percent_of_basic"
          ? Math.round((basic * configured) / 100)
          : Math.round(configured);
      return {
        componentId: c._id,
        componentName: c.name,
        componentCode: c.code,
        componentType: c.type === "deduction" ? "deduction" : "earning",
        calculation: c.calculation,
        defaultAmount: c.defaultAmount,
        amount: effective,
        configuredValue: configured,
        isOverride: override !== undefined,
        overrideId: override?._id ?? null,
      };
    });
    const computed = await computeUserPayslipLines(ctx, args.userId);
    const totals = totalsFromLines(computed);
    return {
      user: {
        _id: user._id,
        name: user.name ?? "Karyawan",
        email: user.email ?? null,
        jobTitle: user.jobTitle ?? null,
        department: user.department ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
      lines,
      totals,
    };
  },
});

export const setOverride = mutation({
  args: {
    userId: v.id("users"),
    componentId: v.id("payrollComponents"),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePayrollAdmin(ctx);
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nominal tidak valid",
      });
    }
    const existing = await ctx.db
      .query("employeeSalaryComponents")
      .withIndex("by_user_and_component", (q) =>
        q.eq("userId", args.userId).eq("componentId", args.componentId),
      )
      .unique();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        amount: Math.round(args.amount),
        note: args.note,
        updatedBy: user._id,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("employeeSalaryComponents", {
      userId: args.userId,
      componentId: args.componentId,
      amount: Math.round(args.amount),
      note: args.note,
      updatedBy: user._id,
      updatedAt: now,
    });
  },
});

export const clearOverride = mutation({
  args: { overrideId: v.id("employeeSalaryComponents") },
  handler: async (ctx, args) => {
    await requirePayrollAdmin(ctx);
    const existing = await ctx.db.get(args.overrideId);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

export type SalaryDirectoryEntry = {
  _id: Id<"users">;
  name: string;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  avatarUrl: string | null;
  grossSalary: number;
  netSalary: number;
  overrideCount: number;
};

/**
 * Directory of all employees with their computed gross and net salary.
 * Finance admins only.
 */
export const listSalaryDirectory = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<SalaryDirectoryEntry>> => {
    await requirePayrollAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const results: Array<SalaryDirectoryEntry> = [];
    const search = (args.search ?? "").trim().toLowerCase();
    for (const u of users) {
      const name = (u.name ?? "").toLowerCase();
      const dept = (u.department ?? "").toLowerCase();
      const title = (u.jobTitle ?? "").toLowerCase();
      if (
        search.length > 0 &&
        !name.includes(search) &&
        !dept.includes(search) &&
        !title.includes(search)
      ) {
        continue;
      }
      const lines = await computeUserPayslipLines(ctx, u._id);
      const totals = totalsFromLines(lines);
      const overrides = await ctx.db
        .query("employeeSalaryComponents")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      results.push({
        _id: u._id,
        name: u.name ?? "Karyawan",
        email: u.email ?? null,
        jobTitle: u.jobTitle ?? null,
        department: u.department ?? null,
        avatarUrl: u.avatarUrl ?? null,
        grossSalary: totals.grossSalary,
        netSalary: totals.netSalary,
        overrideCount: overrides.length,
      });
    }
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  },
});
