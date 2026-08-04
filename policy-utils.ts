import type { LucideIcon } from "lucide-react";
import {
  Shield,
  Users,
  Lock,
  Laptop,
  Wallet,
  Home,
  HeartPulse,
  CalendarDays,
  Gift,
  Plane,
  FileText,
} from "lucide-react";

export type PolicyCategoryKey =
  | "code_of_conduct"
  | "hr"
  | "security"
  | "it"
  | "finance"
  | "wfh"
  | "safety"
  | "leave"
  | "benefits"
  | "travel"
  | "other";

export type PolicyCategoryMeta = {
  key: PolicyCategoryKey;
  label: string;
  icon: LucideIcon;
  description: string;
  tone: string; // tailwind bg/text classes
};

export const POLICY_CATEGORIES: ReadonlyArray<PolicyCategoryMeta> = [
  {
    key: "code_of_conduct",
    label: "Kode Etik",
    icon: Shield,
    description: "Nilai, etika, dan perilaku karyawan",
    tone: "bg-primary/10 text-primary",
  },
  {
    key: "hr",
    label: "SDM",
    icon: Users,
    description: "Kebijakan kepegawaian & hubungan kerja",
    tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    key: "security",
    label: "Keamanan",
    icon: Lock,
    description: "Keamanan data, informasi, dan akses",
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    key: "it",
    label: "Teknologi",
    icon: Laptop,
    description: "Penggunaan perangkat & sistem IT",
    tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "finance",
    label: "Keuangan",
    icon: Wallet,
    description: "Reimbursement, pengadaan, kas",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "wfh",
    label: "Kerja Remote",
    icon: Home,
    description: "Panduan kerja jarak jauh / hybrid",
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    key: "safety",
    label: "K3",
    icon: HeartPulse,
    description: "Keselamatan & kesehatan kerja",
    tone: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  {
    key: "leave",
    label: "Cuti",
    icon: CalendarDays,
    description: "Aturan cuti, izin, dan absensi",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    key: "benefits",
    label: "Benefit",
    icon: Gift,
    description: "Tunjangan, asuransi, fasilitas",
    tone: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  },
  {
    key: "travel",
    label: "Perjalanan Dinas",
    icon: Plane,
    description: "Aturan perjalanan & akomodasi",
    tone: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    key: "other",
    label: "Lainnya",
    icon: FileText,
    description: "Regulasi umum lainnya",
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
];

export const POLICY_CATEGORY_BY_KEY: Record<string, PolicyCategoryMeta> =
  POLICY_CATEGORIES.reduce(
    (acc, c) => {
      acc[c.key] = c;
      return acc;
    },
    {} as Record<string, PolicyCategoryMeta>,
  );

export function getPolicyCategory(key: string): PolicyCategoryMeta {
  return POLICY_CATEGORY_BY_KEY[key] ?? POLICY_CATEGORIES[POLICY_CATEGORIES.length - 1];
}

export function formatEffectiveDate(iso: string): string {
  // iso is YYYY-MM-DD
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = now - then;
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan lalu`;
  const years = Math.floor(days / 365);
  return `${years} tahun lalu`;
}
