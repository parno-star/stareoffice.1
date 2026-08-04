import {
  Trophy,
  Crown,
  Sparkles,
  Users,
  Lightbulb,
  HeartHandshake,
  Star,
  Award as AwardIcon,
  CalendarClock,
  Medal,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export type AwardCategory =
  | "employee_of_month"
  | "employee_of_quarter"
  | "employee_of_year"
  | "excellence"
  | "innovation"
  | "leadership"
  | "teamwork"
  | "long_service"
  | "rookie"
  | "custom";

type CategoryConfig = {
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  iconColor: string;
  gradient: string;
  ring: string;
};

export const CATEGORY_CONFIG: Record<AwardCategory, CategoryConfig> = {
  employee_of_month: {
    label: "Employee of the Month",
    shortLabel: "Karyawan Bulan Ini",
    description: "Penghargaan bulanan untuk karyawan terbaik",
    icon: Crown,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    iconColor: "text-amber-500",
    gradient: "from-amber-500/25 via-amber-500/10 to-orange-500/5",
    ring: "ring-amber-500/30",
  },
  employee_of_quarter: {
    label: "Employee of the Quarter",
    shortLabel: "Karyawan Kuartal",
    description: "Karyawan terbaik dalam satu kuartal",
    icon: Trophy,
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    iconColor: "text-purple-500",
    gradient: "from-purple-500/25 via-purple-500/10 to-pink-500/5",
    ring: "ring-purple-500/30",
  },
  employee_of_year: {
    label: "Employee of the Year",
    shortLabel: "Karyawan Tahunan",
    description: "Penghargaan tertinggi tahunan",
    icon: Crown,
    badge:
      "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    iconColor: "text-yellow-500",
    gradient: "from-yellow-500/30 via-amber-500/15 to-orange-500/10",
    ring: "ring-yellow-500/40",
  },
  excellence: {
    label: "Penghargaan Keunggulan",
    shortLabel: "Keunggulan",
    description: "Penghargaan atas performa luar biasa",
    icon: Sparkles,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    iconColor: "text-emerald-500",
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/5",
    ring: "ring-emerald-500/30",
  },
  innovation: {
    label: "Penghargaan Inovasi",
    shortLabel: "Inovasi",
    description: "Ide kreatif & inovasi berdampak",
    icon: Lightbulb,
    badge:
      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    iconColor: "text-orange-500",
    gradient: "from-orange-500/20 via-amber-500/10 to-yellow-500/5",
    ring: "ring-orange-500/30",
  },
  leadership: {
    label: "Penghargaan Kepemimpinan",
    shortLabel: "Kepemimpinan",
    description: "Kepemimpinan yang menginspirasi",
    icon: Star,
    badge:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    iconColor: "text-indigo-500",
    gradient: "from-indigo-500/20 via-blue-500/10 to-purple-500/5",
    ring: "ring-indigo-500/30",
  },
  teamwork: {
    label: "Penghargaan Kerja Tim",
    shortLabel: "Kerja Tim",
    description: "Kolaborasi luar biasa",
    icon: Users,
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    iconColor: "text-blue-500",
    gradient: "from-blue-500/20 via-sky-500/10 to-cyan-500/5",
    ring: "ring-blue-500/30",
  },
  long_service: {
    label: "Penghargaan Masa Kerja",
    shortLabel: "Masa Kerja",
    description: "Apresiasi dedikasi dan loyalitas",
    icon: CalendarClock,
    badge:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    iconColor: "text-rose-500",
    gradient: "from-rose-500/20 via-pink-500/10 to-red-500/5",
    ring: "ring-rose-500/30",
  },
  rookie: {
    label: "Rookie of the Year",
    shortLabel: "Karyawan Baru Terbaik",
    description: "Karyawan baru dengan kontribusi menonjol",
    icon: HeartHandshake,
    badge:
      "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    iconColor: "text-cyan-500",
    gradient: "from-cyan-500/20 via-teal-500/10 to-emerald-500/5",
    ring: "ring-cyan-500/30",
  },
  custom: {
    label: "Penghargaan Khusus",
    shortLabel: "Khusus",
    description: "Penghargaan khusus lainnya",
    icon: AwardIcon,
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    iconColor: "text-slate-500",
    gradient: "from-slate-500/20 via-slate-500/10 to-slate-500/5",
    ring: "ring-slate-500/30",
  },
};

export const CATEGORY_VALUES: Array<AwardCategory> = [
  "employee_of_month",
  "employee_of_quarter",
  "employee_of_year",
  "excellence",
  "innovation",
  "leadership",
  "teamwork",
  "long_service",
  "rookie",
  "custom",
];

export function getCategoryConfig(category: string): CategoryConfig {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as AwardCategory];
  }
  return CATEGORY_CONFIG.custom;
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function formatAwardDate(isoDate: string): string {
  try {
    return format(new Date(`${isoDate}T00:00:00`), "d MMMM yyyy", {
      locale: idLocale,
    });
  } catch {
    return isoDate;
  }
}

export function formatBonus(amount?: number): string {
  if (amount === undefined || amount === null) return "";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }
}

export const RANK_ICON = [Trophy, Medal, AwardIcon];

export const MAX_CERTIFICATE_SIZE = 5 * 1024 * 1024; // 5 MB
