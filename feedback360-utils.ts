import type { LucideIcon } from "lucide-react";
import { Compass, User, UserCheck, Users, UserPlus } from "lucide-react";

export type Relationship = "self" | "manager" | "peer" | "report";

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  self: "Diri Sendiri",
  manager: "Atasan",
  peer: "Rekan",
  report: "Bawahan",
};

export const RELATIONSHIP_ICONS: Record<Relationship, LucideIcon> = {
  self: User,
  manager: UserCheck,
  peer: Users,
  report: UserPlus,
};

export const RELATIONSHIP_BADGE: Record<Relationship, string> = {
  self:
    "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300",
  manager:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300",
  peer: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
  report:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const CYCLE_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Draf",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  active: {
    label: "Aktif",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "Ditutup",
    badge:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

export const REVIEW_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  pending: {
    label: "Menunggu",
    badge:
      "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "Berjalan",
    badge:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300",
  },
  completed: {
    label: "Selesai",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  shared: {
    label: "Dibagikan",
    badge:
      "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300",
  },
};

export const INVITE_STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  pending: {
    label: "Belum dijawab",
    badge: "bg-muted text-muted-foreground border-border",
  },
  submitted: {
    label: "Sudah dikirim",
    badge:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  declined: {
    label: "Ditolak",
    badge:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

export const COLOR_OPTIONS = [
  { value: "indigo", label: "Indigo", className: "bg-indigo-500" },
  { value: "violet", label: "Violet", className: "bg-violet-500" },
  { value: "sky", label: "Sky", className: "bg-sky-500" },
  { value: "emerald", label: "Emerald", className: "bg-emerald-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
  { value: "rose", label: "Rose", className: "bg-rose-500" },
  { value: "teal", label: "Teal", className: "bg-teal-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500" },
] as const;

export function getCoverClass(color: string): string {
  switch (color) {
    case "indigo":
      return "bg-gradient-to-br from-indigo-500 to-indigo-400";
    case "violet":
      return "bg-gradient-to-br from-violet-500 to-violet-400";
    case "sky":
      return "bg-gradient-to-br from-sky-500 to-sky-400";
    case "emerald":
      return "bg-gradient-to-br from-emerald-500 to-emerald-400";
    case "amber":
      return "bg-gradient-to-br from-amber-500 to-amber-400";
    case "rose":
      return "bg-gradient-to-br from-rose-500 to-rose-400";
    case "teal":
      return "bg-gradient-to-br from-teal-500 to-teal-400";
    case "orange":
      return "bg-gradient-to-br from-orange-500 to-orange-400";
    default:
      return "bg-gradient-to-br from-indigo-500 to-indigo-400";
  }
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score)}%`;
}

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export const DEFAULT_ICON: LucideIcon = Compass;

/** Suggest periods for the current + next year. */
export function suggestPeriods(year: number): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];
  for (const y of [year, year + 1]) {
    result.push({ value: `${y}-Q1`, label: `Q1 ${y}` });
    result.push({ value: `${y}-Q2`, label: `Q2 ${y}` });
    result.push({ value: `${y}-Q3`, label: `Q3 ${y}` });
    result.push({ value: `${y}-Q4`, label: `Q4 ${y}` });
    result.push({ value: `${y}-H1`, label: `Semester 1 ${y}` });
    result.push({ value: `${y}-H2`, label: `Semester 2 ${y}` });
    result.push({ value: `${y}-annual`, label: `Tahunan ${y}` });
  }
  return result;
}
