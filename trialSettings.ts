import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenant } from "./lib/tenant";
import { MENU_KEYS } from "./roles";
import {
  DEFAULT_TRIAL_SETTINGS,
  TRIAL_ALWAYS_ON_MENUS,
  TRIAL_SETTINGS_KEY,
  getTrialSettings,
  type TrialSettings,
} from "./lib/trialAccess";

export type { TrialSettings };

/**
 * Public read: any authenticated user may read the trial configuration. Used
 * by the onboarding flow to decide whether to offer new-org registration and
 * to display the trial duration to the person registering.
 */
export const get = query({
  args: {},
  handler: async (ctx): Promise<TrialSettings> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Anda harus masuk terlebih dahulu",
      });
    }
    return await getTrialSettings(ctx);
  },
});

/**
 * Public read (pre-onboarding): whether new-organisation registration is
 * currently enabled and how long the trial lasts. Safe to expose; no sensitive
 * data. Used by the onboarding choice screen.
 */
export const getPublicInfo = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ registrationEnabled: boolean; durationDays: number }> => {
    const settings = await getTrialSettings(ctx);
    return {
      registrationEnabled: settings.registrationEnabled,
      durationDays: settings.durationDays,
    };
  },
});

/** Super admin: update the trial configuration. */
export const update = mutation({
  args: {
    registrationEnabled: v.boolean(),
    durationDays: v.number(),
    maxEmployees: v.number(),
    activeMenus: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { userId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!isSuperAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat mengubah pengaturan trial",
      });
    }

    // Validate numeric bounds. Duration must be at least 1 day; maxEmployees
    // 0 means unlimited.
    if (!Number.isFinite(args.durationDays) || args.durationDays < 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Lama masa trial minimal 1 hari",
      });
    }
    if (!Number.isFinite(args.maxEmployees) || args.maxEmployees < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Batas karyawan tidak valid",
      });
    }

    // Keep only valid menu keys, and drop always-on menus (they're implicit).
    const validKeys = new Set<string>(MENU_KEYS as readonly string[]);
    const alwaysOn = new Set<string>(TRIAL_ALWAYS_ON_MENUS as string[]);
    const cleanedMenus = Array.from(new Set(args.activeMenus)).filter(
      (k) => validKeys.has(k) && !alwaysOn.has(k),
    );

    const existing = await ctx.db
      .query("trialSettings")
      .withIndex("by_key", (q) => q.eq("key", TRIAL_SETTINGS_KEY))
      .unique();

    const now = new Date().toISOString();
    const payload = {
      registrationEnabled: args.registrationEnabled,
      durationDays: Math.floor(args.durationDays),
      maxEmployees: Math.floor(args.maxEmployees),
      activeMenus: cleanedMenus,
      updatedBy: userId,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("trialSettings", {
        key: TRIAL_SETTINGS_KEY,
        ...payload,
      });
    }
  },
});

// Re-export default for callers that want the fallback shape.
export { DEFAULT_TRIAL_SETTINGS };
