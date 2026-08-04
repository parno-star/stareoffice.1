import { useState } from "react";
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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function AssignCourseDialog({
  courseId,
  trigger,
}: {
  courseId: Id<"courses">;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const users = useQuery(
    api.users.listEmployees,
    open && targetType === "user" ? { search: "" } : "skip",
  );
  const departments = useQuery(
    api.users.listDepartments,
    open && targetType === "department" ? {} : "skip",
  );
  const create = useMutation(api.training.assignments.createAssignment);

  const handleSubmit = async () => {
    if (targetType !== "all" && !targetValue) {
      toast.error("Pilih target penugasan");
      return;
    }
    setSubmitting(true);
    try {
      await create({
        courseId,
        targetType,
        targetValue: targetType === "all" ? undefined : targetValue,
        dueDate: dueDate || undefined,
        note: note.trim() || undefined,
      });
      toast.success("Kelas berhasil ditugaskan");
      setOpen(false);
      setTargetType("all");
      setTargetValue("");
      setDueDate("");
      setNote("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tugaskan kelas</DialogTitle>
          <DialogDescription>
            Jadikan kelas ini wajib untuk karyawan tertentu, departemen, atau
            seluruh perusahaan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Target penugasan</Label>
            <Select
              value={targetType}
              onValueChange={(v) => {
                setTargetType(v);
                setTargetValue("");
              }}
            >
              <SelectTrigger className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Seluruh karyawan</SelectItem>
                <SelectItem value="department">Departemen</SelectItem>
                <SelectItem value="user">Karyawan tertentu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetType === "department" ? (
            <div className="space-y-1.5">
              <Label>Departemen</Label>
              <Select value={targetValue} onValueChange={setTargetValue}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue placeholder="Pilih departemen" />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {targetType === "user" ? (
            <div className="space-y-1.5">
              <Label>Karyawan</Label>
              <Select value={targetValue} onValueChange={setTargetValue}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={String(u._id)}>
                      {u.name ?? u.email ?? "Karyawan"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="assign-due">Tenggat (opsional)</Label>
            <DateField
              id="assign-due"
              value={dueDate}
              onChange={(v) => setDueDate(v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-note">Catatan (opsional)</Label>
            <Textarea
              id="assign-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Pesan singkat untuk peserta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menugaskan..." : "Tugaskan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
