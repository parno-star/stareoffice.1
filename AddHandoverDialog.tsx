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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  caseId: Id<"offboardingCases">;
  trigger?: ReactNode;
};

export default function AddHandoverDialog({ caseId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [successorId, setSuccessorId] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addHandover = useMutation(api.offboarding.addHandover);
  const employees = useQuery(
    api.users.listEmployees,
    open ? { search: undefined } : "skip",
  );

  const reset = () => {
    setTopic("");
    setDescription("");
    setSuccessorId("none");
    setDueDate("");
  };

  const handleSubmit = async () => {
    if (topic.trim().length === 0) {
      toast.error("Topik wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await addHandover({
        caseId,
        topic: topic.trim(),
        description: description.trim() || undefined,
        successorId:
          successorId !== "none"
            ? (successorId as Id<"users">)
            : undefined,
        dueDate: dueDate || undefined,
      });
      toast.success("Handover ditambahkan");
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
            Handover Baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Item Handover Baru</DialogTitle>
          <DialogDescription>
            Tugas/tanggung jawab yang akan dialihkan ke rekan kerja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="handover-topic">Topik</Label>
            <Input
              id="handover-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Project Alpha"
              disabled={submitting}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handover-desc">Deskripsi & Dokumentasi</Label>
            <Textarea
              id="handover-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail proses, link dokumen, kontak penting..."
              disabled={submitting}
              maxLength={1000}
            />
          </div>
          <div className="space-y-2">
            <Label>Diserahkan ke</Label>
            <Select
              value={successorId}
              onValueChange={setSuccessorId}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Belum ditentukan</SelectItem>
                {(employees ?? []).map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? u.email ?? "-"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="handover-due">Target Selesai (opsional)</Label>
            <DateField
              id="handover-due"
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
            disabled={submitting || topic.trim().length === 0}
            className="cursor-pointer"
          >
            {submitting ? "Menambah..." : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
