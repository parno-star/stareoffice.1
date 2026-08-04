import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { CalendarClock, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  getCategoryConfig,
  getOwnerConfig,
  formatDate,
} from "../_lib/onboarding-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  task: Doc<"onboardingTasks">;
  canToggle: boolean;
  canDelete: boolean;
};

export default function OnboardingTaskRow({
  task,
  canToggle,
  canDelete,
}: Props) {
  const toggle = useMutation(api.onboarding.toggleTask);
  const remove = useMutation(api.onboarding.removeTask);
  const cat = getCategoryConfig(task.category);
  const owner = getOwnerConfig(task.ownerRole);
  const CatIcon = cat.icon;
  const OwnerIcon = owner.icon;

  const handleToggle = async () => {
    if (!canToggle) {
      toast.info("Anda tidak memiliki izin untuk mengubah tugas ini");
      return;
    }
    try {
      await toggle({ id: task._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui");
      } else {
        toast.error("Gagal memperbarui");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await remove({ id: task._id });
      toast.success("Tugas dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  const isDone = task.status === "done";
  const isOverdue =
    !isDone &&
    task.dueDate &&
    task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        isDone ? "bg-muted/40" : "bg-card",
      )}
    >
      <div className="pt-0.5">
        <Checkbox
          checked={isDone}
          onCheckedChange={handleToggle}
          disabled={!canToggle}
        />
      </div>

      <div className={cn("flex shrink-0 size-9 items-center justify-center rounded-lg", cat.iconBg)}>
        <CatIcon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                isDone && "text-muted-foreground line-through",
              )}
            >
              {task.title}
            </p>
            {task.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {task.description}
              </p>
            ) : null}
          </div>
          {canDelete ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleDelete}
              className="cursor-pointer text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className={cat.badge}>
            {cat.label}
          </Badge>
          <Badge variant="outline">
            <OwnerIcon className="size-3" />
            {owner.label}
          </Badge>
          {task.dueDate ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-muted-foreground",
                isOverdue && "text-destructive font-medium",
              )}
            >
              <CalendarClock className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
