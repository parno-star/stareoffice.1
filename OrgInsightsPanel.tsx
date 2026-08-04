import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Gauge,
  Users as UsersIcon,
  Target,
  Building2,
  Briefcase,
  Network,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { getInitials } from "../_lib/org-utils.ts";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Severity = "critical" | "warning" | "info" | "positive";
type Category =
  | "span"
  | "succession"
  | "skills"
  | "hierarchy"
  | "leadership"
  | "growth"
  | "department";

function severityMeta(severity: Severity): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  badge: string;
} {
  switch (severity) {
    case "critical":
      return {
        icon: AlertOctagon,
        color: "border-red-500/40 bg-red-500/5",
        label: "Kritis",
        badge:
          "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        color: "border-amber-500/40 bg-amber-500/5",
        label: "Perhatian",
        badge:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    case "info":
      return {
        icon: Info,
        color: "border-sky-500/40 bg-sky-500/5",
        label: "Informasi",
        badge:
          "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
      };
    case "positive":
      return {
        icon: CheckCircle2,
        color: "border-emerald-500/40 bg-emerald-500/5",
        label: "Positif",
        badge:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      };
  }
}

function categoryMeta(category: Category): {
  icon: React.ComponentType<{ className?: string }>;
} {
  switch (category) {
    case "span":
      return { icon: Gauge };
    case "succession":
      return { icon: Target };
    case "skills":
      return { icon: Sparkles };
    case "hierarchy":
      return { icon: Network };
    case "leadership":
      return { icon: UsersIcon };
    case "growth":
      return { icon: TrendingUp };
    case "department":
      return { icon: Building2 };
  }
}

function healthLabel(score: number): { label: string; color: string } {
  if (score >= 85)
    return {
      label: "Sehat",
      color: "text-emerald-600 dark:text-emerald-400",
    };
  if (score >= 70)
    return {
      label: "Cukup Baik",
      color: "text-sky-600 dark:text-sky-400",
    };
  if (score >= 50)
    return {
      label: "Perlu Perhatian",
      color: "text-amber-600 dark:text-amber-400",
    };
  return { label: "Perlu Tindakan", color: "text-red-600 dark:text-red-400" };
}

export default function OrgInsightsPanel({
  allUsers,
  onSelectUser,
}: {
  allUsers: Array<Doc<"users">>;
  onSelectUser: (id: Id<"users">) => void;
}) {
  const insights = useQuery(api.orgAdvanced.insights.getOrgInsights, {});
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");

  const userById = useMemo(() => {
    const m = new Map<Id<"users">, Doc<"users">>();
    for (const u of allUsers) m.set(u._id, u);
    return m;
  }, [allUsers]);

  if (!insights) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const filteredInsights =
    activeCategory === "all"
      ? insights.insights
      : insights.insights.filter((i) => i.category === activeCategory);

  const hl = healthLabel(insights.healthScore);
  const generatedAt = parseISO(insights.generatedAt);

  return (
    <div className="space-y-4">
      {/* Hero summary */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-primary/5" />
        <CardContent className="relative grid gap-4 p-5 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-4 sm:min-w-[140px]">
            <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="size-5" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Skor Kesehatan
            </p>
            <p className={cn("text-4xl font-bold tabular-nums", hl.color)}>
              {insights.healthScore}
            </p>
            <p className={cn("text-xs font-semibold", hl.color)}>{hl.label}</p>
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-violet-500" />
                <p className="text-sm font-semibold">AI Insight Organisasi</p>
                <Badge variant="outline" className="text-[10px]">
                  {insights.totalInsights} temuan
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Analisis otomatis terhadap struktur organisasi saat ini:
                rentang kendali, suksesi, keahlian, hierarki, dan lainnya.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-lg border bg-card px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground">Kritis</p>
                <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                  {insights.criticalCount}
                </p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground">Perhatian</p>
                <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {insights.warningCount}
                </p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground">Positif</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {insights.positiveCount}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
                <RefreshCw className="size-3" />
                {format(generatedAt, "d MMM yyyy HH:mm", { locale: localeId })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category filters */}
      {insights.categories.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-3">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={cn(
                "rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 cursor-pointer",
                activeCategory === "all" && "border-primary/50 bg-primary/5",
              )}
            >
              Semua ({insights.totalInsights})
            </button>
            {insights.categories.map((c) => {
              const Icon = categoryMeta(c.category as Category).icon;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setActiveCategory(c.category as Category)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 cursor-pointer",
                    activeCategory === c.category &&
                      "border-primary/50 bg-primary/5",
                  )}
                >
                  <Icon className="size-3.5" />
                  {c.label} ({c.count})
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* Insights list */}
      {filteredInsights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </div>
            <p className="text-sm font-semibold">
              {activeCategory === "all"
                ? "Organisasi terlihat sehat"
                : "Tidak ada temuan di kategori ini"}
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              {activeCategory === "all"
                ? "AI tidak menemukan masalah struktural yang perlu perhatian segera. Terus pantau secara berkala."
                : "Pilih kategori lain untuk melihat temuan AI."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredInsights.map((insight) => {
            const sev = severityMeta(insight.severity as Severity);
            const SevIcon = sev.icon;
            const CatIcon = categoryMeta(insight.category as Category).icon;
            const related = (insight.relatedUserIds ?? [])
              .map((id) => userById.get(id))
              .filter((u): u is Doc<"users"> => Boolean(u));
            return (
              <Card key={insight.id} className={cn("border", sev.color)}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start gap-2 text-sm">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        sev.badge,
                      )}
                    >
                      <SevIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", sev.badge)}
                        >
                          {sev.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px]"
                        >
                          <CatIcon className="size-3" />
                          {
                            insights.categories.find(
                              (c) => c.category === insight.category,
                            )?.label ?? insight.category
                          }
                        </Badge>
                        {insight.metric ? (
                          <Badge
                            variant="secondary"
                            className="tabular-nums text-[10px]"
                          >
                            {insight.metric}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold leading-tight">
                        {insight.title}
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-sm text-muted-foreground">
                    {insight.description}
                  </p>
                  {insight.recommendation ? (
                    <div className="flex items-start gap-2 rounded-lg border bg-card p-2.5">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
                      <p className="text-xs">
                        <span className="font-semibold">Rekomendasi: </span>
                        {insight.recommendation}
                      </p>
                    </div>
                  ) : null}
                  {related.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Terkait
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {related.map((u) => (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => onSelectUser(u._id)}
                            className="flex items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-xs transition-colors hover:border-primary/40 cursor-pointer"
                          >
                            <Avatar className="size-4">
                              {u.avatarUrl ? (
                                <AvatarImage
                                  src={u.avatarUrl}
                                  alt={u.name ?? ""}
                                />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-[8px] font-semibold text-primary">
                                {getInitials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-[120px] truncate font-medium">
                              {u.name ?? "—"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        <Briefcase className="mr-1 inline size-3" />
        AI insight dihasilkan otomatis berdasarkan data struktur, tidak
        menggantikan penilaian manajerial.
      </p>
    </div>
  );
}
