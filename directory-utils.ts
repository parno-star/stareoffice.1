import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import type { DirectorySkill } from "@/convex/directory.js";
import { formatIsoFullDate } from "@/pages/celebrations/_lib/celebrations-utils.ts";
import { computeAge, computeTenure, formatNumberValue, isMasaKerjaLabel, isUsiaLabel } from "./directory-columns.ts";

export type DirectoryView = "grid" | "list" | "table" | "departments" | "tree" | "skills";

export type ColorToken =
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "sky"
  | "indigo"
  | "teal";

const DEPT_COLOR_SEQ: ReadonlyArray<ColorToken> = [
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "sky",
  "indigo",
  "teal",
];

export function colorForDepartment(
  name: string | null | undefined,
): ColorToken {
  if (!name) return "blue";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DEPT_COLOR_SEQ.length;
  return DEPT_COLOR_SEQ[idx] ?? "blue";
}

export const COLOR_CLASSES: Record<
  ColorToken,
  { bg: string; text: string; border: string; chip: string; accent: string }
> = {
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    accent: "bg-blue-500",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    accent: "bg-emerald-500",
  },
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/20",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    accent: "bg-violet-500",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    accent: "bg-amber-500",
  },
  rose: {
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/20",
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    accent: "bg-rose-500",
  },
  sky: {
    bg: "bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-500/20",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    accent: "bg-sky-500",
  },
  indigo: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/20",
    chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    accent: "bg-indigo-500",
  },
  teal: {
    bg: "bg-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-500/20",
    chip: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
    accent: "bg-teal-500",
  },
};

export const SKILL_CATEGORY_LABELS: Record<string, string> = {
  technical: "Teknis",
  soft: "Soft Skill",
  language: "Bahasa",
  certification: "Sertifikasi",
  tool: "Tools",
};

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function toCsv(
  entries: Array<{
    user: Doc<"users">;
    managerName: string | null;
    directReportCount: number;
    skills: Array<DirectorySkill>;
  }>,
): string {
  const header = [
    "Nama",
    "Email",
    "Telepon",
    "Jabatan",
    "Departemen",
    "Lokasi",
    "Atasan",
    "Jumlah Bawahan Langsung",
    "Keahlian",
  ];
  const rows = entries.map((e) => [
    e.user.name ?? "",
    e.user.email ?? "",
    e.user.phone ?? "",
    e.user.jobTitle ?? "",
    e.user.department ?? "",
    e.user.location ?? "",
    e.managerName ?? "",
    String(e.directReportCount),
    e.skills.map((s) => `${s.skill} (${s.level}/5)`).join("; "),
  ]);

  const escape = (value: string): string => {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [header, ...rows].map((row) =>
    row.map((cell) => escape(String(cell))).join(","),
  );
  // UTF-8 BOM for Excel compatibility
  return "\uFEFF" + lines.join("\n");
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Generate and download a PDF of the directory using jsPDF + autotable.
export async function exportDirectoryPdf(
  entries: Array<{
    user: Doc<"users">;
    managerName: string | null;
    directReportCount: number;
    skills: Array<DirectorySkill>;
  }>,
  orgName?: string,
  customFieldDefs?: Array<Doc<"directoryFields">>,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const fields = customFieldDefs ?? [];

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const title = "Direktori Karyawan";
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  doc.setFontSize(16);
  doc.text(orgName ? orgName : title, 40, 40);
  if (orgName) {
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(title, 40, 58);
  }
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(`Dicetak: ${dateStr}  •  Total: ${entries.length} karyawan`, 40, orgName ? 74 : 58);

  // Column order matches the on-screen table:
  // No, Nama, [custom fields...], Jabatan, Departemen, Email, Telepon, Lokasi, Atasan.
  const head = [
    [
      "No",
      "Nama",
      ...fields.map((f) => f.label),
      "Jabatan",
      "Departemen",
      "Email",
      "Telepon",
      "Lokasi",
      "Atasan",
    ],
  ];
  const body = entries.map((e, i) => [
    String(i + 1),
    e.user.name ?? "-",
    ...fields.map((def) => {
      if (isMasaKerjaLabel(def.label)) {
        return computeTenure(e.user.startDate) ?? "-";
      }
      if (isUsiaLabel(def.label)) {
        return computeAge(e.user.dateOfBirth) ?? "-";
      }
      const raw = (e.user.customFields ?? {})[def._id];
      if (!raw || raw.trim().length === 0) return "-";
      if (def.type === "date") return formatIsoFullDate(raw);
      if (def.type === "number") return formatNumberValue(raw);
      return raw;
    }),
    e.user.jobTitle ?? "-",
    e.user.department ?? "-",
    e.user.email ?? "-",
    e.user.phone ?? "-",
    e.user.location ?? "-",
    e.managerName ?? "-",
  ]);

  autoTable(doc, {
    head,
    body,
    startY: orgName ? 88 : 72,
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 0: { cellWidth: 28, halign: "center" } },
    margin: { left: 40, right: 40 },
  });

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`direktori-karyawan-${date}.pdf`);
}

