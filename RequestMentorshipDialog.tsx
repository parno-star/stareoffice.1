import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function RequestMentorshipDialog({
  trigger,
  mentorId,
  mentorName,
  onRequested,
}: {
  trigger: React.ReactNode;
  mentorId: Id<"users">;
  mentorName: string;
  onRequested?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [topics, setTopics] = useState<Array<string>>([]);
  const [topicInput, setTopicInput] = useState("");
  const [cadence, setCadence] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const request = useMutation(api.training.mentorships.requestMentorship);

  const addTopic = () => {
    const v = topicInput.trim();
    if (!v || topics.includes(v)) return;
    setTopics([...topics, v]);
    setTopicInput("");
  };

  const handleSubmit = async () => {
    if (!goal.trim()) {
      toast.error("Tujuan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await request({
        mentorId,
        goal,
        topics,
        cadence: cadence || undefined,
        targetEndDate: targetEndDate || undefined,
      });
      toast.success("Permintaan mentorship terkirim");
      setOpen(false);
      setGoal("");
      setTopics([]);
      setTopicInput("");
      setCadence("");
      setTargetEndDate("");
      onRequested?.();
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal mengirim")
          : "Gagal mengirim";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Minta mentorship</DialogTitle>
          <DialogDescription>
            Kirim permintaan ke {mentorName} dengan tujuan spesifik agar mereka
            memahami ekspektasi Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tujuan / hasil yang diinginkan</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              placeholder="Contoh: Saya ingin memahami arsitektur React lanjutan untuk membangun dashboard internal."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fokus pembahasan (opsional)</Label>
            <div className="flex gap-2">
              <Input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="Ketik topik lalu tekan Enter..."
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="cursor-pointer"
                onClick={addTopic}
              >
                Tambah
              </Button>
            </div>
            {topics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTopics(topics.filter((x) => x !== t))}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Frekuensi pertemuan</Label>
              <Input
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                placeholder="Contoh: Mingguan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target selesai (opsional)</Label>
              <DateField
                value={targetEndDate}
                onChange={(v) => setTargetEndDate(v)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={submitting}
          >
            Kirim permintaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
