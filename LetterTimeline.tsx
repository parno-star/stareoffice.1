import { format, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { getHistoryMeta } from "../_lib/historyMeta.ts";
import {
  History,
  CheckCheck,
  XCircle,
  Snowflake,
  Send,
  Clock,
  RotateCcw,
  MessageSquareQuote,
} from "lucide-react";

type HistoryEntry = Doc<"letterHistory"> & {
  actor: Pick<Doc<"users">, "_id" | "name"> | null;
};

interface LetterTimelineProps {
  history: HistoryEntry[];
  letterStatus?: string;
}

// A compact status banner shown above the timeline, summarising where the
// letter currently stands so participants immediately understand the outcome.
type StatusSummary = {
  label: string;
  desc: string;
  icon: typeof CheckCheck;
  className: string;
  iconClass: string;
};

function getStatusSummary(status: string | undefined): StatusSummary | null {
  switch (status) {
    case "approved":
    case "sent":
    case "archived":
      return {
        label: "Surat selesai",
        desc: "Proses persetujuan telah tuntas.",
        icon: status === "sent" ? Send : CheckCheck,
        className:
          "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
        iconClass: "text-green-600 dark:text-green-400",
      };
    case "rejected":
      return {
        label: "Surat ditolak",
        desc: "Surat dihentikan oleh pemeriksa atau penyetuju.",
        icon: XCircle,
        className:
          "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
        iconClass: "text-red-600 dark:text-red-400",
      };
    case "frozen":
      return {
        label: "Surat dibekukan (arsip mati)",
        desc: "Surat dibatalkan dan tidak dapat diajukan ulang.",
        icon: Snowflake,
        className:
          "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40",
        iconClass: "text-slate-600 dark:text-slate-300",
      };
    case "revision":
      return {
        label: "Menunggu revisi konseptor",
        desc: "Surat dikembalikan untuk diperbaiki.",
        icon: RotateCcw,
        className:
          "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30",
        iconClass: "text-orange-600 dark:text-orange-400",
      };
    case "review":
      return {
        label: "Sedang dalam persetujuan",
        desc: "Surat sedang berjalan di rantai pemeriksa/penyetuju.",
        icon: Clock,
        className:
          "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
        iconClass: "text-amber-600 dark:text-amber-400",
      };
    default:
      return null;
  }
}

// Actions whose detail is a human note worth highlighting (correction notes,
// approval comments, rejection reasons). Rendered as a quoted callout.
const NOTE_ACTIONS = new Set([
  "revision_requested",
  "returned_to_reviewer",
  "reviewer_note",
  "rejected",
  "frozen",
]);

export default function LetterTimeline({
  history,
  letterStatus,
}: LetterTimelineProps) {
  const summary = getStatusSummary(letterStatus);

  if (history.length === 0) {
    return (
      <div className="space-y-4">
        {summary && <StatusBanner summary={summary} />}
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <History className="size-8 opacity-30" />
          <p>Belum ada riwayat aktivitas surat ini</p>
        </div>
      </div>
    );
  }

  // The most recent entry is the "current" step (timeline is ascending by time).
  const lastIndex = history.length - 1;
  // Whether the flow has reached a terminal state (no active step highlight).
  const isTerminal = ["approved", "sent", "archived", "rejected", "frozen"].includes(
    letterStatus ?? "",
  );

  return (
    <div className="space-y-4">
      {summary && <StatusBanner summary={summary} />}

      <div className="relative">
        {history.map((h, i) => {
          const meta = getHistoryMeta(h.action);
          const Icon = meta.icon;
          const isLast = i === lastIndex;
          const isCurrent = isLast && !isTerminal;
          const prev = i > 0 ? history[i - 1] : null;
          const showDayDivider =
            !prev || !isSameDay(new Date(prev.occurredAt), new Date(h.occurredAt));
          const isNote = NOTE_ACTIONS.has(h.action) && !!h.detail;

          return (
            <div key={h._id}>
              {showDayDivider && (
                <div className="flex items-center gap-2 py-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {format(new Date(h.occurredAt), "EEEE, d MMMM yyyy", {
                      locale: localeId,
                    })}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              <div className="flex gap-3">
                {/* Rail */}
                <div className="flex flex-col items-center">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${meta.dot} ${
                      isCurrent ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  {!isLast && <div className="my-1 min-h-6 w-0.5 flex-1 bg-border" />}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold leading-tight">{meta.label}</p>
                    {isCurrent && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Tahap saat ini
                      </span>
                    )}
                  </div>

                  {h.detail &&
                    (isNote ? (
                      <div className="mt-1.5 flex gap-2 rounded-md border-l-2 border-primary/40 bg-muted/50 px-3 py-2">
                        <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <p className="text-xs italic text-foreground/80 break-words">
                          {h.detail}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground break-words">
                        {h.detail}
                      </p>
                    ))}

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">
                      {h.actor?.name ?? "Sistem"}
                    </span>
                    {" · "}
                    {format(new Date(h.occurredAt), "HH:mm", { locale: localeId })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBanner({ summary }: { summary: StatusSummary }) {
  const Icon = summary.icon;
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${summary.className}`}>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-background/60 ${summary.iconClass}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{summary.label}</p>
        <p className="text-xs text-muted-foreground">{summary.desc}</p>
      </div>
    </div>
  );
}
