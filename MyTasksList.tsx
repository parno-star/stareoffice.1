import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { CheckCircle2, ListTodo, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDueDate, isOverdue } from "../_lib/utils.ts";
import { useOpsConfig } from "../_lib/use-ops-config.ts";
import {
  resolvePriorityMeta,
  resolveStatusMeta,
} from "../_lib/ops-utils.ts";
import { cn } from "@/lib/utils.ts";

export default function MyTasksList() {
  const tasks = useQuery(api.projects.listMyTasks, { status: "all" });
  const { statuses, priorities } = useOpsConfig();

  if (tasks === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  const completedKeys = new Set(
    statuses.filter((s) => s.isCompleted).map((s) => s.key),
  );
  const openTasks = tasks.filter((t) => !completedKeys.has(t.status));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListTodo className="size-4" />
          Tugas Saya ({openTasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {openTasks.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle2 />
              </EmptyMedia>
              <EmptyTitle>Tidak ada tugas aktif</EmptyTitle>
              <EmptyDescription>
                Semua tugas yang ditugaskan kepada Anda sudah selesai.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {openTasks.slice(0, 10).map((task) => {
              const priority = resolvePriorityMeta(task.priority, priorities);
              const status = resolveStatusMeta(task.status, statuses);
              const overdue = isOverdue(
                task.dueDate,
                completedKeys.has(task.status),
              );
              return (
                <Link
                  key={task._id}
                  to={`/projects/${task.projectId}`}
                  className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-2">
                        {task.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {task.project?.name ?? "Tanpa proyek"}
                      </div>
                    </div>
                    <Badge
                      className={cn("text-xs shrink-0", status.color)}
                      variant="secondary"
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge
                      className={cn("text-xs", priority.color)}
                      variant="secondary"
                    >
                      {priority.label}
                    </Badge>
                    {task.dueDate && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs gap-1",
                          overdue &&
                            "border-red-500/40 text-red-600 dark:text-red-400",
                        )}
                      >
                        <CalendarClock className="size-3" />
                        {formatDueDate(task.dueDate)}
                        {overdue && " (lewat)"}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
