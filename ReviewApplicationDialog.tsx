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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  APPLICATION_STATUS_CONFIG,
  type ApplicationStatus,
} from "../_lib/job-utils.ts";

type Props = {
  applicationId: Id<"jobApplications">;
  applicantName: string | null;
  currentStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const REVIEW_STATUSES: Array<ApplicationStatus> = [
  "reviewing",
  "interview",
  "accepted",
  "rejected",
];

export default function ReviewApplicationDialog({
  applicationId,
  applicantName,
  currentStatus,
  open,
  onOpenChange,
}: Props) {
  const [status, setStatus] = useState<ApplicationStatus>("reviewing");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const review = useMutation(api.jobs.review);

  useEffect(() => {
    if (!open) return;
    const initial: ApplicationStatus = REVIEW_STATUSES.includes(
      currentStatus as ApplicationStatus,
    )
      ? (currentStatus as ApplicationStatus)
      : "reviewing";
    setStatus(initial);
    setNote("");
  }, [open, currentStatus]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await review({
        id: applicationId,
        status,
        note: note.trim() || undefined,
      });
      toast.success("Status lamaran diperbarui");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui lamaran");
      } else {
        toast.error("Gagal memperbarui lamaran");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Perbarui Status Lamaran</DialogTitle>
          <DialogDescription>
            Tinjau lamaran dari {applicantName ?? "pelamar"} dan pilih status
            berikutnya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ApplicationStatus)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {APPLICATION_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {APPLICATION_STATUS_CONFIG[status].description}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-note">Catatan (opsional)</Label>
            <Textarea
              id="review-note"
              rows={3}
              placeholder="Pesan singkat untuk pelamar..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              maxLength={400}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
