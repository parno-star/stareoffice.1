import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  FACTORS,
  type FactorKey,
  predictGradeFromLevels,
  bandColorForGrade,
  SIZE_BAND_CONFIG,
} from "../_lib/grading-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { AlertCircle, Gauge } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationId: Id<"ggsEvaluations">;
};

export default function ScoreFormDialog({
  open,
  onOpenChange,
  evaluationId,
}: Props) {
  const data = useQuery(api.grading.getEvaluation, open ? { evaluationId } : "skip");
  const submit = useMutation(api.grading.submitMyScores);

  const [levels, setLevels] = useState<Record<FactorKey, number | undefined>>({
    functional_knowledge: undefined,
    business_expertise: undefined,
    leadership: undefined,
    problem_solving: undefined,
    nature_of_impact: undefined,
    area_of_impact: undefined,
    interpersonal_skills: undefined,
  });
  const [justifs, setJustifs] = useState<Record<FactorKey, string>>({
    functional_knowledge: "",
    business_expertise: "",
    leadership: "",
    problem_solving: "",
    nature_of_impact: "",
    area_of_impact: "",
    interpersonal_skills: "",
  });
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Hydrate from existing scores when dialog opens
  useEffect(() => {
    if (!data) return;
    const lv: Record<FactorKey, number | undefined> = {
      functional_knowledge: undefined,
      business_expertise: undefined,
      leadership: undefined,
      problem_solving: undefined,
      nature_of_impact: undefined,
      area_of_impact: undefined,
      interpersonal_skills: undefined,
    };
    const ju: Record<FactorKey, string> = {
      functional_knowledge: "",
      business_expertise: "",
      leadership: "",
      problem_solving: "",
      nature_of_impact: "",
      area_of_impact: "",
      interpersonal_skills: "",
    };
    for (const s of data.myScores) {
      const k = s.factor as FactorKey;
      lv[k] = s.level;
      ju[k] = s.justification ?? "";
    }
    setLevels(lv);
    setJustifs(ju);
    const myEvaluator = data.evaluators.find(
      (e) => e.userId === data.currentUserId,
    );
    setOverallNote(myEvaluator?.overallNote ?? "");
  }, [data]);

  const preview = useMemo(() => {
    return predictGradeFromLevels(levels, "C");
  }, [levels]);

  const allRated = FACTORS.every((f) => levels[f.key] !== undefined);

  const handleSubmit = async () => {
    if (!allRated) {
      toast.error("Semua 7 faktor wajib dinilai");
      return;
    }
    setSaving(true);
    try {
      await submit({
        evaluationId,
        scores: FACTORS.map((f) => ({
          factor: f.key,
          level: levels[f.key]!,
          justification: justifs[f.key] || undefined,
        })),
        overallNote: overallNote.trim() || undefined,
      });
      toast.success("Penilaian berhasil disimpan");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Penilaian Jabatan (WTW GGS)</DialogTitle>
          <DialogDescription>
            {data?.position?.title
              ? `Nilai jabatan "${data.position.title}" pada 7 faktor GGS. Setiap faktor: level 1–7.`
              : "Nilai 7 faktor menggunakan skala 1–7."}
          </DialogDescription>
        </DialogHeader>

        {data === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-4 p-3">
                <Gauge className="size-6 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Estimasi hasil penilaian Anda
                  </p>
                  {preview ? (
                    <p className="text-sm">
                      Skor{" "}
                      <span className="font-bold">{preview.score.toFixed(1)}</span>
                      /100 · Grade estimasi:{" "}
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-md text-xs font-bold",
                          bandColorForGrade(preview.grade),
                        )}
                      >
                        {preview.grade}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        ({preview.bandLabel})
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Lengkapi semua 7 faktor untuk melihat estimasi grade.
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Grade final dihitung setelah semua anggota komite submit
                    &amp; disetujui admin, menggunakan Size Band{" "}
                    {SIZE_BAND_CONFIG.C.label}.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {FACTORS.map((factor) => (
                <div key={factor.key} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{factor.label}</p>
                        <Badge variant="outline" className="text-[10px]">
                          Bobot {(factor.weight * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {factor.description}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {factor.levels.map((lvl) => {
                      const selected = levels[factor.key] === lvl.level;
                      return (
                        <button
                          key={lvl.level}
                          type="button"
                          onClick={() =>
                            setLevels((p) => ({ ...p, [factor.key]: lvl.level }))
                          }
                          className={cn(
                            "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-center transition-all",
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/40",
                          )}
                        >
                          <span className="text-lg font-bold">{lvl.level}</span>
                          <span className="text-[10px] font-medium leading-tight">
                            {lvl.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {levels[factor.key] ? (
                    <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs">
                      <p className="font-medium">
                        Level {levels[factor.key]} —{" "}
                        {
                          factor.levels.find(
                            (l) => l.level === levels[factor.key],
                          )?.title
                        }
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {
                          factor.levels.find(
                            (l) => l.level === levels[factor.key],
                          )?.description
                        }
                      </p>
                    </div>
                  ) : null}
                  <Textarea
                    className="mt-2"
                    rows={2}
                    placeholder="Justifikasi (opsional): mengapa level ini?"
                    value={justifs[factor.key]}
                    onChange={(e) =>
                      setJustifs((p) => ({ ...p, [factor.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Catatan Keseluruhan</Label>
                <Textarea
                  rows={2}
                  placeholder="Kesimpulan atau catatan umum Anda..."
                  value={overallNote}
                  onChange={(e) => setOverallNote(e.target.value)}
                />
              </div>
              {!allRated ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertCircle className="size-4" />
                  Semua 7 faktor harus dinilai sebelum dapat disubmit.
                </div>
              ) : null}
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !allRated}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Submit Penilaian"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
