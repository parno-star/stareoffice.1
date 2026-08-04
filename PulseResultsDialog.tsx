import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { ShieldCheck, TrendingUp, Users2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.js";
import {
  CATEGORY_LABELS,
  formatScorePercent,
  getSentimentBand,
} from "@/pages/pulse/_lib/pulse-utils.ts";
import { cn } from "@/lib/utils.ts";

export default function PulseResultsDialog({
  open,
  onOpenChange,
  pulseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pulseId: Id<"pulseSurveys"> | null;
}) {
  const results = useQuery(
    api.pulse.getPulseResults,
    pulseId ? { pulseId } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {results === undefined && pulseId ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : results === null ? (
          <DialogHeader>
            <DialogTitle>Hasil tidak ditemukan</DialogTitle>
            <DialogDescription>
              Pulse ini mungkin telah dihapus.
            </DialogDescription>
          </DialogHeader>
        ) : results ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle>{results.pulse.title}</DialogTitle>
                {results.pulse.isAnonymous && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" />
                    Anonim
                  </Badge>
                )}
                <Badge variant="outline">
                  {CATEGORY_LABELS[results.pulse.category] ??
                    results.pulse.category}
                </Badge>
              </div>
              <DialogDescription>{results.pulse.question}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Users2 className="size-3.5" />
                    <span>Total Respons</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {results.responseCount}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <TrendingUp className="size-3.5" />
                    <span>Sentimen</span>
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      getSentimentBand(results.averageSentiment).color,
                    )}
                  >
                    {formatScorePercent(results.averageSentiment)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {getSentimentBand(results.averageSentiment).label}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <MessageSquare className="size-3.5" />
                    <span>Komentar</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {results.recentComments.length}
                  </p>
                </Card>
              </div>

              {/* Distribution */}
              {results.distribution.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Distribusi Jawaban
                  </h3>
                  <ChartContainer
                    config={
                      {
                        count: {
                          label: "Jumlah",
                          color: "var(--chart-1)",
                        },
                      } satisfies ChartConfig
                    }
                    className="h-48 w-full"
                  >
                    <BarChart data={results.distribution}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        fill="var(--chart-1)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </Card>
              )}

              {/* Trend */}
              {results.trend.length > 1 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Tren Sentimen Harian
                  </h3>
                  <ChartContainer
                    config={
                      {
                        score: {
                          label: "Sentimen",
                          color: "var(--chart-2)",
                        },
                      } satisfies ChartConfig
                    }
                    className="h-48 w-full"
                  >
                    <LineChart data={results.trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(value: string) =>
                          format(new Date(value), "d MMM", {
                            locale: idLocale,
                          })
                        }
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        domain={[0, 100]}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={{ fill: "var(--chart-2)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </Card>
              )}

              {/* Department breakdown */}
              {results.departmentBreakdown.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Sentimen per Departemen
                  </h3>
                  <div className="space-y-2">
                    {results.departmentBreakdown.map((d) => {
                      const band = getSentimentBand(d.averageSentiment);
                      return (
                        <div key={d.department} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{d.department}</span>
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                band.color,
                              )}
                            >
                              {formatScorePercent(d.averageSentiment)} ·{" "}
                              {d.responseCount} respons
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                d.averageSentiment >= 60
                                  ? "bg-emerald-500"
                                  : d.averageSentiment >= 40
                                    ? "bg-amber-500"
                                    : "bg-rose-500",
                              )}
                              style={{
                                width: `${Math.max(2, d.averageSentiment)}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Recent comments */}
              {results.recentComments.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Komentar Terbaru
                  </h3>
                  <div className="space-y-3">
                    {results.recentComments.map((c, idx) => {
                      const band = getSentimentBand(c.sentimentScore);
                      return (
                        <div
                          key={`${c.submittedAt}-${idx}`}
                          className="rounded-lg border bg-muted/30 p-3"
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>
                              {c.authorName ?? "Anonim"} ·{" "}
                              {format(
                                new Date(c.submittedAt),
                                "d MMM yyyy HH:mm",
                                { locale: idLocale },
                              )}
                            </span>
                            <span className={cn("font-semibold", band.color)}>
                              {formatScorePercent(c.sentimentScore)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {c.comment}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {results.responseCount === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Belum ada respons pada pulse ini.
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
