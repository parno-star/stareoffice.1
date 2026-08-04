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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ConvexError } from "convex/values";
import { currentPeriodKey, monthRange } from "../_lib/payroll-utils.ts";

export default function CreatePeriodDialog() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriodKey());
  const defaults = useMemo(() => monthRange(period), [period]);
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [payDate, setPayDate] = useState(defaults.pay);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createPeriod = useMutation(api.payroll.periods.createPeriod);

  // Re-derive default dates when period changes
  useEffect(() => {
    const r = monthRange(period);
    setStartDate(r.start);
    setEndDate(r.end);
    setPayDate(r.pay);
  }, [period]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await createPeriod({
        period,
        startDate,
        endDate,
        payDate,
        note: note.trim() || undefined,
      });
      toast.success("Periode payroll dibuat");
      setOpen(false);
      setNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat periode");
      } else {
        toast.error("Gagal membuat periode");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="size-4" />
          Periode Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Periode Payroll</DialogTitle>
          <DialogDescription>
            Tentukan bulan periode, tanggal awal & akhir, dan tanggal
            pembayaran gaji.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="period">Bulan (YYYY-MM)</Label>
            <Input
              id="period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="start">Tanggal awal</Label>
              <DateField
                id="start"
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Tanggal akhir</Label>
              <DateField
                id="end"
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay">Tanggal pembayaran</Label>
            <DateField
              id="pay"
              value={payDate}
              onChange={(v) => setPayDate(v)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              Buat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
