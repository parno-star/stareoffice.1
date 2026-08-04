import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
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
  requestId: Id<"resignationRequests"> | null;
  decision: "approve" | "reject";
};

export default function ResignationReviewDialog({
  open,
  onOpenChange,
  requestId,
  decision,
}: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const review = useMutation(api.offboarding.reviewResignation);

  const handleSubmit = async () => {
    if (!requestId) return;
    setSubmitting(true);
    try {
      await review({
        id: requestId,
        decision,
        note: note.trim() || undefined,
      });
      toast.success(
        decision === "approve"
          ? "Pengajuan disetujui. Case offboarding dibuat."
          : "Pengajuan ditolak.",
      );
      setNote("");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal memproses");
      } else {
        toast.error("Gagal memproses");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          if (!v) setNote("");
          onOpenChange(v);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {decision === "approve"
              ? "Setujui Pengajuan Resign?"
              : "Tolak Pengajuan Resign?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {decision === "approve"
              ? "Setelah disetujui, checklist offboarding otomatis dibuat dan karyawan akan diminta mengisi exit interview."
              : "Pengajuan akan ditolak. Karyawan dapat mengajukan kembali jika diperlukan."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="review-note">Catatan (opsional)</Label>
          <Textarea
            id="review-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tambahkan catatan untuk karyawan..."
            disabled={submitting}
            maxLength={500}
          />
        </div>

        <AlertDialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className={
              decision === "approve"
                ? "cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                : "cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }
          >
            {submitting
              ? "Memproses..."
              : decision === "approve"
                ? "Setujui"
                : "Tolak"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
