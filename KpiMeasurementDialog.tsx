import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type Props = {
  kpi: Doc<"jobRoleKpis"> | null;
  user: Doc<"users"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function generateDefaultPeriod(
  frequency: string,
): { period: string; periodLabel: string } {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  if (frequency === "yearly") {
    return { period: `${year}`, periodLabel: `${year}` };
  }
  if (frequency === "quarterly") {
    return { period: `${year}-Q${quarter}`, periodLabel: `Q${quarter} ${year}` };
  }
  const monthStr = String(month).padStart(2, "0");
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const monthLabel = monthNames[month - 1] ?? `Bulan ${month}`;
  return {
    period: `${year}-${monthStr}`,
    periodLabel: `${monthLabel} ${year}`,
  };
}

export default function KpiMeasurementDialog({
  kpi,
  user,
  open,
  onOpenChange,
}: Props) {
  const upsert = useMutation(api.orgAdvanced.jobRoles.upsertMeasurement);

  const [period, setPeriod] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [actualValue, setActualValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !kpi) return;
    const defaults = generateDefaultPeriod(kpi.frequency);
    setPeriod(defaults.period);
    setPeriodLabel(defaults.periodLabel);
    setActualValue("");
    setNote("");
  }, [open, kpi]);

  if (!kpi || !user) return null;

  const handleSave = async () => {
    const num = Number(actualValue);
    if (!Number.isFinite(num)) {
      toast.error("Nilai aktual harus berupa angka");
      return;
    }
    if (period.trim().length === 0) {
      toast.error("Periode wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        kpiId: kpi._id as Id<"jobRoleKpis">,
        userId: user._id,
        period: period.trim(),
        periodLabel: periodLabel.trim() || period.trim(),
        actualValue: num,
        note: note || undefined,
      });
      toast.success("KPI dicatat");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error(
          (error.data as { message?: string }).message ?? "Gagal mencatat",
        );
      } else {
        toast.error("Gagal mencatat");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4 text-violet-500" />
            Catat Realisasi KPI
          </DialogTitle>
          <DialogDescription>
            {kpi.name} · target {kpi.target ?? "—"} · untuk {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period">Periode (kode)</Label>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-Q1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-label">Label Periode</Label>
              <Input
                id="period-label"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Q1 2026"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actual">Nilai Aktual</Label>
            <Input
              id="actual"
              type="number"
              inputMode="decimal"
              value={actualValue}
              onChange={(e) => setActualValue(e.target.value)}
              placeholder="Contoh: 92"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Catatan</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kendala, konteks, atau rencana tindakan..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Realisasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
