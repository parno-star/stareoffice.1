import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { canManageFinance } from "./roles";
import { requireTenant } from "./lib/tenant";

// ── Shared whitelists (kept in sync with src/pages/expenses/_lib/expense-utils.ts) ──

const VALID_ICONS = [
  "Plane",
  "Utensils",
  "Package",
  "GraduationCap",
  "Car",
  "Receipt",
  "Briefcase",
  "Building2",
  "Wrench",
  "Megaphone",
  "Heart",
  "Gift",
  "Fuel",
  "Laptop",
  "Phone",
  "Wifi",
  "ShoppingCart",
  "Coffee",
  "Home",
  "Users",
  "FileText",
  "CreditCard",
  "Truck",
  "Hotel",
  "Stethoscope",
  "Zap",
];

const VALID_COLORS = [
  "sky",
  "orange",
  "purple",
  "indigo",
  "teal",
  "emerald",
  "rose",
  "amber",
  "blue",
  "violet",
  "slate",
];

// Built-in default categories used when an org has not customized theirs.
// Mirrors DEFAULT_CATEGORY_RECORDS on the frontend.
export const DEFAULT_EXPENSE_CATEGORIES: Array<{
  key: string;
  label: string;
  icon: string;
  color: string;
  order: number;
}> = [
  { key: "travel", label: "Perjalanan Dinas", icon: "Plane", color: "sky", order: 1 },
  { key: "meal", label: "Makan & Jamuan", icon: "Utensils", color: "orange", order: 2 },
  { key: "supplies", label: "Perlengkapan Kantor", icon: "Package", color: "purple", order: 3 },
  { key: "training", label: "Pelatihan", icon: "GraduationCap", color: "indigo", order: 4 },
  { key: "transport", label: "Transportasi", icon: "Car", color: "teal", order: 5 },
  { key: "other", label: "Lainnya", icon: "Receipt", color: "slate", order: 6 },
];

export type ResolvedCategory = {
  key: string;
  label: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  // Custom categories have an id; default (virtual) categories do not.
  id: Id<"expenseCategories"> | null;
};

// ── Internal helpers ────────────────────────────────────────────────────────

async function requireFinanceUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!canManageFinance(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin atau bagian keuangan yang dapat mengelola kategori",
    });
  }
  return user;
}

/**
 * Returns the effective list of categories for an organization. When the org
 * has custom rows, those are returned. Otherwise the built-in defaults are
 * returned as virtual records (id === null).
 */
export async function resolveCategoriesForOrg(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Array<ResolvedCategory>> {
  if (!organizationId) {
    return DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, isActive: true, id: null }));
  }
  const rows = await ctx.db
    .query("expenseCategories")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  if (rows.length === 0) {
    return DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, isActive: true, id: null }));
  }
  return rows
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      key: r.key,
      label: r.label,
      icon: r.icon,
      color: r.color,
      order: r.order,
      isActive: r.isActive,
      id: r._id,
    }));
}

/** Returns the set of category keys that are valid for submitting an expense. */
export async function getActiveCategoryKeys(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | null,
): Promise<Set<string>> {
  const resolved = await resolveCategoriesForOrg(ctx, organizationId);
  return new Set(resolved.filter((c) => c.isActive).map((c) => c.key));
}

// ── Queries ─────────────────────────────────────────────────────────────────

// List all categories (active + inactive) for the caller's org, resolving to
// defaults when none are customized. Available to any authenticated tenant so
// the submission form and cards can render.
export const list = query({
  args: {},
  handler: async (ctx): Promise<Array<ResolvedCategory>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    return await resolveCategoriesForOrg(ctx, organizationId);
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────

function cleanKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Materializes the default categories into real rows for the org. Called
 * lazily the first time an admin customizes anything, so future edits operate
 * on concrete records instead of virtual defaults.
 */
async function ensureSeeded(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const existing = await ctx.db
    .query("expenseCategories")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (existing) return;
  for (const c of DEFAULT_EXPENSE_CATEGORIES) {
    await ctx.db.insert("expenseCategories", {
      organizationId,
      key: c.key,
      label: c.label,
      icon: c.icon,
      color: c.color,
      order: c.order,
      isActive: true,
    });
  }
}

export const create = mutation({
  args: {
    label: v.string(),
    icon: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"expenseCategories">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organisasi belum ditentukan",
      });
    }
    await requireFinanceUser(ctx);

    const label = args.label.trim();
    if (label.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama kategori minimal 2 karakter",
      });
    }
    if (!VALID_ICONS.includes(args.icon)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Ikon tidak valid" });
    }
    if (!VALID_COLORS.includes(args.color)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Warna tidak valid" });
    }

    await ensureSeeded(ctx, organizationId);

    const key = cleanKey(label);
    if (!key || key.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama kategori harus mengandung huruf atau angka",
      });
    }

    const existing = await ctx.db
      .query("expenseCategories")
      .withIndex("by_org_and_key", (q) =>
        q.eq("organizationId", organizationId).eq("key", key),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Kategori "${label}" sudah ada`,
      });
    }

    const all = await ctx.db
      .query("expenseCategories")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const maxOrder = all.reduce((m, c) => Math.max(m, c.order), 0);

    return await ctx.db.insert("expenseCategories", {
      organizationId,
      key,
      label,
      icon: args.icon,
      color: args.color,
      order: maxOrder + 1,
      isActive: true,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("expenseCategories"),
    label: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"expenseCategories">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireFinanceUser(ctx);

    const cat = await ctx.db.get(args.id);
    if (!cat) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Kategori tidak ditemukan" });
    }
    if (organizationId && cat.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Kategori tidak ditemukan di organisasi Anda",
      });
    }

    const patch: Partial<Doc<"expenseCategories">> = {};
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (label.length < 2) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Nama kategori minimal 2 karakter",
        });
      }
      patch.label = label;
    }
    if (args.icon !== undefined) {
      if (!VALID_ICONS.includes(args.icon)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Ikon tidak valid" });
      }
      patch.icon = args.icon;
    }
    if (args.color !== undefined) {
      if (!VALID_COLORS.includes(args.color)) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Warna tidak valid" });
      }
      patch.color = args.color;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("expenseCategories") },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireFinanceUser(ctx);

    const cat = await ctx.db.get(args.id);
    if (!cat) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Kategori tidak ditemukan" });
    }
    if (organizationId && cat.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Kategori tidak ditemukan di organisasi Anda",
      });
    }

    // Prevent deleting a category that already has expenses; deactivate instead
    // to preserve historical reporting.
    const used = await ctx.db
      .query("expenseReports")
      .withIndex("by_category", (q) => q.eq("category", cat.key))
      .first();
    if (used) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          "Kategori sudah dipakai pada pengajuan. Non-aktifkan saja agar riwayat tetap utuh.",
      });
    }

    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("expenseCategories")) },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    await requireFinanceUser(ctx);

    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i];
      if (!id) continue;
      const cat = await ctx.db.get(id);
      if (!cat) continue;
      if (organizationId && cat.organizationId !== organizationId) continue;
      await ctx.db.patch(id, { order: i + 1 });
    }
  },
});
