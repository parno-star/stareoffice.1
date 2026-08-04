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
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { LogOut } from "lucide-react";

type Props = {
  trigger?: ReactNode;
};

export default function ResignationFormDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [exitType, setExitType] = useState("resignation");
  const [reasonCategory, setReasonCategory] = useState("voluntary");
  const [reason, setReason] = useState("");
  const [futureEmployer, setFutureEmployer] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [noticeDate, setNoticeDate] = useState(today);
  const defaultLast = new Date();
  defaultLast.setDate(defaultLast.getDate() + 30);
  const [lastWorkingDay, setLastWorkingDay] = useState(
    defaultLast.toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);

  const submit = useMutation(api.offboarding.submitResignation);

  const reset = () => {
    setExitType("resignation");
    setReasonCategory("voluntary");
    setReason("");
    setFutureEmployer("");
    setNoticeDate(today);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setLastWorkingDay(d.toISOString().slice(0, 10));
  };

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Alasan minimal 5 karakter");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        exitType,
        reasonCategory,
        reason: reason.trim(),
        futureEmployer: futureEmployer.trim() || undefined,
        noticeDate,
        lastWorkingDay,
      });
      toast.success("Pengajuan dikirim ke HR untuk review");
      reset();
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengajukan");
      } else {
        toast.error("Gagal mengajukan");
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
        {trigger ?? (
          <Button variant="secondary" className="gap-2 cursor-pointer">
            <LogOut className="size-4" />
            Ajukan Resign
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajukan Pengunduran Diri</DialogTitle>
          <DialogDescription>
            HR akan mereview pengajuan Anda. Setelah disetujui, checklist
            offboarding otomatis dibuat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Jenis Exit</Label>
              <Select
                value={exitType}
                onValueChange={setExitType}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">Resign</SelectItem>
                  <SelectItem value="retirement">Pensiun</SelectItem>
                  <SelectItem value="contract_end">
                    Kontrak Berakhir
                  </SelectItem>
                  <SelectItem value="mutual">Kesepakatan Bersama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kategori Alasan</Label>
              <Select
                value={reasonCategory}
                onValueChange={setReasonCategory}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voluntary">Sukarela</SelectItem>
                  <SelectItem value="retirement">Pensiun</SelectItem>
                  <SelectItem value="contract_end">Akhir Kontrak</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-date">Tanggal Pengajuan</Label>
              <DateField
                id="notice-date"
                value={noticeDate}
                onChange={(v) => setNoticeDate(v)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-day">Hari Terakhir Bekerja</Label>
              <DateField
                id="last-day"
                value={lastWorkingDay}
                onChange={(v) => setLastWorkingDay(v)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Alasan</Label>
            <Textarea
              id="reason"
              rows={4}
              placeholder="Jelaskan alasan pengajuan Anda..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="future">Rencana Selanjutnya (opsional)</Label>
            <Input
              id="future"
              placeholder="Perusahaan baru, studi lanjut, dll."
              value={futureEmployer}
              onChange={(e) => setFutureEmployer(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || reason.trim().length < 5}
            className="cursor-pointer"
          >
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
