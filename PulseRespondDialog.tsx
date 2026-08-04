import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.js";
import {
  MOOD_ICONS,
  YES_NO_ICONS,
} from "@/pages/pulse/_lib/pulse-utils.ts";

export default function PulseRespondDialog({
  open,
  onOpenChange,
  pulseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pulseId: Id<"pulseSurveys"> | null;
}) {
  const pulse = useQuery(
    api.pulse.getPulse,
    pulseId ? { pulseId } : "skip",
  );
  const submitResponse = useMutation(api.pulse.submitResponse);
  const [answer, setAnswer] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAnswer("");
      setComment("");
    }
  }, [open, pulseId]);

  async function handleSubmit() {
    if (!pulseId || !pulse) return;
    if (!answer) {
      toast.error("Silakan pilih jawaban terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await submitResponse({
        pulseId,
        answer,
        comment: comment.trim() || undefined,
      });
      toast.success("Terima kasih! Suara Anda tercatat.");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal mengirim respons")
          : "Gagal mengirim respons",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {pulse === undefined && pulseId ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : pulse === null ? (
          <DialogHeader>
            <DialogTitle>Pulse tidak ditemukan</DialogTitle>
            <DialogDescription>
              Pulse mungkin telah dihapus atau ditutup oleh administrator.
            </DialogDescription>
          </DialogHeader>
        ) : pulse ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle>{pulse.title}</DialogTitle>
                {pulse.isAnonymous && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" />
                    Anonim
                  </Badge>
                )}
              </div>
              {pulse.description && (
                <DialogDescription>{pulse.description}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-base font-medium">{pulse.question}</p>

              {/* Answer picker by questionType */}
              {pulse.questionType === "mood" && (
                <div className="grid grid-cols-5 gap-2">
                  {MOOD_ICONS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setAnswer(String(m.value))}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all cursor-pointer",
                        answer === String(m.value)
                          ? `${m.bg} border-current`
                          : "bg-muted/30 hover:bg-muted border-transparent",
                      )}
                    >
                      <m.icon className={cn("size-8", m.color)} />
                      <span className="text-[10px] font-medium text-center line-clamp-2">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {pulse.questionType === "rating" && (
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(String(n))}
                      className="cursor-pointer"
                    >
                      <Star
                        className={cn(
                          "size-10 transition-colors",
                          answer && Number(answer) >= n
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                </div>
              )}

              {pulse.questionType === "nps" && (
                <div>
                  <div className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }).map((_, n) => {
                      const active = answer === String(n);
                      const color =
                        n <= 6
                          ? "bg-rose-500/20 text-rose-600 border-rose-500/30"
                          : n <= 8
                            ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-600 border-emerald-500/30";
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAnswer(String(n))}
                          className={cn(
                            "h-10 rounded-md border-2 text-sm font-semibold transition-all cursor-pointer",
                            active
                              ? `${color} border-current scale-105`
                              : "bg-muted/30 hover:bg-muted border-transparent",
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Sangat kecil</span>
                    <span>Sangat besar</span>
                  </div>
                </div>
              )}

              {pulse.questionType === "yes_no" && (
                <div className="grid grid-cols-2 gap-3">
                  {(["yes", "no"] as const).map((key) => {
                    const cfg = YES_NO_ICONS[key];
                    const active = answer === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setAnswer(key)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all cursor-pointer",
                          active
                            ? `${cfg.bg} border-current`
                            : "bg-muted/30 hover:bg-muted border-transparent",
                        )}
                      >
                        <cfg.icon className={cn("size-10", cfg.color)} />
                        <span className="text-sm font-semibold">
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {pulse.commentPrompt && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{pulse.commentPrompt}</p>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ceritakan secara singkat..."
                    rows={3}
                  />
                </div>
              )}
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
                disabled={submitting || !answer}
                className="cursor-pointer"
              >
                {submitting ? "Mengirim..." : "Kirim Pendapat"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
