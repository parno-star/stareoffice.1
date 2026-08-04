/**
 * Feature-gate mapping: links membership plan features (display labels stored
 * in membershipPlans.coreFeatures / disabledFeatures) to the menu keys used
 * by the sidebar navigation.
 *
 * When a feature label appears in a plan's `disabledFeatures`, ALL the
 * corresponding menu keys are blocked for organisations on that plan.
 *
 * The mapping is intentionally broad – a single plan-level feature label
 * (e.g. "Rekrutmen & ATS") may gate multiple menu keys.
 */

import type { MenuKey } from "./roles";
import { MENU_ITEMS } from "./roles";

// Menu keys that must NEVER be locked by a plan (core navigation the app
// always needs to function). Derived from MENU_ITEMS.alwaysOn.
const ALWAYS_ON_MENUS: Set<MenuKey> = new Set(
  MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key),
);

// ── Plan feature label → menu keys ──────────────────────────────────────────
// Keys are the *display labels* stored in membershipPlans.disabledFeatures.
// Values are the sidebar menu keys that should be hidden.

export const FEATURE_TO_MENUS: Record<string, MenuKey[]> = {
  // HR & People
  "Penggajian":               ["payroll"],
  "Penggajian (Payroll)":     ["payroll"],
  "Rekrutmen":                ["recruitment"],
  "Rekrutmen & ATS":          ["recruitment"],
  "Pelatihan":                ["training", "mentorship"],
  "Pelatihan (LMS)":          ["training", "mentorship"],
  "OKR & Kinerja":            ["okr", "performance"],
  "OKR & Goals":              ["okr"],
  "OKR & Penilaian Kinerja":  ["okr", "performance"],

  // Communication
  "Asisten AI":               ["chatbot"],
  "Asisten AI (Chatbot HR)":  ["chatbot"],
  "Asisten AI Premium":       ["chatbot"],

  // Collaboration
  "Tugas & Proyek":           ["projects"],
  "Tugas & Proyek (10 aktif)":["projects"],
  "Proyek Unlimited":         ["projects"],
  "Wiki & Knowledge Base":    ["wiki"],
  "Forum, Saran, Penghargaan":["forum", "suggestions", "recognitions", "awards"],

  // Documents & Knowledge
  "Dokumen & Kebijakan":      ["documents", "policies"],

  // Advanced
  "Feedback 360°":            ["feedback360"],
  "Talent Management":        ["talent", "grading"],
  "Analitik Advanced":        ["analytics", "reports"],
  "Analitik Advanced & Custom":["analytics", "reports"],

  // Engagement
  "Pulse Survey & Helpdesk":  ["pulse", "support"],

  // Operations
  "Reimbursement & Travel":   ["expenses", "fund_requests", "travel"],
  "Inventaris & Aset":        ["assets"],
  "Pemesanan Ruangan":        ["rooms"],
  "Jenjang Karier":           ["career_path"],
  "Onboarding karyawan":      ["onboarding"],

  // Events & Culture
  "Kelola Surat & Kalender":  ["letters", "calendar"],
  "Apresiasi & Polling":      ["recognitions", "polls"],
};

/**
 * Given a list of disabled feature labels from a membership plan,
 * returns the Set of menu keys that should be hidden.
 *
 * Menus flagged `alwaysOn` (home, dashboard, profil, chatbot) are never
 * blocked, even if a mapped feature label appears in disabledFeatures.
 *
 * `unlockedMenus` are menu keys the organisation has explicitly purchased as
 * add-ons; they are removed from the blocked set so the org regains access.
 */
export function getBlockedMenuKeys(
  disabledFeatures: string[],
  unlockedMenus: MenuKey[] = [],
): Set<MenuKey> {
  const blocked = new Set<MenuKey>();
  for (const label of disabledFeatures) {
    const menus = FEATURE_TO_MENUS[label];
    if (!menus) continue;
    for (const menu of menus) {
      if (ALWAYS_ON_MENUS.has(menu)) continue;
      blocked.add(menu);
    }
  }
  // Add-on purchases unlock specific menus regardless of the plan.
  for (const menu of unlockedMenus) {
    blocked.delete(menu);
  }
  return blocked;
}

/**
 * Given a list of allowed menu keys (from role permissions) and a plan's
 * disabledFeatures, returns only the menus the organisation may access.
 *
 * `unlockedMenus` are add-on menus the org has purchased and should keep.
 */
export function filterByPlan(
  roleMenus: MenuKey[],
  disabledFeatures: string[],
  unlockedMenus: MenuKey[] = [],
): MenuKey[] {
  const blocked = getBlockedMenuKeys(disabledFeatures, unlockedMenus);
  if (blocked.size === 0) return roleMenus;
  return roleMenus.filter((m) => !blocked.has(m));
}

/**
 * Maps a single menu key back to the feature label(s) that gate it.
 * Used to produce a helpful upgrade message.
 */
export function getFeatureLabelForMenu(menuKey: MenuKey): string | null {
  for (const [label, menus] of Object.entries(FEATURE_TO_MENUS)) {
    if (menus.includes(menuKey)) return label;
  }
  return null;
}
