import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import {
  TrendingUp,
  Banknote,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  getCategoryConfig,
  getStatusConfig,
  formatCurrency,
  formatDate,
  getAllCategoryOptions,
} from "../_lib/fund-utils.ts";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const STATUS_ORDER = ["in_review", "approved", "disbursed", "rejected", "cancelled", "draft"];

export default function FundRecap() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const allRequests = useQuery(api.fundRequests.list, {
    statusFilter: "all",
    categoryFilter: categoryFilter !== "all" ? categoryFilter : undefined,
  });
  const customCategories = useQuery(api.fundRequests.listCategories, {});
  const categoryOptions = useMemo(
    () => getAllCategoryOptions(customCategories ?? []),
    [customCategories],
  );

  const isLoading = allRequests === undefined;

  // Filter by year based on submittedAt or _creationTime
  const filtered = useMemo(() => {
    if (!allRequests) return [];
    return allRequests.filter((r) => {
      const date = r.submittedAt ?? new Date(r._creationTime).toISOString();
      return date.startsWith(yearFilter);
    });
  }, [allRequests, yearFilter]);

  // ── Stats ──
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const approvedAmount = filtered
    .filter((r) => r.status === "approved" || r.status === "disbursed")
    .reduce((s, r) => s + r.amount, 0);
  const disbursedAmount = filtered
    .filter((r) => r.status === "disbursed")
    .reduce((s, r) => s + r.amount, 0);
  const pendingAmount = filtered
    .filter((r) => r.status === "in_review")
    .reduce((s, r) => s + r.amount, 0);

  // ── By category chart ──
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      if (r.status === "approved" || r.status === "disbursed") {
        map[r.category] = (map[r.category] ?? 0) + r.amount;
      }
    }
    return Object.entries(map).map(([cat, amount]) => ({
      cat,
      label: getCategoryConfig(cat, customCategories ?? []).label,
      amount,
    })).sort((a, b) => b.amount - a.amount);
  }, [filtered, customCategories]);

  // ── By department ──
  const byDept = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const r of filtered) {
      const dept = r.userDepartment ?? "Tidak Ada Departemen";
      if (!map[dept]) map[dept] = { count: 0, amount: 0 };
      map[dept].count++;
      map[dept].amount += r.amount;
    }
    return Object.entries(map)
      .map(([dept, v]) => ({ dept, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  // ── By status ──
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      map[r.status] = (map[r.status] ?? 0) + 1;
    }
    return STATUS_ORDER.filter((s) => map[s]).map((s) => ({
      status: s,
      count: map[s],
      cfg: getStatusConfig(s),
    }));
  }, [filtered]);

  // ── Top submitters ──
  const topSubmitters = useMemo(() => {
    const map: Record<string, { name: string; count: number; amount: number }> = {};
    for (const r of filtered) {
      const k = r.submitterId as string;
      if (!map[k]) map[k] = { name: r.submitterName ?? "—", count: 0, amount: 0 };
      map[k].count++;
      map[k].amount += r.amount;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [filtered]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const now = new Date().getFullYear();
    for (let y = now; y >= now - 4; y--) years.add(String(y));
    return [...years];
  }, []);

  if (isLoading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Pengajuan", value: filtered.length + " Pengajuan", sub: formatCurrency(totalAmount), icon: TrendingUp, tone: "blue" },
          { label: "Menunggu Persetujuan", value: formatCurrency(pendingAmount), sub: (filtered.filter((r) => r.status === "in_review").length) + " pengajuan", icon: Clock, tone: "amber" },
          { label: "Total Disetujui", value: formatCurrency(approvedAmount), sub: (filtered.filter((r) => r.status === "approved" || r.status === "disbursed").length) + " pengajuan", icon: CheckCircle2, tone: "emerald" },
          { label: "Total Dicairkan", value: formatCurrency(disbursedAmount), sub: (filtered.filter((r) => r.status === "disbursed").length) + " pengajuan", icon: Banknote, tone: "teal" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={cn("rounded-lg p-2",
                card.tone === "blue" && "bg-blue-500/10",
                card.tone === "amber" && "bg-amber-500/10",
                card.tone === "emerald" && "bg-emerald-500/10",
                card.tone === "teal" && "bg-teal-500/10",
              )}>
                <card.icon className={cn("size-4",
                  card.tone === "blue" && "text-blue-600",
                  card.tone === "amber" && "text-amber-600",
                  card.tone === "emerald" && "text-emerald-600",
                  card.tone === "teal" && "text-teal-600",
                )} />
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="text-lg font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status breakdown */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Distribusi Status</h3>
          <div className="space-y-2">
            {byStatus.map(({ status, count, cfg }) => {
              const pct = filtered.length > 0 ? (count / filtered.length) * 100 : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
                    <span className="text-muted-foreground">{count} ({Math.round(pct)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", cfg.dot)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {byStatus.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>
            )}
          </div>
        </div>

        {/* By category chart */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Jumlah Disetujui per Kategori</h3>
          {byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCategory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : `${(v / 1_000).toFixed(0)}rb`
                  }
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Jumlah"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {byCategory.map((entry) => (
                    <Cell key={entry.cat} fill={`hsl(var(--primary))`} fillOpacity={0.7 + 0.3 * (byCategory.indexOf(entry) / byCategory.length)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
          )}
        </div>

        {/* By department */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Per Departemen</h3>
          </div>
          <div className="space-y-2">
            {byDept.slice(0, 8).map(({ dept, count, amount }) => (
              <div key={dept} className="flex items-center justify-between py-1.5 border-b border-muted last:border-0">
                <div>
                  <p className="text-sm font-medium truncate max-w-[160px]">{dept}</p>
                  <p className="text-xs text-muted-foreground">{count} pengajuan</p>
                </div>
                <p className="text-sm font-semibold text-primary">{formatCurrency(amount)}</p>
              </div>
            ))}
            {byDept.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>
            )}
          </div>
        </div>

        {/* Top submitters */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Pengaju Terbanyak</h3>
          </div>
          <div className="space-y-3">
            {topSubmitters.map(({ name, count, amount }, idx) => (
              <div key={name} className="flex items-center gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {idx + 1}
                </div>
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="text-[9px]">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">{count} pengajuan</p>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatCurrency(amount)}</p>
              </div>
            ))}
            {topSubmitters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-sm">Detail Semua Pengajuan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Judul</th>
                <th className="px-4 py-2.5 text-left font-medium">Pengaju</th>
                <th className="px-4 py-2.5 text-left font-medium">Kategori</th>
                <th className="px-4 py-2.5 text-right font-medium">Jumlah</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((r) => {
                const statusCfg = getStatusConfig(r.status);
                const catCfg = getCategoryConfig(r.category, customCategories ?? []);
                return (
                  <tr key={r._id} className="border-b hover:bg-muted/20 last:border-0">
                    <td className="px-4 py-2.5 font-medium max-w-[200px]">
                      <p className="truncate">{r.title}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.submitterName ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", catCfg.bg, catCfg.color)}>
                        {catCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className={cn("size-1.5 rounded-full shrink-0", statusCfg.dot)} />
                        <span className={cn("text-xs", statusCfg.color)}>{statusCfg.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {r.submittedAt ? formatDate(r.submittedAt) : formatDate(new Date(r._creationTime).toISOString())}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
