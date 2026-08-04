import {
  GraduationCap,
  Rocket,
  Wrench,
  Users,
  ShieldCheck,
  Package,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type CategoryConfig = {
  value: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  badge: string;
};

export const CATEGORY_OPTIONS: Array<CategoryConfig> = [
  {
    value: "onboarding",
    label: "Onboarding",
    icon: Rocket,
    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  {
    value: "leadership",
    label: "Kepemimpinan",
    icon: Users,
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    value: "technical",
    label: "Teknis",
    icon: Wrench,
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  {
    value: "soft_skills",
    label: "Soft Skills",
    icon: Sparkles,
    iconBg: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    badge: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  },
  {
    value: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    iconBg: "bg-red-500/10 text-red-600 dark:text-red-400",
    badge: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
  {
    value: "product",
    label: "Produk",
    icon: Package,
    iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    badge: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  {
    value: "other",
    label: "Lainnya",
    icon: GraduationCap,
    iconBg: "bg-muted text-foreground",
    badge: "bg-muted text-foreground",
  },
];

const CATEGORY_BY_VALUE: Record<string, CategoryConfig> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c]),
);

export function getCategoryConfig(value: string): CategoryConfig {
  return CATEGORY_BY_VALUE[value] ?? CATEGORY_BY_VALUE.other;
}

export type LevelConfig = {
  value: string;
  label: string;
  badge: string;
};

export const LEVEL_OPTIONS: Array<LevelConfig> = [
  {
    value: "beginner",
    label: "Pemula",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    value: "intermediate",
    label: "Menengah",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    value: "advanced",
    label: "Lanjutan",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
];

const LEVEL_BY_VALUE: Record<string, LevelConfig> = Object.fromEntries(
  LEVEL_OPTIONS.map((l) => [l.value, l]),
);

export function getLevelConfig(value: string): LevelConfig {
  return LEVEL_BY_VALUE[value] ?? LEVEL_OPTIONS[0];
}

export type ColorConfig = {
  value: string;
  label: string;
  cover: string; // gradient / bg for card cover
};

export const COLOR_OPTIONS: Array<ColorConfig> = [
  {
    value: "blue",
    label: "Biru",
    cover:
      "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white",
  },
  {
    value: "green",
    label: "Hijau",
    cover:
      "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white",
  },
  {
    value: "orange",
    label: "Oranye",
    cover:
      "bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 text-white",
  },
  {
    value: "purple",
    label: "Ungu",
    cover:
      "bg-gradient-to-br from-purple-500 via-violet-600 to-fuchsia-700 text-white",
  },
  {
    value: "pink",
    label: "Pink",
    cover:
      "bg-gradient-to-br from-pink-500 via-rose-500 to-red-600 text-white",
  },
  {
    value: "red",
    label: "Merah",
    cover:
      "bg-gradient-to-br from-red-500 via-red-600 to-rose-700 text-white",
  },
  {
    value: "teal",
    label: "Teal",
    cover:
      "bg-gradient-to-br from-teal-500 via-cyan-600 to-sky-700 text-white",
  },
  {
    value: "indigo",
    label: "Indigo",
    cover:
      "bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 text-white",
  },
];

const COLOR_BY_VALUE: Record<string, ColorConfig> = Object.fromEntries(
  COLOR_OPTIONS.map((c) => [c.value, c]),
);

export function getColorConfig(value: string): ColorConfig {
  return COLOR_BY_VALUE[value] ?? COLOR_OPTIONS[0];
}

/** Format duration in minutes to "1j 30m" or "45m". */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}j`;
  return `${hours}j ${minutes}m`;
}

/**
 * Convert a supported video URL (YouTube, Vimeo) to an embeddable URL.
 * Returns the original URL if already embeddable or when pattern is unknown.
 */
export function toEmbedUrl(url: string): string | null {
  try {
    const trimmed = url.trim();
    if (trimmed.length === 0) return null;
    // YouTube
    const ytShort = trimmed.match(
      /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    );
    if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
    const ytWatch = trimmed.match(
      /youtube\.com\/watch\?(?:[^#]*&)?v=([a-zA-Z0-9_-]{6,})/,
    );
    if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
    const ytEmbed = trimmed.match(
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    );
    if (ytEmbed) return `https://www.youtube.com/embed/${ytEmbed[1]}`;
    // Vimeo
    const vimeo = trimmed.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
    // If it's already an https URL, return as-is so an iframe can try
    if (/^https?:\/\//.test(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}
