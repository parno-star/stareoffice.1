export type WikiColorToken =
  | "blue"
  | "green"
  | "amber"
  | "violet"
  | "rose"
  | "cyan"
  | "orange"
  | "emerald"
  | "slate";

export const WIKI_COLORS: Array<{
  token: WikiColorToken;
  label: string;
  className: string;
}> = [
  { token: "blue", label: "Biru", className: "bg-blue-500" },
  { token: "green", label: "Hijau", className: "bg-green-500" },
  { token: "amber", label: "Amber", className: "bg-amber-500" },
  { token: "violet", label: "Ungu", className: "bg-violet-500" },
  { token: "rose", label: "Merah Muda", className: "bg-rose-500" },
  { token: "cyan", label: "Cyan", className: "bg-cyan-500" },
  { token: "orange", label: "Oranye", className: "bg-orange-500" },
  { token: "emerald", label: "Emerald", className: "bg-emerald-500" },
  { token: "slate", label: "Abu", className: "bg-slate-500" },
];

/** Suggested emoji icons for a space. User can also type their own. */
export const WIKI_SPACE_ICONS = [
  "📘",
  "📚",
  "📖",
  "🧭",
  "🛠️",
  "💡",
  "🏢",
  "🎯",
  "🚀",
  "⚙️",
  "🧑‍💻",
  "📊",
  "🔒",
  "💬",
  "🧩",
];

/** Tailwind classes for the color token used on cards + headers. */
export function getSpaceColorClasses(token?: string | null): {
  tile: string;
  ring: string;
  badge: string;
  softBg: string;
} {
  switch (token) {
    case "green":
      return {
        tile: "bg-green-500/10 text-green-700 dark:text-green-300",
        ring: "ring-green-500/30",
        badge: "bg-green-500 text-white",
        softBg: "bg-green-50 dark:bg-green-500/10",
      };
    case "amber":
      return {
        tile: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        ring: "ring-amber-500/30",
        badge: "bg-amber-500 text-white",
        softBg: "bg-amber-50 dark:bg-amber-500/10",
      };
    case "violet":
      return {
        tile: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
        ring: "ring-violet-500/30",
        badge: "bg-violet-500 text-white",
        softBg: "bg-violet-50 dark:bg-violet-500/10",
      };
    case "rose":
      return {
        tile: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
        ring: "ring-rose-500/30",
        badge: "bg-rose-500 text-white",
        softBg: "bg-rose-50 dark:bg-rose-500/10",
      };
    case "cyan":
      return {
        tile: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
        ring: "ring-cyan-500/30",
        badge: "bg-cyan-500 text-white",
        softBg: "bg-cyan-50 dark:bg-cyan-500/10",
      };
    case "orange":
      return {
        tile: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
        ring: "ring-orange-500/30",
        badge: "bg-orange-500 text-white",
        softBg: "bg-orange-50 dark:bg-orange-500/10",
      };
    case "emerald":
      return {
        tile: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        ring: "ring-emerald-500/30",
        badge: "bg-emerald-500 text-white",
        softBg: "bg-emerald-50 dark:bg-emerald-500/10",
      };
    case "slate":
      return {
        tile: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
        ring: "ring-slate-500/30",
        badge: "bg-slate-500 text-white",
        softBg: "bg-slate-50 dark:bg-slate-500/10",
      };
    case "blue":
    default:
      return {
        tile: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
        ring: "ring-blue-500/30",
        badge: "bg-blue-500 text-white",
        softBg: "bg-blue-50 dark:bg-blue-500/10",
      };
  }
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Generate a plain-text summary from markdown content. Strips simple
 * markdown artifacts (# marks, *bold*, etc.) and truncates.
 */
export function summarizeContent(content: string, maxLen = 160): string {
  if (!content) return "";
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

/** Human-readable relative time (id-ID). */
export function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} hari lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatFullDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
