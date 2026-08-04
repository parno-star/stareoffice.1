import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { getBlockedMenuKeys, getFeatureLabelForMenu } from "./featureGate";
import type { MenuKey } from "./roles";
import { MENU_ITEMS } from "./roles";
import { getOrgStorageMb } from "./lib/planStorage";
import { getUnlockedMenuKeys } from "./lib/addons";
import { getMenuOverrides } from "./lib/menuOverrides";
import { getTrialAllowedMenuSet, getTrialSettings } from "./lib/trialAccess";
import { isCountableEmployee } from "./lib/countableUsers";

// Core navigation menus that must never be hidden by a per-tenant override.
const ALWAYS_ON_MENU_SET = new Set<MenuKey>(
  MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key),
);

/** Get the current organisation's membership plan with limits info */
export const getMyOrgPlan = query({
  args: {},
  handler: async (ctx): Promise<{
    plan: Doc<"membershipPlans"> | null;
    blockedMenus: MenuKey[];
    org: Doc<"organizations"> | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { plan: null, blockedMenus: [], org: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user?.organizationId) return { plan: null, blockedMenus: [], org: null };

    const org = await ctx.db.get(user.organizationId);
    if (!org) return { plan: null, blockedMenus: [], org: null };

    if (!org.membershipPlanId) return { plan: null, blockedMenus: [], org };

    const plan = await ctx.db.get(org.membershipPlanId);
    if (!plan) return { plan: null, blockedMenus: [], org };

    const unlocked = await getUnlockedMenuKeys(ctx, org._id);
    const blocked = getBlockedMenuKeys(plan.disabledFeatures, unlocked);

    // While on trial, also mark every menu outside the trial's active set as
    // blocked so the UI reflects the trial's feature scope.
    if (org.isTrial) {
      const trial = await getTrialSettings(ctx);
      const trialAllowed = getTrialAllowedMenuSet(trial.activeMenus);
      for (const item of MENU_ITEMS) {
        if (!item.alwaysOn && !trialAllowed.has(item.key)) {
          blocked.add(item.key);
        }
      }
    }

    return { plan, blockedMenus: [...blocked], org };
  },
});

/** Check if a specific menu key is blocked by the org's plan.
 *
 * A menu is blocked when its mapped feature label appears in the plan's
 * `disabledFeatures`. Super admins and always-on menus are never blocked.
 */
export const isFeatureBlocked = query({
  args: { menuKey: v.string() },
  handler: async (ctx, args): Promise<{
    blocked: boolean;
    planName: string | null;
    upgradeMessage: string | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { blocked: false, planName: null, upgradeMessage: null };

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.organizationId) return { blocked: false, planName: null, upgradeMessage: null };

    // Super admins bypass all plan gating.
    if (user.role === "super_admin") {
      return { blocked: false, planName: null, upgradeMessage: null };
    }

    const menuKey = args.menuKey as MenuKey;

    // ── Per-tenant menu overrides (highest priority) ──
    // A super admin can force a menu on/off for this org specifically.
    const overrides = await getMenuOverrides(ctx, user.organizationId);
    if (overrides.on.has(menuKey)) {
      // Forced on for this tenant → always accessible.
      return { blocked: false, planName: null, upgradeMessage: null };
    }
    if (overrides.off.has(menuKey) && !ALWAYS_ON_MENU_SET.has(menuKey)) {
      // Forced off for this tenant → always blocked (regardless of plan).
      return {
        blocked: true,
        planName: null,
        upgradeMessage:
          "Menu ini dinonaktifkan untuk organisasi Anda. Hubungi administrator platform untuk mengaktifkannya.",
      };
    }

    const org = await ctx.db.get(user.organizationId);
    if (!org?.membershipPlanId) return { blocked: false, planName: null, upgradeMessage: null };

    // ── Trial feature gating ──
    // While on trial, a menu that is not in the trial's active set (and not a
    // forced-on override, handled above) is blocked regardless of the plan.
    if (org.isTrial && !ALWAYS_ON_MENU_SET.has(menuKey)) {
      const trial = await getTrialSettings(ctx);
      const trialAllowed = getTrialAllowedMenuSet(trial.activeMenus);
      if (!trialAllowed.has(menuKey)) {
        return {
          blocked: true,
          planName: null,
          upgradeMessage:
            "Fitur ini belum tersedia selama masa trial. Berlangganan untuk membuka seluruh fitur, atau hubungi administrator platform.",
        };
      }
    }

    const plan = await ctx.db.get(org.membershipPlanId);
    if (!plan) return { blocked: false, planName: null, upgradeMessage: null };

    const unlocked = await getUnlockedMenuKeys(ctx, org._id);
    const blocked = getBlockedMenuKeys(plan.disabledFeatures, unlocked);
    const isBlocked = blocked.has(menuKey);

    if (!isBlocked) {
      return { blocked: false, planName: plan.name, upgradeMessage: null };
    }

    const featureLabel = getFeatureLabelForMenu(menuKey);
    const upgradeMessage = featureLabel
      ? `Fitur "${featureLabel}" tidak termasuk dalam paket ${plan.name}. Upgrade paket atau beli fitur tambahan untuk mengaksesnya.`
      : `Fitur ini tidak termasuk dalam paket ${plan.name}. Upgrade paket untuk mengaksesnya.`;

    return { blocked: true, planName: plan.name, upgradeMessage };
  },
});

/** Get organisation limits usage (employees count, storage usage).
 *
 * NOTE: All limits are now removed — isOver flags always return false.
 */
export const getOrgUsage = query({
  args: {},
  handler: async (ctx): Promise<{
    employeeCount: number;
    maxEmployees: number;
    storageMb: number;
    maxStorageMb: number;
    planName: string | null;
    isOverEmployeeLimit: boolean;
    isOverStorageLimit: boolean;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user?.organizationId) return null;

    const org = await ctx.db.get(user.organizationId);
    if (!org) return null;

    // Count employees in this org (exclude test/simulation & super_admin accounts)
    const orgUsers = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId!))
      .collect();
    const employeeCount = orgUsers.filter(isCountableEmployee).length;

    // Resolve the active plan limits (0 = unlimited)
    let planName: string | null = null;
    let maxEmployees = 0;
    let maxStorageMb = 0;
    if (org.membershipPlanId) {
      const plan = await ctx.db.get(org.membershipPlanId);
      if (plan) {
        planName = plan.name;
        maxEmployees = plan.maxEmployees;
        maxStorageMb = plan.maxStorageMb;
      }
    }

    // Trial organisations use the global trial employee cap instead of the plan
    // limit. Reflect that here so the usage banner shows the correct ceiling.
    if (org.isTrial) {
      const trial = await getTrialSettings(ctx);
      maxEmployees = trial.maxEmployees;
      if (planName) planName = `${planName} (Trial)`;
    }

    // Extra purchased seats add to the plan's employee capacity, but only when
    // the plan has a finite limit. Without this the warning banner keeps
    // showing "batas tercapai" even after verified seats were added.
    if (maxEmployees > 0 && org.extraSeats && org.extraSeats > 0) {
      maxEmployees += org.extraSeats;
    }

    // Real storage usage from the denormalized per-org counter (whole MB).
    const storageMb = await getOrgStorageMb(ctx, user.organizationId);

    return {
      employeeCount,
      maxEmployees,
      storageMb,
      maxStorageMb,
      planName,
      isOverEmployeeLimit: maxEmployees > 0 && employeeCount >= maxEmployees,
      isOverStorageLimit: maxStorageMb > 0 && storageMb >= maxStorageMb,
    };
  },
});
