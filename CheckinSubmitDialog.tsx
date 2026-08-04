import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { CheckinWithUser } from "@/convex/onboarding/checkins.ts";
import { MOOD_CONFIG, formatDate } from "../_lib/onboarding-utils.ts";
import { cn } from "@/lib/utils.ts";
import { CalendarClock } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  checkin: CheckinWithUser | null;
};

export default function CheckinSubmitDialog({
  open,
  onOpenChange,
  checkin,
}: Props) {
  const [mood, setMood] = useState<number | null>(null);
  const [highlights, setHighlights] = useState("");
  const [challenges, setChallenges] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = useMutation(api.onboarding.checkins.submit);

  useEffect(() => {
    if (open && checkin) {
      setMood(checkin.moodScore ?? null);
      setHighlights(checkin.highlights ?? "");
      setChallenges(checkin.challenges ?? "");
      setSupportNeeded(checkin.supportNeeded ?? "");
    }
    if (!open) {
      setMood(null);
      setHighlights("");
      setChallenges("");
      setSupportNeeded("");
    }
  }, [open, checkin]);

  const handleSubmit = async () => {
    if (!checkin) return;
    if (mood === null) {
      toast.error("Pilih mood Anda terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        id: checkin._id,
        moodScore: mood,
        highlights: highlights.trim() || undefined,
        challenges: challenges.trim() || undefined,
        supportNeeded: supportNeeded.trim() || undefined,
      });
      toast.success("Check-in terkirim! Terima kasih atas feedback-nya.");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim check-in");
      } else {
        toast.error("Gagal mengirim check-in");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadySubmitted = checkin && checkin.status !== "pending";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{checkin?.label ?? "Check-in"}</DialogTitle>
          <DialogDescription>
            Ceritakan bagaimana perjalanan onboarding Anda sejauh ini. Feedback
            Anda membantu kami meningkatkan pengalaman onboarding.
          </DialogDescription>
        </DialogHeader>

        {checkin ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <CalendarClock className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Dijadwalkan pada {formatDate(checkin.scheduledDate)}
              </span>
            </div>

            <div className="space-y-3">
              <Label>Bagaimana perasaan Anda?</Label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((score) => {
                  const cfg = MOOD_CONFIG[score];
                  const selected = mood === score;
                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setMood(score)}
                      disabled={submitting || isAlreadySubmitted === true}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border p-3 transition-all cursor-pointer hover:border-primary/50",
                        selected
                          ? `${cfg.bg} border-2 scale-105`
                          : "bg-card border-border",
                        (submitting || isAlreadySubmitted) &&
                          !selected &&
                          "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span className="text-2xl">{cfg.emoji}</span>
                      <span
                        className={cn(
                          "text-[10px] font-medium text-center leading-tight",
                          selected ? cfg.color : "text-muted-foreground",
                        )}
                      >
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="highlights">Apa yang berjalan baik?</Label>
              <Textarea
                id="highlights"
                rows={3}
                placeholder="Hal positif yang Anda rasakan..."
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                disabled={submitting || isAlreadySubmitted === true}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="challenges">Apa tantangan Anda?</Label>
              <Textarea
                id="challenges"
                rows={3}
                placeholder="Hal yang masih terasa sulit atau membingungkan..."
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                disabled={submitting || isAlreadySubmitted === true}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support">Dukungan apa yang Anda butuhkan?</Label>
              <Textarea
                id="support"
                rows={3}
                placeholder="Bantuan, sumber daya, atau arahan yang dibutuhkan..."
                value={supportNeeded}
                onChange={(e) => setSupportNeeded(e.target.value)}
                disabled={submitting || isAlreadySubmitted === true}
                maxLength={1000}
              />
            </div>

            {isAlreadySubmitted && checkin.reviewNote ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="text-xs font-semibold text-primary">
                  Catatan dari HR
                </p>
                <p className="mt-1 whitespace-pre-wrap">{checkin.reviewNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Tutup
          </Button>
          {!isAlreadySubmitted ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting || mood === null}
              className="cursor-pointer"
            >
              {submitting ? "Mengirim..." : "Kirim Check-in"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
