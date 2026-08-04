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
  onOpenChange: (open: boolean) => void;
  expenseId: Id<"expenseReports"> | null;
  mode: "approve" | "reject";
  expenseTitle: string;
};

export default function ReviewExpenseDialog({
  open,
  onOpenChange,
  expenseId,
  mode,
  expenseTitle,
}: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const review = useMutation(api.expenses.review);

  const isApprove = mode === "approve";

  const handleSubmit = async () => {
    if (!expenseId) return;
    if (!isApprove && note.trim().length === 0) {
      toast.error("Silakan berikan alasan penolakan");
      return;
    }
    setSubmitting(true);
    try {
      await review({
        id: expenseId,
        status: isApprove ? "approved" : "rejected",
        note: note.trim() || undefined,
      });
      toast.success(
        isApprove ? "Pengajuan disetujui" : "Pengajuan ditolak",
      );
      setNote("");
      onOpenChange(false);
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          onOpenChange(v);
          if (!v) setNote("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Setujui Pengajuan" : "Tolak Pengajuan"}
          </DialogTitle>
          <DialogDescription>
            {expenseTitle
              ? `"${expenseTitle}"`
              : "Konfirmasi tindakan Anda."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="review-note">
            Catatan {isApprove ? "(opsional)" : ""}
          </Label>
          <Textarea
            id="review-note"
            rows={3}
            placeholder={
              isApprove
                ? "Catatan tambahan untuk pemohon..."
                : "Jelaskan alasan penolakan..."
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            maxLength={500}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant={isApprove ? "default" : "destructive"}
            className="cursor-pointer"
          >
            {submitting
              ? "Memproses..."
              : isApprove
                ? "Setujui"
                : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
