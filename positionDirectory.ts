import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { isAdminRole, ROLE_VALUES } from "./roles";
import { requireTenant } from "./lib/tenant";

// Roles that must never be auto-assigned via a position's default role. These
// are platform/tenant-owner roles that require an explicit, deliberate action.
const NON_ASSIGNABLE_DEFAULT_ROLES = new Set<string>(["super_admin", "admin"]);

/** Validate an optional default-role string coming from the client. */
function normalizeDefaultRole(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "none") return undefined;
  if (
    !(ROLE_VALUES as ReadonlyArray<string>).includes(trimmed) ||
    NON_ASSIGNABLE_DEFAULT_ROLES.has(trimmed)
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Peran default tidak valid",
    });
  }
  return trimmed;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
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

/** List all position directory entries for the current org */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionDirectory">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionDirectory").collect();
    // A super admin without an active grant has organizationId === null and
    // sees nothing; real records always have a non-null organizationId.
    return all.filter((n) => n.organizationId === organizationId);
  },
});

/** List by type (struktural/fungsional) */
export const listByType = query({
  args: { type: v.string() },
  handler: async (ctx, args): Promise<Doc<"positionDirectory">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const items = await ctx.db
      .query("positionDirectory")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .collect();
    return items.filter((n) => n.organizationId === organizationId);
  },
});

/** List by department */
export const listByDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args): Promise<Doc<"positionDirectory">[]> => {
    await requireUser(ctx);
    return await ctx.db
      .query("positionDirectory")
      .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
      .collect();
  },
});

/** Get a single entry */
export const get = query({
  args: { id: v.id("positionDirectory") },
  handler: async (ctx, args): Promise<Doc<"positionDirectory"> | null> => {
    await requireUser(ctx);
    return ctx.db.get(args.id);
  },
});

/** Get stats for position directory */
export const stats = query({
  args: {},
  handler: async (ctx): Promise<{ total: number; struktural: number; fungsional: number; active: number }> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionDirectory").collect();
    const filtered = all.filter((n) => n.organizationId === organizationId);

    return {
      total: filtered.length,
      struktural: filtered.filter((n) => n.type === "struktural").length,
      fungsional: filtered.filter((n) => n.type === "fungsional").length,
      active: filtered.filter((n) => n.isActive).length,
    };
  },
});

/** Get unique titulatures used in the org (for composer dropdown) */
export const getUniqueTitulatures = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const { organizationId } = await requireTenant(ctx);
    // Get from positionNomenclature table
    const nomenclatures = await ctx.db.query("positionNomenclature").collect();
    const filtered = nomenclatures.filter(
      (n) => n.organizationId === organizationId,
    );

    const titSet = new Set<string>();
    for (const n of filtered) {
      if (n.titulature) titSet.add(n.titulature);
    }
    // Also from positionDirectory
    const dirEntries = await ctx.db.query("positionDirectory").collect();
    const dirFiltered = dirEntries.filter(
      (n) => n.organizationId === organizationId,
    );
    for (const d of dirFiltered) {
      if (d.titulature) titSet.add(d.titulature);
    }
    return Array.from(titSet).sort();
  },
});

/** Get unique nomenclatures used (for composer dropdown) */
export const getUniqueNomenclatures = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const { organizationId } = await requireTenant(ctx);
    const nomenclatures = await ctx.db.query("positionNomenclature").collect();
    const filtered = nomenclatures.filter(
      (n) => n.organizationId === organizationId,
    );

    const nomSet = new Set<string>();
    for (const n of filtered) {
      if (n.nomenclature) nomSet.add(n.nomenclature);
    }
    const dirEntries = await ctx.db.query("positionDirectory").collect();
    const dirFiltered = dirEntries.filter(
      (n) => n.organizationId === organizationId,
    );
    for (const d of dirFiltered) {
      if (d.nomenclature) nomSet.add(d.nomenclature);
    }
    return Array.from(nomSet).sort();
  },
});

/** Get unique grades used (for composer dropdown) */
export const getUniqueGrades = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const { organizationId } = await requireTenant(ctx);
    const nomenclatures = await ctx.db.query("positionNomenclature").collect();
    const filtered = nomenclatures.filter(
      (n) => n.organizationId === organizationId,
    );

    const gradeSet = new Set<string>();
    for (const n of filtered) {
      if (n.grade) gradeSet.add(n.grade);
    }
    const dirEntries = await ctx.db.query("positionDirectory").collect();
    const dirFiltered = dirEntries.filter(
      (n) => n.organizationId === organizationId,
    );
    for (const d of dirFiltered) {
      if (d.grade) gradeSet.add(d.grade);
    }
    return Array.from(gradeSet).sort();
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Create a new position directory entry (compose a position) */
export const create = mutation({
  args: {
    titulature: v.string(),
    specificSection: v.string(),
    nomenclature: v.string(),
    type: v.string(),
    grade: v.optional(v.string()),
    tingkatJabatan: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"positionDirectory">> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    if (args.type !== "struktural" && args.type !== "fungsional") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe jabatan harus 'struktural' atau 'fungsional'",
      });
    }

    const titulature = args.titulature.trim();
    const specificSection = args.specificSection.trim();

    if (!titulature || !specificSection) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Titelatur dan bagian spesifik harus diisi",
      });
    }

    // Compose the full name: Titulature + Specific Section
    const fullName = `${titulature} ${specificSection}`;

    return ctx.db.insert("positionDirectory", {
      titulature,
      specificSection,
      fullName,
      nomenclature: args.nomenclature.trim(),
      type: args.type,
      grade: args.grade?.trim() || undefined,
      tingkatJabatan: args.tingkatJabatan?.trim(),
      defaultRole: normalizeDefaultRole(args.defaultRole),
      departmentId: args.departmentId,
      description: args.description?.trim(),
      isActive: true,
      organizationId: me.organizationId,
    });
  },
});

/** Update a position directory entry */
export const update = mutation({
  args: {
    id: v.id("positionDirectory"),
    titulature: v.optional(v.string()),
    specificSection: v.optional(v.string()),
    nomenclature: v.optional(v.string()),
    type: v.optional(v.string()),
    grade: v.optional(v.string()),
    tingkatJabatan: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    }

    if (args.type !== undefined && args.type !== "struktural" && args.type !== "fungsional") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe jabatan harus 'struktural' atau 'fungsional'",
      });
    }

    const patch: Record<string, unknown> = {};
    if (args.titulature !== undefined) patch.titulature = args.titulature.trim();
    if (args.specificSection !== undefined) patch.specificSection = args.specificSection.trim();
    if (args.nomenclature !== undefined) patch.nomenclature = args.nomenclature.trim();
    if (args.type !== undefined) patch.type = args.type;
    if (args.grade !== undefined) patch.grade = args.grade.trim() || undefined;
    if (args.tingkatJabatan !== undefined) patch.tingkatJabatan = args.tingkatJabatan.trim();
    if (args.defaultRole !== undefined) patch.defaultRole = normalizeDefaultRole(args.defaultRole);
    if (args.departmentId !== undefined) patch.departmentId = args.departmentId;
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    // Recompose fullName if either part changed
    const newTit = (patch.titulature as string | undefined) ?? doc.titulature;
    const newSec = (patch.specificSection as string | undefined) ?? doc.specificSection;
    if (args.titulature !== undefined || args.specificSection !== undefined) {
      patch.fullName = `${newTit} ${newSec}`;
    }

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a position directory entry */
export const remove = mutation({
  args: { id: v.id("positionDirectory") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    }
    await ctx.db.delete(args.id);
  },
});

/** Toggle active status */
export const toggleActive = mutation({
  args: { id: v.id("positionDirectory") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    }
    await ctx.db.patch(args.id, { isActive: !doc.isActive });
  },
});
