import { MENU_ITEMS } from "@/convex/roles";
import type { MenuKey } from "@/convex/roles";

/** Map of menu key → human label for rendering add-on unlocked menus. */
const MENU_LABEL: Record<string, string> = Object.fromEntries(
  MENU_ITEMS.map((m) => [m.key, m.label]),
);

/** Human label for a single menu key (falls back to the key itself). */
export function menuLabel(key: string): string {
  return MENU_LABEL[key] ?? key;
}

/** Comma-joined labels for a list of menu keys. */
export function menuLabels(keys: string[]): string {
  return keys.map(menuLabel).join(", ");
}

/** Menu items that can be sold as add-ons (excludes always-on core menus). */
export const ADDON_MENU_OPTIONS: { key: MenuKey; label: string }[] = MENU_ITEMS
  .filter((m) => !m.alwaysOn)
  .map((m) => ({ key: m.key, label: m.label }));

/** Format a numeric IDR amount as Rupiah. */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
