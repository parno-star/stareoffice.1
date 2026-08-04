import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { getLevelColor } from "../_lib/advanced-utils.ts";
import {
  Award,
  BookOpen,
  Flame,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

export default function GamificationPanel() {
  const stats = useQuery(api.training.gamification.getMyStats, {});

  if (stats === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Level card */}
        <Card className="overflow-hidden p-0">
          <div
            className={cn(
              "relative p-4 text-white",
              getLevelColor(stats.level),
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <Trophy className="size-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/80">
                  Level
                </p>
                <p className="text-2xl font-bold leading-tight">
                  {stats.level}
                </p>
                <p className="text-[11px] text-white/80">
                  {stats.totalXp} XP total
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[11px] font-medium text-white/85">
                <span>Menuju Level {stats.level + 1}</span>
                <span>{stats.levelProgress}/100</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-white"
                  style={{ width: `${stats.levelProgress}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  XP Total
                </p>
                <p className="text-xl font-bold">{stats.totalXp}</p>
                {stats.rank ? (
                  <p className="text-xs text-muted-foreground">
                    Peringkat #{stats.rank}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <Flame className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Streak Hari
                </p>
                <p className="text-xl font-bold">{stats.streakDays}</p>
                <p className="text-xs text-muted-foreground">
                  berturut-turut
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Lencana
                </p>
                <p className="text-xl font-bold">
                  {stats.badges.filter((b) => b.earned).length}
                </p>
                <p className="text-xs text-muted-foreground">
                  dari {stats.badges.length} tersedia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Badges grid */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Award className="size-4 text-purple-600" />
            <h3 className="font-semibold">Lencana</h3>
            <span className="text-xs text-muted-foreground">
              {stats.badges.filter((b) => b.earned).length}/
              {stats.badges.length} diraih
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9">
            {stats.badges.map((b) => (
              <Tooltip key={b.key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-all",
                      b.earned
                        ? "border-transparent bg-gradient-to-br from-amber-100 to-rose-100 dark:from-amber-500/20 dark:to-rose-500/20"
                        : "border-dashed bg-muted/50 opacity-60 grayscale",
                    )}
                  >
                    <span className="text-2xl leading-none">{b.icon}</span>
                    <span className="line-clamp-2 text-[10px] font-medium leading-tight">
                      {b.label}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.description}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cumulative stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="size-8 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Kelas Selesai</p>
              <p className="text-xl font-bold">{stats.coursesCompleted}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Award className="size-8 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">
                Sertifikat Diperoleh
              </p>
              <p className="text-xl font-bold">
                {stats.certificatesEarned}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Sparkles className="size-8 text-purple-600" />
            <div>
              <p className="text-xs text-muted-foreground">Kuis Lulus</p>
              <p className="text-xl font-bold">{stats.quizzesPassed}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
