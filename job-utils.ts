import {
  Briefcase,
  Clock,
  CalendarClock,
  FileSignature,
  UserCog,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export type EmploymentType =
  | "fulltime"
  | "parttime"
  | "contract"
  | "internship"
  | "temporary";

export type JobLevel = "entry" | "mid" | "senior" | "lead" | "manager";

export type JobStatus = "open" | "closed";

export type ApplicationStatus =
  | "submitted"
  | "reviewing"
  | "interview"
  | "accepted"
  | "rejected"
  | "withdrawn";

export const EMPLOYMENT_TYPE_CONFIG: Record<
  EmploymentType,
  { label: string; icon: LucideIcon; badge: string }
> = {
  fulltime: {
    label: "Full-time",
    icon: Briefcase,
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  parttime: {
    label: "Part-time",
    icon: Clock,
    badge:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  contract: {
    label: "Kontrak",
    icon: FileSignature,
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  internship: {
    label: "Magang",
    icon: GraduationCap,
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  temporary: {
    label: "Sementara",
    icon: CalendarClock,
    badge:
      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
  },
};

export const LEVEL_CONFIG: Record<
  JobLevel,
  { label: string; badge: string }
> = {
  entry: {
    label: "Entry Level",
    badge:
      "bg-muted text-foreground/80 border-border",
  },
  mid: {
    label: "Menengah",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  senior: {
    label: "Senior",
    badge:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  },
  lead: {
    label: "Lead",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  manager: {
    label: "Manajer",
    badge:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
};

export const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; badge: string }
> = {
  open: {
    label: "Dibuka",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  closed: {
    label: "Ditutup",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export const APPLICATION_STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badge: string; description: string }
> = {
  submitted: {
    label: "Terkirim",
    badge:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
    description: "Menunggu ditinjau",
  },
  reviewing: {
    label: "Ditinjau",
    badge:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
    description: "Sedang dievaluasi tim rekrutmen",
  },
  interview: {
    label: "Interview",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
    description: "Diundang ke tahap interview",
  },
  accepted: {
    label: "Diterima",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    description: "Selamat! Lamaran diterima",
  },
  rejected: {
    label: "Ditolak",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
    description: "Belum dapat dilanjutkan",
  },
  withdrawn: {
    label: "Ditarik",
    badge: "bg-muted text-muted-foreground border-border",
    description: "Ditarik oleh pelamar",
  },
};

export function getEmploymentTypeConfig(value: string) {
  if (value in EMPLOYMENT_TYPE_CONFIG) {
    return EMPLOYMENT_TYPE_CONFIG[value as EmploymentType];
  }
  return EMPLOYMENT_TYPE_CONFIG.fulltime;
}

export function getLevelConfig(value: string) {
  if (value in LEVEL_CONFIG) {
    return LEVEL_CONFIG[value as JobLevel];
  }
  return LEVEL_CONFIG.mid;
}

export function getStatusConfig(value: string) {
  if (value in STATUS_CONFIG) {
    return STATUS_CONFIG[value as JobStatus];
  }
  return STATUS_CONFIG.open;
}

export function getApplicationStatusConfig(value: string) {
  if (value in APPLICATION_STATUS_CONFIG) {
    return APPLICATION_STATUS_CONFIG[value as ApplicationStatus];
  }
  return APPLICATION_STATUS_CONFIG.submitted;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSalaryRange(
  min: number | undefined,
  max: number | undefined,
): string | null {
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined) {
    return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  }
  if (min !== undefined) return `Mulai ${formatCurrency(min)}`;
  if (max !== undefined) return `Hingga ${formatCurrency(max)}`;
  return null;
}

export function formatJobDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function isJobClosingSoon(closingDate: string | undefined): boolean {
  if (!closingDate) return false;
  const [y, m, d] = closingDate.split("-").map((n) => Number(n));
  if (!y || !m || !d) return false;
  const closing = new Date(y, m - 1, d).getTime();
  const now = Date.now();
  const diff = closing - now;
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

export function isJobClosed(closingDate: string | undefined): boolean {
  if (!closingDate) return false;
  const [y, m, d] = closingDate.split("-").map((n) => Number(n));
  if (!y || !m || !d) return false;
  // Consider the job open until end of the closing day
  const closing = new Date(y, m - 1, d, 23, 59, 59).getTime();
  return closing < Date.now();
}

export const MAX_RESUME_SIZE = 10 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"] as const;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
