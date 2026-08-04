import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Gauge, Settings2, Infinity as InfinityIcon } from "lucide-react";

type QuotaData = {
  limitMinutes: number | null;
  usedMinutes: number;
  remainingMinutes: number | null;
  month: string;
  isExhausted: boolean;
  canManage: boolean;
  hasOrg: boolean;
};

/**
 * Shows the organization's monthly call-minute usage and, for admins, lets them
 * set or clear the monthly limit.
 */
export default function QuotaCard({ quota }: { quota: QuotaData }) {
  const isUnlimited = quota.limitMinutes === null;
  const pct =
    quota.limitMinutes && quota.limitMinutes > 0
      ? Math.min(100, Math.round((quota.usedMinutes / quota.limitMinutes) * 100))
      : 0;

  const barColor = quota.isExhausted
    ? "bg-destructive"
    : pct >= 80
      ? "bg-amber-500"
      : "bg-primary";

  return (
    <Card className={quota.isExhausted ? "border-destructive/50" : undefined}>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Gauge className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Kuota Panggilan Bulan Ini</p>
            {isUnlimited ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <InfinityIcon className="size-3.5" />
                Tanpa batas · {quota.usedMinutes} menit terpakai
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {quota.usedMinutes} dari {quota.limitMinutes} menit terpakai
                {quota.remainingMinutes !== null
                  ? ` · sisa ${quota.remainingMinutes} menit`
                  : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:w-64">
          {!isUnlimited ? (
            <div className="flex-1">
              <Progress
                value={pct}
                className="h-2"
                indicatorClassName={barColor}
              />
            </div>
          ) : null}
          {quota.canManage ? <QuotaEditor quota={quota} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function QuotaEditor({ quota }: { quota: QuotaData }) {
  const setQuotaLimit = useMutation(api.calls.setQuotaLimit);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    quota.limitMinutes === null ? "" : String(quota.limitMinutes),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    let limit: number | null;
    if (trimmed === "" || trimmed === "0") {
      limit = null;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Masukkan angka menit yang valid");
        return;
      }
      limit = Math.floor(parsed);
    }
    setSaving(true);
    try {
      await setQuotaLimit({ limitMinutes: limit });
      toast.success("Kuota panggilan diperbarui");
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui kuota");
      } else {
        toast.error("Gagal memperbarui kuota");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(quota.limitMinutes === null ? "" : String(quota.limitMinutes));
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" title="Atur kuota">
          <Settings2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atur Kuota Panggilan</DialogTitle>
          <DialogDescription>
            Tetapkan batas total menit panggilan audio/video untuk seluruh
            organisasi per bulan. Kosongkan atau isi 0 untuk tanpa batas. Kuota
            otomatis reset setiap awal bulan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="quota-minutes">Batas menit per bulan</Label>
          <Input
            id="quota-minutes"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Misal: 1000 (kosong = tanpa batas)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Sudah terpakai bulan ini: {quota.usedMinutes} menit.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
