export const TRACK_OPTIONS = [
  { value: "technical", label: "Teknis" },
  { value: "management", label: "Manajerial" },
  { value: "specialist", label: "Spesialis" },
  { value: "functional", label: "Fungsional" },
  { value: "leadership", label: "Kepemimpinan" },
  { value: "operations", label: "Operasional" },
  { value: "support", label: "Support" },
  { value: "other", label: "Lainnya" },
] as const;

export type TrackValue = (typeof TRACK_OPTIONS)[number]["value"];

export function trackLabel(track: string): string {
  return TRACK_OPTIONS.find((t) => t.value === track)?.label ?? track;
}

export const COVER_COLORS = [
  { value: "sky", label: "Biru Langit", swatch: "bg-sky-500" },
  { value: "violet", label: "Ungu", swatch: "bg-violet-500" },
  { value: "emerald", label: "Hijau", swatch: "bg-emerald-500" },
  { value: "amber", label: "Kuning", swatch: "bg-amber-500" },
  { value: "rose", label: "Merah Muda", swatch: "bg-rose-500" },
  { value: "indigo", label: "Indigo", swatch: "bg-indigo-500" },
  { value: "fuchsia", label: "Fuchsia", swatch: "bg-fuchsia-500" },
  { value: "teal", label: "Teal", swatch: "bg-teal-500" },
] as const;

export type CoverColor = (typeof COVER_COLORS)[number]["value"];

export function coverGradient(color: string): string {
  const map: Record<string, string> = {
    sky: "from-sky-500 to-cyan-600",
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    indigo: "from-indigo-500 to-blue-600",
    fuchsia: "from-fuchsia-500 to-pink-600",
    teal: "from-teal-500 to-emerald-600",
  };
  return map[color] ?? "from-slate-500 to-slate-700";
}

export function coverBadge(color: string): string {
  const map: Record<string, string> = {
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  };
  return map[color] ?? "bg-slate-500/10 text-slate-600 dark:text-slate-400";
}

export const STATUS_LABELS: Record<string, string> = {
  in_progress: "Sedang Berjalan",
  achieved_target: "Target Tercapai",
  paused: "Dijeda",
  completed: "Selesai",
};

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    in_progress: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    achieved_target:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    completed: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

export function formatIdr(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
