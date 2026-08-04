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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  BadgeCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type AttemptResult = {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  results: Array<{
    questionId: string;
    correct: boolean;
    correctOptionId: string;
    explanation?: string;
  }>;
};

export default function QuizTakeDialog({
  courseId,
  trigger,
}: {
  courseId: Id<"courses">;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const quiz = useQuery(
    api.training.quizzes.getQuizForCourse,
    open ? { courseId } : "skip",
  );
  const submit = useMutation(api.training.quizzes.submitQuizAttempt);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAnswers({});
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const unanswered = quiz.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Jawab semua pertanyaan (sisa ${unanswered.length})`);
      return;
    }
    setSubmitting(true);
    try {
      const r = await submit({
        quizId: quiz._id,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      });
      setResult({
        score: r.score,
        passed: r.passed,
        correctCount: r.correctCount,
        totalQuestions: r.totalQuestions,
        results: r.results,
      });
      toast[r.passed ? "success" : "error"](
        r.passed ? "Selamat! Anda lulus kuis." : "Belum lulus, coba lagi.",
      );
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {quiz?.title ?? "Kuis akhir kelas"}
            {quiz?.hasPassed ? (
              <BadgeCheck className="size-5 text-emerald-500" />
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {quiz?.description ??
              "Jawab semua pertanyaan untuk menyelesaikan kelas."}
          </DialogDescription>
        </DialogHeader>

        {quiz === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : quiz === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Kuis belum tersedia.
          </p>
        ) : result ? (
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-xl border p-4",
                result.passed
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-red-500/30 bg-red-500/10",
              )}
            >
              <div className="flex items-center gap-3">
                {result.passed ? (
                  <CheckCircle2 className="size-8 text-emerald-500" />
                ) : (
                  <AlertTriangle className="size-8 text-red-500" />
                )}
                <div>
                  <p className="text-lg font-bold">
                    Skor Anda: {result.score}%
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.correctCount} dari {result.totalQuestions} benar ·
                    {" "}Batas lulus {quiz.passingScore}%
                  </p>
                </div>
              </div>
              <Progress
                value={result.score}
                className={cn(
                  "mt-3 h-2",
                  result.passed
                    ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                    : "[&_[data-slot=progress-indicator]]:bg-red-500",
                )}
              />
            </div>
            <div className="space-y-2">
              {quiz.questions.map((q, idx) => {
                const r = result.results.find((x) => x.questionId === q.id);
                const chosen = answers[q.id];
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      r?.correct
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-red-500/30 bg-red-500/5",
                    )}
                  >
                    <p className="font-medium">
                      {idx + 1}. {q.text}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {q.options.map((o) => {
                        const isChosen = chosen === o.id;
                        const isCorrect = r?.correctOptionId === o.id;
                        return (
                          <li
                            key={o.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1",
                              isCorrect && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                              isChosen && !isCorrect &&
                                "bg-red-500/10 text-red-700 dark:text-red-300",
                            )}
                          >
                            {isCorrect ? (
                              <CheckCircle2 className="size-4 shrink-0" />
                            ) : isChosen ? (
                              <XCircle className="size-4 shrink-0" />
                            ) : (
                              <span className="size-4" />
                            )}
                            <span>{o.text}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {r?.explanation ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">Penjelasan:</span>{" "}
                        {r.explanation}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              {!result.passed &&
              (!quiz.maxAttempts ||
                quiz.attemptsUsed < quiz.maxAttempts) ? (
                <Button
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={reset}
                >
                  Coba lagi
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="cursor-pointer"
              >
                Tutup
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
              <div>
                <span className="font-medium">{quiz.questions.length}</span>{" "}
                pertanyaan · Batas lulus{" "}
                <span className="font-medium">{quiz.passingScore}%</span>
              </div>
              <div className="text-muted-foreground">
                Percobaan{" "}
                <span className="font-medium text-foreground">
                  {quiz.attemptsUsed}
                </span>
                {quiz.maxAttempts ? ` / ${quiz.maxAttempts}` : ""}
                {quiz.bestScore !== null
                  ? ` · Skor terbaik ${quiz.bestScore}%`
                  : ""}
              </div>
            </div>
            {quiz.questions.map((q, idx) => (
              <div
                key={q.id}
                className="space-y-2 rounded-lg border bg-card p-4"
              >
                <p className="text-sm font-medium">
                  {idx + 1}. {q.text}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((o) => {
                    const selected = answers[q.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: o.id }))
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                          selected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "size-4 rounded-full border",
                            selected
                              ? "border-primary bg-primary"
                              : "border-input",
                          )}
                        />
                        {o.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <DialogFooter>
              <Button
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="cursor-pointer"
              >
                {submitting ? "Mengirim..." : "Kirim jawaban"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
