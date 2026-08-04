// Shared helpers, colors, and constants for the Talent Management module.

export type BoxCode =
  | "risk"
  | "effective"
  | "solid_performer"
  | "enigma"
  | "core"
  | "high_performer"
  | "rough_diamond"
  | "growth"
  | "star";

export type BoxMeta = {
  code: BoxCode;
  label: string;
  shortLabel: string;
  description: string;
  action: string;
  tone: "rose" | "amber" | "emerald" | "sky" | "violet";
  bg: string;
  border: string;
  text: string;
  chip: string;
};

export const BOX_META: Record<BoxCode, BoxMeta> = {
  star: {
    code: "star",
    label: "Future Leader",
    shortLabel: "Bintang",
    description: "Performa & potensi sama-sama tinggi. Kandidat utama succession.",
    action: "Promosi / leadership acceleration program",
    tone: "violet",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-300 dark:border-violet-700",
    text: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  high_performer: {
    code: "high_performer",
    label: "High Impact",
    shortLabel: "Performer Tinggi",
    description: "Kontribusi besar, potensi kepemimpinan berkembang.",
    action: "Stretch assignment, project leadership",
    tone: "emerald",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  solid_performer: {
    code: "solid_performer",
    label: "Trusted Professional",
    shortLabel: "Performer Solid",
    description: "Konsisten hasil tinggi. Fokus sebagai subject matter expert.",
    action: "Retensi, jalur karier spesialis",
    tone: "emerald",
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  growth: {
    code: "growth",
    label: "Growth Employee",
    shortLabel: "Bintang Berkembang",
    description: "Potensi tinggi, performa terus menanjak.",
    action: "Program pengembangan & exposure lintas fungsi",
    tone: "violet",
    bg: "bg-violet-50/60 dark:bg-violet-950/20",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  core: {
    code: "core",
    label: "Core Employee",
    shortLabel: "Inti Tim",
    description: "Tulang punggung organisasi dengan performa & potensi stabil.",
    action: "Klarifikasi jalur karier, cegah stagnasi",
    tone: "sky",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-700 dark:text-sky-300",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  effective: {
    code: "effective",
    label: "Effective",
    shortLabel: "Efektif",
    description: "Performa cukup, potensi pengembangan terbatas.",
    action: "Optimalisasi peran & produktivitas",
    tone: "amber",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  rough_diamond: {
    code: "rough_diamond",
    label: "Rough Diamond",
    shortLabel: "Berlian Kasar",
    description: "Potensi tinggi, performa belum maksimal.",
    action: "Mentoring intensif, reposisi peran",
    tone: "violet",
    bg: "bg-violet-50/40 dark:bg-violet-950/10",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  enigma: {
    code: "enigma",
    label: "Enigma",
    shortLabel: "Teka-teki",
    description: "Potensi menengah, performa belum stabil.",
    action: "Diagnosa gap & coaching cepat",
    tone: "amber",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  risk: {
    code: "risk",
    label: "Under Performer",
    shortLabel: "Risiko",
    description: "Performa & potensi rendah. Area risiko tertinggi.",
    action: "Performance Improvement Plan",
    tone: "rose",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-300 dark:border-rose-700",
    text: "text-rose-700 dark:text-rose-300",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  },
};

// Grid from top-left (low-perf, high-pot) to bottom-right (high-perf, low-pot).
// Rendered with 3 rows x 3 cols where row 0 = high potential (top).
export const GRID_LAYOUT: ReadonlyArray<ReadonlyArray<BoxCode>> = [
  ["rough_diamond", "growth", "star"],
  ["enigma", "core", "high_performer"],
  ["risk", "effective", "solid_performer"],
];

export function boxCodeFor(performance: number, potential: number): BoxCode {
  const perf = Math.max(1, Math.min(3, Math.round(performance)));
  const pot = Math.max(1, Math.min(3, Math.round(potential)));
  const map: Record<string, BoxCode> = {
    "1-1": "risk",
    "2-1": "effective",
    "3-1": "solid_performer",
    "1-2": "enigma",
    "2-2": "core",
    "3-2": "high_performer",
    "1-3": "rough_diamond",
    "2-3": "growth",
    "3-3": "star",
  };
  return map[`${perf}-${pot}`] ?? "core";
}

export function getBoxMeta(code: string | undefined | null): BoxMeta | null {
  if (!code) return null;
  if (code in BOX_META) return BOX_META[code as BoxCode];
  return null;
}

// ---- Cycle statuses ----------------------------------------------------

export const CYCLE_STATUS: Record<
  string,
  { label: string; description: string; tone: string }
> = {
  draft: {
    label: "Draft",
    description: "Siklus belum dimulai",
    tone: "bg-muted text-muted-foreground",
  },
  active: {
    label: "Berjalan",
    description: "Manajer sedang mengisi placement",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  calibration: {
    label: "Kalibrasi",
    description: "Komite melakukan kalibrasi",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  finalized: {
    label: "Difinalisasi",
    description: "Hasil sudah difinalisasi",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  closed: {
    label: "Ditutup",
    description: "Siklus arsip",
    tone: "bg-muted text-muted-foreground",
  },
};

export const PLACEMENT_STATUS: Record<
  string,
  { label: string; tone: string }
> = {
  pending: {
    label: "Menunggu",
    tone: "bg-muted text-muted-foreground",
  },
  draft: {
    label: "Draft Manajer",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  submitted: {
    label: "Dikirim",
    tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  },
  calibrated: {
    label: "Terkalibrasi",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  finalized: {
    label: "Final",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
};

// ---- Performance & potential descriptors ------------------------------

export const PERFORMANCE_LEVELS = [
  {
    value: 3,
    label: "Tinggi",
    description: "Melebihi target secara konsisten",
    tone: "bg-emerald-100 text-emerald-800",
  },
  {
    value: 2,
    label: "Sedang",
    description: "Sesuai ekspektasi",
    tone: "bg-sky-100 text-sky-800",
  },
  {
    value: 1,
    label: "Rendah",
    description: "Belum memenuhi ekspektasi",
    tone: "bg-rose-100 text-rose-800",
  },
] as const;

export const POTENTIAL_LEVELS = [
  {
    value: 3,
    label: "Tinggi",
    description: "Siap level berikutnya dalam 1-2 tahun",
    tone: "bg-violet-100 text-violet-800",
  },
  {
    value: 2,
    label: "Sedang",
    description: "Dapat berkembang dengan pengembangan",
    tone: "bg-sky-100 text-sky-800",
  },
  {
    value: 1,
    label: "Terbatas",
    description: "Optimal pada peran saat ini",
    tone: "bg-amber-100 text-amber-800",
  },
] as const;

// ---- IDP categories ----------------------------------------------------

export const IDP_CATEGORIES: Record<string, { label: string; tone: string }> = {
  training: {
    label: "Pelatihan",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  mentoring: {
    label: "Mentoring",
    tone: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  },
  stretch: {
    label: "Stretch Assignment",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  certification: {
    label: "Sertifikasi",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  coaching: {
    label: "Coaching",
    tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  },
  rotation: {
    label: "Rotasi Peran",
    tone: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  },
  other: {
    label: "Lainnya",
    tone: "bg-muted text-muted-foreground",
  },
};

export const IDP_HORIZONS: Record<string, { label: string; tone: string }> = {
  short_term: {
    label: "≤ 3 bulan",
    tone: "bg-emerald-100 text-emerald-800",
  },
  medium_term: {
    label: "3-6 bulan",
    tone: "bg-sky-100 text-sky-800",
  },
  long_term: {
    label: "6+ bulan",
    tone: "bg-violet-100 text-violet-800",
  },
};

export const IDP_ITEM_STATUS: Record<string, { label: string; tone: string }> = {
  planned: { label: "Direncanakan", tone: "bg-muted text-muted-foreground" },
  in_progress: {
    label: "Berjalan",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  done: {
    label: "Selesai",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  cancelled: { label: "Dibatalkan", tone: "bg-muted text-muted-foreground" },
};

// ---- Succession readiness --------------------------------------------

export const READINESS_LEVELS: Record<
  string,
  { label: string; description: string; tone: string }
> = {
  ready_now: {
    label: "Siap Sekarang",
    description: "Bisa mengisi peran saat ini juga",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  "1_year": {
    label: "1 Tahun",
    description: "Siap dalam 1 tahun",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  },
  "2_3_years": {
    label: "2-3 Tahun",
    description: "Butuh pengembangan jangka menengah",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  emergency: {
    label: "Darurat",
    description: "Hanya untuk keadaan darurat",
    tone: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  },
};

// ---- Period helpers ----------------------------------------------------

export function suggestCurrentPeriod(): { key: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const half = month <= 6 ? "H1" : "H2";
  return {
    key: `${year}-${half}`,
    label: `${half === "H1" ? "Semester 1" : "Semester 2"} ${year}`,
  };
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function getInitials(name: string | undefined | null): string {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}
