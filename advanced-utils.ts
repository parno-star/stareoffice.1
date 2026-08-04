import { Medal, Award, Flame, Trophy, Star, Sparkles, Zap } from "lucide-react";

/** Format IDR amount. */
export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format date in Indonesian. */
export function formatIdDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format date+time in Indonesian. */
export function formatIdDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const SESSION_FORMAT_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Tatap Muka",
  hybrid: "Hybrid",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Terjadwal",
  ongoing: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const EXTERNAL_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Review",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export const SKILL_CATEGORY_LABEL: Record<string, string> = {
  technical: "Teknis",
  soft: "Soft Skill",
  language: "Bahasa",
  certification: "Sertifikasi",
  tool: "Tools",
};

export type LevelIconKey =
  | "trophy"
  | "medal"
  | "award"
  | "star"
  | "zap"
  | "sparkles"
  | "flame";

export const LEVEL_ICONS = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  star: Star,
  zap: Zap,
  sparkles: Sparkles,
  flame: Flame,
} as const;

/** Return a color scheme for a learner level. */
export function getLevelColor(level: number): string {
  if (level >= 10)
    return "bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white";
  if (level >= 5)
    return "bg-gradient-to-br from-purple-500 via-violet-600 to-fuchsia-700 text-white";
  if (level >= 3)
    return "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white";
  return "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white";
}
