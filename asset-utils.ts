import {
  Laptop,
  Monitor,
  Smartphone,
  Mouse,
  Armchair,
  Car,
  AppWindow,
  Package,
  type LucideIcon,
} from "lucide-react";

export type AssetCategory =
  | "laptop"
  | "monitor"
  | "phone"
  | "peripheral"
  | "furniture"
  | "vehicle"
  | "software"
  | "other";

export type AssetStatus = "available" | "assigned" | "in_repair" | "retired";

export const CATEGORY_CONFIG: Record<
  AssetCategory,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  laptop: {
    label: "Laptop",
    icon: Laptop,
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-500/10",
  },
  monitor: {
    label: "Monitor",
    icon: Monitor,
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-500/10",
  },
  phone: {
    label: "Ponsel",
    icon: Smartphone,
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  peripheral: {
    label: "Periferal",
    icon: Mouse,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10",
  },
  furniture: {
    label: "Furnitur",
    icon: Armchair,
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-500/10",
  },
  vehicle: {
    label: "Kendaraan",
    icon: Car,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/10",
  },
  software: {
    label: "Lisensi Software",
    icon: AppWindow,
    color: "text-cyan-700 dark:text-cyan-300",
    bg: "bg-cyan-500/10",
  },
  other: {
    label: "Lainnya",
    icon: Package,
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-500/10",
  },
};

export const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; color: string }
> = {
  available: {
    label: "Tersedia",
    color:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  assigned: {
    label: "Ditugaskan",
    color:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  in_repair: {
    label: "Perbaikan",
    color:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  retired: {
    label: "Pensiun",
    color:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
};

export function getCategoryConfig(category: string) {
  return (
    CATEGORY_CONFIG[category as AssetCategory] ?? CATEGORY_CONFIG.other
  );
}

export function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status as AssetStatus] ?? {
      label: status,
      color:
        "bg-muted text-muted-foreground border-border",
    }
  );
}

export function formatIdr(amount: number | undefined): string {
  if (amount === undefined) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
