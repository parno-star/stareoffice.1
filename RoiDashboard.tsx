import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Banknote,
  PiggyBank,
  Activity,
  Target,
  Sparkles,
  AlertTriangle,
  LineChart as LineChartIcon,
  Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { formatIdr } from "../_lib/advanced-utils.ts";
import { getCategoryConfig } from "../_lib/training-utils.ts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart.tsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils.ts";
import { Progress } from "@/components/ui/progress.tsx";

import type { FunctionReturnType } from "convex/server";

const BENEFIT_TYPES = [
  { value: "productivity", label: "Produktivitas" },
  { value: "revenue", label: "Pendapatan" },
  { value: "cost_saving", label: "Penghematan" },
  { value: "quality", label: "Kualitas" },
  { value: "retention", label: "Retensi" },
  { value: "compliance", label: "Kepatuhan" },
];

const CONFIDENCE = [
  { value: "low", label: "Rendah" },
  { value: "medium", label: "Sedang" },
  { value: "high", label: "Tinggi" },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: "blue" | "emerald" | "amber" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              tones[tone],
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate text-xl font-bold">{value}</p>
            {sub ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {sub}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type CourseRoi = FunctionReturnType<
  typeof api.training.roi.getCourseRoiBreakdown
>[number];

function BenefitFormDialog({
  trigger,
  courseId,
  title,
  initial,
}: {
  trigger: React.ReactNode;
  courseId: Id<"courses">;
  title: string;
  initial?: {
    benefitPerLearner: number;
    benefitType: string;
    confidence: string;
    benefitDurationMonths?: number;
    assumptions?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [benefit, setBenefit] = useState(
    initial ? String(initial.benefitPerLearner) : "",
  );
  const [benefitType, setBenefitType] = useState(
    initial?.benefitType ?? "productivity",
  );
  const [confidence, setConfidence] = useState(initial?.confidence ?? "medium");
  const [duration, setDuration] = useState(
    initial?.benefitDurationMonths ? String(initial.benefitDurationMonths) : "12",
  );
  const [assumptions, setAssumptions] = useState(initial?.assumptions ?? "");
  const [busy, setBusy] = useState(false);
  const setBenefitMutation = useMutation(api.training.roi.setCourseBenefit);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(benefit);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("Nilai manfaat tidak valid");
      return;
    }
    setBusy(true);
    try {
      await setBenefitMutation({
        courseId,
        benefitPerLearner: amt,
        benefitType,
        confidence,
        benefitDurationMonths: duration ? Number(duration) : undefined,
        assumptions: assumptions.trim() || undefined,
      });
      toast.success("Manfaat tersimpan");
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manfaat pelatihan</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div>
            <Label>Estimasi manfaat per peserta (IDR)</Label>
            <Input
              type="number"
              min="0"
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              placeholder="5000000"
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Perkiraan dampak finansial per orang yang menyelesaikan kelas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Jenis manfaat</Label>
              <Select value={benefitType} onValueChange={setBenefitType}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tingkat keyakinan</Label>
              <Select value={confidence} onValueChange={setConfidence}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Durasi manfaat (bulan)</Label>
            <Input
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="12"
            />
          </div>
          <div>
            <Label>Asumsi / catatan</Label>
            <Textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              rows={3}
              placeholder="Perhitungan didasarkan pada..."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="cursor-pointer">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeFormDialog({
  trigger,
  courseId,
  courseTitle,
}: {
  trigger: React.ReactNode;
  courseId: Id<"courses">;
  courseTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [metricType, setMetricType] = useState("productivity");
  const [metricName, setMetricName] = useState("");
  const [baseline, setBaseline] = useState("");
  const [post, setPost] = useState("");
  const [unit, setUnit] = useState("%");
  const [realized, setRealized] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const users = useQuery(api.users.listEmployees, {});
  const record = useMutation(api.training.roi.recordOutcome);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      toast.error("Pilih karyawan");
      return;
    }
    if (!metricName.trim()) {
      toast.error("Isi nama metrik");
      return;
    }
    setBusy(true);
    try {
      await record({
        userId: userId as Id<"users">,
        courseId,
        metricType,
        metricName,
        baselineValue: baseline ? Number(baseline) : undefined,
        postValue: post ? Number(post) : undefined,
        unit: unit.trim() || undefined,
        realizedBenefit: realized ? Number(realized) : undefined,
        note: note.trim() || undefined,
      });
      toast.success("Outcome tercatat");
      setOpen(false);
      setUserId("");
      setMetricName("");
      setBaseline("");
      setPost("");
      setRealized("");
      setNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat outcome pelatihan</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {courseTitle}
          </p>
          <div>
            <Label>Karyawan</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Pilih karyawan" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? u.email ?? "Tanpa nama"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Jenis metrik</Label>
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kpi">KPI</SelectItem>
                  <SelectItem value="performance_rating">
                    Rating Kinerja
                  </SelectItem>
                  <SelectItem value="certification">Sertifikasi</SelectItem>
                  <SelectItem value="productivity">Produktivitas</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%"
              />
            </div>
          </div>
          <div>
            <Label>Nama metrik</Label>
            <Input
              value={metricName}
              onChange={(e) => setMetricName(e.target.value)}
              placeholder="Tingkat konversi penjualan"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Baseline (sebelum)</Label>
              <Input
                type="number"
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                placeholder="5"
              />
            </div>
            <div>
              <Label>Setelah pelatihan</Label>
              <Input
                type="number"
                value={post}
                onChange={(e) => setPost(e.target.value)}
                placeholder="12"
              />
            </div>
          </div>
          <div>
            <Label>Realisasi benefit (IDR)</Label>
            <Input
              type="number"
              value={realized}
              onChange={(e) => setRealized(e.target.value)}
              placeholder="10000000"
            />
          </div>
          <div>
            <Label>Catatan</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Penjelasan singkat..."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="cursor-pointer">
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CourseRoiRow({ row }: { row: CourseRoi }) {
  const cat = getCategoryConfig(row.category);
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded",
                cat.iconBg,
              )}
            >
              <cat.icon className="size-3" />
            </span>
            <h4 className="font-semibold text-sm">{row.title}</h4>
            {row.confidence ? (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {row.confidence === "high"
                  ? "Confidence Tinggi"
                  : row.confidence === "medium"
                    ? "Confidence Sedang"
                    : "Confidence Rendah"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {row.enrollmentCount} peserta · {row.completionRate}% selesai
            {row.paybackMonths
              ? ` · Payback ~${row.paybackMonths} bln`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BenefitFormDialog
            courseId={row.courseId}
            title={row.title}
            initial={
              row.benefitPerLearner
                ? {
                    benefitPerLearner: row.benefitPerLearner,
                    benefitType: row.benefitType ?? "productivity",
                    confidence: row.confidence ?? "medium",
                  }
                : undefined
            }
            trigger={
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-1"
              >
                <Pencil className="size-3" />
                Manfaat
              </Button>
            }
          />
          <OutcomeFormDialog
            courseId={row.courseId}
            courseTitle={row.title}
            trigger={
              <Button size="sm" className="cursor-pointer gap-1">
                <Plus className="size-3" />
                Outcome
              </Button>
            }
          />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Biaya total</p>
          <p className="text-sm font-semibold">{formatIdr(row.totalSpend)}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Manfaat total</p>
          <p className="text-sm font-semibold">{formatIdr(row.totalBenefit)}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">Net benefit</p>
          <p
            className={cn(
              "text-sm font-semibold",
              row.netBenefit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {formatIdr(row.netBenefit)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-[10px] text-muted-foreground">ROI</p>
          <p
            className={cn(
              "text-sm font-semibold",
              row.roi !== null && row.roi >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : row.roi !== null
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
            )}
          >
            {row.roi === null ? "—" : `${row.roi}%`}
          </p>
        </div>
      </div>
    </div>
  );
}

function RoiForecastChart() {
  const data = useQuery(api.training.roi.getTrainingForecast, {});
  const merged = useMemo(() => {
    if (!data) return [];
    const hist = data.history.map((h) => ({
      period: h.period,
      actual: h.enrollments,
      completion: h.completions,
      spend: h.spend,
      forecast: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    }));
    const fc = data.forecast.map((f) => ({
      period: f.period,
      actual: null as number | null,
      completion: null as number | null,
      spend: f.predictedSpend,
      forecast: f.predictedEnrollments,
      lower: f.lowerBound,
      upper: f.upperBound,
    }));
    return [...hist, ...fc];
  }, [data]);

  if (data === undefined) return <Skeleton className="h-64 w-full" />;
  if (data.history.every((h) => h.enrollments === 0)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LineChartIcon />
          </EmptyMedia>
          <EmptyTitle>Belum ada data enrollment</EmptyTitle>
          <EmptyDescription>
            Prediksi tersedia setelah ada pendaftaran kelas dalam 3-6 bulan
            terakhir.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ChartContainer
      config={{
        actual: { label: "Aktual Enrollment", color: "hsl(var(--chart-1))" },
        completion: {
          label: "Aktual Selesai",
          color: "hsl(var(--chart-2))",
        },
        forecast: { label: "Prediksi", color: "hsl(var(--chart-3))" },
        upper: { label: "Upper 80%", color: "hsl(var(--chart-4))" },
        lower: { label: "Lower 80%", color: "hsl(var(--chart-5))" },
      }}
      className="h-64 w-full"
    >
      <LineChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="period" fontSize={11} />
        <YAxis fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <ReferenceLine
          x={data.history[data.history.length - 1]?.period}
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
          label={{ value: "Sekarang", position: "top", fontSize: 10 }}
        />
        <Line
          dataKey="actual"
          type="monotone"
          stroke="var(--color-actual)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          dataKey="completion"
          type="monotone"
          stroke="var(--color-completion)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          dataKey="forecast"
          type="monotone"
          stroke="var(--color-forecast)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 4 }}
        />
        <Line
          dataKey="upper"
          type="monotone"
          stroke="var(--color-upper)"
          strokeWidth={1}
          strokeDasharray="2 2"
          dot={false}
        />
        <Line
          dataKey="lower"
          type="monotone"
          stroke="var(--color-lower)"
          strokeWidth={1}
          strokeDasharray="2 2"
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

function CategoryRoiChart({
  byCategory,
}: {
  byCategory: Array<{
    category: string;
    spend: number;
    benefit: number;
    netBenefit: number;
    roi: number | null;
  }>;
}) {
  if (byCategory.length === 0) return null;
  const data = byCategory.map((c) => {
    const cfg = getCategoryConfig(c.category);
    return {
      category: cfg.label,
      spend: c.spend,
      benefit: c.benefit,
    };
  });
  return (
    <ChartContainer
      config={{
        spend: { label: "Biaya", color: "hsl(var(--chart-4))" },
        benefit: { label: "Manfaat", color: "hsl(var(--chart-2))" },
      }}
      className="h-64 w-full"
    >
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="category" fontSize={10} />
        <YAxis fontSize={10} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar dataKey="spend" fill="var(--color-spend)" radius={4} />
        <Bar dataKey="benefit" fill="var(--color-benefit)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export default function RoiDashboard() {
  const summary = useQuery(api.training.roi.getRoiSummary, {});
  const breakdown = useQuery(api.training.roi.getCourseRoiBreakdown, {});
  const forecast = useQuery(api.training.roi.getTrainingForecast, {});

  if (summary === undefined) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const {
    totals,
    byCategory,
    byDepartment,
  } = summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={DollarSign}
          label="Total Biaya"
          value={formatIdr(totals.totalSpend)}
          sub={`${totals.totalEnrollments} pendaftaran`}
          tone="amber"
        />
        <KpiCard
          icon={Banknote}
          label="Total Manfaat"
          value={formatIdr(totals.totalBenefit)}
          sub={`${totals.totalCompletions} lulus`}
          tone="emerald"
        />
        <KpiCard
          icon={PiggyBank}
          label="Net Benefit"
          value={formatIdr(totals.netBenefit)}
          sub={totals.netBenefit >= 0 ? "Positif" : "Defisit"}
          tone={totals.netBenefit >= 0 ? "emerald" : "rose"}
        />
        <KpiCard
          icon={totals.roi !== null && totals.roi >= 0 ? TrendingUp : TrendingDown}
          label="ROI Total"
          value={totals.roi === null ? "—" : `${totals.roi}%`}
          sub={`${totals.coveredCourses} kelas terukur`}
          tone={totals.roi !== null && totals.roi >= 0 ? "emerald" : "rose"}
        />
        <KpiCard
          icon={Target}
          label="Rasio Penyelesaian"
          value={
            totals.totalEnrollments === 0
              ? "0%"
              : `${Math.round(
                  (totals.totalCompletions / totals.totalEnrollments) * 100,
                )}%`
          }
          sub="Completion rate"
          tone="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChartIcon className="size-4" />
              Prediksi Enrollment & Biaya (3 Bulan)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RoiForecastChart />
            {forecast && forecast.forecast.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {forecast.forecast.map((f) => (
                  <div
                    key={f.period}
                    className="rounded-md border bg-muted/40 p-2"
                  >
                    <p className="font-medium">{f.period}</p>
                    <p className="text-muted-foreground">
                      {f.predictedEnrollments} peserta
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Range {f.lowerBound}–{f.upperBound}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Biaya: {formatIdr(f.predictedSpend)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" />
              ROI per Kategori
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Activity />
                  </EmptyMedia>
                  <EmptyTitle>Belum ada data</EmptyTitle>
                  <EmptyDescription>
                    Tambahkan biaya dan manfaat kelas untuk melihat grafik.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <CategoryRoiChart byCategory={byCategory} />
                <div className="mt-3 space-y-2">
                  {byCategory.slice(0, 5).map((c) => {
                    const cfg = getCategoryConfig(c.category);
                    return (
                      <div
                        key={c.category}
                        className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded",
                              cfg.iconBg,
                            )}
                          >
                            <cfg.icon className="size-3" />
                          </span>
                          <span>{cfg.label}</span>
                        </div>
                        <span
                          className={cn(
                            "font-semibold text-sm",
                            c.roi !== null && c.roi >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : c.roi !== null
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-muted-foreground",
                          )}
                        >
                          {c.roi === null ? "—" : `${c.roi}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-risk */}
      {forecast && forecast.atRiskCourses.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Kelas Berisiko Underperform
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {forecast.atRiskCourses.map((c) => (
              <div
                key={c.courseId}
                className="flex flex-col gap-1 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.reason}
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <Progress value={c.completionRate} />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">
                    {c.completionRate}% selesai · {c.enrollmentCount} peserta
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* By department */}
      {byDepartment.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              ROI per Departemen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2">Departemen</th>
                    <th className="px-2 py-2 text-right">Biaya</th>
                    <th className="px-2 py-2 text-right">Manfaat</th>
                    <th className="px-2 py-2 text-right">Net</th>
                    <th className="py-2 pl-2 text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {byDepartment.map((d) => (
                    <tr key={d.department} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 font-medium">{d.department}</td>
                      <td className="px-2 py-2 text-right">
                        {formatIdr(d.spend)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatIdr(d.benefit)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right font-medium",
                          d.netBenefit >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {formatIdr(d.netBenefit)}
                      </td>
                      <td
                        className={cn(
                          "py-2 pl-2 text-right font-semibold",
                          d.roi !== null && d.roi >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : d.roi !== null
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {d.roi === null ? "—" : `${d.roi}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Per course breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4" />
            Detail ROI per Kelas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {breakdown === undefined ? (
            <Skeleton className="h-32 w-full" />
          ) : breakdown.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target />
                </EmptyMedia>
                <EmptyTitle>Belum ada kelas terdaftar</EmptyTitle>
                <EmptyDescription>
                  Buat kelas terlebih dahulu lalu atur biaya dan manfaat.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            breakdown.map((row) => <CourseRoiRow key={row.courseId} row={row} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
