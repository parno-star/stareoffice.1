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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Banknote } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatCurrency } from "../_lib/fund-utils.ts";

const PAYMENT_METHODS = [
  { value: "transfer", label: "Transfer Bank" },
  { value: "cash", label: "Tunai" },
  { value: "check", label: "Cek / Giro" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  fundRequestId: Id<"fundRequests">;
  title: string;
  amount: number;
};

export default function DisburseDialog({ open, onClose, fundRequestId, title, amount }: Props) {
  const disburse = useMutation(api.fundRequests.disburse);
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await disburse({
        id: fundRequestId,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        disbursementNote: note || undefined,
      });
      toast.success("Dana berhasil dicairkan");
      onClose();
      setPaymentMethod("transfer");
      setPaymentReference("");
      setNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mencairkan dana");
      } else {
        toast.error("Gagal mencairkan dana");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-teal-500" />
            Cairkan Dana
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(amount)}</p>
          </div>

          <div className="space-y-2">
            <Label>Metode Pembayaran</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ref">No. Referensi / Bukti (opsional)</Label>
            <Input
              id="ref"
              placeholder="Mis. TRF-2026-00123"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Catatan Pencairan (opsional)</Label>
            <Textarea
              placeholder="Catatan tambahan…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Banknote className="size-4" />
            )}
            Cairkan Dana
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
