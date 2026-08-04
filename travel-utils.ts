import {
  Plane,
  Train,
  Bus,
  Car,
  Ship,
  Navigation,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  CircleDashed,
  Flag,
  type LucideIcon,
} from "lucide-react";

export type TransportMode = "flight" | "train" | "bus" | "car" | "ship" | "other";

export type TravelStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled";

export const TRANSPORT_CONFIG: Record<
  TransportMode,
  { label: string; icon: LucideIcon; accent: string; iconBg: string }
> = {
  flight: {
    label: "Pesawat",
    icon: Plane,
    accent:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  train: {
    label: "Kereta Api",
    icon: Train,
    accent:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  bus: {
    label: "Bus",
    icon: Bus,
    accent:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  car: {
    label: "Mobil",
    icon: Car,
    accent:
      "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  ship: {
    label: "Kapal",
    icon: Ship,
    accent:
      "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
    iconBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  other: {
    label: "Lainnya",
    icon: Navigation,
    accent: "bg-muted text-muted-foreground border-border",
    iconBg: "bg-muted text-muted-foreground",
  },
};

export const STATUS_CONFIG: Record<
  TravelStatus,
  { label: string; badge: string; icon: LucideIcon }
> = {
  draft: {
    label: "Draft",
    badge: "bg-muted text-muted-foreground border-border",
    icon: FileText,
  },
  pending: {
    label: "Menunggu",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    icon: Clock,
  },
  approved: {
    label: "Disetujui",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Ditolak",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
    icon: XCircle,
  },
  in_progress: {
    label: "Sedang Berjalan",
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    icon: MapPin,
  },
  completed: {
    label: "Selesai",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
    icon: Flag,
  },
  cancelled: {
    label: "Dibatalkan",
    badge: "bg-muted text-muted-foreground border-border line-through",
    icon: CircleDashed,
  },
};

export function getTransportConfig(mode: string) {
  if (mode in TRANSPORT_CONFIG) {
    return TRANSPORT_CONFIG[mode as TransportMode];
  }
  return TRANSPORT_CONFIG.other;
}

export function getStatusConfig(status: string) {
  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as TravelStatus];
  }
  return STATUS_CONFIG.draft;
}

export function formatCurrency(amount: number, currency: string = "IDR"): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("id-ID")}`;
  }
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatRange(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatDate(startIso);
  const [sy, sm] = startIso.split("-");
  const [ey, em] = endIso.split("-");
  if (sy === ey && sm === em) {
    const [, , sd] = startIso.split("-");
    const [, , ed] = endIso.split("-");
    return `${Number(sd)}–${Number(ed)} ${formatDate(startIso).split(" ").slice(1).join(" ")}`;
  }
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  const diff = e.getTime() - s.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

export function enumerateDates(startIso: string, endIso: string): Array<string> {
  const out: Array<string> = [];
  if (startIso > endIso) return out;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
