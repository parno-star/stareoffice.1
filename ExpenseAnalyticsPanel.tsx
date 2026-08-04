import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from "recharts";
import { useMemo, useState } from "react";
import {
  formatCurrency,
  buildCategoryDisplayMap,
  resolveCategoryDisplay,
} from "../_lib/expense-utils.ts";
import { BarChart3 } from "lucide-react";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

function startOfYearIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const CHART_COLORS = [
  "oklch(0.65 0.18 250)",
  "oklch(0.7 0.18 150)",
  "oklch(0.7 0.18 40)",
  "oklch(0.68 0.16 300)",
  "oklch(0.7 0.18 200)",
  "oklch(0.68 0.15 20)",
  "oklch(0.65 0.12 120)",
  "oklch(0.6 0.18 350)",
];

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map((n) => Number(n));
  if (!y || !m) return key;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString("id-ID", { month: "short", year: "2-digit" });
}

export default function ExpenseAnalyticsPanel() {
  const [startDate, setStartDate] = useState(startOfYearIso());
  const [endDate, setEndDate] = useState(todayIso());

  const analytics = useQuery(api.expenses.getAnalytics, {
    startDate,
    endDate,
  });
  const categoryList = useQuery(api.expenseCategories.list, {});
  const categoryMap = useMemo(
    () => buildCategoryDisplayMap(categoryList ?? []),
    [categoryList],
  );

  const isLoading = analytics === undefined;

  const categoryData = useMemo(
    () =>
      (analytics?.byCategory ?? []).map((c) => ({
        ...c,
        label: resolveCategoryDisplay(c.category, categoryMap).label,
      })),
    [analytics, categoryMap],
  );

  const monthData = useMemo(
    () =>
      (analytics?.byMonth ?? []).map((m) => ({
        ...m,
        label: monthLabel(m.month),
      })),
    [analytics],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="an-start">Dari tanggal</Label>
            <DateField
              id="an-start"
              value={startDate}
              onChange={(v) => setStartDate(v)}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="an-end">Sampai tanggal</Label>
            <DateField
              id="an-end"
              value={endDate}
              onChange={(v) => setEndDate(v)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : analytics.total === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 />
            </EmptyMedia>
            <EmptyTitle>Belum ada data</EmptyTitle>
            <EmptyDescription>
              Tidak ada pengajuan reimbursement pada rentang tanggal ini.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Total Pengajuan
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {analytics.total.toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(analytics.totalAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Sudah Dibayar
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(analytics.paidAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Menunggu bayar: {formatCurrency(analytics.approvedAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Belum Diproses
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(analytics.pendingAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ditolak: {formatCurrency(analytics.rejectedAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Rata-rata waktu persetujuan
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {analytics.avgApprovalHours !== null
                    ? `${analytics.avgApprovalHours.toFixed(1)} jam`
                    : "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  sejak pengajuan hingga direview
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tren Bulanan</CardTitle>
                <CardDescription>
                  Nominal pengeluaran per bulan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis
                        fontSize={11}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}jt`
                            : v >= 1000
                              ? `${(v / 1000).toFixed(0)}rb`
                              : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="oklch(0.65 0.18 250)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per Kategori</CardTitle>
                <CardDescription>
                  Nominal pengeluaran per kategori
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        type="number"
                        fontSize={11}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(0)}jt`
                            : v >= 1000
                              ? `${(v / 1000).toFixed(0)}rb`
                              : String(v)
                        }
                      />
                      <YAxis
                        dataKey="label"
                        type="category"
                        fontSize={11}
                        width={110}
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                        {categoryData.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per Departemen</CardTitle>
                <CardDescription>
                  Belanja reimbursement per departemen
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.byDepartment.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Tidak ada data
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.byDepartment.map((d, idx) => {
                      const max = Math.max(
                        ...analytics.byDepartment.map((x) => x.amount),
                      );
                      const pct = max > 0 ? (d.amount / max) * 100 : 0;
                      return (
                        <div key={d.department} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {d.department}
                            </span>
                            <span className="tabular-nums">
                              {formatCurrency(d.amount)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background:
                                  CHART_COLORS[idx % CHART_COLORS.length],
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {d.count} pengajuan
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Pengguna</CardTitle>
                <CardDescription>
                  Karyawan dengan pengeluaran tertinggi
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topSpenders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Tidak ada data
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topSpenders.map((u, idx) => (
                      <div
                        key={u.userId}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {idx + 1}
                        </span>
                        <Avatar className="size-9">
                          {u.userAvatar ? (
                            <AvatarImage src={u.userAvatar} />
                          ) : null}
                          <AvatarFallback>
                            {getInitials(u.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {u.userName ?? "Karyawan"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.count} pengajuan
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums">
                          {formatCurrency(u.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ringkasan Kategori</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categoryData.map((c) => {
                const cfg = resolveCategoryDisplay(c.category, categoryMap);
                const Icon = cfg.icon;
                const pct =
                  analytics.totalAmount > 0
                    ? (c.amount / analytics.totalAmount) * 100
                    : 0;
                return (
                  <div
                    key={c.category}
                    className="flex items-center gap-3 rounded-lg border p-2.5"
                  >
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {resolveCategoryDisplay(c.category, categoryMap).label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.count} pengajuan · {pct.toFixed(1)}%
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums">
                      {formatCurrency(c.amount)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
