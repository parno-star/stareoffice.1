import {
  MessageSquare,
  HelpCircle,
  Lightbulb,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export type ThreadCategory = "general" | "question" | "idea" | "announcement";

export const CATEGORY_CONFIG: Record<
  ThreadCategory,
  { label: string; icon: LucideIcon; badge: string; dot: string }
> = {
  general: {
    label: "Umum",
    icon: MessageSquare,
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dot: "bg-slate-500",
  },
  question: {
    label: "Pertanyaan",
    icon: HelpCircle,
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    dot: "bg-blue-500",
  },
  idea: {
    label: "Ide",
    icon: Lightbulb,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
  },
  announcement: {
    label: "Pengumuman",
    icon: Megaphone,
    badge:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
    dot: "bg-rose-500",
  },
};

export function getCategoryConfig(category: string) {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as ThreadCategory];
  }
  return CATEGORY_CONFIG.general;
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
