import { useRef } from "react";
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
import { Badge } from "@/components/ui/badge.tsx";
import { FileText, Download, FileBadge } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import {
  FACTORS,
  type FactorKey,
  bandColorForGrade,
  bandLabelForGrade,
  formatIDR,
  SIZE_BAND_CONFIG,
} from "../_lib/grading-utils.ts";
import { cn } from "@/lib/utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type Evaluation = Doc<"ggsEvaluations">;
type Position = Doc<"ggsPositions">;
type SalaryBand = Doc<"ggsSalaryBands">;

const FACTOR_TO_EVAL_KEY: Record<FactorKey, keyof Evaluation> = {
  functional_knowledge: "finalFunctionalKnowledge",
  business_expertise: "finalBusinessExpertise",
  leadership: "finalLeadership",
  problem_solving: "finalProblemSolving",
  nature_of_impact: "finalNatureOfImpact",
  area_of_impact: "finalAreaOfImpact",
  interpersonal_skills: "finalInterpersonalSkills",
};

type Props = {
  position: Position;
  evaluation: Evaluation;
  salaryBand: SalaryBand | null;
};

export default function JobEvaluationReportDialog({
  position,
  evaluation,
  salaryBand,
}: Props) {
  const reportRef = useRef<HTMLDivElement>(null);

  const downloadPDF = () => {
    try {
      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
      });
      const marginX = 40;
      let y = 50;
      const addText = (text: string, opts?: { size?: number; bold?: boolean }) => {
        doc.setFontSize(opts?.size ?? 11);
        doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
        const split = doc.splitTextToSize(text, 515);
        doc.text(split, marginX, y);
        y += 14 * split.length;
      };
      const line = () => {
        doc.setDrawColor(200);
        doc.line(marginX, y, marginX + 515, y);
        y += 10;
      };

      addText("JOB EVALUATION REPORT", { size: 18, bold: true });
      addText("WTW Global Grading System (GGS)", { size: 10 });
      y += 6;
      line();
      addText(`Jabatan: ${position.title}`, { size: 13, bold: true });
      addText(`Departemen: ${position.department}`);
      if (position.jobFamily) addText(`Job Family: ${position.jobFamily}`);
      addText(`Periode Evaluasi: ${evaluation.periodLabel}`);
      addText(
        `Status: ${evaluation.status === "approved" ? "Disetujui" : evaluation.status}`,
      );
      if (evaluation.approvedAt)
        addText(
          `Tanggal Disetujui: ${new Date(evaluation.approvedAt).toLocaleDateString("id-ID")}`,
        );
      y += 6;
      line();
      addText("HASIL AKHIR", { size: 13, bold: true });
      addText(`Global Grade: ${evaluation.finalGrade ?? "—"}`, {
        size: 22,
        bold: true,
      });
      addText(`Career Band: ${evaluation.finalBandLabel ?? "—"}`);
      addText(`Final Score: ${(evaluation.finalScore ?? 0).toFixed(2)}/100`);
      if (evaluation.sizeBandUsed) {
        const cfg = SIZE_BAND_CONFIG[evaluation.sizeBandUsed];
        addText(`Company Size Band: ${cfg?.label ?? evaluation.sizeBandUsed}`);
      }
      if (salaryBand) {
        addText(
          `Salary Band: ${formatIDR(salaryBand.minSalary)} - ${formatIDR(salaryBand.midSalary)} - ${formatIDR(salaryBand.maxSalary)}`,
        );
      }
      y += 6;
      line();
      addText("PENILAIAN PER FAKTOR (rata-rata komite)", { size: 12, bold: true });
      for (const f of FACTORS) {
        const val = evaluation[FACTOR_TO_EVAL_KEY[f.key]] as number | undefined;
        const str =
          val !== undefined ? `${val.toFixed(2)} / 7 (bobot ${(f.weight * 100).toFixed(0)}%)` : "—";
        addText(`${f.label}: ${str}`, { bold: true });
        addText(`  ${f.description}`, { size: 9 });
      }
      if (evaluation.reason) {
        y += 6;
        line();
        addText("Alasan / Justifikasi", { bold: true });
        addText(evaluation.reason);
      }
      y += 6;
      line();
      addText(
        `Laporan otomatis dihasilkan pada ${new Date().toLocaleString("id-ID")}`,
        { size: 8 },
      );
      const fileName = `Job-Evaluation-${position.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;
      doc.save(fileName);
      toast.success("Laporan PDF berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    }
  };

  const grade = evaluation.finalGrade ?? 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="cursor-pointer">
          <FileText className="size-4" />
          Laporan Evaluasi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBadge className="size-5 text-primary" />
            Job Evaluation Report
          </DialogTitle>
          <DialogDescription>
            Hasil evaluasi formal menggunakan metode WTW Global Grading System.
          </DialogDescription>
        </DialogHeader>
        <div ref={reportRef} className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Job Evaluation Report
              </p>
              <h2 className="text-2xl font-bold">{position.title}</h2>
              <p className="text-sm text-muted-foreground">
                {position.department}
                {position.jobFamily ? ` · ${position.jobFamily}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Periode: {evaluation.periodLabel}
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end">
              <div
                className={cn(
                  "flex size-20 items-center justify-center rounded-xl text-3xl font-bold",
                  bandColorForGrade(grade),
                )}
              >
                {grade || "—"}
              </div>
              <p className="mt-2 text-xs font-semibold">
                {evaluation.finalBandLabel ?? bandLabelForGrade(grade)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Global Grade (1–25)
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">
                Final Score
              </p>
              <p className="text-xl font-bold">
                {(evaluation.finalScore ?? 0).toFixed(2)}
                <span className="text-sm text-muted-foreground"> / 100</span>
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">
                Size Band
              </p>
              <p className="text-sm font-semibold">
                {evaluation.sizeBandUsed
                  ? (SIZE_BAND_CONFIG[evaluation.sizeBandUsed]?.label ??
                    evaluation.sizeBandUsed)
                  : "—"}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-[11px] uppercase text-muted-foreground">
                Salary Band (Mid)
              </p>
              <p className="text-sm font-semibold">
                {salaryBand ? formatIDR(salaryBand.midSalary) : "—"}
              </p>
              {salaryBand ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatIDR(salaryBand.minSalary)} —{" "}
                  {formatIDR(salaryBand.maxSalary)}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 font-semibold">Penilaian per Faktor</p>
            <div className="space-y-1.5">
              {FACTORS.map((f) => {
                const val = evaluation[FACTOR_TO_EVAL_KEY[f.key]] as
                  | number
                  | undefined;
                const pct = val ? (val / 7) * 100 : 0;
                return (
                  <div
                    key={f.key}
                    className="rounded-md border bg-background p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{f.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Bobot {(f.weight * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {val !== undefined ? val.toFixed(2) : "—"}
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            / 7
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {evaluation.reason ? (
            <div>
              <p className="font-semibold">Alasan / Justifikasi</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-sm">
                {evaluation.reason}
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
            <span>Metode: WTW Global Grading System (GGS)</span>
            <Badge variant="outline">
              {evaluation.status === "approved" ? "Disetujui" : evaluation.status}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={downloadPDF} className="cursor-pointer">
            <Download className="size-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
