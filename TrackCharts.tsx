import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type Calc = Doc<"trackCalculations">;

const STATUS_COLORS: Record<string, string> = {
  aman: "#10b981",
  mendekati_batas: "#f59e0b",
  overload: "#ef4444",
};

const CLASS_COLORS: Record<string, string> = {
  "Kelas I": "#6366f1",
  "Kelas II": "#3b82f6",
  "Kelas III": "#10b981",
  "Kelas IV": "#f59e0b",
  "Kelas V": "#ef4444",
};

const TQI_COLORS: Record<string, string> = {
  sangat_baik: "#10b981",
  baik: "#3b82f6",
  sedang: "#f59e0b",
  buruk: "#ef4444",
};

export default function TrackCharts() {
  const data = useQuery(api.trackCalculations.getAllForCharts, {});

  if (data === undefined) return null;
  if (data.length === 0) return null;

  // Sort oldest first for time series
  const sorted = [...data].reverse();

  return (
    <div className="space-y-6">
      <StatusDistribution data={data} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TqiTrend data={sorted} />
        <MgtComparison data={sorted} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ClassDistribution data={data} />
        <SpeedComparison data={sorted} />
      </div>
      <GeometryRadar data={data} />
    </div>
  );
}

function StatusDistribution({ data }: { data: Calc[] }) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = { aman: 0, mendekati_batas: 0, overload: 0 };
    for (const d of data) {
      counts[d.overallStatus] = (counts[d.overallStatus] ?? 0) + 1;
    }
    return [
      { name: "Aman", value: counts.aman, fill: STATUS_COLORS.aman },
      { name: "Mendekati Batas", value: counts.mendekati_batas, fill: STATUS_COLORS.mendekati_batas },
      { name: "Overload", value: counts.overload, fill: STATUS_COLORS.overload },
    ].filter((d) => d.value > 0);
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribusi Status Lintas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {chartData.map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div
                className="size-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: d.fill }}
              >
                {d.value}
              </div>
              <div>
                <p className="text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {((d.value / data.length) * 100).toFixed(0)}% dari total
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TqiTrend({ data }: { data: Calc[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: d.segmentName.length > 12 ? d.segmentName.slice(0, 12) + "..." : d.segmentName,
        tqi: d.tqi,
        date: new Date(d.calculatedAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        }),
      })),
    [data]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tren TQI per Segmen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={11} className="fill-muted-foreground" />
              <YAxis fontSize={11} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="tqi"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4, fill: "#6366f1" }}
                name="TQI"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-emerald-500" /> {"<"} 20 Sangat Baik
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-blue-500" /> {"<"} 35 Baik
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-amber-500" /> {"<"} 50 Sedang
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-red-500" /> {">"} 50 Buruk
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MgtComparison({ data }: { data: Calc[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: d.segmentName.length > 10 ? d.segmentName.slice(0, 10) + "..." : d.segmentName,
        mgt: parseFloat(d.mgt.toFixed(1)),
      })),
    [data]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Perbandingan MGT per Segmen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={11} className="fill-muted-foreground" />
              <YAxis fontSize={11} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value} MGT`, "Tonase"]}
              />
              <Bar dataKey="mgt" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="MGT" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassDistribution({ data }: { data: Calc[] }) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of data) {
      counts[d.trackClassLabel] = (counts[d.trackClassLabel] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        fill: CLASS_COLORS[name] ?? "#94a3b8",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribusi Kelas Jalan Rel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={false}
                fontSize={11}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SpeedComparison({ data }: { data: Calc[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: d.segmentName.length > 10 ? d.segmentName.slice(0, 10) + "..." : d.segmentName,
        rencana: d.designSpeed,
        efektif: d.effectiveMaxSpeed,
      })),
    [data]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Kecepatan Rencana vs Efektif</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={11} className="fill-muted-foreground" />
              <YAxis fontSize={11} className="fill-muted-foreground" unit=" km/j" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => `${value} km/jam`}
              />
              <Legend fontSize={11} />
              <Bar dataKey="rencana" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Kecepatan Rencana" />
              <Bar dataKey="efektif" fill="#10b981" radius={[4, 4, 0, 0]} name="Kecepatan Efektif Maks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function GeometryRadar({ data }: { data: Calc[] }) {
  // Average geometry values from the last 10 calculations
  const chartData = useMemo(() => {
    const recent = data.slice(0, 10);
    if (recent.length === 0) return [];

    const avgAlignment = recent.reduce((s, d) => s + d.input.geometry.sdAlignment, 0) / recent.length;
    const avgLevel = recent.reduce((s, d) => s + d.input.geometry.sdLevel, 0) / recent.length;
    const avgGauge = recent.reduce((s, d) => s + d.input.geometry.sdGauge, 0) / recent.length;
    const avgTwist = recent.reduce((s, d) => s + d.input.geometry.sdTwist, 0) / recent.length;

    return [
      { parameter: "Alignment", value: parseFloat(avgAlignment.toFixed(2)) },
      { parameter: "Level", value: parseFloat(avgLevel.toFixed(2)) },
      { parameter: "Gauge", value: parseFloat(avgGauge.toFixed(2)) },
      { parameter: "Twist", value: parseFloat(avgTwist.toFixed(2)) },
    ];
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Rata-rata Simpangan Baku Geometri (10 Perhitungan Terakhir)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto h-72 max-w-lg">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData}>
              <PolarGrid className="stroke-muted" />
              <PolarAngleAxis dataKey="parameter" fontSize={12} className="fill-foreground" />
              <PolarRadiusAxis fontSize={10} className="fill-muted-foreground" />
              <Radar
                name="SD (mm)"
                dataKey="value"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value} mm`, "SD"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
