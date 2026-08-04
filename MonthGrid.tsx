import { cn } from "@/lib/utils.ts";
import { getCategoryConfig, toIsoDate, buildMonthGrid } from "../_lib/calendar-utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type EnrichedEvent = Doc<"events"> & { authorName: string };

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function MonthGrid({
  year,
  month, // 0-indexed
  events,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number;
  events: Array<EnrichedEvent>;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}) {
  const days = buildMonthGrid(year, month);
  const todayIso = toIsoDate(new Date());

  // Group events by each day they span.
  const eventsByDay = new Map<string, Array<EnrichedEvent>>();
  for (const ev of events) {
    const start = new Date(`${ev.startDate}T00:00:00`);
    const end = new Date(`${ev.endDate}T00:00:00`);
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const key = toIsoDate(cursor);
      const arr = eventsByDay.get(key) ?? [];
      arr.push(ev);
      eventsByDay.set(key, arr);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const iso = toIsoDate(day);
          const inMonth = day.getMonth() === month;
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          const dayEvents = eventsByDay.get(iso) ?? [];

          return (
            <button
              key={iso + idx}
              onClick={() => onSelectDate(iso)}
              className={cn(
                "group flex min-h-16 cursor-pointer flex-col items-start gap-1 border-b border-r p-1.5 text-left transition-colors last:border-r-0 sm:min-h-24",
                "[&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/20 text-muted-foreground/60",
                isSelected &&
                  "bg-primary/5 ring-2 ring-inset ring-primary",
                !isSelected && "hover:bg-muted/50",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday && "bg-primary text-primary-foreground",
                    !isToday && isSelected && "text-primary",
                  )}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="text-[10px] font-semibold text-muted-foreground sm:hidden">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>

              {/* Event chips (desktop) */}
              <div className="hidden w-full flex-1 flex-col gap-0.5 sm:flex">
                {dayEvents.slice(0, 3).map((ev) => {
                  const cfg = getCategoryConfig(ev.category);
                  return (
                    <div
                      key={ev._id}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] font-medium",
                        cfg.bg,
                        cfg.text,
                      )}
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", cfg.dot)} />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 ? (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} lainnya
                  </span>
                ) : null}
              </div>

              {/* Event dots (mobile) */}
              {dayEvents.length > 0 ? (
                <div className="flex gap-0.5 sm:hidden">
                  {Array.from(new Set(dayEvents.map((e) => e.category)))
                    .slice(0, 4)
                    .map((cat) => {
                      const cfg = getCategoryConfig(cat);
                      return (
                        <span
                          key={cat}
                          className={cn("size-1.5 rounded-full", cfg.dot)}
                        />
                      );
                    })}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
