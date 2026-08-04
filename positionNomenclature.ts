import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { ...user, organizationId: organizationId ?? undefined };
}

function requireAdmin(user: Doc<"users">): void {
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengakses fitur ini",
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/** List all nomenclature entries for the current org */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionNomenclature">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionNomenclature").collect();
    if (organizationId === null) return all.sort((a, b) => a.order - b.order);
    return all.filter((n) => n.organizationId === organizationId).sort((a, b) => a.order - b.order);
  },
});

/** List nomenclature entries for a specific department */
export const listByDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args): Promise<Doc<"positionNomenclature">[]> => {
    await requireUser(ctx);
    const items = await ctx.db
      .query("positionNomenclature")
      .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
      .collect();
    return items.sort((a, b) => a.order - b.order);
  },
});

/** List nomenclature entries by type (struktural/fungsional) */
export const listByType = query({
  args: { type: v.string() },
  handler: async (ctx, args): Promise<Doc<"positionNomenclature">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const items = await ctx.db
      .query("positionNomenclature")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .collect();
    if (organizationId === null) return items.sort((a, b) => a.order - b.order);
    return items.filter((n) => n.organizationId === organizationId).sort((a, b) => a.order - b.order);
  },
});

/** Get a single nomenclature entry by ID */
export const get = query({
  args: { id: v.id("positionNomenclature") },
  handler: async (ctx, args): Promise<Doc<"positionNomenclature"> | null> => {
    await requireUser(ctx);
    return ctx.db.get(args.id);
  },
});

/** Get summary stats for nomenclature */
export const stats = query({
  args: {},
  handler: async (ctx): Promise<{ total: number; struktural: number; fungsional: number; departments: number }> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionNomenclature").collect();
    const filtered = organizationId === null
      ? all
      : all.filter((n) => n.organizationId === organizationId);

    const deptSet = new Set(filtered.map((n) => n.departmentId));
    return {
      total: filtered.length,
      struktural: filtered.filter((n) => n.type === "struktural").length,
      fungsional: filtered.filter((n) => n.type === "fungsional").length,
      departments: deptSet.size,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a new nomenclature entry */
export const create = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.string(),
    nomenclature: v.string(),
    titulature: v.string(),
    grade: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"positionNomenclature">> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    // Validate type
    if (args.type !== "struktural" && args.type !== "fungsional") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe jabatan harus 'struktural' atau 'fungsional'",
      });
    }

    // Check department exists
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Departemen tidak ditemukan" });
    }

    // Get current max order for this department
    const existing = await ctx.db
      .query("positionNomenclature")
      .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
      .collect();
    const maxOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.order)) : 0;

    return ctx.db.insert("positionNomenclature", {
      departmentId: args.departmentId,
      name: args.name.trim(),
      nomenclature: args.nomenclature.trim(),
      titulature: args.titulature.trim(),
      grade: args.grade.trim(),
      type: args.type,
      description: args.description?.trim(),
      order: maxOrder + 1,
      organizationId: me.organizationId,
    });
  },
});

/** Update an existing nomenclature entry */
export const update = mutation({
  args: {
    id: v.id("positionNomenclature"),
    departmentId: v.optional(v.id("departments")),
    name: v.optional(v.string()),
    nomenclature: v.optional(v.string()),
    titulature: v.optional(v.string()),
    grade: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data nomenklatur tidak ditemukan" });
    }

    // Validate type if provided
    if (args.type !== undefined && args.type !== "struktural" && args.type !== "fungsional") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe jabatan harus 'struktural' atau 'fungsional'",
      });
    }

    // Check department if changing
    if (args.departmentId !== undefined) {
      const dept = await ctx.db.get(args.departmentId);
      if (!dept) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Departemen tidak ditemukan" });
      }
    }

    const patch: Record<string, unknown> = {};
    if (args.departmentId !== undefined) patch.departmentId = args.departmentId;
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.nomenclature !== undefined) patch.nomenclature = args.nomenclature.trim();
    if (args.titulature !== undefined) patch.titulature = args.titulature.trim();
    if (args.grade !== undefined) patch.grade = args.grade.trim();
    if (args.type !== undefined) patch.type = args.type;
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.order !== undefined) patch.order = args.order;

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a nomenclature entry */
export const remove = mutation({
  args: { id: v.id("positionNomenclature") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data nomenklatur tidak ditemukan" });
    }

    await ctx.db.delete(args.id);
  },
});
