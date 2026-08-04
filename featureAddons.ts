import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isSuperAdminRole, MENU_KEYS } from "./roles";
import { requireTenant } from "./lib/tenant";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MENU_KEY_SET = new Set<string>(MENU_KEYS);

async function requireAdminUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, {
    allowSuperAdmin: true,
    bypassSubscriptionLock: true,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role)) {
    throw new ConvexError({ message: "Akses ditolak", code: "FORBIDDEN" });
  }
  return user;
}

async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireAdminUser(ctx);
  if (!isSuperAdminRole(user.role)) {
    throw new ConvexError({
      message: "Hanya super admin yang dapat melakukan tindakan ini",
      code: "FORBIDDEN",
    });
  }
  return user;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function cleanMenuKeys(keys: string[]): string[] {
  return Array.from(new Set(keys.filter((k) => MENU_KEY_SET.has(k))));
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AddonRow = {
  _id: Id<"featureAddons">;
  name: string;
  description: string | null;
  menuKeys: string[];
  price: number;
  priceLabel: string | null;
  order: number;
  isActive: boolean;
};

// ── Catalog Queries ─────────────────────────────────────────────────────────

/** List every add-on (super admin catalog management). */
export const listAll = query({
  args: {},
  handler: async (ctx): Promise<AddonRow[]> => {
    await requireSuperAdmin(ctx);
    const docs = await ctx.db
      .query("featureAddons")
      .withIndex("by_order")
      .collect();
    return docs.map(toAddonRow);
  },
});

/** List only active add-ons (used by org purchase catalog). */
export const listActive = query({
  args: {},
  handler: async (ctx): Promise<AddonRow[]> => {
    const docs = await ctx.db
      .query("featureAddons")
      .withIndex("by_order")
      .collect();
    return docs.filter((d) => d.isActive).map(toAddonRow);
  },
});

function toAddonRow(d: Doc<"featureAddons">): AddonRow {
  return {
    _id: d._id,
    name: d.name,
    description: d.description ?? null,
    menuKeys: d.menuKeys,
    price: d.price,
    priceLabel: d.priceLabel ?? null,
    order: d.order,
    isActive: d.isActive,
  };
}

// ── Catalog Mutations (super admin) ────────────────────────────────────────

export const createAddon = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    menuKeys: v.array(v.string()),
    price: v.number(),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"featureAddons">> => {
    const admin = await requireSuperAdmin(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nama add-on wajib diisi" });
    }
    if (args.price < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Harga tidak valid" });
    }
    const menuKeys = cleanMenuKeys(args.menuKeys);
    if (menuKeys.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih minimal satu menu yang dibuka add-on ini",
      });
    }

    // Default order = end of list.
    let order = args.order;
    if (order === undefined) {
      const existing = await ctx.db
        .query("featureAddons")
        .withIndex("by_order")
        .collect();
      order = existing.length;
    }

    return await ctx.db.insert("featureAddons", {
      name,
      description: args.description?.trim() || undefined,
      menuKeys,
      price: args.price,
      priceLabel: formatRupiah(args.price),
      order,
      isActive: args.isActive ?? true,
      createdBy: admin._id,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateAddon = mutation({
  args: {
    addonId: v.id("featureAddons"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    menuKeys: v.optional(v.array(v.string())),
    price: v.optional(v.number()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    const addon = await ctx.db.get(args.addonId);
    if (!addon) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Add-on tidak ditemukan" });
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Nama add-on wajib diisi" });
      }
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.menuKeys !== undefined) {
      const menuKeys = cleanMenuKeys(args.menuKeys);
      if (menuKeys.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Pilih minimal satu menu yang dibuka add-on ini",
        });
      }
      patch.menuKeys = menuKeys;
    }
    if (args.price !== undefined) {
      if (args.price < 0) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Harga tidak valid" });
      }
      patch.price = args.price;
      patch.priceLabel = formatRupiah(args.price);
    }
    if (args.order !== undefined) patch.order = args.order;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.addonId, patch);
  },
});

export const deleteAddon = mutation({
  args: { addonId: v.id("featureAddons") },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    const addon = await ctx.db.get(args.addonId);
    if (!addon) return;

    // Revoke any active grants for this add-on so orgs lose access cleanly.
    const grants = await ctx.db
      .query("orgAddons")
      .filter((q) => q.eq(q.field("addonId"), args.addonId))
      .collect();
    for (const g of grants) {
      await ctx.db.delete(g._id);
    }
    await ctx.db.delete(args.addonId);
  },
});
