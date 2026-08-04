import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import AssignCourseDialog from "./AssignCourseDialog.tsx";
import { cn } from "@/lib/utils.ts";

export default function CourseAssignmentsPanel({
  courseId,
}: {
  courseId: Id<"courses">;
}) {
  const assignments = useQuery(
    api.training.assignments.listAssignmentsForCourse,
    { courseId },
  );
  const completion = useQuery(
    api.training.analytics.getCourseAssignmentCompletion,
    { courseId },
  );
  const remove = useMutation(api.training.assignments.removeAssignment);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Penugasan & Kepatuhan</p>
          <p className="text-xs text-muted-foreground">
            Kelola karyawan yang wajib menyelesaikan kelas ini.
          </p>
        </div>
        <AssignCourseDialog
          courseId={courseId}
          trigger={
            <Button size="sm" className="cursor-pointer">
              Tugaskan kelas
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-xs font-semibold text-muted-foreground">
          Daftar Penugasan
        </div>
        {assignments === undefined ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Belum ada penugasan.
          </p>
        ) : (
          <ul className="divide-y">
            {assignments.map((a) => (
              <li
                key={a._id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.targetLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    oleh {a.assignedByName ?? "Admin"}
                    {a.dueDate ? ` · tenggat ${a.dueDate}` : ""}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    remove({ id: a._id })
                      .then(() => toast.success("Penugasan dihapus"))
                      .catch(() => toast.error("Gagal menghapus"))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-xs font-semibold text-muted-foreground">
          Progress Peserta yang Ditugaskan
        </div>
        {completion === undefined ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : completion.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Belum ada peserta yang ditugaskan.
          </p>
        ) : (
          <ul className="divide-y">
            {completion.map((p) => (
              <li
                key={p.userId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.userName ?? "Karyawan"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.userDepartment ?? "Tanpa departemen"}
                    {p.dueDate
                      ? ` · tenggat ${format(new Date(p.dueDate), "d MMM yyyy", { locale: idLocale })}`
                      : ""}
                  </p>
                </div>
                <div className="hidden w-40 space-y-1 sm:block">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{p.progress}%</span>
                    {p.completedAt ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        Selesai
                      </span>
                    ) : null}
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <Badge
                  className={cn(
                    "shrink-0",
                    p.completedAt
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : p.overdue
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                  variant="secondary"
                >
                  {p.completedAt ? (
                    "Selesai"
                  ) : p.overdue ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="size-3" /> Terlambat
                    </span>
                  ) : (
                    "Belum selesai"
                  )}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
