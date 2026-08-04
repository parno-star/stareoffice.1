import { format, formatDistanceToNow, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function formatClosesAt(iso: string | null): string {
  if (!iso) return "Tanpa batas waktu";
  try {
    return format(parseISO(iso), "d MMM yyyy HH:mm", { locale: idLocale });
  } catch {
    return "Tanpa batas waktu";
  }
}

export function formatCloseCountdown(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    if (d.getTime() <= Date.now()) return "Sudah ditutup";
    return `Ditutup ${formatDistanceToNow(d, { addSuffix: true, locale: idLocale })}`;
  } catch {
    return null;
  }
}

export function formatCreated(ts: number): string {
  return formatDistanceToNow(new Date(ts), {
    addSuffix: true,
    locale: idLocale,
  });
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Convert datetime-local input value to ISO UTC string.
 * Input is in user's local timezone already as naive string.
 */
export function datetimeLocalToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Produce min value for datetime-local input (now + 5min, in local tz).
 */
export function getMinCloseDateTimeLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
