import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
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
import { CheckSquare, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import TaskCard from "./TaskCard.tsx";
import TaskFormDialog from "./TaskFormDialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useOpsConfig } from "../_lib/use-ops-config.ts";
import { getOpsColor, type StatusRecord } from "../_lib/ops-utils.ts";

type Props = { projectId: Id<"projects"> };

export default function TaskBoard({ projectId }: Props) {
  const tasks = useQuery(api.projects.listProjectTasks, { projectId });
  const { statuses, isLoading } = useOpsConfig();
  const [addStatus, setAddStatus] = useState<string | null>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<Id<"tasks">>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("none");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bulkSetStatus = useMutation(api.projects.bulkSetTaskStatus);
  const bulkDelete = useMutation(api.projects.bulkDeleteTasks);

  if (tasks === undefined || isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  // Columns = active stages, plus any stage a task currently sits in (so
  // deactivated/legacy stages still show their tasks instead of hiding them).
  const activeStatuses = statuses.filter((s) => s.isActive);
  const usedKeys = new Set(tasks.map((t) => t.status));
  const extraStatuses: Array<StatusRecord> = [];
  for (const key of usedKeys) {
    if (!activeStatuses.some((s) => s.key === key)) {
      const found = statuses.find((s) => s.key === key);
      extraStatuses.push(
        found ?? {
          id: null,
          key,
          label: key,
          color: "slate",
          order: 999,
          isActive: false,
          isCompleted: false,
        },
      );
    }
  }
  const columns = [...activeStatuses, ...extraStatuses];

  const gridCols =
    columns.length <= 3
      ? "md:grid-cols-2 lg:grid-cols-3"
      : "md:grid-cols-2 xl:grid-cols-4";

  const toggleTask = (id: Id<"tasks">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkStatus("none");
  };

  const handleBulkStatus = async () => {
    if (bulkStatus === "none" || selected.size === 0) return;
    try {
      const res = await bulkSetStatus({
        taskIds: Array.from(selected),
        status: bulkStatus,
      });
      toast.success(`${res.count} tugas dipindahkan`);
      exitSelectMode();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal memindahkan tugas");
      }
    }
  };

  const handleBulkDelete = async () => {
    setConfirmDelete(false);
    if (selected.size === 0) return;
    try {
      const res = await bulkDelete({ taskIds: Array.from(selected) });
      toast.success(`${res.count} tugas dihapus`);
      exitSelectMode();
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
      {/* Selection toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {selectMode ? (
          <>
            <span className="text-sm text-muted-foreground">
              {selected.size} dipilih
            </span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Pindahkan ke tahap..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>
                  Pindahkan ke tahap...
                </SelectItem>
                {activeStatuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkStatus}
              disabled={bulkStatus === "none" || selected.size === 0}
              className="cursor-pointer"
            >
              Terapkan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={selected.size === 0}
              className="cursor-pointer text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Hapus
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={exitSelectMode}
              className="cursor-pointer"
            >
              <X className="size-4" />
              Selesai
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSelectMode(true)}
            disabled={tasks.length === 0}
            className="cursor-pointer"
          >
            <CheckSquare className="size-4" />
            Pilih Beberapa
          </Button>
        )}
      </div>

      <div className={cn("grid gap-4", gridCols)}>
        {columns.map((status) => {
          const items = tasks.filter((t) => t.status === status.key);
          return (
            <div
              key={status.key}
              className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 min-h-32"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      getOpsColor(status.color).badge,
                    )}
                  >
                    {status.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={() => setAddStatus(status.key)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6">
                    Kosong
                  </div>
                ) : (
                  items.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      projectId={projectId}
                      selectable={selectMode}
                      selected={selected.has(task._id)}
                      onToggleSelect={() => toggleTask(task._id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskFormDialog
        open={addStatus !== null}
        onOpenChange={(open) => !open && setAddStatus(null)}
        projectId={projectId}
        initialStatus={addStatus ?? undefined}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas terpilih?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} tugas akan dihapus permanen. Tugas yang tidak Anda
              miliki izin hapusnya akan dilewati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
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
