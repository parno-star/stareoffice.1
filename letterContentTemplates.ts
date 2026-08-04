import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireTenant, assertSameTenant } from "./lib/tenant";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  }
  return { user, organizationId };
}

function requireAdmin(user: Doc<"users">): void {
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ConvexError({
      message: "Hanya admin yang dapat mengelola template isi surat",
      code: "FORBIDDEN",
    });
  }
}

// ─── Categories for content templates ─────────────────────────────────────────

export const CONTENT_TEMPLATE_CATEGORIES = [
  { value: "umum", label: "Umum" },
  { value: "keluar", label: "Surat Keluar" },
  { value: "masuk", label: "Surat Masuk" },
  { value: "memo", label: "Nota" },
] as const;

// ═════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═════════════════════════════════════════════════════════════════════════════

/** List all content templates visible to the caller's organization. */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"letterContentTemplates">[]> => {
    const { organizationId } = await requireAuth(ctx);
    const all = await ctx.db.query("letterContentTemplates").collect();
    // Scope to caller's org; legacy/undefined-org rows are visible to real
    // tenants. A super admin without an active grant has organizationId === null
    // and sees nothing.
    const scoped = organizationId
      ? all.filter((t) => !t.organizationId || t.organizationId === organizationId)
      : [];
    return scoped.sort((a, b) => a.name.localeCompare(b.name, "id"));
  },
});

/** List only active templates, optionally filtered by category. */
export const listActive = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Doc<"letterContentTemplates">[]> => {
    const { organizationId } = await requireAuth(ctx);
    const active = await ctx.db
      .query("letterContentTemplates")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    let scoped = organizationId
      ? active.filter((t) => !t.organizationId || t.organizationId === organizationId)
      : [];
    if (args.category && args.category !== "umum") {
      // Show templates for the requested category plus general-purpose ones.
      scoped = scoped.filter(
        (t) => t.category === args.category || !t.category || t.category === "umum",
      );
    }
    return scoped.sort((a, b) => a.name.localeCompare(b.name, "id"));
  },
});

/** Get a single content template. */
export const get = query({
  args: { id: v.id("letterContentTemplates") },
  handler: async (ctx, args): Promise<Doc<"letterContentTemplates"> | null> => {
    const { organizationId } = await requireAuth(ctx);
    const tpl = await ctx.db.get(args.id);
    if (!tpl) return null;
    assertSameTenant(organizationId, tpl.organizationId, "template");
    return tpl;
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═════════════════════════════════════════════════════════════════════════════

/** Create a new content template (admin only). */
export const create = mutation({
  args: {
    name: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"letterContentTemplates">> => {
    const { user, organizationId } = await requireAuth(ctx);
    requireAdmin(user);

    if (!args.name.trim()) {
      throw new ConvexError({ message: "Nama template wajib diisi", code: "BAD_REQUEST" });
    }
    if (!args.content.trim()) {
      throw new ConvexError({ message: "Isi template wajib diisi", code: "BAD_REQUEST" });
    }

    return await ctx.db.insert("letterContentTemplates", {
      name: args.name.trim(),
      category: args.category,
      description: args.description,
      content: args.content,
      isActive: args.isActive ?? true,
      createdBy: user._id,
      updatedAt: new Date().toISOString(),
      organizationId: organizationId ?? undefined,
    });
  },
});

/** Update an existing content template (admin only). */
export const update = mutation({
  args: {
    id: v.id("letterContentTemplates"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user, organizationId } = await requireAuth(ctx);
    requireAdmin(user);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({ message: "Template tidak ditemukan", code: "NOT_FOUND" });
    }
    assertSameTenant(organizationId, existing.organizationId, "template");

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.name !== undefined) {
      if (!args.name.trim()) {
        throw new ConvexError({ message: "Nama template wajib diisi", code: "BAD_REQUEST" });
      }
      patch.name = args.name.trim();
    }
    if (args.category !== undefined) patch.category = args.category;
    if (args.description !== undefined) patch.description = args.description;
    if (args.content !== undefined) {
      if (!args.content.trim()) {
        throw new ConvexError({ message: "Isi template wajib diisi", code: "BAD_REQUEST" });
      }
      patch.content = args.content;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a content template (admin only). */
export const remove = mutation({
  args: { id: v.id("letterContentTemplates") },
  handler: async (ctx, args): Promise<void> => {
    const { user, organizationId } = await requireAuth(ctx);
    requireAdmin(user);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({ message: "Template tidak ditemukan", code: "NOT_FOUND" });
    }
    assertSameTenant(organizationId, existing.organizationId, "template");

    await ctx.db.delete(args.id);
  },
});

/** Seed a few starter content templates for the caller's org (idempotent). */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx): Promise<{ created: number; skipped: number }> => {
    const { user, organizationId } = await requireAuth(ctx);
    requireAdmin(user);

    const existing = await ctx.db.query("letterContentTemplates").collect();
    const scoped = organizationId
      ? existing.filter((t) => !t.organizationId || t.organizationId === organizationId)
      : existing;

    const defaults: Array<{
      name: string;
      category: string;
      description: string;
      content: string;
    }> = [
      {
        name: "Undangan Rapat",
        category: "keluar",
        description: "Template undangan rapat resmi.",
        content:
          "<p>Dengan hormat,</p><p></p><p>Sehubungan dengan agenda kegiatan organisasi, dengan ini kami mengundang Bapak/Ibu untuk menghadiri rapat yang akan diselenggarakan pada:</p><p></p><p>Hari/Tanggal&nbsp;: ______________<br>Waktu&nbsp;: ______________ WIB<br>Tempat&nbsp;: ______________<br>Agenda&nbsp;: ______________</p><p></p><p>Mengingat pentingnya acara ini, kami mohon kehadiran Bapak/Ibu tepat pada waktunya.</p><p></p><p>Demikian surat undangan ini kami sampaikan. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.</p>",
      },
      {
        name: "Surat Permohonan",
        category: "keluar",
        description: "Template surat permohonan umum.",
        content:
          "<p>Dengan hormat,</p><p></p><p>Yang bertanda tangan di bawah ini, kami bermaksud mengajukan permohonan ______________ dengan rincian sebagai berikut:</p><p></p><p>1. ______________<br>2. ______________<br>3. ______________</p><p></p><p>Sebagai bahan pertimbangan, bersama ini kami lampirkan dokumen pendukung yang diperlukan.</p><p></p><p>Demikian permohonan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>",
      },
      {
        name: "Surat Pemberitahuan",
        category: "keluar",
        description: "Template surat pemberitahuan resmi.",
        content:
          "<p>Dengan hormat,</p><p></p><p>Melalui surat ini kami sampaikan pemberitahuan bahwa ______________.</p><p></p><p>Sehubungan dengan hal tersebut, kami mohon Bapak/Ibu dapat ______________.</p><p></p><p>Demikian pemberitahuan ini kami sampaikan untuk menjadi perhatian. Atas kerja samanya, kami ucapkan terima kasih.</p>",
      },
    ];

    let created = 0;
    let skipped = 0;
    for (const def of defaults) {
      if (scoped.some((t) => t.name === def.name)) {
        skipped++;
        continue;
      }
      await ctx.db.insert("letterContentTemplates", {
        ...def,
        isActive: true,
        createdBy: user._id,
        updatedAt: new Date().toISOString(),
        organizationId: organizationId ?? undefined,
      });
      created++;
    }
    return { created, skipped };
  },
});
