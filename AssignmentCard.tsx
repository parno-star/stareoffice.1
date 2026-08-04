import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  GraduationCap,
  HeartHandshake,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AssignmentDetail } from "@/convex/careerPath";
import {
  STATUS_LABELS,
  coverBadge,
  coverGradient,
  statusBadge,
  trackLabel,
} from "../_lib/career-utils.ts";
import { cn } from "@/lib/utils.ts";

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Props = {
  assignment: AssignmentDetail;
  showEmployee?: boolean;
};

export default function AssignmentCard({
  assignment,
  showEmployee,
}: Props) {
  const navigate = useNavigate();
  const path = assignment.path;
  if (!path) return null;
  const progress = assignment.targetLevelProgress;

  return (
    <Card className="overflow-hidden pt-0">
      <div
        className={cn(
          "h-2 w-full bg-gradient-to-r",
          coverGradient(path.coverColor),
        )}
      />
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{path.icon ?? "🚀"}</span>
              <h3 className="truncate text-base font-semibold">
                {path.title}
              </h3>
              <Badge
                variant="secondary"
                className={cn("text-[10px]", coverBadge(path.coverColor))}
              >
                {trackLabel(path.track)}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {path.description}
            </p>
          </div>
          <Badge className={statusBadge(assignment.status)}>
            {STATUS_LABELS[assignment.status] ?? assignment.status}
          </Badge>
        </div>

        {showEmployee ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
            <Avatar className="size-8">
              {assignment.userAvatarUrl ? (
                <AvatarImage src={assignment.userAvatarUrl} />
              ) : null}
              <AvatarFallback className="text-xs">
                {initials(assignment.userName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {assignment.userName ?? "Tanpa nama"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {assignment.userJobTitle ?? "-"}
                {assignment.userDepartment
                  ? ` · ${assignment.userDepartment}`
                  : ""}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Compass className="size-3.5" /> Level Saat Ini
            </div>
            <p className="truncate text-sm font-semibold">
              {assignment.currentLevel
                ? `L${assignment.currentLevel.order}. ${assignment.currentLevel.title}`
                : "Belum ditentukan"}
            </p>
            {assignment.currentLevel?.targetJobTitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {assignment.currentLevel.targetJobTitle}
              </p>
            ) : null}
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy className="size-3.5" /> Target Berikutnya
            </div>
            <p className="truncate text-sm font-semibold">
              {assignment.targetLevel
                ? `L${assignment.targetLevel.order}. ${assignment.targetLevel.title}`
                : "Belum ditentukan"}
            </p>
            {assignment.targetLevel?.targetJobTitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {assignment.targetLevel.targetJobTitle}
              </p>
            ) : null}
          </div>
        </div>

        {progress ? (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                Progres menuju {assignment.targetLevel?.title}
              </span>
              <span className="font-semibold">
                {progress.progressPercent}%
              </span>
            </div>
            <Progress value={progress.progressPercent} className="h-2" />
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {progress.courses.length > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  {progress.coursesCompleted ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : (
                    <GraduationCap className="size-3.5 text-muted-foreground" />
                  )}
                  {progress.courses.filter((c) => c.completed).length}/
                  {progress.courses.length} training
                </span>
              ) : null}
              {progress.performanceAverage !== null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-3.5 text-amber-500" />
                  KPI {progress.performanceAverage.toFixed(1)}/5
                </span>
              ) : null}
              {progress.allRequirementsMet ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  Siap naik level
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}

        {assignment.mentorName ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HeartHandshake className="size-3.5" />
            <span>Mentor: {assignment.mentorName}</span>
          </div>
        ) : null}

        <Button
          size="sm"
          variant="secondary"
          className="w-full gap-1"
          onClick={() =>
            navigate(`/career-path/${assignment.pathId}`)
          }
        >
          <Target className="size-3.5" /> Detail Roadmap
          <ArrowRight className="ml-auto size-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
