import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Frown,
  GraduationCap,
  HeartHandshake,
  Laugh,
  Meh,
  MessageCircle,
  Smile,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users2,
  Workflow,
} from "lucide-react";

export type QuestionType = "mood" | "rating" | "nps" | "yes_no";

export const QUESTION_TYPE_OPTIONS: ReadonlyArray<{
  value: QuestionType;
  label: string;
  description: string;
}> = [
  {
    value: "mood",
    label: "Mood (5 Emoji)",
    description: "Pilih perasaan dari sangat buruk hingga sangat baik",
  },
  {
    value: "rating",
    label: "Skala 1-5",
    description: "Penilaian bintang Likert klasik",
  },
  {
    value: "nps",
    label: "NPS (0-10)",
    description: "Net Promoter Score klasik",
  },
  {
    value: "yes_no",
    label: "Ya / Tidak",
    description: "Pertanyaan biner cepat",
  },
];

export const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map((q) => [q.value, q.label]),
);

export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}> = [
  { value: "workload", label: "Beban Kerja", icon: Briefcase, color: "amber" },
  {
    value: "leadership",
    label: "Kepemimpinan",
    icon: Star,
    color: "violet",
  },
  { value: "culture", label: "Budaya", icon: Sparkles, color: "pink" },
  { value: "wellbeing", label: "Kesejahteraan", icon: Activity, color: "rose" },
  { value: "growth", label: "Pengembangan", icon: GraduationCap, color: "blue" },
  {
    value: "recognition",
    label: "Apresiasi",
    icon: HeartHandshake,
    color: "emerald",
  },
  {
    value: "communication",
    label: "Komunikasi",
    icon: MessageCircle,
    color: "teal",
  },
  { value: "team", label: "Tim & Kolaborasi", icon: Users2, color: "orange" },
  { value: "custom", label: "Kustom", icon: Workflow, color: "slate" },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
);

export const CATEGORY_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.icon]),
) as Record<string, LucideIcon>;

export const FREQUENCY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "one_off", label: "Sekali Saja" },
  { value: "weekly", label: "Mingguan" },
  { value: "biweekly", label: "Dua Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "quarterly", label: "Triwulan" },
];

export const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(
  FREQUENCY_OPTIONS.map((f) => [f.value, f.label]),
);

export const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Draft",
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
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

export const COLOR_OPTIONS = [
  { value: "rose", className: "bg-rose-500" },
  { value: "pink", className: "bg-pink-500" },
  { value: "violet", className: "bg-violet-500" },
  { value: "blue", className: "bg-blue-500" },
  { value: "emerald", className: "bg-emerald-500" },
  { value: "amber", className: "bg-amber-500" },
  { value: "orange", className: "bg-orange-500" },
  { value: "teal", className: "bg-teal-500" },
] as const;

export function getCoverClass(color: string): string {
  switch (color) {
    case "rose":
      return "bg-gradient-to-br from-rose-500 to-pink-500";
    case "pink":
      return "bg-gradient-to-br from-pink-500 to-rose-400";
    case "violet":
      return "bg-gradient-to-br from-violet-500 to-indigo-500";
    case "blue":
      return "bg-gradient-to-br from-blue-500 to-sky-500";
    case "emerald":
      return "bg-gradient-to-br from-emerald-500 to-teal-500";
    case "amber":
      return "bg-gradient-to-br from-amber-500 to-orange-500";
    case "orange":
      return "bg-gradient-to-br from-orange-500 to-red-500";
    case "teal":
      return "bg-gradient-to-br from-teal-500 to-emerald-500";
    default:
      return "bg-gradient-to-br from-rose-500 to-pink-500";
  }
}

export const MOOD_ICONS: Array<{
  value: number;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}> = [
  {
    value: 1,
    label: "Sangat buruk",
    icon: ThumbsDown,
    color: "text-rose-500",
    bg: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30",
  },
  {
    value: 2,
    label: "Buruk",
    icon: Frown,
    color: "text-orange-500",
    bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30",
  },
  {
    value: 3,
    label: "Netral",
    icon: Meh,
    color: "text-amber-500",
    bg: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30",
  },
  {
    value: 4,
    label: "Baik",
    icon: Smile,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
  },
  {
    value: 5,
    label: "Sangat baik",
    icon: Laugh,
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",
  },
];

export function formatScorePercent(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score)}%`;
}

// Classify sentiment score into buckets similar to NPS (promoter/passive/detractor)
export function getSentimentBand(score: number | null | undefined): {
  label: string;
  color: string;
  description: string;
} {
  if (score === null || score === undefined) {
    return {
      label: "Belum Ada Data",
      color: "text-muted-foreground",
      description: "Tunggu respons pertama",
    };
  }
  if (score >= 75) {
    return {
      label: "Sangat Positif",
      color: "text-emerald-500",
      description: "Karyawan sangat senang",
    };
  }
  if (score >= 60) {
    return {
      label: "Positif",
      color: "text-teal-500",
      description: "Sentimen baik, terus perhatikan",
    };
  }
  if (score >= 40) {
    return {
      label: "Netral",
      color: "text-amber-500",
      description: "Perlu peningkatan",
    };
  }
  if (score >= 25) {
    return {
      label: "Perlu Perhatian",
      color: "text-orange-500",
      description: "Sentimen rendah, ambil tindakan",
    };
  }
  return {
    label: "Kritis",
    color: "text-rose-500",
    description: "Intervensi HR disarankan",
  };
}

// Emoji answer icon mapping for yes_no
export const YES_NO_ICONS: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  yes: {
    label: "Ya",
    icon: ThumbsUp,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
  },
  no: {
    label: "Tidak",
    icon: ThumbsDown,
    color: "text-rose-500",
    bg: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30",
  },
};
