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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "../_lib/expense-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseIds: Array<Id<"expenseReports">>;
  title?: string;
  onSuccess?: () => void;
};

export default function MarkPaidDialog({
  open,
  onOpenChange,
  expenseIds,
  title,
  onSuccess,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const markPaid = useMutation(api.expenses.markPaid);
  const bulkMarkPaid = useMutation(api.expenses.bulkMarkPaid);

  const isBulk = expenseIds.length > 1;

  const handleSubmit = async () => {
    if (expenseIds.length === 0) return;
    setSubmitting(true);
    try {
      if (isBulk) {
        const { count } = await bulkMarkPaid({
          ids: expenseIds,
          paymentMethod: method,
          paymentReference: reference.trim() || undefined,
        });
        toast.success(`${count} pengajuan ditandai dibayar`);
      } else {
        await markPaid({
          id: expenseIds[0],
          paymentMethod: method,
          paymentReference: reference.trim() || undefined,
        });
        toast.success("Pengajuan ditandai sebagai dibayar");
      }
      setReference("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menandai pembayaran");
      } else {
        toast.error("Gagal menandai pembayaran");
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
          if (!v) setReference("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBulk
              ? `Bayar ${expenseIds.length} Pengajuan`
              : "Tandai Sudah Dibayar"}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? "Pilih metode pembayaran untuk semua pengajuan terpilih."
              : title
                ? `"${title}"`
                : "Konfirmasi pembayaran."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Metode Pembayaran</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-ref">Referensi (opsional)</Label>
            <Input
              id="pay-ref"
              placeholder="Nomor voucher / ID transaksi"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={submitting}
              maxLength={60}
            />
          </div>
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
            className="cursor-pointer"
          >
            {submitting
              ? "Memproses..."
              : isBulk
                ? "Bayar Semua"
                : "Tandai Dibayar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
