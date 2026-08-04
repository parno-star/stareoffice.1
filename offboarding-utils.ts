import {
  FileText,
  HandCoins,
  Laptop,
  MessageSquareHeart,
  Scale,
  ShieldOff,
  Users,
  Wallet,
  Briefcase,
  LogOut,
  UserX,
  HeartHandshake,
  FileClock,
  Link as LinkIcon,
} from "lucide-react";
import type { ComponentType } from "react";

export type CategoryConfig = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  badge: string;
};

export const TASK_CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  asset_return: {
    key: "asset_return",
    label: "Pengembalian Aset",
    icon: Laptop,
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    badge: "border-blue-300 text-blue-700 dark:text-blue-300",
  },
  access_revoke: {
    key: "access_revoke",
    label: "Cabut Akses",
    icon: ShieldOff,
    iconBg: "bg-red-500/10 text-red-600 dark:text-red-400",
    badge: "border-red-300 text-red-700 dark:text-red-300",
  },
  handover: {
    key: "handover",
    label: "Handover",
    icon: LinkIcon,
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    badge: "border-violet-300 text-violet-700 dark:text-violet-300",
  },
  payroll: {
    key: "payroll",
    label: "Payroll Akhir",
    icon: Wallet,
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badge: "border-emerald-300 text-emerald-700 dark:text-emerald-300",
  },
  exit_interview: {
    key: "exit_interview",
    label: "Exit Interview",
    icon: MessageSquareHeart,
    iconBg: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    badge: "border-pink-300 text-pink-700 dark:text-pink-300",
  },
  it: {
    key: "it",
    label: "IT",
    icon: Laptop,
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    badge: "border-sky-300 text-sky-700 dark:text-sky-300",
  },
  hr: {
    key: "hr",
    label: "HR",
    icon: Users,
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badge: "border-amber-300 text-amber-700 dark:text-amber-300",
  },
  finance: {
    key: "finance",
    label: "Keuangan",
    icon: HandCoins,
    iconBg: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
    badge: "border-lime-300 text-lime-700 dark:text-lime-300",
  },
  legal: {
    key: "legal",
    label: "Legal",
    icon: Scale,
    iconBg: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    badge: "border-slate-300 text-slate-700 dark:text-slate-300",
  },
  other: {
    key: "other",
    label: "Lainnya",
    icon: FileText,
    iconBg: "bg-muted text-muted-foreground",
    badge: "border-muted-foreground/30 text-muted-foreground",
  },
};

export function getCategoryConfig(key: string): CategoryConfig {
  return TASK_CATEGORY_CONFIG[key] ?? TASK_CATEGORY_CONFIG.other;
}

export const OWNER_LABELS: Record<string, string> = {
  hr: "HR",
  it: "IT",
  manager: "Atasan",
  employee: "Karyawan",
  finance: "Keuangan",
  legal: "Legal",
  other: "Lainnya",
};

export const EXIT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: ComponentType<{ className?: string }>; color: string }
> = {
  resignation: {
    label: "Resign",
    icon: LogOut,
    color: "text-blue-600 dark:text-blue-400",
  },
  termination: {
    label: "PHK / Terminasi",
    icon: UserX,
    color: "text-red-600 dark:text-red-400",
  },
  retirement: {
    label: "Pensiun",
    icon: HeartHandshake,
    color: "text-amber-600 dark:text-amber-400",
  },
  contract_end: {
    label: "Kontrak Berakhir",
    icon: FileClock,
    color: "text-violet-600 dark:text-violet-400",
  },
  mutual: {
    label: "Kesepakatan Bersama",
    icon: Briefcase,
    color: "text-emerald-600 dark:text-emerald-400",
  },
};

export function getExitTypeConfig(key: string) {
  return EXIT_TYPE_CONFIG[key] ?? EXIT_TYPE_CONFIG.resignation;
}

export const REASON_CATEGORY_LABELS: Record<string, string> = {
  voluntary: "Sukarela",
  involuntary: "Tidak Sukarela",
  retirement: "Pensiun",
  contract_end: "Akhir Kontrak",
  other: "Lainnya",
};

export const PRIMARY_REASON_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "better_opportunity", label: "Peluang karir yang lebih baik" },
  { key: "compensation", label: "Kompensasi / gaji" },
  { key: "management", label: "Manajemen / atasan" },
  { key: "work_life", label: "Work-life balance" },
  { key: "growth", label: "Pertumbuhan karir terbatas" },
  { key: "relocation", label: "Pindah domisili" },
  { key: "health", label: "Alasan kesehatan / pribadi" },
  { key: "culture", label: "Budaya kerja" },
  { key: "retirement", label: "Pensiun" },
  { key: "other", label: "Lainnya" },
];

export const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-300",
  withdrawn: "bg-muted text-muted-foreground",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300",
  in_progress: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-300",
  cancelled: "bg-muted text-muted-foreground",
  todo: "bg-muted text-muted-foreground",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300",
  skipped: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300",
  reviewed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  withdrawn: "Dibatalkan",
  completed: "Selesai",
  in_progress: "Berjalan",
  cancelled: "Dibatalkan",
  todo: "Belum",
  done: "Selesai",
  skipped: "Dilewati",
  submitted: "Terkirim",
  reviewed: "Direview",
};

export function formatOffsetDays(days: number): string {
  if (days === 0) return "Hari terakhir";
  if (days < 0) return `${Math.abs(days)} hari sebelum`;
  return `${days} hari setelah`;
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "-";
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return 0;
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => Number(n));
  const target = new Date(y, m - 1, d).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}
