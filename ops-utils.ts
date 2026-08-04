// Shared display helpers for operations (task stages & priorities).
// The list of valid color keys is kept in sync with the backend whitelist in
// convex/operationsSettings.ts.

import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type OpsColor = {
  label: string;
  // Badge / column-label classes (readable in light + dark mode).
  badge: string;
  // Solid swatch for the color picker.
  swatch: string;
};

export const OPS_COLORS: Record<string, OpsColor> = {
  slate: {
    label: "Abu-abu",
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    swatch: "#64748b",
  },
  blue: {
    label: "Biru",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    swatch: "#3b82f6",
  },
  amber: {
    label: "Kuning",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    swatch: "#f59e0b",
  },
  green: {
    label: "Hijau",
    badge: "bg-green-500/10 text-green-700 dark:text-green-400",
    swatch: "#22c55e",
  },
  orange: {
    label: "Oranye",
    badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    swatch: "#f97316",
  },
  red: {
    label: "Merah",
    badge: "bg-red-500/10 text-red-700 dark:text-red-400",
    swatch: "#ef4444",
  },
  violet: {
    label: "Violet",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    swatch: "#8b5cf6",
  },
  rose: {
    label: "Merah Muda",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    swatch: "#f43f5e",
  },
  cyan: {
    label: "Cyan",
    badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    swatch: "#06b6d4",
  },
  teal: {
    label: "Toska",
    badge: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    swatch: "#14b8a6",
  },
  indigo: {
    label: "Nila",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
    swatch: "#6366f1",
  },
  emerald: {
    label: "Emerald",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    swatch: "#10b981",
  },
};

export const OPS_COLOR_KEYS = Object.keys(OPS_COLORS);

export function getOpsColor(key: string): OpsColor {
  return OPS_COLORS[key] ?? OPS_COLORS.slate!;
}

// Record shapes coming from api.operationsSettings.getConfig
export type StatusRecord = {
  id: Id<"taskStatuses"> | null;
  key: string;
  label: string;
  color: string;
  order: number;
  isActive: boolean;
  isCompleted: boolean;
};

export type PriorityRecord = {
  id: Id<"taskPriorities"> | null;
  key: string;
  label: string;
  color: string;
  order: number;
  isActive: boolean;
};

// Resolve a status/priority key against a live list, falling back to a neutral
// style so unknown/legacy keys still render.
export function resolveStatusMeta(
  key: string,
  statuses: ReadonlyArray<StatusRecord>,
): { key: string; label: string; color: string } {
  const found = statuses.find((s) => s.key === key);
  if (found) return { key: found.key, label: found.label, color: getOpsColor(found.color).badge };
  return { key, label: key, color: getOpsColor("slate").badge };
}

export function resolvePriorityMeta(
  key: string,
  priorities: ReadonlyArray<PriorityRecord>,
): { key: string; label: string; color: string } {
  const found = priorities.find((p) => p.key === key);
  if (found) return { key: found.key, label: found.label, color: getOpsColor(found.color).badge };
  return { key, label: key, color: getOpsColor("slate").badge };
}
