import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatCurrency } from "../_lib/travel-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: Id<"travelRequests">;
  title: string;
  estimatedCost: number;
  currency: string;
};

export default function TravelReportDialog({
  open,
  onOpenChange,
  requestId,
  title,
  estimatedCost,
  currency,
}: Props) {
  const [actualCost, setActualCost] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitReport = useMutation(api.travel.submitReport);

  useEffect(() => {
    if (open) {
      setActualCost(String(estimatedCost));
      setSummary("");
    }
  }, [open, estimatedCost]);

  const handleClose = (v: boolean) => {
    if (!submitting) onOpenChange(v);
  };

  const submit = async () => {
    const num = Number(actualCost.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Biaya aktual tidak valid");
      return;
    }
    if (summary.trim().length === 0) {
      toast.error("Ringkasan laporan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({
        id: requestId,
        actualCost: num,
        reportSummary: summary.trim(),
      });
      toast.success("Laporan perjalanan berhasil dikirim");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim laporan");
      } else {
        toast.error("Gagal mengirim laporan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Laporan Perjalanan</DialogTitle>
          <DialogDescription>
            Kirim laporan untuk perjalanan &quot;{title}&quot;. Laporan akan
            diarsipkan dan status berubah menjadi selesai.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="text-muted-foreground">Estimasi awal</p>
            <p className="text-sm font-semibold">
              {formatCurrency(estimatedCost, currency)}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual-cost">Biaya Aktual (IDR)</Label>
            <Input
              id="actual-cost"
              type="number"
              min="0"
              step="50000"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Ringkasan Laporan</Label>
            <Textarea
              id="summary"
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Hasil perjalanan, pertemuan dengan klien, outcome, next steps..."
              disabled={submitting}
              maxLength={2000}
            />
          </div>
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
            className="cursor-pointer"
          >
            {submitting ? "Mengirim..." : "Kirim Laporan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
