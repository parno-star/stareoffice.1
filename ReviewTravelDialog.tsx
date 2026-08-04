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
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: Id<"travelRequests">;
  mode: "approve" | "reject";
  title: string;
};

export default function ReviewTravelDialog({
  open,
  onOpenChange,
  requestId,
  mode,
  title,
}: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const review = useMutation(api.travel.review);

  const handleClose = (v: boolean) => {
    if (!submitting) {
      onOpenChange(v);
      if (!v) setNote("");
    }
  };

  const submit = async () => {
    if (mode === "reject" && note.trim().length === 0) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await review({
        id: requestId,
        decision: mode === "approve" ? "approved" : "rejected",
        note: note.trim() || undefined,
      });
      toast.success(
        mode === "approve" ? "Pengajuan disetujui" : "Pengajuan ditolak",
      );
      setNote("");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memproses");
      } else {
        toast.error("Gagal memproses");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "approve" ? "Setujui Perjalanan" : "Tolak Perjalanan"}
          </DialogTitle>
          <DialogDescription>
            {mode === "approve"
              ? `Setujui pengajuan perjalanan "${title}".`
              : `Berikan alasan penolakan untuk "${title}".`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="review-note">
            {mode === "approve" ? "Catatan (opsional)" : "Alasan penolakan"}
          </Label>
          <Textarea
            id="review-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              mode === "approve"
                ? "Selamat bertugas, mohon laporan setelah kembali."
                : "Misal: budget melebihi anggaran kuartal, geser tanggal, dsb."
            }
            disabled={submitting}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            variant={mode === "approve" ? "default" : "destructive"}
            className="cursor-pointer"
          >
            {submitting
              ? "Mengirim..."
              : mode === "approve"
                ? "Setujui"
                : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
