import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";
import { getOrgScope } from "./_scope";

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const me = await ctx.db.get(userId);
  if (!me) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User tidak ditemukan" });
  }
  if (!isAdminRole(me.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola headcount planning",
    });
  }
  return me;
}

export const listPositions = query({
  args: { status: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      position: Doc<"headcountPositions">;
      reportsTo: Doc<"users"> | null;
      filledBy: Doc<"users"> | null;
    }>
  > => {
    const { organizationId, users } = await getOrgScope(ctx);
    const rows = args.status
      ? await ctx.db
          .query("headcountPositions")
          .withIndex("by_status", (q) => q.eq("status", args.status as string))
          .collect()
      : await ctx.db.query("headcountPositions").collect();
    // Scope to the viewing organization. Prefer the row's organizationId when
    // present; legacy rows without one fall back to matching a department name
    // that exists in the viewing org.
    const orgDeptNames = new Set(
      users
        .map((u) => (u.department ?? "").trim())
        .filter((d) => d.length > 0),
    );
    const scopedRows =
      // No org in scope → yields no rows (see summary note above).
      rows.filter((r) =>
        r.organizationId !== undefined
          ? r.organizationId === organizationId
          : orgDeptNames.has(r.department),
      );
    scopedRows.sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.title.localeCompare(b.title),
    );
    const out: Array<{
      position: Doc<"headcountPositions">;
      reportsTo: Doc<"users"> | null;
      filledBy: Doc<"users"> | null;
    }> = [];
    for (const r of scopedRows) {
      const rt = r.reportsToId ? await ctx.db.get(r.reportsToId) : null;
      const fb = r.filledByUserId ? await ctx.db.get(r.filledByUserId) : null;
      out.push({ position: r, reportsTo: rt, filledBy: fb });
    }
    return out;
  },
});

export const summary = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totals: { open: number; planned: number; filled: number; cancelled: number };
    byDepartment: Array<{
      department: string;
      open: number;
      planned: number;
      filled: number;
    }>;
  }> => {
    const { organizationId, users } = await getOrgScope(ctx);
    const allRows = await ctx.db.query("headcountPositions").collect();
    const orgDeptNames = new Set(
      users
        .map((u) => (u.department ?? "").trim())
        .filter((d) => d.length > 0),
    );
    const rows =
      // No org in scope → orgDeptNames is empty and no row matches a null org,
      // so this yields no rows (super admin without an active grant sees none).
      allRows.filter((r) =>
        r.organizationId !== undefined
          ? r.organizationId === organizationId
          : orgDeptNames.has(r.department),
      );
    const totals = { open: 0, planned: 0, filled: 0, cancelled: 0 };
    const byDept = new Map<
      string,
      { department: string; open: number; planned: number; filled: number }
    >();
    for (const r of rows) {
      const bucket =
        byDept.get(r.department) ?? {
          department: r.department,
          open: 0,
          planned: 0,
          filled: 0,
        };
      if (r.status === "filled") {
        totals.filled += 1;
        bucket.filled += 1;
      } else if (r.status === "cancelled") {
        totals.cancelled += 1;
      } else if (r.status === "planned") {
        totals.planned += 1;
        bucket.planned += 1;
      } else {
        // approved or posted counted as open
        totals.open += 1;
        bucket.open += 1;
      }
      byDept.set(r.department, bucket);
    }
    return {
      totals,
      byDepartment: Array.from(byDept.values()).sort(
        (a, b) => b.open + b.planned - (a.open + a.planned),
      ),
    };
  },
});

export const createPosition = mutation({
  args: {
    title: v.string(),
    department: v.string(),
    description: v.optional(v.string()),
    reportsToId: v.optional(v.id("users")),
    level: v.string(),
    status: v.string(),
    targetStartDate: v.optional(v.string()),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"headcountPositions">> => {
    const me = await requireAdmin(ctx);
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul posisi tidak boleh kosong",
      });
    }
    const id = await ctx.db.insert("headcountPositions", {
      title,
      department: args.department.trim(),
      description: args.description,
      reportsToId: args.reportsToId,
      level: args.level,
      status: args.status,
      targetStartDate: args.targetStartDate,
      budgetMin: args.budgetMin,
      budgetMax: args.budgetMax,
      note: args.note,
      createdBy: me._id,
    });
    await ctx.db.insert("orgHistory", {
      eventType: "position_created",
      actorId: me._id,
      subjectType: "position",
      subjectName: `${title} (${args.department})`,
      summary: `${me.name ?? "Admin"} membuat posisi baru ${title} di ${args.department}`,
      timestamp: new Date().toISOString(),
    });
    return id;
  },
});

export const updatePosition = mutation({
  args: {
    positionId: v.id("headcountPositions"),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    description: v.optional(v.string()),
    reportsToId: v.optional(v.union(v.id("users"), v.null())),
    level: v.optional(v.string()),
    status: v.optional(v.string()),
    targetStartDate: v.optional(v.union(v.string(), v.null())),
    budgetMin: v.optional(v.union(v.number(), v.null())),
    budgetMax: v.optional(v.union(v.number(), v.null())),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const pos = await ctx.db.get(args.positionId);
    if (!pos) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Posisi tidak ditemukan" });
    }
    const patch: Partial<Doc<"headcountPositions">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.department !== undefined) patch.department = args.department.trim();
    if (args.description !== undefined) patch.description = args.description;
    if (args.reportsToId !== undefined) {
      patch.reportsToId = args.reportsToId ?? undefined;
    }
    if (args.level !== undefined) patch.level = args.level;
    if (args.status !== undefined) patch.status = args.status;
    if (args.targetStartDate !== undefined) {
      patch.targetStartDate = args.targetStartDate ?? undefined;
    }
    if (args.budgetMin !== undefined) {
      patch.budgetMin = args.budgetMin ?? undefined;
    }
    if (args.budgetMax !== undefined) {
      patch.budgetMax = args.budgetMax ?? undefined;
    }
    if (args.note !== undefined) patch.note = args.note;
    await ctx.db.patch(args.positionId, patch);
    await ctx.db.insert("orgHistory", {
      eventType: "position_updated",
      actorId: me._id,
      subjectType: "position",
      subjectName: `${patch.title ?? pos.title} (${patch.department ?? pos.department})`,
      summary: `${me.name ?? "Admin"} memperbarui posisi ${patch.title ?? pos.title}`,
      timestamp: new Date().toISOString(),
    });
    return null;
  },
});

export const fillPosition = mutation({
  args: {
    positionId: v.id("headcountPositions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const pos = await ctx.db.get(args.positionId);
    if (!pos) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Posisi tidak ditemukan" });
    }
    await ctx.db.patch(args.positionId, {
      status: "filled",
      filledByUserId: args.userId,
      filledAt: new Date().toISOString(),
    });
    const user = await ctx.db.get(args.userId);
    await ctx.db.insert("orgHistory", {
      eventType: "position_filled",
      actorId: me._id,
      subjectType: "position",
      subjectName: `${pos.title} (${pos.department})`,
      summary: `${me.name ?? "Admin"} mengisi posisi ${pos.title} dengan ${user?.name ?? "?"}`,
      timestamp: new Date().toISOString(),
    });
    return null;
  },
});

export const removePosition = mutation({
  args: { positionId: v.id("headcountPositions") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const pos = await ctx.db.get(args.positionId);
    if (!pos) return null;
    await ctx.db.delete(args.positionId);
    await ctx.db.insert("orgHistory", {
      eventType: "position_cancelled",
      actorId: me._id,
      subjectType: "position",
      subjectName: `${pos.title} (${pos.department})`,
      summary: `${me.name ?? "Admin"} membatalkan posisi ${pos.title}`,
      timestamp: new Date().toISOString(),
    });
    return null;
  },
});
