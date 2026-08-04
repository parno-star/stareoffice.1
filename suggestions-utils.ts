import {
  Briefcase,
  Cog,
  Heart,
  Laptop,
  MoreHorizontal,
  Sparkles,
  Eye,
  CheckCircle2,
  XCircle,
  Rocket,
  type LucideIcon,
} from "lucide-react";

export type SuggestionCategory =
  | "workplace"
  | "process"
  | "benefits"
  | "technology"
  | "other";

export type SuggestionStatus =
  | "new"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "implemented";

export const CATEGORY_CONFIG: Record<
  SuggestionCategory,
  { label: string; icon: LucideIcon; badge: string }
> = {
  workplace: {
    label: "Lingkungan Kerja",
    icon: Briefcase,
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  process: {
    label: "Proses & Alur Kerja",
    icon: Cog,
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  benefits: {
    label: "Tunjangan & Fasilitas",
    icon: Heart,
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
  technology: {
    label: "Teknologi",
    icon: Laptop,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  other: {
    label: "Lainnya",
    icon: MoreHorizontal,
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  },
};

export const STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; icon: LucideIcon; badge: string }
> = {
  new: {
    label: "Baru",
    icon: Sparkles,
    badge:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  reviewing: {
    label: "Ditinjau",
    icon: Eye,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  accepted: {
    label: "Diterima",
    icon: CheckCircle2,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  implemented: {
    label: "Terlaksana",
    icon: Rocket,
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  rejected: {
    label: "Ditolak",
    icon: XCircle,
    badge:
      "bg-destructive/15 text-destructive border-destructive/20",
  },
};

export function getCategoryConfig(category: string) {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as SuggestionCategory];
  }
  return CATEGORY_CONFIG.other;
}

export function getStatusConfig(status: string) {
  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as SuggestionStatus];
  }
  return STATUS_CONFIG.new;
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const STATUS_ORDER: Array<SuggestionStatus> = [
  "new",
  "reviewing",
  "accepted",
  "implemented",
  "rejected",
];
