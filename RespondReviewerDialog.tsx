import { useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import { ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  RELATIONSHIP_BADGE,
  RELATIONSHIP_ICONS,
  RELATIONSHIP_LABELS,
} from "@/pages/feedback360/_lib/feedback360-utils.ts";

type Answer = { questionId: string; value: string };

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RatingPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const current = Number(value) || 0;
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= current;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={cn(
              "flex size-10 cursor-pointer items-center justify-center rounded-lg border transition-colors",
              active
                ? "border-amber-400 bg-amber-100 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
            )}
            aria-label={`Beri ${n} dari 5`}
          >
            <Star
              className={cn("size-5", active ? "fill-current" : "")}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm text-muted-foreground">
        {current > 0 ? `${current}/5` : "Pilih nilai"}
      </span>
    </div>
  );
}

export default function RespondReviewerDialog({
  reviewerRowId,
  onOpenChange,
}: {
  reviewerRowId: Id<"feedback360Reviewers"> | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = reviewerRowId !== null;
  const form = useQuery(
    api.feedback360.reviewers.getInviteForm,
    reviewerRowId ? { reviewerRowId } : "skip",
  );
  const submit = useMutation(api.feedback360.reviewers.submitReviewerResponse);
  const decline = useMutation(api.feedback360.reviewers.declineInvite);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [saving, setSaving] = useState(false);

  // Rehydrate when the form data loads (may include previously saved answers)
  useEffect(() => {
    if (!form) return;
    const next: Record<string, string> = {};
    for (const a of form.existingAnswers) next[a.questionId] = a.value;
    setAnswers(next);
    setStrengths(form.existingStrengths ?? "");
    setImprovements(form.existingImprovements ?? "");
  }, [form]);

  const isAnonymous =
    form?.invite.relationship === "peer" ||
    form?.invite.relationship === "report";

  const required = useMemo(() => {
    if (!form) return [];
    return form.questions.filter((q) => q.required);
  }, [form]);

  async function handleSubmit() {
    if (!reviewerRowId || !form) return;
    for (const q of required) {
      const v = answers[q.id];
      if (v === undefined || v.trim() === "") {
        toast.error("Lengkapi semua pertanyaan wajib terlebih dahulu");
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Array<Answer> = form.questions
        .map((q) => ({ questionId: q.id, value: answers[q.id] ?? "" }))
        .filter((a) => a.value.trim() !== "");
      await submit({
        reviewerRowId,
        answers: payload,
        strengths: strengths.trim() || undefined,
        improvements: improvements.trim() || undefined,
      });
      toast.success("Terima kasih! Feedback Anda telah dikirim.");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim feedback");
      } else {
        toast.error("Gagal mengirim feedback");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDecline() {
    if (!reviewerRowId) return;
    try {
      await decline({ reviewerRowId });
      toast.success("Undangan ditolak");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menolak undangan");
      } else {
        toast.error("Gagal menolak undangan");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Isi Feedback 360°</DialogTitle>
          <DialogDescription>
            Berikan jawaban jujur dan konstruktif. Perspektif Anda penting bagi
            pengembangan rekan tim.
          </DialogDescription>
        </DialogHeader>

        {form === undefined ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : form === null ? (
          <p className="text-sm text-muted-foreground">
            Undangan tidak ditemukan.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Avatar className="size-12 shrink-0">
                {form.invite.revieweeAvatar ? (
                  <AvatarImage src={form.invite.revieweeAvatar} />
                ) : null}
                <AvatarFallback>
                  {initials(form.invite.revieweeName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {form.invite.revieweeName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {form.invite.revieweeJobTitle ??
                    form.invite.revieweeDepartment ??
                    "Karyawan"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border",
                      RELATIONSHIP_BADGE[form.invite.relationship],
                    )}
                  >
                    {(() => {
                      const Icon = RELATIONSHIP_ICONS[form.invite.relationship];
                      return <Icon className="mr-1 size-3" />;
                    })()}
                    {RELATIONSHIP_LABELS[form.invite.relationship]}
                  </Badge>
                  {isAnonymous ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <ShieldCheck className="mr-1 size-3" />
                      Anonim bagi reviewee
                    </Badge>
                  ) : (
                    <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      Identitas Anda terlihat
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {form.questions.map((q, idx) => (
                <div key={q.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Pertanyaan {idx + 1}
                        {q.category ? ` · ${q.category}` : ""}
                      </p>
                      <p className="text-sm font-medium">{q.text}</p>
                    </div>
                    {q.required ? (
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                        Wajib
                      </Badge>
                    ) : null}
                  </div>
                  {q.type === "rating" ? (
                    <RatingPicker
                      value={answers[q.id] ?? ""}
                      onChange={(v) =>
                        setAnswers((prev) => ({ ...prev, [q.id]: v }))
                      }
                    />
                  ) : (
                    <Textarea
                      value={answers[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="Tulis jawaban Anda..."
                      rows={3}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kekuatan utama (opsional)</Label>
                <Textarea
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="Apa yang paling berkesan dari orang ini?"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Area pengembangan (opsional)</Label>
                <Textarea
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="Area mana yang bisa lebih ditingkatkan?"
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {form && form.invite.relationship !== "self" ? (
            <Button
              variant="ghost"
              onClick={handleDecline}
              disabled={saving}
              className="cursor-pointer text-destructive hover:text-destructive"
            >
              Tolak Undangan
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer"
          >
            Tutup
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form}
            className="cursor-pointer"
          >
            {saving ? "Mengirim..." : "Kirim Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
