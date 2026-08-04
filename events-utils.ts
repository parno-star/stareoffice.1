export const EVENT_TYPES = {
  gathering: { label: "Gathering", emoji: "🎉" },
  townhall: { label: "Townhall", emoji: "🎤" },
  workshop: { label: "Workshop", emoji: "🛠️" },
  anniversary: { label: "Anniversary", emoji: "🎂" },
  launch: { label: "Launch / Rilis", emoji: "🚀" },
  social: { label: "Sosial", emoji: "🤝" },
  ceremony: { label: "Seremoni", emoji: "🏅" },
  other: { label: "Lainnya", emoji: "✨" },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function getEventTypeLabel(type: string | undefined | null): {
  label: string;
  emoji: string;
} {
  if (!type) return { label: "Lainnya", emoji: "✨" };
  return EVENT_TYPES[type as EventType] ?? { label: "Lainnya", emoji: "✨" };
}

// Categories that apply to "company events" (exclude "deadline")
export const COMPANY_EVENT_CATEGORIES = [
  "event",
  "meeting",
  "training",
  "holiday",
] as const;

export function formatTimeRange(
  startTime: string | undefined,
  endTime: string | undefined,
  allDay: boolean,
): string {
  if (allDay) return "Sepanjang hari";
  if (!startTime) return "-";
  if (endTime) return `${startTime} – ${endTime}`;
  return startTime;
}
