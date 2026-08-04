import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useOpsConfig } from "../_lib/use-ops-config.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  initialStatus?: string;
  task?: {
    _id: Id<"tasks">;
    title: string;
    description?: string;
    assigneeId?: Id<"users">;
    priority: string;
    status: string;
    dueDate?: string;
  };
};

export default function TaskFormDialog({
  open,
  onOpenChange,
  projectId,
  initialStatus,
  task,
}: Props) {
  const project = useQuery(api.projects.getProject, { projectId });
  const { statuses, priorities } = useOpsConfig();

  const activePriorities = priorities.filter((p) => p.isActive);
  const activeStatuses = statuses.filter((s) => s.isActive);
  // Fallback defaults derived from the org config.
  const defaultPriorityKey =
    activePriorities.find((p) => p.key === "medium")?.key ??
    activePriorities[0]?.key ??
    "medium";
  const defaultStatusKey =
    activeStatuses.find((s) => !s.isCompleted)?.key ??
    activeStatuses[0]?.key ??
    "todo";

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(
    task?.assigneeId ?? "none",
  );
  const [priority, setPriority] = useState(task?.priority ?? "");
  const [status, setStatus] = useState(task?.status ?? initialStatus ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [submitting, setSubmitting] = useState(false);

  // Effective values fall back to config-derived defaults when empty.
  const effectivePriority = priority || defaultPriorityKey;
  const effectiveStatus = status || initialStatus || defaultStatusKey;

  const createTask = useMutation(api.projects.createTask);
  const updateTask = useMutation(api.projects.updateTask);

  // Combine owner + members for assignee list
  const assigneeOptions = project
    ? [
        ...(project.owner ? [project.owner] : []),
        ...project.members.filter((m) => m._id !== project.owner?._id),
      ]
    : [];

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssigneeId("none");
    setPriority("");
    setStatus("");
    setDueDate("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Judul tugas wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (task) {
        await updateTask({
          taskId: task._id,
          title: title.trim(),
          description: description.trim(),
          assigneeId:
            assigneeId === "none" ? null : (assigneeId as Id<"users">),
          priority: effectivePriority,
          status: effectiveStatus,
          dueDate: dueDate || null,
        });
        toast.success("Tugas diperbarui");
      } else {
        await createTask({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeId:
            assigneeId === "none" ? undefined : (assigneeId as Id<"users">),
          priority: effectivePriority,
          dueDate: dueDate || undefined,
        });
        toast.success("Tugas berhasil dibuat");
      }
      onOpenChange(false);
      if (!task) resetForm();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menyimpan tugas");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit Tugas" : "Buat Tugas Baru"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Perbarui detail tugas di bawah ini."
              : "Isi detail untuk membuat tugas baru."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Desain mockup halaman utama"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Deskripsi</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail tugas, acceptance criteria..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ditugaskan ke</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditugaskan</SelectItem>
                  {assigneeOptions.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioritas</Label>
              <Select value={effectivePriority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activePriorities.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {task && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={effectiveStatus} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStatuses.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="due">Tenggat</Label>
              <DateField
                id="due"
                value={dueDate}
                onChange={(v) => setDueDate(v)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : task ? "Simpan" : "Buat Tugas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
