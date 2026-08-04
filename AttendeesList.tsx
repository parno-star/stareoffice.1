import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Users } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

const STATUS_LABELS: Record<string, { label: string; dot: string; text: string }> = {
  going: { label: "Hadir", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  maybe: { label: "Mungkin", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  not_going: { label: "Tidak hadir", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AttendeesList({ eventId }: { eventId: Id<"events"> }) {
  const attendees = useQuery(api.events.listAttendees, { eventId });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Peserta
        </CardTitle>
        {attendees !== undefined ? (
          <span className="text-xs text-muted-foreground">
            {attendees.length} respon
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {attendees === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))
        ) : attendees.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada yang merespon
          </p>
        ) : (
          attendees.map((a) => {
            const s = STATUS_LABELS[a.status] ?? STATUS_LABELS.going;
            return (
              <div
                key={a._id}
                className="flex items-center gap-3 rounded-lg p-1"
              >
                <Avatar className="size-9">
                  {a.userAvatar ? (
                    <AvatarImage src={a.userAvatar} alt={a.userName} />
                  ) : null}
                  <AvatarFallback>{getInitials(a.userName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.userName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.jobTitle ?? a.department ?? "Karyawan"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={cn("size-2 rounded-full", s.dot)} />
                  <span className={cn("font-medium", s.text)}>{s.label}</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
