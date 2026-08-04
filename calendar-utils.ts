export type EventCategory =
  | "meeting"
  | "holiday"
  | "training"
  | "event"
  | "deadline";

export const CATEGORY_CONFIG: Record<
  EventCategory,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  meeting: {
    label: "Rapat",
    dot: "bg-sky-500",
    bg: "bg-sky-500/15",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30",
  },
  holiday: {
    label: "Hari Libur",
    dot: "bg-rose-500",
    bg: "bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
  },
  training: {
    label: "Pelatihan",
    dot: "bg-violet-500",
    bg: "bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30",
  },
  event: {
    label: "Acara",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
  },
  deadline: {
    label: "Tenggat",
    dot: "bg-amber-500",
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
  },
};

export function getCategoryConfig(category: string) {
  return (
    CATEGORY_CONFIG[category as EventCategory] ?? CATEGORY_CONFIG.event
  );
}

export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Build 6x7 grid of days for a month view, starting on Monday.
export function buildMonthGrid(year: number, month: number): Array<Date> {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0 (Sun) .. 6 (Sat)
  // Shift so Monday is first (Mon=0).
  const offset = (firstWeekday + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const days: Array<Date> = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}
