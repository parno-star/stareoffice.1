import { formatCurrency, formatDate } from "../../fund-requests/_lib/fund-utils.ts";

// ─── Action Labels ──────────────────────────────────────────────────────────

export type AuditAction =
  | "created"
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "resubmitted"
  | "disbursed"
  | "cancelled"
  | "delegated";

type ActionVisual = {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: string; // lucide icon name hint
};

export const AUDIT_ACTION_CONFIG: Record<AuditAction, ActionVisual> = {
  created: {
    label: "Dibuat",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    icon: "FilePlus",
  },
  submitted: {
    label: "Diajukan",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: "Send",
  },
  approved: {
    label: "Disetujui",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: "CheckCircle2",
  },
  rejected: {
    label: "Ditolak",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: "XCircle",
  },
  revision_requested: {
    label: "Minta Revisi",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    icon: "RotateCcw",
  },
  resubmitted: {
    label: "Dikirim Ulang",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    icon: "RefreshCw",
  },
  disbursed: {
    label: "Dicairkan",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    icon: "Banknote",
  },
  cancelled: {
    label: "Dibatalkan",
    color: "text-slate-500 dark:text-slate-500",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    icon: "CircleX",
  },
  delegated: {
    label: "Didelegasikan",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    icon: "UserCheck",
  },
};

export function getActionConfig(action: string): ActionVisual {
  return AUDIT_ACTION_CONFIG[action as AuditAction] ?? AUDIT_ACTION_CONFIG.created;
}

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_CONFIG).map(
  ([key, cfg]) => ({ value: key, label: cfg.label }),
);

// ─── Helpers ────────────────────────────────────────────────────────────────

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimestampShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { formatCurrency, formatDate };
