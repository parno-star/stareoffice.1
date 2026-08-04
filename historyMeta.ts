import {
  FilePlus2, FilePen, Send, Inbox, CheckCircle2, CheckCheck, XCircle,
  RotateCcw, GitFork, ClipboardCheck, Archive, PenLine, Eraser,
  Paperclip, Trash2, History, Mail, Snowflake, MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HistoryMeta = {
  label: string;
  icon: LucideIcon;
  // Tailwind classes for the timeline dot
  dot: string;
};

// Maps raw letter history action keys to a friendly Indonesian label, icon,
// and color. Keep in sync with the addHistory() calls in convex/letters.ts.
const HISTORY_META: Record<string, HistoryMeta> = {
  created: {
    label: "Surat dibuat",
    icon: FilePlus2,
    dot: "border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
  },
  updated: {
    label: "Isi surat diperbarui",
    icon: FilePen,
    dot: "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
  },
  submitted_for_approval: {
    label: "Diajukan untuk persetujuan",
    icon: ClipboardCheck,
    dot: "border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
  },
  approved: {
    label: "Disetujui",
    icon: CheckCircle2,
    dot: "border-green-300 bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300",
  },
  fully_approved: {
    label: "Disetujui seluruhnya",
    icon: CheckCheck,
    dot: "border-green-400 bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  },
  rejected: {
    label: "Ditolak",
    icon: XCircle,
    dot: "border-red-300 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  },
  revision_requested: {
    label: "Dikembalikan untuk revisi",
    icon: RotateCcw,
    dot: "border-orange-300 bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300",
  },
  returned_to_reviewer: {
    label: "Dikembalikan ke pemeriksa",
    icon: RotateCcw,
    dot: "border-orange-300 bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300",
  },
  reviewer_note: {
    label: "Catatan pemeriksa",
    icon: MessageSquare,
    dot: "border-blue-300 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
  },
  frozen: {
    label: "Surat dibekukan (arsip mati)",
    icon: Snowflake,
    dot: "border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  },
  sent: {
    label: "Surat dikirim",
    icon: Send,
    dot: "border-violet-300 bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
  },
  email_sent: {
    label: "Dikirim via email",
    icon: Mail,
    dot: "border-sky-300 bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300",
  },
  received: {
    label: "Surat diterima",
    icon: Inbox,
    dot: "border-teal-300 bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300",
  },
  disposition_created: {
    label: "Disposisi diberikan",
    icon: GitFork,
    dot: "border-indigo-300 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  disposition_completed: {
    label: "Disposisi diselesaikan",
    icon: CheckCircle2,
    dot: "border-green-300 bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300",
  },
  archived: {
    label: "Surat diarsipkan",
    icon: Archive,
    dot: "border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
  },
  signed: {
    label: "Ditandatangani secara digital",
    icon: PenLine,
    dot: "border-emerald-300 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  signature_removed: {
    label: "Tanda tangan dihapus",
    icon: Eraser,
    dot: "border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  },
  attachment_added: {
    label: "Lampiran ditambahkan",
    icon: Paperclip,
    dot: "border-cyan-300 bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300",
  },
  attachment_deleted: {
    label: "Lampiran dihapus",
    icon: Trash2,
    dot: "border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  },
};

const FALLBACK: HistoryMeta = {
  label: "Aktivitas",
  icon: History,
  dot: "border-muted bg-muted text-muted-foreground",
};

export function getHistoryMeta(action: string): HistoryMeta {
  return HISTORY_META[action] ?? { ...FALLBACK, label: action.replace(/_/g, " ") };
}
