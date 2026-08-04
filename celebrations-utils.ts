export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function formatMonthDay(mmdd: string): string {
  const match = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!match) return mmdd;
  const month = Number(match[1]);
  const day = Number(match[2]);
  // Arbitrary year (2000) just for formatting; year is hidden
  const date = new Date(2000, month - 1, day);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
  });
}

export function formatIsoFullDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCountdown(daysUntil: number): string {
  if (daysUntil === 0) return "Hari ini";
  if (daysUntil === 1) return "Besok";
  if (daysUntil < 7) return `${daysUntil} hari lagi`;
  if (daysUntil < 14) return "Minggu depan";
  return `${daysUntil} hari lagi`;
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Convert MM-DD year-agnostic string -> YYYY-MM-DD using a placeholder year
// for display in HTML date inputs. We use year 2000 as a neutral reference.
export function monthDayToDateInput(mmdd: string | undefined): string {
  if (!mmdd) return "";
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return "";
  return `2000-${mmdd}`;
}

// Extract MM-DD from a YYYY-MM-DD input
export function dateInputToMonthDay(isoDate: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  return `${match[1]}-${match[2]}`;
}
