import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { toEmbedUrl, formatDuration } from "../_lib/training-utils.ts";
import MarkdownContent from "@/pages/wiki/_components/MarkdownContent.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

export default function LessonViewer({
  lessonId,
  lessonOrder,
  totalLessons,
  onPrev,
  onNext,
}: {
  lessonId: Id<"courseLessons">;
  lessonOrder: number;
  totalLessons: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const lesson = useQuery(api.courses.getLesson, { id: lessonId });
  const toggleComplete = useMutation(api.courses.toggleLessonComplete);

  const handleToggle = async () => {
    try {
      const result = await toggleComplete({ lessonId });
      if (result.completed) {
        toast.success(
          result.progress >= 100
            ? "Selamat! Anda menyelesaikan kelas ini"
            : "Pelajaran ditandai selesai",
        );
      } else {
        toast.info("Status penyelesaian dihapus");
      }
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  if (lesson === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (lesson === null) {
    return (
      <p className="p-8 text-center text-muted-foreground">
        Pelajaran tidak ditemukan.
      </p>
    );
  }

  const embed = lesson.videoUrl ? toEmbedUrl(lesson.videoUrl) : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Pelajaran {lessonOrder + 1} dari {totalLessons}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">
          {lesson.title}
        </h2>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatDuration(lesson.durationMinutes)}
          </span>
        </div>
      </div>

      {embed ? (
        <div className="overflow-hidden rounded-xl border bg-black">
          <div className="aspect-video w-full">
            <iframe
              src={embed}
              title={lesson.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : null}

      {lesson.content.trim().length > 0 ? (
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <MarkdownContent content={lesson.content} />
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Belum ada materi tertulis untuk pelajaran ini.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={!onPrev}
          className="cursor-pointer"
        >
          <ChevronLeft className="size-4" />
          Sebelumnya
        </Button>
        <Button
          onClick={handleToggle}
          variant={lesson.isCompleted ? "secondary" : "default"}
          className={cn(
            "cursor-pointer gap-2",
            lesson.isCompleted && "text-emerald-700 dark:text-emerald-300",
          )}
        >
          {lesson.isCompleted ? (
            <>
              <CheckCircle2 className="size-4" />
              Selesai
            </>
          ) : (
            <>
              <Circle className="size-4" />
              Tandai selesai
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!onNext}
          className="cursor-pointer"
        >
          Berikutnya
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
