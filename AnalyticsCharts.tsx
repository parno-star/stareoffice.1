import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart.tsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils.ts";

export const ANALYTICS_PALETTE: ReadonlyArray<string> = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

// -----------------------------------------------------------------------
// Headcount trend - area chart with cumulative headcount
// -----------------------------------------------------------------------

export type HeadcountTrendPoint = {
  month: string;
  label: string;
  hires: number;
  cumulative: number;
};

export function HeadcountTrendCard({
  data,
}: {
  data: Array<HeadcountTrendPoint>;
}) {
  const config = {
    cumulative: { label: "Total Karyawan", color: "var(--chart-1)" },
    hires: { label: "Karyawan Baru", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Tren Headcount 12 Bulan Terakhir
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pertumbuhan total karyawan dan jumlah karyawan baru per bulan.
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-72 w-full">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="grad-cumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-hires" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={32}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="var(--chart-1)"
              fill="url(#grad-cumulative)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="hires"
              stroke="var(--chart-2)"
              fill="url(#grad-hires)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Composition pie + list (byDepartment/byLevel/byLocation/byRole)
// -----------------------------------------------------------------------

export type CompositionItem = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export function CompositionCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<CompositionItem>;
}) {
  const total = items.reduce((acc, i) => acc + i.count, 0);
  const config = {
    count: { label: "Jumlah" },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data.
          </p>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <ChartContainer
              config={config}
              className="mx-auto h-56 w-full max-w-[220px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={items}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={42}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {items.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex-1 space-y-1.5 text-sm">
              {items.slice(0, 8).map((it, idx) => (
                <li
                  key={it.key}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="block size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length],
                      }}
                    />
                    <span className="truncate">{it.label}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {it.count}{" "}
                    <span className="text-[10px]">
                      ({total === 0 ? 0 : Math.round((it.count / total) * 100)}%)
                    </span>
                  </span>
                </li>
              ))}
              {items.length > 8 ? (
                <li className="pt-1 text-xs text-muted-foreground">
                  +{items.length - 8} lainnya
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Tenure distribution bar chart
// -----------------------------------------------------------------------

export type TenureBucket = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export function TenureDistributionCard({
  items,
}: {
  items: Array<TenureBucket>;
}) {
  const config = {
    count: { label: "Karyawan", color: "var(--chart-3)" },
  } satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribusi Masa Kerja</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sebaran karyawan berdasarkan lama bekerja di perusahaan.
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-60 w-full">
          <BarChart
            data={items}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={28}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {items.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Performance distribution
// -----------------------------------------------------------------------

export type PerformanceRatingBucket = {
  rating: number;
  label: string;
  count: number;
  percent: number;
};

export function PerformanceDistributionCard({
  items,
}: {
  items: Array<PerformanceRatingBucket>;
}) {
  const total = items.reduce((acc, i) => acc + i.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Distribusi Rating Kinerja
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {total} review kinerja yang sudah disubmit/acknowledge.
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada review kinerja tersedia.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={it.rating} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-flex size-6 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                      style={{
                        backgroundColor:
                          ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length],
                      }}
                    >
                      {it.rating}
                    </span>
                    <span>{it.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {it.count} orang ({it.percent}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${it.percent}%`,
                      backgroundColor:
                        ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Compensation by department
// -----------------------------------------------------------------------

export type CompensationByDepartment = {
  department: string;
  headcount: number;
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  totalCost: number;
};

function formatIdr(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)}rb`;
  }
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function CompensationCard({
  items,
}: {
  items: Array<CompensationByDepartment>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Biaya SDM per Departemen</CardTitle>
        <p className="text-xs text-muted-foreground">
          Dari payroll terakhir yang dipublikasikan (net take-home per bulan).
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada periode payroll yang dipublikasikan.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b pb-2 text-[11px] font-medium uppercase text-muted-foreground">
              <span>Departemen</span>
              <span className="text-right">Rata-rata</span>
              <span className="text-right">Total</span>
            </div>
            {items.map((it, idx) => (
              <div
                key={it.department}
                className="grid grid-cols-[1fr_auto_auto] gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{it.department}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.headcount} karyawan · min {formatIdr(it.minSalary)} –
                    max {formatIdr(it.maxSalary)}
                  </p>
                </div>
                <span
                  className="self-center text-right font-semibold"
                  style={{
                    color: ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length],
                  }}
                >
                  {formatIdr(it.avgSalary)}
                </span>
                <span className="self-center text-right font-semibold">
                  {formatIdr(it.totalCost)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Payroll trend line chart
// -----------------------------------------------------------------------

export type PayrollTrendPoint = {
  period: string;
  label: string;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  employeeCount: number;
};

export function PayrollTrendCard({
  data,
}: {
  data: Array<PayrollTrendPoint>;
}) {
  const config = {
    totalGross: { label: "Gross", color: "var(--chart-1)" },
    totalNet: { label: "Net", color: "var(--chart-2)" },
  } satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tren Biaya Payroll</CardTitle>
        <p className="text-xs text-muted-foreground">
          Total biaya gross & net selama periode payroll terpublikasi.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada periode payroll yang dipublikasikan.
          </p>
        ) : (
          <ChartContainer config={config} className="h-60 w-full">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={60}
                tickFormatter={(v: number) =>
                  v >= 1_000_000_000
                    ? `${Math.round(v / 1_000_000_000)}M`
                    : `${Math.round(v / 1_000_000)}jt`
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatIdr(Number(value))}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="totalGross"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="totalNet"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Recruitment pipeline funnel
// -----------------------------------------------------------------------

export type PipelineStageItem = {
  stage: string;
  label: string;
  count: number;
};

export function PipelineCard({
  items,
}: {
  items: Array<PipelineStageItem>;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funnel Rekrutmen</CardTitle>
        <p className="text-xs text-muted-foreground">
          Jumlah kandidat per tahap di pipeline rekrutmen.
        </p>
      </CardHeader>
      <CardContent>
        {items.every((i) => i.count === 0) ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada kandidat dalam pipeline.
          </p>
        ) : (
          <div className="space-y-2.5">
            {items.map((it, idx) => {
              const width = Math.max(6, Math.round((it.count / max) * 100));
              return (
                <div key={it.stage} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted-foreground">
                    {it.label}
                  </span>
                  <div className="relative flex-1">
                    <div
                      className={cn(
                        "flex h-9 items-center rounded-md px-3 text-sm font-semibold text-white transition-all",
                      )}
                      style={{
                        width: `${width}%`,
                        backgroundColor:
                          ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length],
                      }}
                    >
                      {it.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Engagement pulse trend
// -----------------------------------------------------------------------

export type EngagementPulsePoint = {
  weekStart: string;
  label: string;
  avgScore: number | null;
  responses: number;
};

export function EngagementPulseCard({
  data,
}: {
  data: Array<EngagementPulsePoint>;
}) {
  const config = {
    avgScore: { label: "Skor Engagement", color: "var(--chart-4)" },
  } satisfies ChartConfig;
  const hasData = data.some((d) => d.avgScore !== null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pulsa Engagement Mingguan</CardTitle>
        <p className="text-xs text-muted-foreground">
          Rata-rata skor survei engagement (0-100) per minggu, 12 minggu terakhir.
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada respons survei engagement.
          </p>
        ) : (
          <ChartContainer config={config} className="h-60 w-full">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="grad-engagement" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-4)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-4)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="avgScore"
                stroke="var(--chart-4)"
                fill="url(#grad-engagement)"
                strokeWidth={2}
                connectNulls
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Top skills bar
// -----------------------------------------------------------------------

export type SkillItem = {
  skill: string;
  category: string;
  count: number;
  avgLevel: number;
};

export function TopSkillsCard({ items }: { items: Array<SkillItem> }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Keterampilan</CardTitle>
        <p className="text-xs text-muted-foreground">
          Keterampilan paling umum di perusahaan dan rata-rata level (1-5).
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data keterampilan.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, idx) => {
              const width = Math.round((it.count / max) * 100);
              return (
                <li key={it.skill} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{it.skill}</span>
                      <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                        {it.category}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {it.count} orang · L{it.avgLevel.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        backgroundColor:
                          ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Department scorecard table
// -----------------------------------------------------------------------

export type DepartmentScorecard = {
  department: string;
  headcount: number;
  avgTenureYears: number;
  avgPerformance: number | null;
  avgEngagement: number | null;
  trainingCompletions: number;
  recognitionCount: number;
  absenceDays: number;
  openPositions: number;
};

function scoreTone(value: number, target: number): string {
  if (value >= target) return "text-emerald-600 dark:text-emerald-400";
  if (value >= target * 0.7) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function DepartmentScorecardTable({
  items,
}: {
  items: Array<DepartmentScorecard>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scorecard per Departemen</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ringkasan metrik utama setiap departemen dalam 90 hari terakhir.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data departemen.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Departemen</th>
                <th className="px-3 py-2 font-medium text-center">Headcount</th>
                <th className="px-3 py-2 font-medium text-center">Tenure</th>
                <th className="px-3 py-2 font-medium text-center">Kinerja</th>
                <th className="px-3 py-2 font-medium text-center">
                  Engagement
                </th>
                <th className="px-3 py-2 font-medium text-center">Training</th>
                <th className="px-3 py-2 font-medium text-center">Apresiasi</th>
                <th className="px-3 py-2 font-medium text-center">Absensi</th>
                <th className="px-3 py-2 font-medium text-center">Vacancy</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.department}
                  className="border-b last:border-0 hover:bg-muted/40"
                >
                  <td className="py-2.5 pr-3 font-medium">{it.department}</td>
                  <td className="px-3 py-2.5 text-center">{it.headcount}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">
                    {it.avgTenureYears}j
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {it.avgPerformance === null ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <span
                        className={cn(
                          "font-semibold",
                          scoreTone(it.avgPerformance, 3.5),
                        )}
                      >
                        {it.avgPerformance.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {it.avgEngagement === null ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <span
                        className={cn(
                          "font-semibold",
                          scoreTone(it.avgEngagement, 70),
                        )}
                      >
                        {it.avgEngagement}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {it.trainingCompletions}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {it.recognitionCount}
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">
                    {it.absenceDays}h
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {it.openPositions > 0 ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {it.openPositions}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
