import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatCurrency } from "../_lib/fund-utils.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  fundRequestId: Id<"fundRequests">;
  title: string;
  amount: number;
  action: "approve" | "reject" | "revise";
};

export default function ReviewDialog({ open, onClose, fundRequestId, title, amount, action }: Props) {
  const review = useMutation(api.fundRequests.review);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await review({ id: fundRequestId, action, note: note || undefined });
      const messages: Record<string, string> = {
        approve: "Pengajuan disetujui",
        reject: "Pengajuan ditolak",
        revise: "Permintaan revisi dikirim",
      };
      toast.success(messages[action]);
      onClose();
      setNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal memproses");
      } else {
        toast.error("Gagal memproses");
      }
    } finally {
      setLoading(false);
    }
  };

  const config = {
    approve: {
      icon: <CheckCircle2 className="size-5 text-emerald-500" />,
      title: "Setujui Pengajuan",
      noteLabel: "Catatan (opsional)",
      notePlaceholder: "Tambahkan catatan persetujuan…",
      buttonLabel: "Setujui",
      buttonIcon: <CheckCircle2 className="size-4" />,
      variant: "default" as const,
      requireNote: false,
    },
    reject: {
      icon: <XCircle className="size-5 text-red-500" />,
      title: "Tolak Pengajuan",
      noteLabel: "Alasan Penolakan",
      notePlaceholder: "Jelaskan alasan penolakan…",
      buttonLabel: "Tolak",
      buttonIcon: <XCircle className="size-4" />,
      variant: "destructive" as const,
      requireNote: true,
    },
    revise: {
      icon: <RotateCcw className="size-5 text-orange-500" />,
      title: "Minta Revisi",
      noteLabel: "Catatan Revisi",
      notePlaceholder: "Jelaskan apa yang perlu direvisi…",
      buttonLabel: "Minta Revisi",
      buttonIcon: <RotateCcw className="size-4" />,
      variant: "secondary" as const,
      requireNote: true,
    },
  };

  const cfg = config[action];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cfg.icon}
            {cfg.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(amount)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-note">{cfg.noteLabel}</Label>
            <Textarea
              id="review-note"
              placeholder={cfg.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button
            variant={cfg.variant}
            onClick={handleSubmit}
            disabled={loading || (cfg.requireNote && note.trim().length === 0)}
          >
            {loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              cfg.buttonIcon
            )}
            {cfg.buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
