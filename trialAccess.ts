/**
 * Shared helpers for the self-service trial.
 *
 * The trial configuration is a global singleton row in `trialSettings`
 * (key = "trial"). These helpers read it safely (falling back to defaults) and
 * resolve which sidebar menus a trial organisation may use, so the same rules
 * apply everywhere: onboarding, menu resolution, feature gating, and limits.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MenuKey } from "../roles";
import { MENU_ITEMS, MENU_KEYS } from "../roles";

export const TRIAL_SETTINGS_KEY = "trial";

export type TrialSettings = {
  registrationEnabled: boolean;
  durationDays: number;
  maxEmployees: number;
  activeMenus: string[];
};

// Menus that are always available (core navigation) — never gated by the trial.
export const TRIAL_ALWAYS_ON_MENUS: MenuKey[] = MENU_ITEMS.filter(
  (m) => m.alwaysOn,
).map((m) => m.key);

// Sensible default trial menu set: the everyday HR/e-office features a small
// team would expect while evaluating the product.
export const DEFAULT_TRIAL_MENUS: MenuKey[] = [
  "directory",
  "leave",
  "attendance",
  "projects",
  "messages",
  "calendar",
  "documents",
  "my_documents",
  "news",
  "organization",
  "notifications",
  "user_management",
];

export const DEFAULT_TRIAL_SETTINGS: TrialSettings = {
  registrationEnabled: true,
  durationDays: 30,
  maxEmployees: 25,
  activeMenus: DEFAULT_TRIAL_MENUS,
};

/** Read the global trial settings, falling back to defaults when unset. */
export async function getTrialSettings(
  ctx: QueryCtx | MutationCtx,
): Promise<TrialSettings> {
  const doc = await ctx.db
    .query("trialSettings")
    .withIndex("by_key", (q) => q.eq("key", TRIAL_SETTINGS_KEY))
    .unique();
  if (!doc) return DEFAULT_TRIAL_SETTINGS;
  return {
    registrationEnabled: doc.registrationEnabled,
    durationDays: doc.durationDays,
    maxEmployees: doc.maxEmployees,
    activeMenus: doc.activeMenus,
  };
}

const MENU_KEY_SET = new Set<string>(MENU_KEYS as readonly string[]);
const ALWAYS_ON_SET = new Set<string>(TRIAL_ALWAYS_ON_MENUS as string[]);

/**
 * The full set of menu keys a trial org may access: always-on core menus plus
 * every valid menu the super admin enabled for trials.
 */
export function getTrialAllowedMenuSet(activeMenus: string[]): Set<MenuKey> {
  const allowed = new Set<MenuKey>(TRIAL_ALWAYS_ON_MENUS);
  for (const key of activeMenus) {
    if (MENU_KEY_SET.has(key) && !ALWAYS_ON_SET.has(key)) {
      allowed.add(key as MenuKey);
    }
  }
  return allowed;
}

/**
 * Given a resolved list of allowed menu keys, restrict it to what the trial
 * permits. Always-on menus are preserved. Used when an org is on trial so the
 * super admin's trial feature selection is the controlling layer.
 */
export function applyTrialMenuFilter(
  allowed: MenuKey[],
  activeMenus: string[],
): MenuKey[] {
  const trialAllowed = getTrialAllowedMenuSet(activeMenus);
  return allowed.filter((m) => trialAllowed.has(m));
}
