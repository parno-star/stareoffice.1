/**
 * Feature add-on helpers.
 *
 * Add-ons let an organization unlock specific sidebar menu keys that its
 * membership plan would otherwise block — without changing the plan. A grant
 * lives in `orgAddons` (status="active"); the add-on definition (which menus it
 * unlocks) lives in `featureAddons`.
 *
 * These helpers resolve the set of menu keys an org has unlocked via active
 * add-on grants, so the plan-gating layer can subtract them from the blocked
 * set. Kept side-effect free and read-only so they can run in any query ctx.
 */

import type { Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MenuKey } from "../roles";
import { MENU_KEYS } from "../roles";

const MENU_KEY_SET = new Set<string>(MENU_KEYS);

/**
 * Returns the distinct list of menu keys an organization has currently unlocked
 * through active add-on grants. Invalid/stale menu keys are filtered out.
 */
export async function getUnlockedMenuKeys(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<MenuKey[]> {
  const grants = await ctx.db
    .query("orgAddons")
    .withIndex("by_org_and_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    )
    .collect();

  if (grants.length === 0) return [];

  const unlocked = new Set<MenuKey>();
  for (const grant of grants) {
    const addon = await ctx.db.get(grant.addonId);
    if (!addon) continue;
    for (const key of addon.menuKeys) {
      if (MENU_KEY_SET.has(key)) unlocked.add(key as MenuKey);
    }
  }
  return [...unlocked];
}
