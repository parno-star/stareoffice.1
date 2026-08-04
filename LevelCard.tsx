import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  CheckCircle2,
  Circle,
  Clock,
  GraduationCap,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import type { LevelProgress } from "@/convex/careerPath";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { formatIdr } from "../_lib/career-utils.ts";

type Props = {
  level: Doc<"careerPathLevels">;
  progress?: LevelProgress;
  isCurrent?: boolean;
  isTarget?: boolean;
  compact?: boolean;
};

export default function LevelCard({
  level,
  progress,
  isCurrent,
  isTarget,
  compact,
}: Props) {
  const hasSalary =
    level.salaryMin !== undefined || level.salaryMax !== undefined;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-colors",
        isCurrent && "border-sky-500 ring-1 ring-sky-500/30",
        isTarget && !isCurrent && "border-violet-500 ring-1 ring-violet-500/30",
      )}
    >
      {(isCurrent || isTarget) && (
        <div
          className={cn(
            "absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            isCurrent && "bg-sky-500/10 text-sky-600 dark:text-sky-400",
            isTarget &&
              !isCurrent &&
              "bg-violet-500/10 text-violet-600 dark:text-violet-400",
          )}
        >
          {isCurrent ? (
            <>
              <Target className="size-3" /> Saat Ini
            </>
          ) : (
            <>
              <Trophy className="size-3" /> Target
            </>
          )}
        </div>
      )}
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3 pr-20">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
            L{level.order}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">{level.title}</h3>
            {level.targetJobTitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {level.targetJobTitle}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {level.summary}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {level.targetGrade ? (
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" /> {level.targetGrade}
            </Badge>
          ) : null}
          {level.estimatedMonths !== undefined ? (
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" /> {level.estimatedMonths} bulan
            </Badge>
          ) : null}
          {level.requiredCourseIds.length > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <GraduationCap className="size-3" />
              {level.requiredCourseIds.length} training
            </Badge>
          ) : null}
          {level.minPerformanceRating !== undefined &&
          level.minPerformanceRating > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" />
              KPI min {level.minPerformanceRating}
            </Badge>
          ) : null}
          {level.requiredSkills.length > 0 ? (
            <Badge variant="secondary">
              {level.requiredSkills.length} skill
            </Badge>
          ) : null}
        </div>

        {hasSalary && !compact ? (
          <p className="text-xs text-muted-foreground">
            Rentang gaji: {formatIdr(level.salaryMin ?? null)} -{" "}
            {formatIdr(level.salaryMax ?? null)}
          </p>
        ) : null}

        {progress ? (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Progres</span>
              <span className="font-semibold">
                {progress.progressPercent}%
              </span>
            </div>
            <Progress value={progress.progressPercent} className="h-2" />
            <div className="space-y-1 text-xs">
              {progress.courses.length > 0 ? (
                <div className="flex items-start gap-1.5">
                  {progress.coursesCompleted ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    Training:{" "}
                    {
                      progress.courses.filter((c) => c.completed).length
                    }
                    /{progress.courses.length} selesai
                  </span>
                </div>
              ) : null}
              {level.minPerformanceRating !== undefined &&
              level.minPerformanceRating > 0 ? (
                <div className="flex items-start gap-1.5">
                  {progress.performanceMet ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    Rata-rata KPI:{" "}
                    {progress.performanceAverage !== null
                      ? progress.performanceAverage.toFixed(1)
                      : "-"}{" "}
                    / {level.minPerformanceRating}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {level.description && !compact ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {level.description}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
