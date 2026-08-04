import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { normalizeRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ---- Default footer links seeded on first query if table is empty --------
const DEFAULT_FOOTER_LINKS: Array<{ group: string; label: string; order: number }> = [
  // Produk
  { group: "Produk", label: "Star e-Office", order: 0 },
  { group: "Produk", label: "Arsip Digital", order: 1 },
  { group: "Produk", label: "Tanda Tangan Digital", order: 2 },
  { group: "Produk", label: "Dashboard Eksekutif", order: 3 },
  { group: "Produk", label: "Workflow Engine", order: 4 },
  // Perusahaan
  { group: "Perusahaan", label: "Tentang Kami", order: 0 },
  { group: "Perusahaan", label: "Karir", order: 1 },
  { group: "Perusahaan", label: "Blog", order: 2 },
  { group: "Perusahaan", label: "Media Kit", order: 3 },
  { group: "Perusahaan", label: "Hubungi Kami", order: 4 },
  // Dukungan
  { group: "Dukungan", label: "Pusat Bantuan", order: 0 },
  { group: "Dukungan", label: "Dokumentasi API", order: 1 },
  { group: "Dukungan", label: "Status Sistem", order: 2 },
  { group: "Dukungan", label: "SLA", order: 3 },
  { group: "Dukungan", label: "Keamanan", order: 4 },
  // Legal
  { group: "Legal", label: "Syarat & Ketentuan", order: 0 },
  { group: "Legal", label: "Kebijakan Privasi", order: 1 },
  { group: "Legal", label: "SLA Enterprise", order: 2 },
  { group: "Legal", label: "UU PDP", order: 3 },
  { group: "Legal", label: "ISO 27001", order: 4 },
];

async function requireSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (normalizeRole(user.role) !== "super_admin") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Hanya Super Admin yang dapat mengelola link footer" });
  }
  return user;
}

// ---- Public query: active footer links (no auth needed for landing page) --
export type FooterLinkGroup = {
  title: string;
  links: string[];
};

export const getActiveFooterLinks = query({
  args: {},
  handler: async (ctx): Promise<FooterLinkGroup[]> => {
    const allLinks = await ctx.db.query("footerLinks").collect();

    // If table is empty, return defaults (all active)
    if (allLinks.length === 0) {
      const groups = new Map<string, string[]>();
      for (const d of DEFAULT_FOOTER_LINKS) {
        const arr = groups.get(d.group) ?? [];
        arr.push(d.label);
        groups.set(d.group, arr);
      }
      const order = ["Produk", "Perusahaan", "Dukungan", "Legal"];
      return order
        .filter((g) => groups.has(g))
        .map((g) => ({ title: g, links: groups.get(g)! }));
    }

    // Only active links, grouped and sorted
    const active = allLinks.filter((l) => l.isActive);
    const groups = new Map<string, Array<{ label: string; order: number }>>();
    for (const l of active) {
      const arr = groups.get(l.group) ?? [];
      arr.push({ label: l.label, order: l.order });
      groups.set(l.group, arr);
    }
    const order = ["Produk", "Perusahaan", "Dukungan", "Legal"];
    return order
      .filter((g) => groups.has(g))
      .map((g) => ({
        title: g,
        links: groups.get(g)!.sort((a, b) => a.order - b.order).map((i) => i.label),
      }));
  },
});

// ---- Admin query: all footer links with status --------------------------
export type FooterLinkItem = {
  _id: Id<"footerLinks">;
  group: string;
  label: string;
  order: number;
  isActive: boolean;
};

export const getAllFooterLinks = query({
  args: {},
  handler: async (ctx): Promise<FooterLinkItem[]> => {
    await requireSuperAdmin(ctx);
    const allLinks = await ctx.db.query("footerLinks").collect();
    return allLinks.map((l) => ({
      _id: l._id,
      group: l.group,
      label: l.label,
      order: l.order,
      isActive: l.isActive,
    }));
  },
});

// ---- Seed defaults (called once by superadmin when table is empty) --------
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const user = await requireSuperAdmin(ctx);
    const existing = await ctx.db.query("footerLinks").first();
    if (existing) return; // already seeded
    const now = new Date().toISOString();
    for (const d of DEFAULT_FOOTER_LINKS) {
      await ctx.db.insert("footerLinks", {
        group: d.group,
        label: d.label,
        order: d.order,
        isActive: true,
        updatedBy: user._id,
        updatedAt: now,
      });
    }
  },
});

// ---- Toggle a single link active/inactive --------------------------------
export const toggleLink = mutation({
  args: {
    linkId: v.id("footerLinks"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireSuperAdmin(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Link tidak ditemukan" });
    }
    await ctx.db.patch(args.linkId, {
      isActive: args.isActive,
      updatedBy: user._id,
      updatedAt: new Date().toISOString(),
    });
  },
});

// ---- Bulk update all links (toggle multiple at once) ---------------------
export const bulkToggle = mutation({
  args: {
    updates: v.array(
      v.object({
        linkId: v.id("footerLinks"),
        isActive: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireSuperAdmin(ctx);
    const now = new Date().toISOString();
    for (const u of args.updates) {
      const link = await ctx.db.get(u.linkId);
      if (link) {
        await ctx.db.patch(u.linkId, {
          isActive: u.isActive,
          updatedBy: user._id,
          updatedAt: now,
        });
      }
    }
  },
});
