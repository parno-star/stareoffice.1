import type { LucideIcon } from "lucide-react";
import {
  HeartPulse,
  Sparkles,
  Activity,
  UserPlus,
  LogOut,
  Flag,
  Frown,
  Meh,
  Smile,
  Laugh,
  ThumbsDown,
} from "lucide-react";

export const SURVEY_KIND_OPTIONS = [
  { value: "engagement", label: "Engagement", icon: HeartPulse },
  { value: "wellness", label: "Wellness", icon: Activity },
  { value: "pulse", label: "Pulse Check", icon: Sparkles },
  { value: "onboarding", label: "Onboarding", icon: UserPlus },
  { value: "exit", label: "Exit", icon: LogOut },
  { value: "custom", label: "Kustom", icon: Flag },
] as const;

export const KIND_LABELS: Record<string, string> = Object.fromEntries(
  SURVEY_KIND_OPTIONS.map((k) => [k.value, k.label]),
);

export const KIND_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  SURVEY_KIND_OPTIONS.map((k) => [k.value, k.icon]),
) as Record<string, LucideIcon>;

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

export const QUESTION_TYPE_OPTIONS = [
  { value: "rating", label: "Skala 1-5 (Likert)" },
  { value: "mood", label: "Mood (Emoji 1-5)" },
  { value: "nps", label: "NPS (0-10)" },
  { value: "single_choice", label: "Pilihan Tunggal" },
  { value: "multi_choice", label: "Pilihan Ganda" },
  { value: "text", label: "Jawaban Bebas" },
] as const;

export const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map((q) => [q.value, q.label]),
);

export const COLOR_OPTIONS = [
  { value: "rose", label: "Rose", className: "bg-rose-500" },
  { value: "pink", label: "Pink", className: "bg-pink-500" },
  { value: "violet", label: "Violet", className: "bg-violet-500" },
  { value: "blue", label: "Blue", className: "bg-blue-500" },
  { value: "emerald", label: "Emerald", className: "bg-emerald-500" },
  { value: "amber", label: "Amber", className: "bg-amber-500" },
  { value: "orange", label: "Orange", className: "bg-orange-500" },
  { value: "teal", label: "Teal", className: "bg-teal-500" },
] as const;

export function getCoverClass(color: string): string {
  switch (color) {
    case "rose":
      return "bg-gradient-to-br from-rose-500 to-rose-400";
    case "pink":
      return "bg-gradient-to-br from-pink-500 to-pink-400";
    case "violet":
      return "bg-gradient-to-br from-violet-500 to-violet-400";
    case "blue":
      return "bg-gradient-to-br from-blue-500 to-blue-400";
    case "emerald":
      return "bg-gradient-to-br from-emerald-500 to-emerald-400";
    case "amber":
      return "bg-gradient-to-br from-amber-500 to-amber-400";
    case "orange":
      return "bg-gradient-to-br from-orange-500 to-orange-400";
    case "teal":
      return "bg-gradient-to-br from-teal-500 to-teal-400";
    default:
      return "bg-gradient-to-br from-rose-500 to-rose-400";
  }
}

export const MOOD_ICONS: Array<{
  value: number;
  label: string;
  icon: LucideIcon;
  color: string;
}> = [
  { value: 1, label: "Sangat buruk", icon: ThumbsDown, color: "text-rose-500" },
  { value: 2, label: "Buruk", icon: Frown, color: "text-orange-500" },
  { value: 3, label: "Biasa", icon: Meh, color: "text-amber-500" },
  { value: 4, label: "Baik", icon: Smile, color: "text-emerald-500" },
  { value: 5, label: "Sangat baik", icon: Laugh, color: "text-blue-500" },
];

export function getMoodLabel(score: number): string {
  const m = MOOD_ICONS.find((x) => x.value === Math.round(score));
  return m ? m.label : "-";
}

export function getMoodColor(score: number): string {
  const m = MOOD_ICONS.find((x) => x.value === Math.round(score));
  return m ? m.color : "text-muted-foreground";
}

export function formatScorePercent(score: number | null): string {
  if (score === null || score === undefined) return "—";
  return `${score.toFixed(0)}%`;
}

export const WELLNESS_TAG_SUGGESTIONS = [
  "produktif",
  "fokus",
  "energik",
  "lelah",
  "kewalahan",
  "stres",
  "senang",
  "terapresiasi",
  "terhubung",
  "kesepian",
  "termotivasi",
  "bingung",
  "tenang",
  "cemas",
];
