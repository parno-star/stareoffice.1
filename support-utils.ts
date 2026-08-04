import {
  Monitor,
  Laptop,
  Wifi,
  KeyRound,
  MoreHorizontal,
  CircleDot,
  Loader,
  CheckCircle2,
  Archive,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Flame,
  type LucideIcon,
} from "lucide-react";

export type TicketCategory =
  | "hardware"
  | "software"
  | "network"
  | "access"
  | "other";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export const CATEGORY_CONFIG: Record<
  TicketCategory,
  { label: string; icon: LucideIcon; badge: string }
> = {
  hardware: {
    label: "Perangkat Keras",
    icon: Monitor,
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  software: {
    label: "Perangkat Lunak",
    icon: Laptop,
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  network: {
    label: "Jaringan",
    icon: Wifi,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  access: {
    label: "Akses & Akun",
    icon: KeyRound,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  other: {
    label: "Lainnya",
    icon: MoreHorizontal,
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  },
};

export const PRIORITY_CONFIG: Record<
  TicketPriority,
  { label: string; icon: LucideIcon; badge: string }
> = {
  low: {
    label: "Rendah",
    icon: ArrowDown,
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  },
  medium: {
    label: "Sedang",
    icon: CircleDot,
    badge:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  high: {
    label: "Tinggi",
    icon: ArrowUp,
    badge:
      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
  },
  urgent: {
    label: "Mendesak",
    icon: Flame,
    badge: "bg-destructive/15 text-destructive border-destructive/20",
  },
};

export const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: LucideIcon; badge: string }
> = {
  open: {
    label: "Terbuka",
    icon: AlertTriangle,
    badge:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  in_progress: {
    label: "Dikerjakan",
    icon: Loader,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  resolved: {
    label: "Selesai",
    icon: CheckCircle2,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  closed: {
    label: "Ditutup",
    icon: Archive,
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  },
};

export function getCategoryConfig(category: string) {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as TicketCategory];
  }
  return CATEGORY_CONFIG.other;
}

export function getPriorityConfig(priority: string) {
  if (priority in PRIORITY_CONFIG) {
    return PRIORITY_CONFIG[priority as TicketPriority];
  }
  return PRIORITY_CONFIG.medium;
}

export function getStatusConfig(status: string) {
  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as TicketStatus];
  }
  return STATUS_CONFIG.open;
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const STATUS_ORDER: Array<TicketStatus> = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export const PRIORITY_ORDER: Array<TicketPriority> = [
  "low",
  "medium",
  "high",
  "urgent",
];
