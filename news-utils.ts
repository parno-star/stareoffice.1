import {
  Megaphone,
  Newspaper,
  Users,
  Cog,
  Calendar,
  Trophy,
  RefreshCw,
  AlertTriangle,
  Bell,
  Info,
  type LucideIcon,
} from "lucide-react";

export type NewsCategoryKey =
  | "general"
  | "news"
  | "hr"
  | "it"
  | "event"
  | "achievement"
  | "update";

export type CategoryMeta = {
  key: NewsCategoryKey;
  label: string;
  icon: LucideIcon;
  // tailwind classes
  chipClass: string;
  // badge background subtle for cards
  gradient: string;
};

export const CATEGORIES: ReadonlyArray<CategoryMeta> = [
  {
    key: "general",
    label: "Umum",
    icon: Megaphone,
    chipClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
    gradient: "from-slate-500/20 to-slate-500/5",
  },
  {
    key: "news",
    label: "Berita",
    icon: Newspaper,
    chipClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
    gradient: "from-blue-500/25 to-blue-500/5",
  },
  {
    key: "hr",
    label: "SDM",
    icon: Users,
    chipClass:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
    gradient: "from-purple-500/25 to-purple-500/5",
  },
  {
    key: "it",
    label: "IT",
    icon: Cog,
    chipClass:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200",
    gradient: "from-cyan-500/25 to-cyan-500/5",
  },
  {
    key: "event",
    label: "Acara",
    icon: Calendar,
    chipClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
    gradient: "from-emerald-500/25 to-emerald-500/5",
  },
  {
    key: "achievement",
    label: "Prestasi",
    icon: Trophy,
    chipClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    gradient: "from-amber-500/30 to-amber-500/5",
  },
  {
    key: "update",
    label: "Pembaruan",
    icon: RefreshCw,
    chipClass:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
    gradient: "from-indigo-500/25 to-indigo-500/5",
  },
];

export function getCategoryMeta(key: string | null | undefined): CategoryMeta {
  const found = CATEGORIES.find((c) => c.key === key);
  return found ?? CATEGORIES[0];
}

export type PriorityKey = "normal" | "important" | "urgent";

export const PRIORITY_META: Record<
  PriorityKey,
  {
    label: string;
    icon: LucideIcon;
    className: string;
  }
> = {
  normal: {
    label: "Informasi",
    icon: Info,
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  },
  important: {
    label: "Penting",
    icon: Bell,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  },
  urgent: {
    label: "Mendesak",
    icon: AlertTriangle,
    className:
      "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200",
  },
};

export function getPriorityMeta(priority: string | null | undefined) {
  if (priority === "urgent") return PRIORITY_META.urgent;
  if (priority === "important") return PRIORITY_META.important;
  return PRIORITY_META.normal;
}
