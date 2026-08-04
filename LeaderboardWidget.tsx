import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Trophy, Medal, Award } from "lucide-react";
import { getInitials } from "../_lib/recognitions-utils.ts";
import { cn } from "@/lib/utils.ts";

const RANK_CONFIG = [
  {
    icon: Trophy,
    color: "text-amber-500",
    bg: "bg-amber-500/10 ring-amber-500/30",
  },
  {
    icon: Medal,
    color: "text-slate-400",
    bg: "bg-slate-400/10 ring-slate-400/30",
  },
  {
    icon: Award,
    color: "text-orange-500",
    bg: "bg-orange-500/10 ring-orange-500/30",
  },
];

export default function LeaderboardWidget() {
  const leaderboard = useQuery(api.recognitions.getLeaderboard, { limit: 5 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-amber-500" />
          Top Apresiasi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboard === undefined ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))
        ) : leaderboard.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Belum ada apresiasi. Jadilah yang pertama!
          </p>
        ) : (
          leaderboard.map((entry, idx) => {
            const rank = idx + 1;
            const rankCfg = RANK_CONFIG[idx];
            return (
              <div
                key={entry.userId}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5"
              >
                {rankCfg ? (
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full ring-2",
                      rankCfg.bg,
                    )}
                  >
                    <rankCfg.icon className={cn("size-4", rankCfg.color)} />
                  </div>
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {rank}
                  </div>
                )}
                <Avatar className="size-8">
                  {entry.avatarUrl ? (
                    <AvatarImage src={entry.avatarUrl} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold">
                    {getInitials(entry.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{entry.name}</p>
                  {entry.jobTitle ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.jobTitle}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold tabular-nums">
                    {entry.receivedCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">apresiasi</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
