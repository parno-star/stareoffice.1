import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { CalendarDays, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { getCategoryConfig } from "@/pages/calendar/_lib/calendar-utils.ts";
import { cn } from "@/lib/utils.ts";

function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM", { locale: idLocale });
  } catch {
    return iso;
  }
}

export default function UpcomingEvents() {
  const navigate = useNavigate();
  const events = useQuery(api.events.listUpcoming, { limit: 4 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Acara Mendatang</CardTitle>
        <button
          onClick={() => navigate("/calendar")}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Lihat Semua
          <ArrowRight className="size-3" />
        </button>
      </CardHeader>
      <CardContent className="space-y-2">
        {events === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CalendarDays className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Belum ada acara mendatang
            </p>
          </div>
        ) : (
          events.map((ev) => {
            const cfg = getCategoryConfig(ev.category);
            return (
              <button
                key={ev._id}
                onClick={() => navigate(`/calendar/${ev._id}`)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:bg-muted"
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg",
                    cfg.bg,
                    cfg.text,
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase leading-none">
                    {formatShortDate(ev.startDate).split(" ")[1]}
                  </span>
                  <span className="text-sm font-bold leading-tight">
                    {formatShortDate(ev.startDate).split(" ")[0]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ev.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {cfg.label}
                    {ev.startTime ? ` · ${ev.startTime}` : ""}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
