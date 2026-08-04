/**
 * Per-tenant menu overrides — super admin management.
 *
 * These functions let a super admin force specific sidebar menus ON or OFF for
 * a single organization, independent of the org's plan or add-ons. The
 * resolution logic lives in lib/menuOverrides.ts and is applied by
 * userSettings.getMyAllowedMenus (sidebar) and planAccess.isFeatureBlocked
 * (direct page access).
 */

import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { MENU_KEYS, isSuperAdminRole, type MenuKey } from "./roles";

const MENU_KEY_SET = new Set<string>(MENU_KEYS);

/** Ensures the caller is a super admin. Returns their user doc. */
async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
  }
  if (!isSuperAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya Super Admin yang dapat mengatur menu per organisasi.",
    });
  }
  return user;
}

export type OrgMenuOverride = {
  menuKey: MenuKey;
  forced: "on" | "off";
  updatedAt: string;
  note?: string;
};

/**
 * Returns the current override state for one organization as a map keyed by
 * menu key. Super admin only.
 */
export const getForOrg = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args): Promise<Record<string, OrgMenuOverride>> => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db
      .query("orgMenuOverrides")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const map: Record<string, OrgMenuOverride> = {};
    for (const row of rows) {
      if (!MENU_KEY_SET.has(row.menuKey)) continue;
      if (row.forced !== "on" && row.forced !== "off") continue;
      map[row.menuKey] = {
        menuKey: row.menuKey as MenuKey,
        forced: row.forced,
        updatedAt: row.updatedAt,
        note: row.note,
      };
    }
    return map;
  },
});

/**
 * Sets (or clears) the override for a single menu in one organization.
 * `forced: "default"` removes any existing override so the menu falls back to
 * the org's plan/role resolution. Super admin only.
 */
export const setOverride = mutation({
  args: {
    organizationId: v.id("organizations"),
    menuKey: v.string(),
    // "on" | "off" | "default"
    forced: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireSuperAdmin(ctx);

    if (!MENU_KEY_SET.has(args.menuKey)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Menu tidak valid" });
    }
    if (!["on", "off", "default"].includes(args.forced)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nilai tidak valid" });
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }

    const existing = await ctx.db
      .query("orgMenuOverrides")
      .withIndex("by_org_and_menu", (q) =>
        q.eq("organizationId", args.organizationId).eq("menuKey", args.menuKey),
      )
      .unique();

    // "default" → remove the override entirely.
    if (args.forced === "default") {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        forced: args.forced,
        updatedBy: me._id,
        updatedAt: now,
        note: args.note,
      });
    } else {
      await ctx.db.insert("orgMenuOverrides", {
        organizationId: args.organizationId,
        menuKey: args.menuKey,
        forced: args.forced,
        updatedBy: me._id,
        updatedAt: now,
        note: args.note,
      });
    }
    return null;
  },
});

/**
 * Returns a map of organizationId → number of active menu overrides, across all
 * organizations. Used by the super admin org list to show a "custom menu" badge.
 * Super admin only.
 */
export const getCountsForAllOrgs = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db.query("orgMenuOverrides").collect();
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (!MENU_KEY_SET.has(row.menuKey)) continue;
      if (row.forced !== "on" && row.forced !== "off") continue;
      const key = row.organizationId as string;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  },
});

/** Clears ALL overrides for one organization (reset to defaults). Super admin only. */
export const clearAllForOrg = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db
      .query("orgMenuOverrides")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
