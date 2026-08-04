import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import { Crown, Trophy, BookOpen, Award } from "lucide-react";
import { cn } from "@/lib/utils.ts";

function Rankings({ metric }: { metric: "xp" | "courses" | "certificates" }) {
  const list = useQuery(api.training.gamification.getLeaderboard, {
    metric,
    limit: 20,
  });

  if (list === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada data. Selesaikan kelas untuk tampil di sini.
      </p>
    );
  }

  const metricLabel =
    metric === "courses"
      ? "kelas"
      : metric === "certificates"
        ? "sertifikat"
        : "XP";

  return (
    <ul className="space-y-1.5">
      {list.map((item) => (
        <li
          key={String(item.userId)}
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
            item.rank === 1 &&
              "border-amber-400 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-500/10",
            item.rank === 2 &&
              "border-slate-400 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-500/10",
            item.rank === 3 &&
              "border-orange-400 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-500/10",
          )}
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              item.rank === 1 && "bg-amber-400 text-white",
              item.rank === 2 && "bg-slate-400 text-white",
              item.rank === 3 && "bg-orange-400 text-white",
              item.rank > 3 && "bg-muted text-muted-foreground",
            )}
          >
            {item.rank === 1 ? <Crown className="size-5" /> : item.rank}
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
            {item.userAvatar ? (
              <img
                src={item.userAvatar}
                alt={item.userName ?? ""}
                className="size-9 rounded-full object-cover"
              />
            ) : (
              (item.userName ?? "?").slice(0, 1)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {item.userName ?? "Anonim"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {item.userDepartment ?? "—"} · Level {item.level} ·{" "}
              {item.badgeCount} lencana
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{item.value}</p>
            <p className="text-[11px] text-muted-foreground">{metricLabel}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function LeaderboardPanel() {
  const [tab, setTab] = useState<"xp" | "courses" | "certificates">("xp");
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <h3 className="font-semibold">Papan Peringkat</h3>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="xp" className="cursor-pointer gap-1">
              <Trophy className="size-3.5" /> XP
            </TabsTrigger>
            <TabsTrigger value="courses" className="cursor-pointer gap-1">
              <BookOpen className="size-3.5" /> Kelas
            </TabsTrigger>
            <TabsTrigger
              value="certificates"
              className="cursor-pointer gap-1"
            >
              <Award className="size-3.5" /> Sertifikat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="xp" className="mt-4">
            <Rankings metric="xp" />
          </TabsContent>
          <TabsContent value="courses" className="mt-4">
            <Rankings metric="courses" />
          </TabsContent>
          <TabsContent value="certificates" className="mt-4">
            <Rankings metric="certificates" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
