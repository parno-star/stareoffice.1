import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { UserRound } from "lucide-react";
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

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM", { locale: idLocale });
  } catch {
    return iso;
  }
}

export default function OnLeaveTodayCard() {
  const onLeave = useQuery(api.leaveRequests.listOnLeaveToday, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4 text-primary" />
          Sedang cuti hari ini
          {onLeave ? (
            <Badge variant="secondary" className="ml-auto">
              {onLeave.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {onLeave === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : onLeave.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada karyawan yang cuti hari ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {onLeave.map((r) => (
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
                    {formatLeaveType(r.type)} · kembali{" "}
                    {formatDate(r.endDate)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
