import {
  FileSignature,
  Laptop,
  GraduationCap,
  Users,
  KeyRound,
  ClipboardList,
  UserRound,
  Wrench,
  Briefcase,
  ShieldCheck,
  Sparkles,
  Sun,
  CalendarDays,
  CalendarRange,
  Trophy,
  Link2,
  FileText,
  Video,
  Phone,
  type LucideIcon,
} from "lucide-react";

export type OnboardingCategory =
  | "paperwork"
  | "equipment"
  | "training"
  | "meeting"
  | "access"
  | "other";

export type OwnerRole = "hr" | "it" | "manager" | "employee" | "other";

export type OnboardingPhase =
  | "preboarding"
  | "day_one"
  | "first_week"
  | "first_month"
  | "first_quarter";

export type ResourceKind = "link" | "document" | "video" | "contact";
export type ResourceCategory =
  | "welcome"
  | "culture"
  | "policy"
  | "tool"
  | "people"
  | "benefits"
  | "other";

export const PHASE_ORDER: Array<OnboardingPhase> = [
  "preboarding",
  "day_one",
  "first_week",
  "first_month",
  "first_quarter",
];

export const PHASE_CONFIG: Record<
  OnboardingPhase,
  { label: string; short: string; icon: LucideIcon; color: string; accent: string; description: string }
> = {
  preboarding: {
    label: "Pra-onboarding",
    short: "Sebelum mulai",
    icon: Sparkles,
    color: "text-slate-600 dark:text-slate-300",
    accent: "bg-slate-500/10 border-slate-500/20",
    description: "Persiapan sebelum hari pertama.",
  },
  day_one: {
    label: "Hari Pertama",
    short: "Hari 1",
    icon: Sun,
    color: "text-amber-600 dark:text-amber-400",
    accent: "bg-amber-500/10 border-amber-500/20",
    description: "Selamat datang & orientasi awal.",
  },
  first_week: {
    label: "Minggu Pertama",
    short: "1 Minggu",
    icon: CalendarDays,
    color: "text-blue-600 dark:text-blue-400",
    accent: "bg-blue-500/10 border-blue-500/20",
    description: "Pelatihan dasar & integrasi tim.",
  },
  first_month: {
    label: "Bulan Pertama",
    short: "1 Bulan",
    icon: CalendarRange,
    color: "text-purple-600 dark:text-purple-400",
    accent: "bg-purple-500/10 border-purple-500/20",
    description: "Produktivitas awal & eksplorasi peran.",
  },
  first_quarter: {
    label: "Kuartal Pertama",
    short: "3 Bulan",
    icon: Trophy,
    color: "text-emerald-600 dark:text-emerald-400",
    accent: "bg-emerald-500/10 border-emerald-500/20",
    description: "Kontribusi penuh & evaluasi awal.",
  },
};

export function getPhaseConfig(p: string | undefined | null) {
  if (p && p in PHASE_CONFIG) return PHASE_CONFIG[p as OnboardingPhase];
  return PHASE_CONFIG.first_week;
}

export function phaseFromOffset(offset: number): OnboardingPhase {
  if (offset < 0) return "preboarding";
  if (offset === 0) return "day_one";
  if (offset <= 7) return "first_week";
  if (offset <= 30) return "first_month";
  return "first_quarter";
}

export const RESOURCE_KIND_CONFIG: Record<
  ResourceKind,
  { label: string; icon: LucideIcon; color: string; iconBg: string }
> = {
  link: {
    label: "Tautan",
    icon: Link2,
    color: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  document: {
    label: "Dokumen",
    icon: FileText,
    color: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  video: {
    label: "Video",
    icon: Video,
    color: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  contact: {
    label: "Kontak",
    icon: Phone,
    color: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
};

export function getResourceKindConfig(k: string) {
  if (k in RESOURCE_KIND_CONFIG) {
    return RESOURCE_KIND_CONFIG[k as ResourceKind];
  }
  return RESOURCE_KIND_CONFIG.link;
}

export const RESOURCE_CATEGORY_CONFIG: Record<
  ResourceCategory,
  { label: string; badge: string }
> = {
  welcome: {
    label: "Selamat Datang",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  culture: {
    label: "Budaya",
    badge: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/20",
  },
  policy: {
    label: "Kebijakan",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  tool: {
    label: "Alat Kerja",
    badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  people: {
    label: "Tim & Orang",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  benefits: {
    label: "Benefit",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  other: {
    label: "Lainnya",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export function getResourceCategoryConfig(c: string) {
  if (c in RESOURCE_CATEGORY_CONFIG) {
    return RESOURCE_CATEGORY_CONFIG[c as ResourceCategory];
  }
  return RESOURCE_CATEGORY_CONFIG.other;
}

export const MOOD_CONFIG: Record<
  number,
  { label: string; emoji: string; color: string; bg: string }
> = {
  1: {
    label: "Sangat berat",
    emoji: "😞",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  2: {
    label: "Kurang nyaman",
    emoji: "🙁",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  3: {
    label: "Biasa saja",
    emoji: "😐",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  4: {
    label: "Senang",
    emoji: "🙂",
    color: "text-lime-600 dark:text-lime-400",
    bg: "bg-lime-500/10 border-lime-500/20",
  },
  5: {
    label: "Sangat senang",
    emoji: "😄",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
};

export const CATEGORY_CONFIG: Record<
  OnboardingCategory,
  { label: string; icon: LucideIcon; badge: string; iconBg: string }
> = {
  paperwork: {
    label: "Administrasi",
    icon: FileSignature,
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  equipment: {
    label: "Perlengkapan",
    icon: Laptop,
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  training: {
    label: "Pelatihan",
    icon: GraduationCap,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  meeting: {
    label: "Pertemuan",
    icon: Users,
    badge:
      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
    iconBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  access: {
    label: "Akses Sistem",
    icon: KeyRound,
    badge:
      "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  other: {
    label: "Lainnya",
    icon: ClipboardList,
    badge: "bg-muted text-muted-foreground border-border",
    iconBg: "bg-muted text-muted-foreground",
  },
};

export const OWNER_CONFIG: Record<
  OwnerRole,
  { label: string; icon: LucideIcon }
> = {
  hr: { label: "HR", icon: UserRound },
  it: { label: "IT", icon: Wrench },
  manager: { label: "Manajer", icon: Briefcase },
  employee: { label: "Karyawan", icon: ShieldCheck },
  other: { label: "Lainnya", icon: ClipboardList },
};

export function getCategoryConfig(c: string) {
  if (c in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[c as OnboardingCategory];
  }
  return CATEGORY_CONFIG.other;
}

export function getOwnerConfig(o: string) {
  if (o in OWNER_CONFIG) {
    return OWNER_CONFIG[o as OwnerRole];
  }
  return OWNER_CONFIG.other;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function daysUntilStart(startDate: string): number {
  const [y, m, d] = startDate.split("-").map((n) => Number(n));
  const start = new Date(y, m - 1, d);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = start.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatOffsetDays(offset: number): string {
  if (offset === 0) return "Hari pertama";
  if (offset > 0) return `+${offset} hari`;
  return `${offset} hari`;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
