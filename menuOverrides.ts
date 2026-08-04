/**
 * Per-tenant menu override helpers.
 *
 * Overrides let a super admin force a specific sidebar menu ON or OFF for a
 * single organization, independent of the org's plan or add-ons. They are the
 * FINAL gate applied after role + plan + add-on resolution:
 *
 *   forced "on"  → the menu is always available for the org (bypasses plan block)
 *   forced "off" → the menu is always hidden for the org (even if the plan allows)
 *
 * These helpers are read-only and side-effect free so they can run in any
 * query ctx.
 */

import type { Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MenuKey } from "../roles";
import { MENU_KEYS } from "../roles";

const MENU_KEY_SET = new Set<string>(MENU_KEYS);

export type MenuOverrideMap = {
  /** Menu keys forced ON for the org (always shown). */
  on: Set<MenuKey>;
  /** Menu keys forced OFF for the org (always hidden). */
  off: Set<MenuKey>;
};

/**
 * Returns the org's forced-on / forced-off menu key sets. Invalid/stale menu
 * keys are filtered out. Returns empty sets when the org has no overrides.
 */
export async function getMenuOverrides(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<MenuOverrideMap> {
  const rows = await ctx.db
    .query("orgMenuOverrides")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  const on = new Set<MenuKey>();
  const off = new Set<MenuKey>();
  for (const row of rows) {
    if (!MENU_KEY_SET.has(row.menuKey)) continue;
    const key = row.menuKey as MenuKey;
    if (row.forced === "on") on.add(key);
    else if (row.forced === "off") off.add(key);
  }
  return { on, off };
}

/**
 * Applies per-tenant overrides to a resolved list of allowed menu keys.
 * Forced-on menus are added; forced-off menus are removed. `alwaysOn` core
 * menus can still be forced off here intentionally is NOT allowed — callers
 * should pass the alwaysOn set so those menus are never hidden.
 */
export function applyMenuOverrides(
  allowed: MenuKey[],
  overrides: MenuOverrideMap,
  alwaysOn: Set<MenuKey>,
): MenuKey[] {
  const result = new Set<MenuKey>(allowed);
  for (const key of overrides.on) result.add(key);
  for (const key of overrides.off) {
    if (alwaysOn.has(key)) continue; // never hide core navigation
    result.delete(key);
  }
  return [...result];
}
