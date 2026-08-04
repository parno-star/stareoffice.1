import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Users } from "lucide-react";
import { getLocalDateString, formatClock } from "../_lib/utils.ts";

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TeamTodayList() {
  const date = getLocalDateString();
  const team = useQuery(api.attendance.listTodayTeam, { date });

  if (team === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Siapa di Kantor Hari Ini</CardTitle>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>Belum ada yang hadir</EmptyTitle>
              <EmptyDescription>
                Anda akan melihat rekan yang sudah clock-in hari ini di sini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {team.map(({ record, user }) => (
              <div
                key={record._id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {user?.name ?? "Karyawan"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user?.department ?? "-"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {formatClock(record.clockInAt)}
                    {record.clockOutAt && (
                      <span className="text-muted-foreground">
                        {" "}
                        - {formatClock(record.clockOutAt)}
                      </span>
                    )}
                  </div>
                  {record.isLate && (
                    <Badge variant="destructive" className="text-xs mt-1">
                      Terlambat
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
