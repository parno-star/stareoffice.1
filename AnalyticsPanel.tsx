import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { BOX_META, type BoxCode } from "../_lib/talent-utils.ts";
import { cn } from "@/lib/utils.ts";
import { ArrowDown, ArrowUp, Minus, Plus, Sparkles, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = {
  cycleId: Id<"talentCycles">;
};

const CODES: ReadonlyArray<BoxCode> = [
  "star",
  "high_performer",
  "growth",
  "solid_performer",
  "core",
  "rough_diamond",
  "effective",
  "enigma",
  "risk",
];

export default function AnalyticsPanel({ cycleId }: Props) {
  const analytics = useQuery(api.talent.getCycleAnalytics, { cycleId });

  if (analytics === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const total = analytics.total;
  const topPct = total ? Math.round((analytics.topTalentCount / total) * 100) : 0;
  const riskPct = total ? Math.round((analytics.riskCount / total) * 100) : 0;

  const segmentData = CODES.map((code) => ({
    name: BOX_META[code].shortLabel,
    fullName: BOX_META[code].label,
    count: analytics.bySegment[code] ?? 0,
    code,
  }));

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Sparkles className="size-4 text-violet-600" />}
          label="Top Talenta"
          value={`${analytics.topTalentCount}`}
          sub={`${topPct}% dari ${total} karyawan`}
          tone="bg-violet-50 dark:bg-violet-950/30"
        />
        <Stat
          icon={<AlertTriangle className="size-4 text-rose-600" />}
          label="Area Risiko"
          value={`${analytics.riskCount}`}
          sub={`${riskPct}% perlu intervensi`}
          tone="bg-rose-50 dark:bg-rose-950/30"
        />
        <Stat
          icon={<ArrowUp className="size-4 text-emerald-600" />}
          label="Naik"
          value={`${analytics.movement.improved}`}
          sub="vs. siklus sebelumnya"
          tone="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <Stat
          icon={<ArrowDown className="size-4 text-amber-600" />}
          label="Turun"
          value={`${analytics.movement.declined}`}
          sub="perlu perhatian khusus"
          tone="bg-amber-50 dark:bg-amber-950/30"
        />
      </div>

      {/* Distribution per segment */}
      <Card>
        <CardHeader>
          <CardTitle>Distribusi per Segmen</CardTitle>
          <CardDescription>
            Jumlah karyawan per kotak Nine Box.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={segmentData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [`${v} karyawan`, ""]}
                  labelFormatter={(l: string, data) => {
                    const d = data?.[0]?.payload as
                      | { fullName?: string }
                      | undefined;
                    return d?.fullName ?? l;
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="oklch(from var(--primary) l c h)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Movement */}
      <Card>
        <CardHeader>
          <CardTitle>Pergerakan Talenta</CardTitle>
          <CardDescription>
            Perbandingan dengan posisi Nine Box periode sebelumnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MovementBlock
              label="Naik"
              count={analytics.movement.improved}
              icon={<ArrowUp className="size-4" />}
              tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            />
            <MovementBlock
              label="Sama"
              count={analytics.movement.same}
              icon={<Minus className="size-4" />}
              tone="bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
            />
            <MovementBlock
              label="Turun"
              count={analytics.movement.declined}
              icon={<ArrowDown className="size-4" />}
              tone="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
            />
            <MovementBlock
              label="Baru"
              count={analytics.movement.newlyAdded}
              icon={<Plus className="size-4" />}
              tone="bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
            />
          </div>
        </CardContent>
      </Card>

      {/* Per department */}
      <Card>
        <CardHeader>
          <CardTitle>Per Departemen</CardTitle>
          <CardDescription>
            Perbandingan distribusi antar departemen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart
                data={analytics.byDepartment.map((d) => {
                  const row: Record<string, string | number> = {
                    department: d.department,
                  };
                  for (const code of CODES) {
                    row[code] = d.counts[code] ?? 0;
                  }
                  return row;
                })}
              >
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {CODES.map((code) => (
                  <Bar
                    key={code}
                    dataKey={code}
                    stackId="a"
                    name={BOX_META[code].shortLabel}
                    fill={COLOR[code]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const COLOR: Record<BoxCode, string> = {
  star: "#7c3aed",
  high_performer: "#10b981",
  growth: "#a78bfa",
  solid_performer: "#34d399",
  core: "#38bdf8",
  rough_diamond: "#c4b5fd",
  effective: "#fbbf24",
  enigma: "#f59e0b",
  risk: "#f43f5e",
};

function Stat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4", tone)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function MovementBlock({
  label,
  count,
  icon,
  tone,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className={cn("rounded-lg p-3", tone)}>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{count}</div>
    </div>
  );
}
