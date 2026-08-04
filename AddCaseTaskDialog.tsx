import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { OWNER_LABELS, TASK_CATEGORY_CONFIG } from "../_lib/offboarding-utils.ts";

type Props = {
  caseId: Id<"offboardingCases">;
  lastWorkingDay: string;
  trigger?: ReactNode;
};

export default function AddCaseTaskDialog({
  caseId,
  lastWorkingDay,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [ownerRole, setOwnerRole] = useState("hr");
  const [dueDate, setDueDate] = useState(lastWorkingDay);
  const [submitting, setSubmitting] = useState(false);

  const addTask = useMutation(api.offboarding.addCaseTask);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("other");
    setOwnerRole("hr");
    setDueDate(lastWorkingDay);
  };

  const handleSubmit = async () => {
    if (title.trim().length === 0) {
      toast.error("Judul wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await addTask({
        caseId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        ownerRole,
        dueDate: dueDate || undefined,
      });
      toast.success("Tugas ditambahkan");
      reset();
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menambah");
      } else {
        toast.error("Gagal menambah");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          if (!v) reset();
          setOpen(v);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="secondary" className="gap-1 cursor-pointer">
            <Plus className="size-4" />
            Tugas Baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tugas Offboarding Baru</DialogTitle>
          <DialogDescription>
            Tugas ini hanya akan muncul di case ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="task-title">Judul</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TASK_CATEGORY_CONFIG).map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Penanggung Jawab</Label>
              <Select
                value={ownerRole}
                onValueChange={setOwnerRole}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OWNER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Deadline</Label>
            <DateField
              id="task-due"
              value={dueDate}
              onChange={(v) => setDueDate(v)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || title.trim().length === 0}
            className="cursor-pointer"
          >
            {submitting ? "Menambah..." : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
