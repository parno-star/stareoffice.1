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
import { Label } from "@/components/ui/label.tsx";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function ReviewActions({
  requestId,
}: {
  requestId: Id<"leaveRequests">;
}) {
  const review = useMutation(api.leaveRequests.review);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openDialog = (value: "approved" | "rejected") => {
    setDecision(value);
    setNote("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      await review({
        id: requestId,
        decision,
        note: note.trim() ? note.trim() : undefined,
      });
      toast.success(
        decision === "approved"
          ? "Pengajuan disetujui"
          : "Pengajuan ditolak",
      );
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memproses pengajuan");
      } else {
        toast.error("Gagal memproses pengajuan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-destructive hover:text-destructive"
          onClick={() => openDialog("rejected")}
        >
          <X className="size-4" />
          Tolak
        </Button>
        <Button
          size="sm"
          className="gap-1"
          onClick={() => openDialog("approved")}
        >
          <Check className="size-4" />
          Setujui
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "approved"
                ? "Setujui pengajuan cuti"
                : "Tolak pengajuan cuti"}
            </DialogTitle>
            <DialogDescription>
              {decision === "approved"
                ? "Anda akan menyetujui pengajuan cuti ini. Tambahkan catatan jika perlu."
                : "Berikan alasan penolakan agar karyawan mengetahui keputusan Anda."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="review-note">
              Catatan {decision === "rejected" ? "(disarankan)" : "(opsional)"}
            </Label>
            <Textarea
              id="review-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                decision === "approved"
                  ? "Selamat berlibur!"
                  : "Jelaskan alasan penolakan..."
              }
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              variant={decision === "approved" ? "default" : "destructive"}
            >
              {submitting
                ? "Memproses..."
                : decision === "approved"
                  ? "Setujui"
                  : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
