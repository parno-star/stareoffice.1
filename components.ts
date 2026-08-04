import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requirePayrollAdmin, requireUser, canManagePayroll } from "./_helpers";

const COMPONENT_TYPES = ["earning", "deduction"] as const;
const CALCULATION_TYPES = ["fixed", "percent_of_basic"] as const;

export const listComponents = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Array<Doc<"payrollComponents">>> => {
    const user = await requireUser(ctx);
    if (!canManagePayroll(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin/bendahara yang dapat melihat komponen gaji",
      });
    }
    const all = await ctx.db.query("payrollComponents").collect();
    const filtered = args.includeInactive
      ? all
      : all.filter((c) => c.isActive);
    return filtered.sort((a, b) => a.order - b.order);
  },
});

export const createComponent = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    type: v.string(),
    calculation: v.string(),
    defaultAmount: v.number(),
    description: v.optional(v.string()),
    isTaxable: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"payrollComponents">> => {
    const user = await requirePayrollAdmin(ctx);
    const name = args.name.trim();
    const code = args.code.trim().toUpperCase();
    if (name.length === 0 || code.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama & kode wajib diisi",
      });
    }
    if (!COMPONENT_TYPES.includes(args.type as (typeof COMPONENT_TYPES)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe komponen tidak valid",
      });
    }
    if (
      !CALCULATION_TYPES.includes(
        args.calculation as (typeof CALCULATION_TYPES)[number],
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Perhitungan tidak valid",
      });
    }
    if (!Number.isFinite(args.defaultAmount) || args.defaultAmount < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nilai default tidak valid",
      });
    }
    // Determine order
    let order = args.order ?? 0;
    if (args.order === undefined) {
      const existing = await ctx.db.query("payrollComponents").collect();
      order =
        existing.reduce((max, c) => (c.order > max ? c.order : max), 0) + 10;
    }
    return await ctx.db.insert("payrollComponents", {
      name,
      code,
      type: args.type,
      calculation: args.calculation,
      defaultAmount: Math.round(args.defaultAmount),
      description: args.description?.trim(),
      isActive: true,
      isTaxable: args.isTaxable ?? args.type === "earning",
      order,
      authorId: user._id,
    });
  },
});

export const updateComponent = mutation({
  args: {
    id: v.id("payrollComponents"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    type: v.optional(v.string()),
    calculation: v.optional(v.string()),
    defaultAmount: v.optional(v.number()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    isTaxable: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePayrollAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Komponen tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"payrollComponents">> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.code !== undefined) patch.code = args.code.trim().toUpperCase();
    if (args.type !== undefined) {
      if (
        !COMPONENT_TYPES.includes(args.type as (typeof COMPONENT_TYPES)[number])
      ) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Tipe komponen tidak valid",
        });
      }
      patch.type = args.type;
    }
    if (args.calculation !== undefined) {
      if (
        !CALCULATION_TYPES.includes(
          args.calculation as (typeof CALCULATION_TYPES)[number],
        )
      ) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Perhitungan tidak valid",
        });
      }
      patch.calculation = args.calculation;
    }
    if (args.defaultAmount !== undefined) {
      patch.defaultAmount = Math.round(args.defaultAmount);
    }
    if (args.description !== undefined) patch.description = args.description;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.isTaxable !== undefined) patch.isTaxable = args.isTaxable;
    if (args.order !== undefined) patch.order = args.order;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const deleteComponent = mutation({
  args: { id: v.id("payrollComponents") },
  handler: async (ctx, args) => {
    await requirePayrollAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    // Clean up overrides referencing this component
    const overrides = await ctx.db
      .query("employeeSalaryComponents")
      .withIndex("by_component", (q) => q.eq("componentId", args.id))
      .collect();
    for (const o of overrides) {
      await ctx.db.delete(o._id);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
