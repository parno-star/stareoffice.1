import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { CalendarClock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { TaskWithPeople } from "@/convex/projects";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatDueDate, getInitials, isOverdue } from "../_lib/utils.ts";
import { useOpsConfig } from "../_lib/use-ops-config.ts";
import { resolvePriorityMeta } from "../_lib/ops-utils.ts";
import TaskFormDialog from "./TaskFormDialog.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  task: TaskWithPeople;
  projectId: Id<"projects">;
  // Optional multi-select controls. When `selectable` is true a checkbox is
  // shown; clicking the card toggles selection instead of doing nothing.
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

export default function TaskCard({
  task,
  projectId,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateTask = useMutation(api.projects.updateTask);
  const deleteTask = useMutation(api.projects.deleteTask);
  const { statuses, priorities } = useOpsConfig();

  const priority = resolvePriorityMeta(task.priority, priorities);
  const isTaskCompleted = statuses.some(
    (s) => s.key === task.status && s.isCompleted,
  );
  const overdue = isOverdue(task.dueDate, isTaskCompleted);
  const moveTargets = statuses.filter((s) => s.isActive);

  const handleStatusChange = async (status: string) => {
    try {
      await updateTask({ taskId: task._id, status });
      toast.success("Status diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal memperbarui status");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask({ taskId: task._id });
      toast.success("Tugas dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menghapus tugas");
      }
    }
  };

  return (
    <>
      <Card
        className={cn(
          "gap-2 p-3 transition-shadow hover:shadow-sm",
          selectable && "cursor-pointer",
          selectable && selected && "ring-2 ring-primary",
        )}
        onClick={selectable ? () => onToggleSelect?.() : undefined}
      >
        <div className="flex items-start gap-2">
          {selectable ? (
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect?.()}
                aria-label="Pilih tugas"
                className="cursor-pointer"
              />
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium line-clamp-2">{task.title}</div>
            {task.description && (
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {task.description}
              </div>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 cursor-pointer"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Pindah ke</DropdownMenuLabel>
                {moveTargets.map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    disabled={s.key === task.status}
                    onClick={() => handleStatusChange(s.key)}
                    className="cursor-pointer"
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setEditOpen(true)}
                  className="cursor-pointer"
                >
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", priority.color)} variant="secondary">
            {priority.label}
          </Badge>
          {task.dueDate && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs gap-1",
                overdue && "border-red-500/40 text-red-600 dark:text-red-400",
              )}
            >
              <CalendarClock className="size-3" />
              {formatDueDate(task.dueDate)}
            </Badge>
          )}
        </div>

        {task.assignee && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Avatar className="size-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {task.assignee.name ?? "Tanpa nama"}
            </span>
          </div>
        )}
      </Card>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        task={{
          _id: task._id,
          title: task.title,
          description: task.description,
          assigneeId: task.assigneeId,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate,
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Tugas "{task.title}" akan
              dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="cursor-pointer bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
