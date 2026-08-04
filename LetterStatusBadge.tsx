import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:    { label: "Konsep",       className: "bg-gray-100 text-gray-700 border-gray-300" },
  review:   { label: "Menunggu Persetujuan", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  approved: { label: "Disetujui",    className: "bg-green-100 text-green-800 border-green-300" },
  sent:     { label: "Terkirim",     className: "bg-blue-100 text-blue-800 border-blue-300" },
  received: { label: "Diterima",     className: "bg-teal-100 text-teal-800 border-teal-300" },
  archived: { label: "Diarsipkan",   className: "bg-purple-100 text-purple-800 border-purple-300" },
  rejected: { label: "Ditolak",      className: "bg-red-100 text-red-800 border-red-300" },
  revision: { label: "Perlu Revisi", className: "bg-orange-100 text-orange-800 border-orange-300" },
  frozen:   { label: "Dibekukan (Arsip Mati)", className: "bg-slate-200 text-slate-700 border-slate-400" },
};

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  masuk:    { label: "Surat Masuk",  className: "bg-teal-100 text-teal-800 border-teal-300" },
  keluar:   { label: "Surat Keluar", className: "bg-blue-100 text-blue-800 border-blue-300" },
  internal: { label: "Internal",     className: "bg-orange-100 text-orange-800 border-orange-300" },
  memo:     { label: "Nota",         className: "bg-violet-100 text-violet-800 border-violet-300" },
};

const CLASSIFICATION_CONFIG: Record<string, { label: string; className: string }> = {
  biasa:          { label: "Biasa",         className: "bg-gray-100 text-gray-600" },
  segera:         { label: "Segera",         className: "bg-yellow-100 text-yellow-700" },
  sangat_segera:  { label: "Sangat Segera", className: "bg-orange-100 text-orange-700" },
  rahasia:        { label: "Rahasia",        className: "bg-red-100 text-red-700" },
  sangat_rahasia: { label: "Sangat Rahasia", className: "bg-red-200 text-red-900 font-bold" },
};

export function LetterStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export function LetterTypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export function ClassificationBadge({ classification }: { classification: string }) {
  const cfg = CLASSIFICATION_CONFIG[classification] ?? { label: classification, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
