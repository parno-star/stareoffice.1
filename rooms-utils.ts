import {
  Projector,
  Presentation,
  Video,
  Monitor,
  Snowflake,
  Coffee,
  type LucideIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export type AmenityId =
  | "projector"
  | "whiteboard"
  | "videoCall"
  | "tv"
  | "ac"
  | "coffee";

type AmenityConfig = {
  id: AmenityId;
  label: string;
  icon: LucideIcon;
};

export const AMENITIES: Array<AmenityConfig> = [
  { id: "projector", label: "Proyektor", icon: Projector },
  { id: "whiteboard", label: "Papan Tulis", icon: Presentation },
  { id: "videoCall", label: "Video Call", icon: Video },
  { id: "tv", label: "TV/Layar", icon: Monitor },
  { id: "ac", label: "AC", icon: Snowflake },
  { id: "coffee", label: "Coffee Corner", icon: Coffee },
];

export function getAmenityConfig(id: string): AmenityConfig | null {
  return AMENITIES.find((a) => a.id === id) ?? null;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build ISO UTC timestamp from date (YYYY-MM-DD) and local time (HH:mm).
 */
export function buildIsoTimestamp(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map((n) => parseInt(n, 10));
  const [h, mi] = time.split(":").map((n) => parseInt(n, 10));
  const localDate = new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0);
  return localDate.toISOString();
}

/**
 * Format ISO timestamp as "HH:mm" in local time.
 */
export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "HH:mm");
  } catch {
    return iso;
  }
}

export function formatDateLong(iso: string): string {
  try {
    const d = iso.includes("T") ? parseISO(iso) : parseISO(`${iso}T00:00:00`);
    return format(d, "EEEE, d MMMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string): string {
  try {
    const d = iso.includes("T") ? parseISO(iso) : parseISO(`${iso}T00:00:00`);
    return format(d, "d MMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

/**
 * Returns time slots from startHour to endHour (e.g. 08:00 - 19:00)
 */
export const BUSINESS_HOURS = { start: 7, end: 20 };

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Convert an ISO timestamp into minutes since midnight local time.
 */
export function minutesFromMidnight(iso: string): number {
  const d = parseISO(iso);
  return d.getHours() * 60 + d.getMinutes();
}
