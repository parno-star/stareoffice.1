import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { BarChart3, Plane, Wallet, TrendingUp, Users } from "lucide-react";
import {
  formatCurrency,
  getStatusConfig,
  getTransportConfig,
} from "../_lib/travel-utils.ts";

const PIE_COLORS = [
  "oklch(0.55 0.22 265)",
  "oklch(0.7 0.18 30)",
  "oklch(0.7 0.18 170)",
  "oklch(0.65 0.2 300)",
  "oklch(0.7 0.2 90)",
  "oklch(0.65 0.2 350)",
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate text-xl font-bold">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TravelAnalyticsPanel() {
  const analytics = useQuery(api.travel.getAnalytics, {});

  if (analytics === undefined) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (analytics.total === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BarChart3 />
          </EmptyMedia>
          <EmptyTitle>Belum ada data</EmptyTitle>
          <EmptyDescription>
            Analitik akan muncul setelah karyawan mengajukan perjalanan dinas.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const monthChartData = analytics.byMonth.map((m) => ({
    month: m.month,
    trip: m.count,
    cost: m.cost,
  }));

  const transportChartData = analytics.byTransport.map((t) => ({
    name: getTransportConfig(t.mode).label,
    value: t.count,
  }));

  const statusChartData = analytics.byStatus.map((s) => ({
    name: getStatusConfig(s.status).label,
    value: s.count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Plane}
          label="Total Perjalanan"
          value={String(analytics.total)}
          accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        />
        <StatTile
          icon={Wallet}
          label="Total Estimasi"
          value={formatCurrency(analytics.totalEstimated)}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatTile
          icon={TrendingUp}
          label="Total Aktual"
          value={formatCurrency(analytics.totalActual)}
          hint={
            analytics.totalActual > analytics.totalEstimated
              ? "Over budget"
              : analytics.totalActual === 0
                ? "Belum ada laporan"
                : "Sesuai/dibawah budget"
          }
          accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <StatTile
          icon={Users}
          label="Pelancong Teratas"
          value={String(analytics.topTravelers.length)}
          hint={analytics.topTravelers[0]?.userName ?? "Tidak ada"}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren Bulanan</CardTitle>
          </CardHeader>
          <CardContent>
            {monthChartData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada data bulanan.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="trip"
                    stroke="oklch(0.55 0.22 265)"
                    strokeWidth={2}
                    name="Jumlah Perjalanan"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Perjalanan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={50}
                  label
                >
                  {statusChartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moda Transportasi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={transportChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="oklch(0.7 0.18 170)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Biaya per Departemen</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.byDepartment.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada data departemen.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.byDepartment} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    type="number"
                    fontSize={12}
                    tickFormatter={(v: number) =>
                      `${Math.round(v / 1_000_000)}jt`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    fontSize={12}
                    width={110}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar
                    dataKey="cost"
                    fill="oklch(0.65 0.2 300)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pelancong Teratas</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topTravelers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada data pelancong.
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.topTravelers.map((t, idx) => (
                <div
                  key={t.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </div>
                    <Avatar className="size-9">
                      <AvatarImage src={t.userAvatar ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(t.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {t.userName ?? "Karyawan"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.tripCount} perjalanan
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(t.totalCost)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
