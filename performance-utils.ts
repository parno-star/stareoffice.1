export type ReviewStatus = "draft" | "submitted" | "acknowledged";

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Draf",
  submitted: "Menunggu konfirmasi",
  acknowledged: "Dikonfirmasi karyawan",
};

export const STATUS_BADGES: Record<ReviewStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  submitted:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  acknowledged:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
};

export const RATING_DIMENSIONS = [
  { key: "qualityRating", label: "Kualitas Pekerjaan" },
  { key: "productivityRating", label: "Produktivitas" },
  { key: "communicationRating", label: "Komunikasi" },
  { key: "teamworkRating", label: "Kerjasama Tim" },
  { key: "initiativeRating", label: "Inisiatif" },
] as const;

export type RatingKey = (typeof RATING_DIMENSIONS)[number]["key"];

export function ratingLabel(n: number | null | undefined): string {
  if (n === null || n === undefined) return "Belum dinilai";
  if (n >= 4.5) return "Luar biasa";
  if (n >= 3.5) return "Melebihi ekspektasi";
  if (n >= 2.5) return "Memenuhi ekspektasi";
  if (n >= 1.5) return "Perlu peningkatan";
  return "Di bawah ekspektasi";
}

export function ratingColor(n: number | null | undefined): string {
  if (n === null || n === undefined) return "text-muted-foreground";
  if (n >= 4) return "text-emerald-600 dark:text-emerald-400";
  if (n >= 3) return "text-blue-600 dark:text-blue-400";
  if (n >= 2) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

// Build a suggested list of periods (this year + previous year).
export function suggestPeriods(year: number): Array<{
  value: string;
  label: string;
}> {
  const list: Array<{ value: string; label: string }> = [];
  for (const y of [year, year - 1]) {
    list.push({ value: `${y}-annual`, label: `Tahunan ${y}` });
    list.push({ value: `${y}-H2`, label: `Semester 2 ${y}` });
    list.push({ value: `${y}-H1`, label: `Semester 1 ${y}` });
    list.push({ value: `${y}-Q4`, label: `Q4 ${y}` });
    list.push({ value: `${y}-Q3`, label: `Q3 ${y}` });
    list.push({ value: `${y}-Q2`, label: `Q2 ${y}` });
    list.push({ value: `${y}-Q1`, label: `Q1 ${y}` });
  }
  return list;
}
