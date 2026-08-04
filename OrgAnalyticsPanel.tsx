import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
} from "recharts";
import {
  Layers,
  Gauge,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";
import { getInitials } from "../_lib/org-utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function OrgAnalyticsPanel({
  allUsers,
}: {
  allUsers: Array<Doc<"users">>;
}) {
  const analytics = useQuery(api.organization.getAnalytics, {});

  if (!analytics) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 w-full lg:col-span-2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const depthChartData = analytics.depthDistribution.map((d) => ({
    name: `Level ${d.depth}`,
    count: d.count,
  }));

  const deptChartData = analytics.departmentSizes.slice(0, 8).map((d) => ({
    name:
      d.department.length > 14 ? d.department.slice(0, 13) + "…" : d.department,
    full: d.department,
    count: d.count,
  }));

  const topManagersWithUser = analytics.topManagers.map((m) => {
    const user = allUsers.find((u) => u._id === m.userId);
    return { ...m, user };
  });

  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          icon={Layers}
          label="Kedalaman Hierarki"
          value={analytics.maxDepth + 1}
          hint={`${analytics.maxDepth + 1} tingkat pelaporan`}
        />
        <MiniStat
          icon={Gauge}
          label="Rata-rata Rentang Kendali"
          value={analytics.avgSpan.toFixed(1)}
          hint={`Maks ${analytics.maxSpan} bawahan`}
        />
        <MiniStat
          icon={UsersIcon}
          label="Individual Contributor"
          value={analytics.icCount}
          hint={`${analytics.totalManagers} atasan`}
        />
        <MiniStat
          icon={TrendingUp}
          label="Total Karyawan"
          value={analytics.totalEmployees}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi per Level</CardTitle>
          </CardHeader>
          <CardContent>
            {depthChartData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada data
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={depthChartData}>
                    <XAxis
                      dataKey="name"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RTooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {depthChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColors[i % chartColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ukuran Departemen</CardTitle>
          </CardHeader>
          <CardContent>
            {deptChartData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Belum ada data
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptChartData} layout="vertical">
                    <XAxis
                      type="number"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <RTooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: number, _name, item) => [
                        value,
                        item?.payload?.full ?? "",
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {deptChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColors[i % chartColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Atasan dengan Bawahan Terbanyak
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topManagersWithUser.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada atasan yang terdaftar
            </p>
          ) : (
            <div className="space-y-2">
              {topManagersWithUser.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <Avatar className="size-10">
                    {m.user?.avatarUrl ? (
                      <AvatarImage
                        src={m.user.avatarUrl}
                        alt={m.name}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.user?.jobTitle ?? "—"}
                      {m.user?.department ? ` • ${m.user.department}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <UsersIcon className="size-3" />
                    {m.reports} bawahan
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
