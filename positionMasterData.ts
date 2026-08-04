import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

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
// TITULATURES
// ═══════════════════════════════════════════════════════════════════════════════

export const listTitulatures = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionTitulatures">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionTitulatures").collect();
    return all.filter((t) => t.organizationId === organizationId);
  },
});

export const createTitulature = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama titelatur tidak boleh kosong" });
    // Check duplicate
    const all = await ctx.db.query("positionTitulatures").collect();
    const orgItems = all.filter((t) => t.organizationId === me.organizationId);
    if (orgItems.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "CONFLICT", message: "Titelatur sudah ada" });
    }
    return ctx.db.insert("positionTitulatures", { name, organizationId: me.organizationId });
  },
});

export const updateTitulature = mutation({
  args: { id: v.id("positionTitulatures"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tidak boleh kosong" });
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.patch(args.id, { name });
  },
});

export const removeTitulature = mutation({
  args: { id: v.id("positionTitulatures") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS (BAGIAN)
// ═══════════════════════════════════════════════════════════════════════════════

export const listSections = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionSections">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionSections").collect();
    return all.filter((s) => s.organizationId === organizationId);
  },
});

export const createSection = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama bagian tidak boleh kosong" });
    const all = await ctx.db.query("positionSections").collect();
    const orgItems = all.filter((s) => s.organizationId === me.organizationId);
    if (orgItems.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "CONFLICT", message: "Bagian sudah ada" });
    }
    return ctx.db.insert("positionSections", { name, organizationId: me.organizationId });
  },
});

export const updateSection = mutation({
  args: { id: v.id("positionSections"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tidak boleh kosong" });
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.patch(args.id, { name });
  },
});

export const removeSection = mutation({
  args: { id: v.id("positionSections") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRADES
// ═══════════════════════════════════════════════════════════════════════════════

export const listGrades = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionGrades">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionGrades").collect();
    return all.filter((g) => g.organizationId === organizationId);
  },
});

export const createGrade = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Grade tidak boleh kosong" });
    const all = await ctx.db.query("positionGrades").collect();
    const orgItems = all.filter((g) => g.organizationId === me.organizationId);
    if (orgItems.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "CONFLICT", message: "Grade sudah ada" });
    }
    return ctx.db.insert("positionGrades", { name, organizationId: me.organizationId });
  },
});

export const updateGrade = mutation({
  args: { id: v.id("positionGrades"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tidak boleh kosong" });
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.patch(args.id, { name });
  },
});

export const removeGrade = mutation({
  args: { id: v.id("positionGrades") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOMENKLATUR (MASTER DATA)
// ═══════════════════════════════════════════════════════════════════════════════

export const listNomenclatures = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionNomenclatures">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionNomenclatures").collect();
    return all.filter((n) => n.organizationId === organizationId);
  },
});

export const createNomenclature = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama nomenklatur tidak boleh kosong" });
    const all = await ctx.db.query("positionNomenclatures").collect();
    const orgItems = all.filter((n) => n.organizationId === me.organizationId);
    if (orgItems.some((n) => n.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "CONFLICT", message: "Nomenklatur sudah ada" });
    }
    return ctx.db.insert("positionNomenclatures", { name, organizationId: me.organizationId });
  },
});

export const updateNomenclature = mutation({
  args: { id: v.id("positionNomenclatures"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tidak boleh kosong" });
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.patch(args.id, { name });
  },
});

export const removeNomenclature = mutation({
  args: { id: v.id("positionNomenclatures") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TINGKAT JABATAN (MASTER DATA)
// ═══════════════════════════════════════════════════════════════════════════════

export const listTingkatJabatan = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionTingkatJabatan">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionTingkatJabatan").collect();
    return all.filter((t) => t.organizationId === organizationId);
  },
});

export const createTingkatJabatan = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tingkat jabatan tidak boleh kosong" });
    const all = await ctx.db.query("positionTingkatJabatan").collect();
    const orgItems = all.filter((t) => t.organizationId === me.organizationId);
    if (orgItems.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "CONFLICT", message: "Tingkat jabatan sudah ada" });
    }
    return ctx.db.insert("positionTingkatJabatan", { name, organizationId: me.organizationId });
  },
});

export const updateTingkatJabatan = mutation({
  args: { id: v.id("positionTingkatJabatan"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tidak boleh kosong" });
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.patch(args.id, { name });
  },
});

export const removeTingkatJabatan = mutation({
  args: { id: v.id("positionTingkatJabatan") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// TINGKAT JABATAN FUNGSIONAL (MASTER DATA)
// ═══════════════════════════════════════════════════════════════════════════════

export const listTingkatJabatanFungsional = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionTingkatJabatanFungsional">[]> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("positionTingkatJabatanFungsional").collect();
    return all.filter((t) => t.organizationId === organizationId);
  },
});

export const createTingkatJabatanFungsional = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tingkat jabatan fungsional tidak boleh kosong" });
    const all = await ctx.db.query("positionTingkatJabatanFungsional").collect();
    const orgItems = all.filter((t) => t.organizationId === me.organizationId);
    if (orgItems.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError({ code: "CONFLICT", message: "Tingkat jabatan fungsional sudah ada" });
    }
    return ctx.db.insert("positionTingkatJabatanFungsional", { name, organizationId: me.organizationId });
  },
});

export const updateTingkatJabatanFungsional = mutation({
  args: { id: v.id("positionTingkatJabatanFungsional"), name: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const name = args.name.trim();
    if (!name) throw new ConvexError({ code: "BAD_REQUEST", message: "Nama tidak boleh kosong" });
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.patch(args.id, { name });
  },
});

export const removeTingkatJabatanFungsional = mutation({
  args: { id: v.id("positionTingkatJabatanFungsional") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    requireAdmin(me);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError({ code: "NOT_FOUND", message: "Data tidak ditemukan" });
    await ctx.db.delete(args.id);
  },
});
