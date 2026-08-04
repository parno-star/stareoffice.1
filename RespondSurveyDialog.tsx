import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { Shield, Star } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.js";
import { MOOD_ICONS } from "@/pages/engagement/_lib/engagement-utils.ts";

type AnswerState = Record<
  string,
  { value: string; values: Array<string> }
>;

export default function RespondSurveyDialog({
  open,
  onOpenChange,
  surveyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: Id<"engagementSurveys"> | null;
}) {
  const survey = useQuery(
    api.engagement.getSurvey,
    surveyId ? { surveyId } : "skip",
  );
  const submit = useMutation(api.engagement.submitResponse);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  function setValue(questionId: string, value: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value, values: prev[questionId]?.values ?? [] },
    }));
  }

  function toggleMulti(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = prev[questionId]?.values ?? [];
      const values = current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option];
      return {
        ...prev,
        [questionId]: { value: values[0] ?? "", values },
      };
    });
  }

  async function handleSubmit() {
    if (!survey) return;
    // Validate required
    for (const q of survey.questions) {
      if (!q.required) continue;
      const a = answers[q.id];
      const hasValue =
        a &&
        ((a.value && a.value.trim().length > 0) ||
          (a.values && a.values.length > 0));
      if (!hasValue) {
        toast.error(`Pertanyaan wajib belum diisi: ${q.text}`);
        return;
      }
    }
    setSaving(true);
    try {
      await submit({
        surveyId: survey._id,
        answers: survey.questions.map((q) => {
          const a = answers[q.id];
          return {
            questionId: q.id,
            value: a?.value ?? "",
            values:
              a?.values && a.values.length > 0 ? a.values : undefined,
          };
        }),
        comment: comment.trim() || undefined,
      });
      toast.success("Terima kasih! Jawaban Anda telah tersimpan.");
      setAnswers({});
      setComment("");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan jawaban");
      } else {
        toast.error("Gagal menyimpan jawaban");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {survey === undefined && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {survey === null && (
          <DialogHeader>
            <DialogTitle>Survei tidak ditemukan</DialogTitle>
          </DialogHeader>
        )}
        {survey && (
          <>
            <DialogHeader>
              <DialogTitle>{survey.title}</DialogTitle>
              {survey.description && (
                <DialogDescription>{survey.description}</DialogDescription>
              )}
            </DialogHeader>

            {survey.isAnonymous && (
              <div className="flex items-start gap-3 rounded-lg border bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 p-3">
                <Shield className="size-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-emerald-700 dark:text-emerald-300">
                    Anonim
                  </p>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    Jawaban Anda tidak dapat dikaitkan dengan identitas Anda.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {survey.questions.map((q, idx) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary">{idx + 1}</Badge>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {q.text}
                        {q.required && (
                          <span className="ml-1 text-rose-500">*</span>
                        )}
                      </p>
                      {q.category && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {q.category}
                        </p>
                      )}
                    </div>
                  </div>

                  {q.type === "rating" && (
                    <RatingPicker
                      value={answers[q.id]?.value ?? ""}
                      onChange={(v) => setValue(q.id, v)}
                      minLabel={q.minLabel}
                      maxLabel={q.maxLabel}
                    />
                  )}
                  {q.type === "mood" && (
                    <MoodPicker
                      value={answers[q.id]?.value ?? ""}
                      onChange={(v) => setValue(q.id, v)}
                    />
                  )}
                  {q.type === "nps" && (
                    <NpsPicker
                      value={answers[q.id]?.value ?? ""}
                      onChange={(v) => setValue(q.id, v)}
                      minLabel={q.minLabel}
                      maxLabel={q.maxLabel}
                    />
                  )}
                  {q.type === "single_choice" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(q.options ?? []).map((opt) => {
                        const selected = answers[q.id]?.value === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setValue(q.id, opt)}
                            className={cn(
                              "rounded-md border px-3 py-2 text-sm text-left cursor-pointer transition-colors",
                              selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "hover:bg-muted",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "multi_choice" && (
                    <div className="space-y-2">
                      {(q.options ?? []).map((opt) => {
                        const selected =
                          answers[q.id]?.values?.includes(opt) ?? false;
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted"
                          >
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleMulti(q.id, opt)}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "text" && (
                    <Textarea
                      value={answers[q.id]?.value ?? ""}
                      onChange={(e) => setValue(q.id, e.target.value)}
                      placeholder="Tulis jawaban Anda..."
                      rows={3}
                    />
                  )}
                </div>
              ))}

              <div className="space-y-2 pt-2 border-t">
                <Label>Komentar Tambahan (opsional)</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ada hal lain yang ingin disampaikan?"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="cursor-pointer"
              >
                {saving ? "Mengirim..." : "Kirim Jawaban"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RatingPicker({
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  minLabel: string | null | undefined;
  maxLabel: string | null | undefined;
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = Number(value) === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border py-3 cursor-pointer transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "hover:bg-muted",
              )}
            >
              <div className="flex">
                {Array.from({ length: n }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "size-4",
                      selected
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40",
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-medium">{n}</span>
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-2 px-1 text-xs text-muted-foreground">
          <span>{minLabel ?? ""}</span>
          <span>{maxLabel ?? ""}</span>
        </div>
      )}
    </div>
  );
}

function MoodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {MOOD_ICONS.map((m) => {
        const selected = Number(value) === m.value;
        const Icon = m.icon;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(String(m.value))}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border py-3 cursor-pointer transition-colors",
              selected
                ? "border-primary bg-primary/10"
                : "hover:bg-muted",
            )}
          >
            <Icon className={cn("size-6", selected ? m.color : "text-muted-foreground")} />
            <span className="text-[10px] font-medium text-center">
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NpsPicker({
  value,
  onChange,
  minLabel,
  maxLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  minLabel: string | null | undefined;
  maxLabel: string | null | undefined;
}) {
  return (
    <div>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }).map((_, n) => {
          const selected = Number(value) === n;
          const color =
            n <= 6
              ? "border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              : n <= 8
                ? "border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                : "border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10";
          const selectedColor =
            n <= 6
              ? "border-rose-500 bg-rose-100 dark:bg-rose-500/20"
              : n <= 8
                ? "border-amber-500 bg-amber-100 dark:bg-amber-500/20"
                : "border-emerald-500 bg-emerald-100 dark:bg-emerald-500/20";
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={cn(
                "aspect-square rounded-md border text-sm font-medium cursor-pointer transition-colors",
                selected ? selectedColor : color,
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 px-1 text-xs text-muted-foreground">
        <span>{minLabel ?? "Tidak Mungkin"}</span>
        <span>{maxLabel ?? "Sangat Mungkin"}</span>
      </div>
    </div>
  );
}
