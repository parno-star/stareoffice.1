import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Crown, Trophy, Medal, Award as AwardIcon } from "lucide-react";
import { getInitials, formatAwardDate } from "../_lib/awards-utils.ts";
import { cn } from "@/lib/utils.ts";

const RANK_STYLES = [
  {
    icon: Crown,
    color: "text-amber-500",
    bg: "bg-gradient-to-br from-amber-500/20 to-orange-500/10",
    ring: "ring-amber-500/40",
    label: "1",
  },
  {
    icon: Trophy,
    color: "text-slate-500",
    bg: "bg-gradient-to-br from-slate-400/20 to-slate-500/10",
    ring: "ring-slate-400/40",
    label: "2",
  },
  {
    icon: Medal,
    color: "text-orange-500",
    bg: "bg-gradient-to-br from-orange-500/20 to-red-500/10",
    ring: "ring-orange-500/40",
    label: "3",
  },
];

export default function HallOfFameWidget() {
  const entries = useQuery(api.awards.getHallOfFame, { limit: 10 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AwardIcon className="size-4 text-amber-500" />
          Hall of Fame
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Belum ada penghargaan yang diberikan.
          </p>
        ) : (
          entries.map((entry, idx) => {
            const rank = idx + 1;
            const rankStyle = RANK_STYLES[idx];
            return (
              <div
                key={entry.userId}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2.5",
                  rankStyle ? rankStyle.bg : "bg-muted/30",
                )}
              >
                {rankStyle ? (
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full bg-background ring-2",
                      rankStyle.ring,
                    )}
                  >
                    <rankStyle.icon
                      className={cn("size-4.5", rankStyle.color)}
                    />
                  </div>
                ) : (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {rank}
                  </div>
                )}
                <Avatar className="size-9 shrink-0">
                  {entry.avatarUrl ? (
                    <AvatarImage src={entry.avatarUrl} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold">
                    {getInitials(entry.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {entry.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.latestAwardTitle}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Terakhir: {formatAwardDate(entry.latestAwardDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">
                    {entry.awardCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    penghargaan
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
