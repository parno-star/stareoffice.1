import {
  FileText,
  BookOpen,
  FileCheck2,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  type LucideIcon,
} from "lucide-react";

export type DocumentCategory =
  | "policy"
  | "sop"
  | "form"
  | "template"
  | "other";

export const CATEGORY_CONFIG: Record<
  DocumentCategory,
  { label: string; badge: string; dot: string }
> = {
  policy: {
    label: "Kebijakan",
    badge:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    dot: "bg-blue-500",
  },
  sop: {
    label: "SOP",
    badge:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
    dot: "bg-purple-500",
  },
  form: {
    label: "Formulir",
    badge:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  template: {
    label: "Template",
    badge:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
  },
  other: {
    label: "Lainnya",
    badge:
      "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

export function getCategoryLabel(category: string): string {
  if (category in CATEGORY_CONFIG) {
    return CATEGORY_CONFIG[category as DocumentCategory].label;
  }
  return "Lainnya";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getFileIcon(fileType: string, fileName: string): LucideIcon {
  const lower = fileName.toLowerCase();
  if (
    fileType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(lower)
  ) {
    return FileImage;
  }
  if (
    fileType.includes("pdf") ||
    lower.endsWith(".pdf")
  ) {
    return FileCheck2;
  }
  if (
    fileType.includes("spreadsheet") ||
    fileType.includes("excel") ||
    /\.(xlsx?|csv)$/i.test(lower)
  ) {
    return FileSpreadsheet;
  }
  if (
    fileType.includes("zip") ||
    fileType.includes("rar") ||
    /\.(zip|rar|7z|tar|gz)$/i.test(lower)
  ) {
    return FileArchive;
  }
  if (
    fileType.includes("word") ||
    /\.(docx?)$/i.test(lower)
  ) {
    return BookOpen;
  }
  return FileText;
}

// Max upload size: 25 MB (keeps uploads reasonable and avoids Convex limits)
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
