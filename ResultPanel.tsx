import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Pencil,
  Train,
  Gauge,
  Weight,
  Zap,
  Wrench,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { CalculatorResult } from "../_lib/calculator-engine.ts";
import type { GaugeType } from "../_lib/track-standards.ts";

type Props = {
  result: CalculatorResult;
  segmentName: string;
  staStart: string;
  staEnd: string;
  gauge: GaugeType;
  onReset: () => void;
  onRecalculate: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
};

const STATUS_CONFIG = {
  aman: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/30",
  },
  mendekati_batas: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  overload: {
    icon: XCircle,
    bg: "bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-500/30",
  },
};

export default function ResultPanel({
  result,
  segmentName,
  staStart,
  staEnd,
  gauge,
  onReset,
  onRecalculate,
  onSave,
  isSaving,
  isSaved,
}: Props) {
  const sc = STATUS_CONFIG[result.overallStatus];
  const StatusIcon = sc.icon;

  return (
    <div className="space-y-4">
      {/* Main result card */}
      <Card className={cn("border-2", sc.border)}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div className={cn("flex size-16 items-center justify-center rounded-2xl", sc.bg)}>
              <StatusIcon className={cn("size-8", sc.text)} />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm text-muted-foreground">{segmentName}</p>
              <p className="text-xs text-muted-foreground">
                STA {staStart} - {staEnd} | Lebar sepur {gauge} mm
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <h2 className="text-3xl font-bold">{result.trackClass.classLabel}</h2>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    sc.bg,
                    sc.text
                  )}
                >
                  {result.statusLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ditentukan oleh: {result.trackClass.determinedBy}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Beban gandar */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Weight className="size-4 text-blue-600" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Beban Gandar</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{result.axleLoad.axleLoad} ton</p>
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                result.axleLoad.isOverload ? "text-red-600" : "text-emerald-600"
              )}
            >
              {result.axleLoad.isOverload ? "Melebihi batas" : "Dalam batas"} (maks{" "}
              {result.axleLoad.maxAllowed} ton)
            </p>
          </CardContent>
        </Card>

        {/* MGT */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10">
                <Train className="size-4 text-violet-600" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Tonase Tahunan</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{result.mgt.mgt.toFixed(1)} MGT</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(result.mgt.annualTonnage / 1_000_000).toFixed(1)} juta ton/tahun
            </p>
            <p className="text-[10px] text-muted-foreground">
              TE={result.mgt.te.toFixed(0)} | Kb={result.mgt.kb} | K1={result.mgt.k1}
            </p>
          </CardContent>
        </Card>

        {/* TQI */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
                <Gauge className="size-4 text-amber-600" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Track Quality Index</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{result.tqi.tqi}</p>
            <p
              className={cn(
                "mt-1 text-xs font-semibold",
                result.tqi.color === "emerald" && "text-emerald-600",
                result.tqi.color === "blue" && "text-blue-600",
                result.tqi.color === "amber" && "text-amber-600",
                result.tqi.color === "red" && "text-red-600"
              )}
            >
              {result.tqi.categoryLabel}
            </p>
            <p className="text-[10px] text-muted-foreground">
              V maks berdasarkan TQI: {result.tqi.maxSpeedAllowed} km/jam
            </p>
          </CardContent>
        </Card>

        {/* Kecepatan */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="size-4 text-primary" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Validasi Kecepatan</p>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {result.speedValidation.effectiveMax} km/jam
            </p>
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                result.speedValidation.isExceeded ? "text-red-600" : "text-emerald-600"
              )}
            >
              {result.speedValidation.isExceeded
                ? `Rencana ${result.speedValidation.designSpeed} km/jam melebihi batas`
                : `Rencana ${result.speedValidation.designSpeed} km/jam aman`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Kelas: {result.speedValidation.maxByClass} km/jam | TQI:{" "}
              {result.speedValidation.maxByTqi} km/jam
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Temuan ({result.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.issues.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-lg p-3 text-sm",
                    issue.severity === "error"
                      ? "bg-red-500/10 text-red-700 dark:text-red-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  )}
                >
                  {issue.severity === "error" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">{issue.parameter}</p>
                    <p className="text-xs opacity-80">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" />
            Rekomendasi Teknis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {onSave && (
          <Button
            className="cursor-pointer gap-1.5"
            onClick={onSave}
            disabled={isSaving || isSaved}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? "Menyimpan..." : isSaved ? "Tersimpan" : "Simpan Hasil"}
          </Button>
        )}
        <Button variant="secondary" className="cursor-pointer gap-1.5" onClick={onRecalculate}>
          <Pencil className="size-4" />
          Edit Data & Hitung Ulang
        </Button>
        <Button variant="secondary" className="cursor-pointer gap-1.5" onClick={onReset}>
          <RotateCcw className="size-4" />
          Reset Semua
        </Button>
      </div>
    </div>
  );
}
