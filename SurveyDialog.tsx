import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type Question = {
  id: string;
  text: string;
  type: string;
  options?: Array<string>;
  required: boolean;
};

export default function SurveyEditorDialog({
  courseId,
  trigger,
  initialValues,
}: {
  courseId: Id<"courses">;
  trigger: ReactNode;
  initialValues?: {
    title: string;
    description?: string;
    isActive: boolean;
    questions: Array<Question>;
  };
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(
    initialValues?.title ?? "Umpan Balik Pelatihan",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [questions, setQuestions] = useState<Array<Question>>(
    initialValues?.questions ?? [
      {
        id: crypto.randomUUID(),
        text: "Bagaimana Anda menilai kualitas materi?",
        type: "rating",
        required: true,
      },
      {
        id: crypto.randomUUID(),
        text: "Apa saran Anda untuk perbaikan?",
        type: "text",
        required: false,
      },
    ],
  );
  const [busy, setBusy] = useState(false);
  const save = useMutation(api.training.surveys.upsertSurvey);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "",
        type: "rating",
        required: false,
      },
    ]);
  };

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Judul survei wajib diisi");
      return;
    }
    if (questions.some((q) => !q.text.trim())) {
      toast.error("Semua pertanyaan harus memiliki teks");
      return;
    }
    setBusy(true);
    try {
      await save({
        courseId,
        title: title.trim(),
        description: description.trim() || undefined,
        isActive,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          type: q.type,
          options:
            q.type === "choice"
              ? (q.options ?? []).filter((o) => o.trim())
              : undefined,
          required: q.required,
        })),
      });
      toast.success("Survei disimpan");
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Survei umpan balik pelatihan</DialogTitle>
            <DialogDescription>
              Tanyakan feedback dari peserta setelah menyelesaikan kelas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="t">Judul</Label>
              <Input
                id="t"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d">Deskripsi</Label>
              <Textarea
                id="d"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="active" className="cursor-pointer">
                Survei aktif
              </Label>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pertanyaan</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addQuestion}
                  className="cursor-pointer gap-1"
                >
                  <Plus className="size-4" /> Tambah
                </Button>
              </div>
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="space-y-2 rounded-lg border bg-card p-3"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(i, { text: e.target.value })
                      }
                      placeholder={`Pertanyaan ${i + 1}`}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive"
                      onClick={() => removeQuestion(i)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select
                      value={q.type}
                      onValueChange={(v) => updateQuestion(i, { type: v })}
                    >
                      <SelectTrigger className="w-36 cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">Rating 1-5</SelectItem>
                        <SelectItem value="text">Teks</SelectItem>
                        <SelectItem value="choice">Pilihan</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={q.required}
                        onChange={(e) =>
                          updateQuestion(i, { required: e.target.checked })
                        }
                      />
                      Wajib diisi
                    </label>
                  </div>
                  {q.type === "choice" ? (
                    <Textarea
                      rows={2}
                      placeholder="Satu opsi per baris"
                      value={(q.options ?? []).join("\n")}
                      onChange={(e) =>
                        updateQuestion(i, {
                          options: e.target.value.split("\n"),
                        })
                      }
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="cursor-pointer">
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Taker dialog

export function SurveyTakeDialog({
  courseId,
  trigger,
}: {
  courseId: Id<"courses">;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const survey = useQuery(
    api.training.surveys.getSurvey,
    open ? { courseId } : "skip",
  );
  const submit = useMutation(api.training.surveys.submitResponse);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;
    for (const q of survey.questions) {
      if (q.required && !answers[q.id]) {
        toast.error(`Pertanyaan "${q.text}" wajib diisi`);
        return;
      }
    }
    setBusy(true);
    try {
      await submit({
        surveyId: survey._id,
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          value,
        })),
      });
      toast.success("Terima kasih atas umpan balik Anda!");
      setOpen(false);
      setAnswers({});
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{survey?.title ?? "Survei"}</DialogTitle>
            {survey?.description ? (
              <DialogDescription>{survey.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-4 py-4">
            {survey === undefined ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : survey === null ? (
              <p className="text-sm text-muted-foreground">
                Survei tidak tersedia.
              </p>
            ) : survey.hasResponded ? (
              <p className="text-sm text-muted-foreground">
                Anda sudah mengirim umpan balik. Submit ulang untuk memperbarui
                jawaban.
              </p>
            ) : null}
            {survey?.questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <Label>
                  {i + 1}. {q.text}
                  {q.required ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </Label>
                {q.type === "rating" ? (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        type="button"
                        key={n}
                        size="sm"
                        variant={
                          answers[q.id] === String(n) ? "default" : "secondary"
                        }
                        onClick={() =>
                          setAnswers((a) => ({ ...a, [q.id]: String(n) }))
                        }
                        className="cursor-pointer"
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                ) : q.type === "choice" && q.options ? (
                  <div className="space-y-1">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt}
                          onChange={() =>
                            setAnswers((a) => ({ ...a, [q.id]: opt }))
                          }
                          className="cursor-pointer"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    rows={3}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={busy || !survey}
              className="cursor-pointer"
            >
              Kirim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
