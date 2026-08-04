import {
  Users,
  Lightbulb,
  Crown,
  Sparkles,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

export type RecognitionCategory =
  | "teamwork"
  | "innovation"
  | "leadership"
  | "excellence"
  | "helpfulness";

type CategoryConfig = {
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  iconColor: string;
  gradient: string;
};

export const CATEGORY_CONFIG: Record<RecognitionCategory, CategoryConfig> = {
  teamwork: {
    label: "Kerja Tim",
    description: "Kolaborasi dan kerja sama yang luar biasa",
    icon: Users,
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    iconColor: "text-blue-500",
    gradient: "from-blue-500/15 to-blue-500/5",
  },
  innovation: {
    label: "Inovasi",
    description: "Ide kreatif yang membawa perubahan",
    icon: Lightbulb,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    iconColor: "text-amber-500",
    gradient: "from-amber-500/15 to-amber-500/5",
  },
  leadership: {
    label: "Kepemimpinan",
    description: "Kepemimpinan yang menginspirasi",
    icon: Crown,
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
    iconColor: "text-purple-500",
    gradient: "from-purple-500/15 to-purple-500/5",
  },
  excellence: {
    label: "Keunggulan",
    description: "Hasil kerja yang melampaui ekspektasi",
    icon: Sparkles,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    iconColor: "text-emerald-500",
    gradient: "from-emerald-500/15 to-emerald-500/5",
  },
  helpfulness: {
    label: "Kesiapan Membantu",
    description: "Selalu siap membantu rekan kerja",
    icon: HeartHandshake,
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
    iconColor: "text-rose-500",
    gradient: "from-rose-500/15 to-rose-500/5",
  },
};

export function getCategoryConfig(category: string): CategoryConfig {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as RecognitionCategory];
  }
  return CATEGORY_CONFIG.teamwork;
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const CATEGORY_VALUES: Array<RecognitionCategory> = [
  "teamwork",
  "innovation",
  "leadership",
  "excellence",
  "helpfulness",
];
