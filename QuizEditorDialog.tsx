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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type QuestionDraft = {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  explanation?: string;
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyQuestion(): QuestionDraft {
  const opts = [
    { id: newId(), text: "" },
    { id: newId(), text: "" },
  ];
  return {
    id: newId(),
    text: "",
    options: opts,
    correctOptionId: opts[0].id,
    explanation: "",
  };
}

export default function QuizEditorDialog({
  courseId,
  trigger,
}: {
  courseId: Id<"courses">;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const existing = useQuery(
    api.training.quizzes.getQuizForAdmin,
    open ? { courseId } : "skip",
  );
  const upsert = useMutation(api.training.quizzes.upsertQuiz);
  const removeQuiz = useMutation(api.training.quizzes.removeQuiz);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScore, setPassingScore] = useState("70");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [questions, setQuestions] = useState<Array<QuestionDraft>>([
    emptyQuestion(),
  ]);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (open && existing !== undefined && !initialized) {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? "");
      setPassingScore(String(existing.passingScore));
      setMaxAttempts(existing.maxAttempts ? String(existing.maxAttempts) : "");
      setQuestions(
        existing.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation ?? "",
        })),
      );
    } else {
      setTitle("Kuis akhir kelas");
      setDescription("");
      setPassingScore("70");
      setMaxAttempts("");
      setQuestions([emptyQuestion()]);
    }
    setInitialized(true);
  }

  const updateQuestion = (idx: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const handleSubmit = async () => {
    if (title.trim().length === 0) {
      toast.error("Judul kuis wajib diisi");
      return;
    }
    const pass = Number(passingScore);
    if (!Number.isFinite(pass) || pass < 0 || pass > 100) {
      toast.error("Nilai kelulusan harus 0-100");
      return;
    }
    const ma = maxAttempts.trim() === "" ? undefined : Number(maxAttempts);
    if (ma !== undefined && (!Number.isFinite(ma) || ma < 1)) {
      toast.error("Batas percobaan tidak valid");
      return;
    }
    for (const q of questions) {
      if (q.text.trim().length === 0) {
        toast.error("Isi semua pertanyaan");
        return;
      }
      if (q.options.length < 2) {
        toast.error("Minimal 2 opsi per pertanyaan");
        return;
      }
      for (const o of q.options) {
        if (o.text.trim().length === 0) {
          toast.error("Isi semua opsi jawaban");
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      await upsert({
        courseId,
        title: title.trim(),
        description: description.trim() || undefined,
        passingScore: pass,
        maxAttempts: ma,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
          correctOptionId: q.correctOptionId,
          explanation: q.explanation?.trim() || undefined,
        })),
      });
      toast.success("Kuis disimpan");
      setOpen(false);
      setInitialized(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeQuiz({ courseId });
      toast.success("Kuis dihapus");
      setOpen(false);
      setInitialized(false);
    } catch {
      toast.error("Gagal menghapus kuis");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setInitialized(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola kuis kelas</DialogTitle>
          <DialogDescription>
            Kuis wajib dikerjakan peserta untuk menyelesaikan kelas. Nilai
            minimum kelulusan dapat Anda tentukan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quiz-title">Judul kuis</Label>
              <Input
                id="quiz-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Evaluasi akhir"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quiz-pass">Nilai lulus (%)</Label>
                <Input
                  id="quiz-pass"
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiz-attempts">Batas coba</Label>
                <Input
                  id="quiz-attempts"
                  type="number"
                  min="1"
                  placeholder="tak terbatas"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="quiz-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instruksi singkat untuk peserta"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Pertanyaan ({questions.length})</Label>
              <Button
                size="sm"
                variant="secondary"
                type="button"
                className="cursor-pointer gap-1"
                onClick={() =>
                  setQuestions((prev) => [...prev, emptyQuestion()])
                }
              >
                <Plus className="size-4" /> Tambah pertanyaan
              </Button>
            </div>
            {questions.map((q, qIdx) => (
              <Card key={q.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {qIdx + 1}
                    </div>
                    <Input
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(qIdx, { text: e.target.value })
                      }
                      placeholder="Tulis pertanyaan..."
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      type="button"
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setQuestions((prev) =>
                          prev.filter((_, i) => i !== qIdx),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 pl-9">
                    {q.options.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(qIdx, { correctOptionId: o.id })
                          }
                          title="Tandai sebagai jawaban benar"
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border cursor-pointer",
                            q.correctOptionId === o.id
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-input",
                          )}
                        >
                          {q.correctOptionId === o.id ? (
                            <CheckCircle2 className="size-4" />
                          ) : null}
                        </button>
                        <Input
                          value={o.text}
                          onChange={(e) => {
                            const next = q.options.map((x) =>
                              x.id === o.id ? { ...x, text: e.target.value } : x,
                            );
                            updateQuestion(qIdx, { options: next });
                          }}
                          placeholder="Opsi jawaban"
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          type="button"
                          disabled={q.options.length <= 2}
                          onClick={() => {
                            const next = q.options.filter((x) => x.id !== o.id);
                            updateQuestion(qIdx, {
                              options: next,
                              correctOptionId:
                                q.correctOptionId === o.id
                                  ? next[0]?.id ?? ""
                                  : q.correctOptionId,
                            });
                          }}
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="cursor-pointer gap-1"
                      onClick={() =>
                        updateQuestion(qIdx, {
                          options: [
                            ...q.options,
                            { id: newId(), text: "" },
                          ],
                        })
                      }
                    >
                      <Plus className="size-4" /> Tambah opsi
                    </Button>
                    <Textarea
                      value={q.explanation ?? ""}
                      onChange={(e) =>
                        updateQuestion(qIdx, { explanation: e.target.value })
                      }
                      placeholder="Penjelasan jawaban (opsional)"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {existing ? (
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              Hapus kuis
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? "Menyimpan..." : "Simpan kuis"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
