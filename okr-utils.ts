import type { LucideIcon } from "lucide-react";
import {
  Building2,
  UsersRound,
  Users,
  User,
  TrendingUp,
  Sparkles,
  Package,
  Heart,
  UserCheck,
  Settings,
  DollarSign,
  Tag,
} from "lucide-react";

export const OKR_SCOPE_OPTIONS = [
  { value: "company", label: "Perusahaan", icon: Building2 },
  { value: "department", label: "Departemen", icon: UsersRound },
  { value: "team", label: "Tim", icon: Users },
  { value: "individual", label: "Individu", icon: User },
] as const;

export type ScopeOption = (typeof OKR_SCOPE_OPTIONS)[number];

export const SCOPE_LABELS: Record<string, string> = {
  company: "Perusahaan",
  department: "Departemen",
  team: "Tim",
  individual: "Individu",
};

export const SCOPE_ICONS: Record<string, LucideIcon> = {
  company: Building2,
  department: UsersRound,
  team: Users,
  individual: User,
};

export const CATEGORY_OPTIONS = [
  { value: "strategic", label: "Strategis", icon: TrendingUp },
  { value: "growth", label: "Growth", icon: Sparkles },
  { value: "product", label: "Produk", icon: Package },
  { value: "customer", label: "Customer", icon: Heart },
  { value: "people", label: "People", icon: UserCheck },
  { value: "ops", label: "Operasional", icon: Settings },
  { value: "finance", label: "Finance", icon: DollarSign },
  { value: "other", label: "Lainnya", icon: Tag },
] as const;

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
);

export const CATEGORY_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.icon]),
) as Record<string, LucideIcon>;

export const HEALTH_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  on_track: {
    label: "On track",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  at_risk: {
    label: "At risk",
    badge:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  off_track: {
    label: "Off track",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  achieved: {
    label: "Tercapai",
    badge:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300",
    dot: "bg-blue-500",
  },
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  draft: {
    label: "Draft",
    badge: "bg-muted text-muted-foreground border-border",
  },
  active: {
    label: "Aktif",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  completed: {
    label: "Selesai",
    badge:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300",
  },
  archived: {
    label: "Arsip",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export const METRIC_TYPE_OPTIONS = [
  { value: "number", label: "Angka" },
  { value: "percent", label: "Persen (%)" },
  { value: "currency", label: "Mata Uang (IDR)" },
  { value: "boolean", label: "Selesai / Belum" },
  { value: "milestone", label: "Milestone" },
] as const;

export const METRIC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  METRIC_TYPE_OPTIONS.map((m) => [m.value, m.label]),
);

export function formatMetricValue(
  value: number,
  metricType: string,
  unit?: string,
): string {
  if (metricType === "currency") {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (metricType === "percent") {
    return `${value}%`;
  }
  if (metricType === "boolean") {
    return value >= 1 ? "Selesai" : "Belum";
  }
  const formatted = new Intl.NumberFormat("id-ID").format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function generateCurrentPeriodOptions(): Array<{
  value: string;
  label: string;
}> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentQ = Math.ceil(month / 3);
  const currentH = month <= 6 ? 1 : 2;
  const options: Array<{ value: string; label: string }> = [];
  // Current & next year quarters + halves + year
  for (const y of [year, year + 1]) {
    options.push({ value: `${y}`, label: `${y} (Tahunan)` });
    options.push({ value: `${y}-H1`, label: `H1 ${y}` });
    options.push({ value: `${y}-H2`, label: `H2 ${y}` });
    for (let q = 1; q <= 4; q++) {
      options.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` });
    }
  }
  // Prioritize current quarter label sort: put current at top
  const currentOption = `${year}-Q${currentQ}`;
  options.sort((a, b) => {
    if (a.value === currentOption) return -1;
    if (b.value === currentOption) return 1;
    return a.value.localeCompare(b.value);
  });
  void currentH;
  return options;
}

export function getScopeColor(scope: string): string {
  switch (scope) {
    case "company":
      return "text-violet-600 dark:text-violet-400";
    case "department":
      return "text-blue-600 dark:text-blue-400";
    case "team":
      return "text-emerald-600 dark:text-emerald-400";
    case "individual":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}
