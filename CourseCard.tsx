import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  BookOpen,
  Clock,
  Users,
  CheckCircle2,
  Star,
  AlertTriangle,
  Award as AwardIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { CourseWithMeta } from "@/convex/courses.ts";
import {
  formatDuration,
  getCategoryConfig,
  getColorConfig,
  getLevelConfig,
} from "../_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";
import BookmarkButton from "./BookmarkButton.tsx";

export default function CourseCard({ course }: { course: CourseWithMeta }) {
  const cat = getCategoryConfig(course.category);
  const level = getLevelConfig(course.level);
  const color = getColorConfig(course.coverColor);
  const CatIcon = cat.icon;
  const progress = course.enrollment?.progress ?? 0;
  const isCompleted = Boolean(course.enrollment?.completedAt);
  const isEnrolled = Boolean(course.enrollment);
  const rating = course.averageRating ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    course.isAssigned &&
    !isCompleted &&
    course.assignmentDueDate &&
    course.assignmentDueDate < today;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-lg">
      <Link
        to={`/training/${course._id}`}
        className="flex flex-1 flex-col"
      >
        {/* Cover */}
        <div
          className={cn("relative aspect-[5/2] overflow-hidden", color.cover)}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
          <div className="absolute left-4 top-4 flex size-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <CatIcon className="size-5 text-white" />
          </div>
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
            {!course.isPublished ? (
              <Badge
                variant="outline"
                className="border-white/30 bg-black/30 text-white"
              >
                Draft
              </Badge>
            ) : null}
            {course.isAssigned ? (
              <Badge
                className={cn(
                  "gap-1 border-transparent text-white",
                  isOverdue ? "bg-red-500/90" : "bg-amber-500/90",
                )}
              >
                {isOverdue ? <AlertTriangle className="size-3" /> : null}
                {isOverdue ? "Terlambat" : "Wajib"}
              </Badge>
            ) : null}
            {isCompleted ? (
              <div className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">
                <CheckCircle2 className="size-3.5" />
                Selesai
              </div>
            ) : null}
          </div>
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2 text-[11px] font-medium text-white/80">
              <span className="rounded-full bg-white/15 px-2 py-0.5">
                {cat.label}
              </span>
              <span className={cn("rounded-full px-2 py-0.5", level.badge)}>
                {level.label}
              </span>
              {rating > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5">
                  <Star className="size-3 fill-amber-300 text-amber-300" />
                  {rating.toFixed(1)}
                </span>
              ) : null}
              {course.hasQuiz ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5">
                  <AwardIcon className="size-3" />
                  Kuis
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <h3 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
              {course.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {course.description}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" />
              {course.lessonCount} pelajaran
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDuration(course.durationMinutes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {course.enrollmentCount} peserta
            </span>
          </div>

          {course.isAssigned && course.assignmentDueDate ? (
            <div
              className={cn(
                "text-[11px] font-medium",
                isOverdue
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400",
              )}
            >
              Tenggat: {course.assignmentDueDate}
            </div>
          ) : null}

          {isEnrolled && !isCompleted ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="text-muted-foreground">Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          ) : null}
        </div>
      </Link>
      <div className="absolute right-3 bottom-3 z-10">
        <BookmarkButton
          courseId={course._id}
          variant="secondary"
          size="icon-sm"
          showLabel={false}
          className="size-8 rounded-full bg-background/80 p-0 shadow backdrop-blur"
        />
      </div>
    </div>
  );
}
