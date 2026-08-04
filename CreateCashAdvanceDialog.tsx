import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { ConvexError } from "convex/values";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function inOneWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CreateCashAdvanceDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState("");
  const [neededBy, setNeededBy] = useState(inOneWeek());
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.cashAdvances.create);

  const reset = () => {
    setTitle("");
    setPurpose("");
    setAmount("");
    setNeededBy(inOneWeek());
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    const t = title.trim();
    const p = purpose.trim();
    const a = Number(amount.replace(/[^0-9.]/g, ""));
    if (t.length === 0) {
      toast.error("Judul wajib diisi");
      return;
    }
    if (p.length === 0) {
      toast.error("Tujuan penggunaan wajib diisi");
      return;
    }
    if (!Number.isFinite(a) || a <= 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    setSubmitting(true);
    try {
      await create({
        title: t,
        purpose: p,
        amount: a,
        neededBy,
      });
      toast.success("Pengajuan uang muka berhasil dikirim");
      reset();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim pengajuan");
      } else {
        toast.error("Gagal mengirim pengajuan");
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
          setOpen(v);
          if (!v) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2 cursor-pointer">
          <Wallet className="size-4" />
          Ajukan Uang Muka
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pengajuan Uang Muka</DialogTitle>
          <DialogDescription>
            Ajukan uang muka untuk keperluan dinas. Setelah dicairkan, Anda
            dapat menyelesaikannya dengan melampirkan bukti pengeluaran.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ca-title">Judul</Label>
            <Input
              id="ca-title"
              placeholder="Uang muka perjalanan dinas Surabaya"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-purpose">Tujuan / Rencana Penggunaan</Label>
            <Textarea
              id="ca-purpose"
              rows={3}
              placeholder="Jelaskan tujuan penggunaan uang muka..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={submitting}
              maxLength={600}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ca-amount">Nominal (IDR)</Label>
              <Input
                id="ca-amount"
                type="number"
                min="0"
                step="1000"
                placeholder="2000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-needed">Dibutuhkan Sebelum</Label>
              <DateField
                id="ca-needed"
                value={neededBy}
                onChange={(v) => setNeededBy(v)}
                disabled={submitting}
                min={todayIso()}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
