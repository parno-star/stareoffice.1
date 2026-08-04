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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { CheckinWithUser } from "@/convex/onboarding/checkins.ts";
import {
  MOOD_CONFIG,
  formatDate,
  getInitials,
} from "../_lib/onboarding-utils.ts";
import { cn } from "@/lib/utils.ts";
import { Calendar, CheckCircle2, Smile } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  checkin: CheckinWithUser | null;
};

export default function CheckinReviewDialog({
  open,
  onOpenChange,
  checkin,
}: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const review = useMutation(api.onboarding.checkins.review);

  useEffect(() => {
    if (open && checkin) {
      setNote(checkin.reviewNote ?? "");
    }
    if (!open) setNote("");
  }, [open, checkin]);

  const handleReview = async () => {
    if (!checkin) return;
    setSubmitting(true);
    try {
      await review({
        id: checkin._id,
        reviewNote: note.trim() || undefined,
      });
      toast.success("Check-in ditandai sudah ditinjau");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal meninjau");
      } else {
        toast.error("Gagal meninjau");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const moodCfg =
    checkin?.moodScore != null ? MOOD_CONFIG[checkin.moodScore] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{checkin?.label ?? "Check-in"}</DialogTitle>
          <DialogDescription>
            Tinjau feedback dari karyawan dan berikan tanggapan jika perlu.
          </DialogDescription>
        </DialogHeader>

        {checkin ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Avatar className="size-11">
                {checkin.userAvatar ? (
                  <AvatarImage src={checkin.userAvatar} />
                ) : null}
                <AvatarFallback>
                  {getInitials(checkin.userName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {checkin.userName ?? "Karyawan"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {checkin.userJobTitle ?? ""}
                  {checkin.userJobTitle && checkin.userDepartment ? " · " : ""}
                  {checkin.userDepartment ?? ""}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  checkin.status === "reviewed"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
                }
              >
                {checkin.status === "reviewed" ? "Ditinjau" : "Dikirim"}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Dijadwalkan</p>
                  <p className="text-sm font-medium">
                    {formatDate(checkin.scheduledDate)}
                  </p>
                </div>
              </div>
              {moodCfg ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3",
                    moodCfg.bg,
                  )}
                >
                  <Smile className={cn("size-4", moodCfg.color)} />
                  <div>
                    <p className="text-xs text-muted-foreground">Mood</p>
                    <p className={cn("text-sm font-medium", moodCfg.color)}>
                      {moodCfg.emoji} {moodCfg.label}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {checkin.highlights ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Yang Berjalan Baik
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {checkin.highlights}
                </p>
              </div>
            ) : null}
            {checkin.challenges ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Tantangan
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {checkin.challenges}
                </p>
              </div>
            ) : null}
            {checkin.supportNeeded ? (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Dukungan yang Dibutuhkan
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {checkin.supportNeeded}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="review-note">Catatan tanggapan (opsional)</Label>
              <Textarea
                id="review-note"
                rows={3}
                placeholder="Tulis tanggapan atau langkah tindak lanjut..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting || checkin.status === "reviewed"}
                maxLength={1000}
              />
            </div>
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
          {checkin?.status === "submitted" ? (
            <Button
              onClick={handleReview}
              disabled={submitting}
              className="gap-1 cursor-pointer"
            >
              <CheckCircle2 className="size-4" />
              {submitting ? "Menyimpan..." : "Tandai Sudah Ditinjau"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
