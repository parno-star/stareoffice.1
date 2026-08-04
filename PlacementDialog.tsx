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
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  BOX_META,
  GRID_LAYOUT,
  PERFORMANCE_LEVELS,
  POTENTIAL_LEVELS,
  boxCodeFor,
} from "../_lib/talent-utils.ts";
import { cn } from "@/lib/utils.ts";
import { Spinner } from "@/components/ui/spinner.tsx";

type Props = {
  placementId: Id<"talentPlacements"> | null;
  placement: Doc<"talentPlacements"> | null;
  mode: "manager" | "calibrate" | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function PlacementDialog({
  placementId,
  placement,
  mode,
  open,
  onOpenChange,
}: Props) {
  const [performance, setPerformance] = useState<number>(2);
  const [potential, setPotential] = useState<number>(2);
  const [managerNotes, setManagerNotes] = useState("");
  const [committeeNotes, setCommitteeNotes] = useState("");
  const [strengths, setStrengths] = useState("");
  const [developmentAreas, setDevelopmentAreas] = useState("");
  const [saving, setSaving] = useState(false);

  const draftMut = useMutation(api.talent.draftPlacement);
  const calibrateMut = useMutation(api.talent.calibratePlacement);

  useEffect(() => {
    if (placement) {
      setPerformance(placement.performance ?? 2);
      setPotential(placement.potential ?? 2);
      setManagerNotes(placement.managerNotes ?? "");
      setCommitteeNotes(placement.committeeNotes ?? "");
      setStrengths(placement.strengths ?? "");
      setDevelopmentAreas(placement.developmentAreas ?? "");
    }
  }, [placement]);

  if (!placement || !placementId || !mode) return null;

  const previewCode = boxCodeFor(performance, potential);
  const preview = BOX_META[previewCode];

  async function handleSave(submit: boolean) {
    if (!placementId || !mode) return;
    setSaving(true);
    try {
      if (mode === "manager") {
        await draftMut({
          placementId,
          performance,
          potential,
          managerNotes: managerNotes || undefined,
          strengths: strengths || undefined,
          developmentAreas: developmentAreas || undefined,
          submit,
        });
        toast.success(submit ? "Placement dikirim ke komite" : "Draft disimpan");
      } else {
        await calibrateMut({
          placementId,
          performance,
          potential,
          committeeNotes: committeeNotes || undefined,
        });
        toast.success("Kalibrasi disimpan");
      }
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string })?.message ?? "Gagal menyimpan"
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "manager" ? "Nilai Karyawan" : "Kalibrasi"} —{" "}
            {placement.userName}
          </DialogTitle>
          <DialogDescription>
            {mode === "manager"
              ? "Isi skor performa, potensi, serta justifikasi. Draft bisa disimpan dan dikirim kemudian."
              : "Komite dapat menyesuaikan skor sebelum finalisasi."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Performa</Label>
            <div className="grid grid-cols-3 gap-2">
              {PERFORMANCE_LEVELS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPerformance(p.value)}
                  className={cn(
                    "rounded-lg border-2 p-3 text-left transition cursor-pointer",
                    performance === p.value
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/60",
                  )}
                >
                  <div className="text-xs font-semibold">{p.label}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Potensi</Label>
            <div className="grid grid-cols-3 gap-2">
              {POTENTIAL_LEVELS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPotential(p.value)}
                  className={cn(
                    "rounded-lg border-2 p-3 text-left transition cursor-pointer",
                    potential === p.value
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/60",
                  )}
                >
                  <div className="text-xs font-semibold">{p.label}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview grid */}
          <div className="sm:col-span-2 rounded-lg border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                Preview Posisi
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  preview.chip,
                )}
              >
                {preview.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {GRID_LAYOUT.map((row) =>
                row.map((code) => {
                  const meta = BOX_META[code];
                  const active = code === previewCode;
                  return (
                    <div
                      key={code}
                      className={cn(
                        "rounded p-2 text-center text-[10px] font-medium",
                        meta.bg,
                        active
                          ? "ring-2 ring-primary"
                          : "opacity-60 hover:opacity-100",
                        meta.text,
                      )}
                    >
                      {meta.shortLabel}
                    </div>
                  );
                }),
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {preview.description} · Tindakan: {preview.action}
            </p>
          </div>

          {mode === "manager" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="strengths">Kekuatan</Label>
                <Textarea
                  id="strengths"
                  rows={3}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="Hal yang menjadi kekuatan karyawan..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dev-areas">Area Pengembangan</Label>
                <Textarea
                  id="dev-areas"
                  rows={3}
                  value={developmentAreas}
                  onChange={(e) => setDevelopmentAreas(e.target.value)}
                  placeholder="Hal yang perlu dikembangkan..."
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="manager-notes">Catatan Manajer</Label>
                <Textarea
                  id="manager-notes"
                  rows={2}
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Alasan penempatan di kotak ini..."
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="committee-notes">Catatan Komite Kalibrasi</Label>
              <Textarea
                id="committee-notes"
                rows={3}
                value={committeeNotes}
                onChange={(e) => setCommitteeNotes(e.target.value)}
                placeholder="Kesepakatan komite atas posisi final karyawan..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          {mode === "manager" ? (
            <>
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                {saving ? <Spinner /> : null}
                Simpan Draft
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving ? <Spinner /> : null}
                Kirim ke Komite
              </Button>
            </>
          ) : (
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? <Spinner /> : null}
              Simpan Kalibrasi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
