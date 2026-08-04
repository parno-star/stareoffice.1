export const EDUCATION_LEVELS: Array<{ value: string; label: string }> = [
  { value: "sma", label: "SMA / Sederajat" },
  { value: "smk", label: "SMK" },
  { value: "d1", label: "Diploma 1 (D1)" },
  { value: "d2", label: "Diploma 2 (D2)" },
  { value: "d3", label: "Diploma 3 (D3)" },
  { value: "d4", label: "Diploma 4 (D4)" },
  { value: "s1", label: "Sarjana (S1)" },
  { value: "s2", label: "Magister (S2)" },
  { value: "s3", label: "Doktor (S3)" },
  { value: "other", label: "Lainnya" },
];

export const EDUCATION_LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  EDUCATION_LEVELS.map((l) => [l.value, l.label]),
);

export const TRAINING_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "Eksternal" },
  { value: "certification", label: "Sertifikasi" },
  { value: "workshop", label: "Workshop" },
  { value: "seminar", label: "Seminar" },
  { value: "online", label: "Online / E-Learning" },
  { value: "other", label: "Lainnya" },
];

export const TRAINING_CATEGORY_LABEL: Record<string, string> =
  Object.fromEntries(TRAINING_CATEGORIES.map((c) => [c.value, c.label]));

export const POSITION_CHANGE_TYPES: Array<{ value: string; label: string }> = [
  { value: "initial", label: "Awal Bergabung" },
  { value: "promotion", label: "Promosi" },
  { value: "lateral", label: "Mutasi Lateral" },
  { value: "rotation", label: "Rotasi" },
  { value: "demotion", label: "Demosi" },
  { value: "other", label: "Lainnya" },
];

export const POSITION_CHANGE_LABEL: Record<string, string> = Object.fromEntries(
  POSITION_CHANGE_TYPES.map((c) => [c.value, c.label]),
);

export const ORGANIZATION_CATEGORIES: Array<{ value: string; label: string }> =
  [
    { value: "internal", label: "Internal Perusahaan" },
    { value: "professional", label: "Asosiasi Profesi" },
    { value: "community", label: "Komunitas" },
    { value: "academic", label: "Akademik / Kampus" },
    { value: "social", label: "Sosial / Kemasyarakatan" },
    { value: "religious", label: "Keagamaan" },
    { value: "political", label: "Politik" },
    { value: "external", label: "Eksternal Lainnya" },
    { value: "other", label: "Lainnya" },
  ];

export const ORGANIZATION_CATEGORY_LABEL: Record<string, string> =
  Object.fromEntries(ORGANIZATION_CATEGORIES.map((c) => [c.value, c.label]));

export const AWARD_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "company", label: "Internal Perusahaan" },
  { value: "external", label: "Eksternal" },
  { value: "government", label: "Pemerintah" },
  { value: "community", label: "Komunitas" },
  { value: "academic", label: "Akademik" },
  { value: "professional", label: "Profesional" },
  { value: "competition", label: "Kompetisi / Lomba" },
  { value: "recognition", label: "Apresiasi" },
  { value: "other", label: "Lainnya" },
];

export const AWARD_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  AWARD_CATEGORIES.map((c) => [c.value, c.label]),
);

export const AWARD_LEVELS: Array<{ value: string; label: string }> = [
  { value: "internal", label: "Internal" },
  { value: "local", label: "Lokal" },
  { value: "regional", label: "Regional" },
  { value: "national", label: "Nasional" },
  { value: "international", label: "Internasional" },
];

export const AWARD_LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  AWARD_LEVELS.map((l) => [l.value, l.label]),
);

export function formatYearRange(
  startYear?: number,
  endYear?: number,
  isCurrent?: boolean,
): string {
  if (!startYear && !endYear) return "—";
  if (isCurrent) return `${startYear ?? "?"} – Sekarang`;
  if (startYear && endYear) return `${startYear} – ${endYear}`;
  return String(startYear ?? endYear ?? "—");
}

export function formatDateRangeId(
  startDate?: string,
  endDate?: string,
  isCurrent?: boolean,
): string {
  const fmt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  const s = fmt(startDate);
  if (isCurrent) return s ? `${s} – Sekarang` : "Sekarang";
  const e = fmt(endDate);
  if (s && e) return `${s} – ${e}`;
  return s || e || "—";
}

export function formatDateId(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
