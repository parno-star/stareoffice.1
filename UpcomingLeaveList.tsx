import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatLeaveType } from "../_lib/leave-utils.ts";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDateRange(start: string, end: string): string {
  try {
    const s = format(parseISO(start), "d MMM", { locale: idLocale });
    if (start === end) return s;
    const e = format(parseISO(end), "d MMM", { locale: idLocale });
    return `${s} – ${e}`;
  } catch {
    return start;
  }
}

export default function UpcomingLeaveList() {
  const upcoming = useQuery(api.leaveRequests.listUpcoming, { days: 30 });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" />
          Cuti yang akan datang
          <span className="text-xs font-normal text-muted-foreground">
            (30 hari)
          </span>
          {upcoming ? (
            <Badge variant="secondary" className="ml-auto">
              {upcoming.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada cuti terjadwal dalam 30 hari ke depan.
          </p>
        ) : (
          <ul className="max-h-60 space-y-2 overflow-y-auto">
            {upcoming.map((r) => (
              <li
                key={r._id}
                className="flex items-center gap-3 rounded-md border bg-muted/30 p-2"
              >
                <Avatar className="size-8">
                  {r.userAvatarUrl ? (
                    <AvatarImage src={r.userAvatarUrl} alt={r.userName} />
                  ) : null}
                  <AvatarFallback>{initials(r.userName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.userName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatLeaveType(r.type)} · {r.dayCount} hari
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateRange(r.startDate, r.endDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
