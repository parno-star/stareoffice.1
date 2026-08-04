import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Users,
  Layers,
  Network,
  TrendingUp,
  AlertTriangle,
  Gauge,
  UserX,
  Search,
  GitBranchPlus,
} from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { getInitials } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

const HEALTH_META: Record<
  string,
  { label: string; tone: string; dot: string; description: string }
> = {
  healthy: {
    label: "Sehat",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    description: "5-10 bawahan langsung, ideal untuk coaching.",
  },
  stretched: {
    label: "Terbebani",
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
    description: "Lebih dari 10 bawahan - rawan burnout & kualitas coaching turun.",
  },
  underused: {
    label: "Underutilized",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    description: "Hanya 1 bawahan - pertimbangkan merger tim.",
  },
  lonely: {
    label: "Tim Kecil",
    tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    description: "2-4 bawahan, tim kecil yang masih terkelola.",
  },
  deep: {
    label: "Rantai Dalam",
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
    description: "Hirarki di bawah manajer ini cukup dalam (>=4 level).",
  },
};

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone: "primary" | "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {hint ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SpanOfControlPanel({
  onSelectUser,
}: {
  onSelectUser: (user: Doc<"users">) => void;
}) {
  const stats = useQuery(api.orgAdvanced.spanOfControl.getSpanStats, {});
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!stats) return [];
    const q = search.trim().toLowerCase();
    return stats.rows.filter((r) => {
      if (healthFilter && r.health !== healthFilter) return false;
      if (!q) return true;
      return (
        (r.manager.name ?? "").toLowerCase().includes(q) ||
        (r.manager.jobTitle ?? "").toLowerCase().includes(q) ||
        (r.manager.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [stats, search, healthFilter]);

  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Gauge}
          label="Rata-rata Span"
          value={stats.avgSpan}
          hint={`Maks ${stats.maxSpan} bawahan langsung`}
          tone="primary"
        />
        <MetricCard
          icon={Users}
          label="Rasio IC : Manajer"
          value={`${stats.managerRatio}:1`}
          hint={`${stats.totalIcs} individu · ${stats.totalManagers} manajer`}
          tone="sky"
        />
        <MetricCard
          icon={GitBranchPlus}
          label="Kedalaman Hirarki"
          value={stats.maxDepth}
          hint="Rantai laporan terdalam"
          tone="violet"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Perlu Perhatian"
          value={stats.stretchedCount + stats.underusedCount}
          hint={`${stats.stretchedCount} terbebani · ${stats.underusedCount} underused`}
          tone="amber"
        />
      </div>

      {/* Health legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4 text-primary" />
            Kesehatan Rentang Kendali
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHealthFilter(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition cursor-pointer",
                healthFilter === null
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              Semua ({stats.rows.length})
            </button>
            {Object.entries(HEALTH_META).map(([key, meta]) => {
              const count = stats.rows.filter((r) => r.health === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setHealthFilter(healthFilter === key ? null : key)
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition cursor-pointer",
                    healthFilter === key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", meta.dot)} />
                  <span className="font-medium">{meta.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })}
            {stats.orphanCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-600 dark:text-amber-400">
                <UserX className="size-3" /> {stats.orphanCount} karyawan tanpa
                atasan
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari manajer, jabatan, atau departemen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network />
            </EmptyMedia>
            <EmptyTitle>Belum ada data manajer</EmptyTitle>
            <EmptyDescription>
              Tetapkan atasan pada karyawan untuk melihat rentang kendali.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const meta = HEALTH_META[row.health] ?? HEALTH_META.lonely;
            return (
              <Card
                key={row.manager._id}
                onClick={() => onSelectUser(row.manager)}
                className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-11">
                      <AvatarImage src={row.manager.avatarUrl} />
                      <AvatarFallback>
                        {getInitials(row.manager.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {row.manager.name ?? "Tanpa Nama"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.manager.jobTitle ?? "—"}
                        {row.manager.department
                          ? ` · ${row.manager.department}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn("shrink-0", meta.tone)}>
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border bg-muted/30 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Langsung
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {row.directReports}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Total
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {row.totalReports}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Level
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        {row.depth}
                      </p>
                    </div>
                  </div>

                  {row.departments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {row.departments.slice(0, 3).map((d) => (
                        <span
                          key={d.name}
                          className="rounded-md border bg-muted px-1.5 py-0.5 text-[10px]"
                        >
                          {d.name} · {d.count}
                        </span>
                      ))}
                      {row.departments.length > 3 ? (
                        <span className="text-[10px] text-muted-foreground">
                          +{row.departments.length - 3} lainnya
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-3 text-[10px] text-muted-foreground">
                    <TrendingUp className="mr-1 inline size-3" />
                    {meta.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
