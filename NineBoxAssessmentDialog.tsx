import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { getInitials } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";
import { BOX_LABELS, BOX_TONES } from "./nine-box-utils.ts";

type Props = {
  employee: Doc<"users"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
};

export default function NineBoxAssessmentDialog({
  employee,
  open,
  onOpenChange,
  isAdmin,
}: Props) {
  const assessments = useQuery(
    api.orgAdvanced.nineBox.getForUser,
    employee ? { userId: employee._id } : "skip",
  );
  const upsert = useMutation(api.orgAdvanced.nineBox.upsertAssessment);
  const remove = useMutation(api.orgAdvanced.nineBox.deleteAssessment);

  const [performance, setPerformance] = useState<number>(2);
  const [potential, setPotential] = useState<number>(2);
  const [periodLabel, setPeriodLabel] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const latest = (assessments ?? [])[0];
    if (latest) {
      setPerformance(latest.performance);
      setPotential(latest.potential);
      setPeriodLabel(latest.periodLabel ?? "");
      setNotes(latest.notes ?? "");
    } else {
      setPerformance(2);
      setPotential(2);
      setPeriodLabel(`${new Date().getFullYear()}`);
      setNotes("");
    }
  }, [open, assessments]);

  if (!employee) return null;

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const period = periodLabel
        ? periodLabel.toLowerCase().replace(/\s+/g, "-")
        : undefined;
      await upsert({
        userId: employee._id,
        performance,
        potential,
        period,
        periodLabel: periodLabel || undefined,
        notes: notes || undefined,
      });
      toast.success("Penilaian tersimpan");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error(
          (error.data as { message?: string }).message ?? "Gagal menyimpan",
        );
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const cellKey = `${performance}-${potential}`;
  const cellLabel = BOX_LABELS[cellKey] ?? "—";
  const cellTone = BOX_TONES[cellKey] ?? "bg-muted text-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Penilaian 9-Box</DialogTitle>
          <DialogDescription>
            Nilai performa dan potensi karyawan pada skala 1-3 untuk menempatkan
            mereka di matriks talenta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <Avatar>
            <AvatarImage src={employee.avatarUrl} />
            <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{employee.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {employee.jobTitle ?? "—"}
              {employee.department ? ` · ${employee.department}` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Performa (1 = rendah, 3 = tinggi)</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setPerformance(v)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm font-semibold transition cursor-pointer",
                    performance === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                    !isAdmin && "cursor-not-allowed opacity-60",
                  )}
                >
                  {v === 1 ? "Rendah" : v === 2 ? "Menengah" : "Tinggi"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Potensi (1 = rendah, 3 = tinggi)</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setPotential(v)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm font-semibold transition cursor-pointer",
                    potential === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted",
                    !isAdmin && "cursor-not-allowed opacity-60",
                  )}
                >
                  {v === 1 ? "Rendah" : v === 2 ? "Menengah" : "Tinggi"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            cellTone,
          )}
        >
          <p className="text-xs uppercase opacity-80">Kategori</p>
          <p className="text-base font-semibold">{cellLabel}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nine-period">Periode (opsional)</Label>
          <Input
            id="nine-period"
            placeholder="2026-H1"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nine-notes">Catatan (opsional)</Label>
          <Textarea
            id="nine-notes"
            rows={3}
            placeholder="Strengths, rencana pengembangan, dll."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        {(assessments ?? []).length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Riwayat Penilaian
            </p>
            {(assessments ?? []).map((a) => (
              <div
                key={a._id}
                className="flex items-center justify-between gap-2 rounded-md border bg-card p-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.periodLabel ?? "Tanpa periode"} ·{" "}
                    {BOX_LABELS[`${a.performance}-${a.potential}`] ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(a.assessedAt).toLocaleString("id-ID")}
                  </p>
                </div>
                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await remove({ assessmentId: a._id });
                        toast.success("Penilaian dihapus");
                      } catch {
                        toast.error("Gagal menghapus");
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          {isAdmin ? (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Penilaian"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
