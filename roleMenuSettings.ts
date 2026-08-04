import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  DEFAULT_ROLE_MENUS,
  MENU_KEYS,
  ROLE_VALUES,
  type MenuKey,
  type Role,
} from "./roles";
import { requireTenant } from "./lib/tenant";

/** Returns the effective menu list for a given role.
 *  If a custom override exists in roleMenuSettings, use it.
 *  Otherwise fall back to DEFAULT_ROLE_MENUS. */
export const getMenusForRole = query({
  args: { role: v.string() },
  handler: async (ctx, args): Promise<ReadonlyArray<string>> => {
    const doc = await ctx.db
      .query("roleMenuSettings")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();

    if (doc) return doc.allowedMenus;
    const r = args.role as Role;
    return DEFAULT_ROLE_MENUS[r] ?? DEFAULT_ROLE_MENUS["employee"];
  },
});

/** Returns all role menu configs (custom overrides + defaults for rest).
 *  Used by the super-admin settings panel. */
export const getAllRoleMenuSettings = query({
  args: {},
  handler: async (ctx): Promise<
    Record<string, { allowedMenus: string[]; isCustomized: boolean }>
  > => {
    const docs = await ctx.db.query("roleMenuSettings").collect();
    const customMap: Record<string, string[]> = {};
    for (const doc of docs) {
      customMap[doc.role] = doc.allowedMenus;
    }

    const result: Record<string, { allowedMenus: string[]; isCustomized: boolean }> = {};
    for (const role of ROLE_VALUES) {
      if (customMap[role]) {
        result[role] = { allowedMenus: customMap[role], isCustomized: true };
      } else {
        result[role] = {
          allowedMenus: [...DEFAULT_ROLE_MENUS[role]],
          isCustomized: false,
        };
      }
    }
    return result;
  },
});

/** Super-admin only: update the allowed menus for a role. */
export const updateRoleMenus = mutation({
  args: {
    role: v.string(),
    allowedMenus: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!isSuperAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat mengubah akses menu",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    // Validate role
    if (!ROLE_VALUES.includes(args.role as Role)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Role tidak valid" });
    }

    // Validate menu keys
    const validKeys = new Set<string>(MENU_KEYS);
    const filtered = args.allowedMenus.filter((k) => validKeys.has(k));

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("roleMenuSettings")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        allowedMenus: filtered,
        updatedBy: user._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("roleMenuSettings", {
        role: args.role,
        allowedMenus: filtered,
        updatedBy: user._id,
        updatedAt: now,
      });
    }
  },
});

/** Super-admin only: reset a role back to its default menus. */
export const resetRoleMenus = mutation({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const { isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!isSuperAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat mereset akses menu",
      });
    }

    const existing = await ctx.db
      .query("roleMenuSettings")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
