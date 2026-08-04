import {
  Plane,
  Utensils,
  Package,
  GraduationCap,
  Car,
  Receipt,
  Briefcase,
  Building2,
  Wrench,
  Megaphone,
  Heart,
  Gift,
  Fuel,
  Laptop,
  Phone,
  Wifi,
  ShoppingCart,
  Coffee,
  Home,
  Users,
  FileText,
  CreditCard,
  Truck,
  Hotel,
  Stethoscope,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type ExpenseCategory =
  | "travel"
  | "meal"
  | "supplies"
  | "training"
  | "transport"
  | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid";

export type CategoryDisplay = {
  label: string;
  icon: LucideIcon;
  badge: string;
  iconBg: string;
};

// ── Icon whitelist ─────────────────────────────────────────────────────────
// Admins choose an icon by name; these are the only allowed values. Both the
// backend validator and the frontend renderer rely on this shared list.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Plane,
  Utensils,
  Package,
  GraduationCap,
  Car,
  Receipt,
  Briefcase,
  Building2,
  Wrench,
  Megaphone,
  Heart,
  Gift,
  Fuel,
  Laptop,
  Phone,
  Wifi,
  ShoppingCart,
  Coffee,
  Home,
  Users,
  FileText,
  CreditCard,
  Truck,
  Hotel,
  Stethoscope,
  Zap,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? Receipt;
}

// ── Color whitelist ────────────────────────────────────────────────────────
// Each color key maps to a badge + icon background using semantic-friendly
// Tailwind classes that read well in both light and dark mode.
export const CATEGORY_COLORS: Record<
  string,
  { label: string; badge: string; iconBg: string; swatch: string }
> = {
  sky: {
    label: "Biru Langit",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    swatch: "#0ea5e9",
  },
  orange: {
    label: "Oranye",
    badge:
      "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
    iconBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    swatch: "#f97316",
  },
  purple: {
    label: "Ungu",
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    swatch: "#a855f7",
  },
  indigo: {
    label: "Nila",
    badge:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    swatch: "#6366f1",
  },
  teal: {
    label: "Toska",
    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    swatch: "#14b8a6",
  },
  emerald: {
    label: "Hijau",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    swatch: "#10b981",
  },
  rose: {
    label: "Merah Muda",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    swatch: "#f43f5e",
  },
  amber: {
    label: "Kuning",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    swatch: "#f59e0b",
  },
  blue: {
    label: "Biru",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    swatch: "#3b82f6",
  },
  violet: {
    label: "Violet",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    swatch: "#8b5cf6",
  },
  slate: {
    label: "Abu-abu",
    badge: "bg-muted text-muted-foreground border-border",
    iconBg: "bg-muted text-muted-foreground",
    swatch: "#64748b",
  },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS);

// Shape of a category record coming from the backend.
export type ExpenseCategoryRecord = {
  key: string;
  label: string;
  icon: string;
  color: string;
  isActive: boolean;
  order: number;
};

// Build a display config (icon component + tailwind classes) from a record.
export function categoryDisplayFromRecord(
  rec: Pick<ExpenseCategoryRecord, "label" | "icon" | "color">,
): CategoryDisplay {
  const color = CATEGORY_COLORS[rec.color] ?? CATEGORY_COLORS.slate;
  return {
    label: rec.label,
    icon: getCategoryIcon(rec.icon),
    badge: color.badge,
    iconBg: color.iconBg,
  };
}

// Built-in default categories. Mirrors DEFAULT_EXPENSE_CATEGORIES in the
// backend and is used as a fallback when an org has no custom categories.
export const DEFAULT_CATEGORY_RECORDS: Array<ExpenseCategoryRecord> = [
  { key: "travel", label: "Perjalanan Dinas", icon: "Plane", color: "sky", isActive: true, order: 1 },
  { key: "meal", label: "Makan & Jamuan", icon: "Utensils", color: "orange", isActive: true, order: 2 },
  { key: "supplies", label: "Perlengkapan Kantor", icon: "Package", color: "purple", isActive: true, order: 3 },
  { key: "training", label: "Pelatihan", icon: "GraduationCap", color: "indigo", isActive: true, order: 4 },
  { key: "transport", label: "Transportasi", icon: "Car", color: "teal", isActive: true, order: 5 },
  { key: "other", label: "Lainnya", icon: "Receipt", color: "slate", isActive: true, order: 6 },
];

export const CATEGORY_CONFIG: Record<ExpenseCategory, CategoryDisplay> = {
  travel: categoryDisplayFromRecord(DEFAULT_CATEGORY_RECORDS[0]!),
  meal: categoryDisplayFromRecord(DEFAULT_CATEGORY_RECORDS[1]!),
  supplies: categoryDisplayFromRecord(DEFAULT_CATEGORY_RECORDS[2]!),
  training: categoryDisplayFromRecord(DEFAULT_CATEGORY_RECORDS[3]!),
  transport: categoryDisplayFromRecord(DEFAULT_CATEGORY_RECORDS[4]!),
  other: categoryDisplayFromRecord(DEFAULT_CATEGORY_RECORDS[5]!),
};

export const STATUS_CONFIG: Record<
  ExpenseStatus,
  { label: string; badge: string }
> = {
  pending: {
    label: "Menunggu",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  approved: {
    label: "Disetujui",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  rejected: {
    label: "Ditolak",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
  },
  paid: {
    label: "Dibayar",
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
};

export type AdvanceStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disbursed"
  | "settled"
  | "cancelled";

export const ADVANCE_STATUS_CONFIG: Record<
  AdvanceStatus,
  { label: string; badge: string }
> = {
  pending: {
    label: "Menunggu",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  approved: {
    label: "Disetujui",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  rejected: {
    label: "Ditolak",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
  },
  disbursed: {
    label: "Dicairkan",
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  },
  settled: {
    label: "Diselesaikan",
    badge:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  cancelled: {
    label: "Dibatalkan",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export function getAdvanceStatusConfig(status: string) {
  if (status in ADVANCE_STATUS_CONFIG) {
    return ADVANCE_STATUS_CONFIG[status as AdvanceStatus];
  }
  return ADVANCE_STATUS_CONFIG.pending;
}

export type PaymentMethod = "transfer" | "cash" | "petty_cash" | "other";
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: "Transfer Bank",
  cash: "Tunai",
  petty_cash: "Kas Kecil",
  other: "Lainnya",
};

export function getCategoryConfig(category: string) {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as ExpenseCategory];
  }
  return CATEGORY_CONFIG.other;
}

// Build a key -> display map from a list of category records. Used across the
// finance UI so custom categories render with the right label/icon/color.
export function buildCategoryDisplayMap(
  records: ReadonlyArray<
    Pick<ExpenseCategoryRecord, "key" | "label" | "icon" | "color">
  >,
): Record<string, CategoryDisplay> {
  const map: Record<string, CategoryDisplay> = {};
  for (const rec of records) {
    map[rec.key] = categoryDisplayFromRecord(rec);
  }
  return map;
}

// Resolve a category's display from a live map, falling back to defaults and
// finally to the generic "other" style so unknown/legacy keys still render.
export function resolveCategoryDisplay(
  key: string,
  map: Record<string, CategoryDisplay>,
): CategoryDisplay {
  if (map[key]) return map[key];
  if (key in CATEGORY_CONFIG) return CATEGORY_CONFIG[key as ExpenseCategory];
  return {
    label: key,
    icon: getCategoryIcon("Receipt"),
    badge: CATEGORY_COLORS.slate!.badge,
    iconBg: CATEGORY_COLORS.slate!.iconBg,
  };
}

export function getStatusConfig(status: string) {
  if (status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as ExpenseStatus];
  }
  return STATUS_CONFIG.pending;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatExpenseDate(iso: string): string {
  // iso: YYYY-MM-DD - render in user locale without timezone shift
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

// Max receipt upload size: 10 MB (typical receipt)
export const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;

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

// --- CSV helpers -----------------------------------------------------------
export function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells
    .map((c) => {
      if (c === null || c === undefined) return "";
      const s = String(c);
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

export function downloadCsv(filename: string, rows: Array<string>): void {
  const blob = new Blob(["\uFEFF" + rows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
