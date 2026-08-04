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
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  History,
  User as UserIcon,
  Building2,
  Users as UsersIcon,
  Briefcase,
  Link2,
  Search,
  Filter,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { getInitials } from "../_lib/org-utils.ts";

function getEventMeta(eventType: string): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
} {
  if (eventType.startsWith("manager")) {
    return {
      icon: UserIcon,
      color:
        "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
      label: "Atasan",
    };
  }
  if (eventType.startsWith("department")) {
    return {
      icon: Building2,
      color:
        "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
      label: "Departemen",
    };
  }
  if (eventType.startsWith("team")) {
    return {
      icon: UsersIcon,
      color:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      label: "Tim",
    };
  }
  if (eventType.startsWith("position")) {
    return {
      icon: Briefcase,
      color:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      label: "Posisi",
    };
  }
  if (eventType.startsWith("dotted")) {
    return {
      icon: Link2,
      color:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      label: "Jalur Sekunder",
    };
  }
  return {
    icon: History,
    color: "bg-muted text-muted-foreground border-border",
    label: "Lainnya",
  };
}

type TimelineEntry = {
  row: Doc<"orgHistory">;
  actor: Doc<"users"> | null;
  dayKey: string;
};

function formatDayLabel(dayKey: string): string {
  try {
    return format(parseISO(dayKey), "EEEE, d MMMM yyyy", { locale: localeId });
  } catch {
    return dayKey;
  }
}

export default function OrgTimelinePanel() {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actorId, setActorId] = useState<Id<"users"> | "all">("all");
  const [limit, setLimit] = useState(100);

  const data = useQuery(api.orgAdvanced.history.listTimeline, {
    limit,
    filter,
    search: search.trim() || undefined,
    actorId: actorId === "all" ? undefined : actorId,
  });

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, Array<TimelineEntry>>();
    for (const e of data.entries) {
      const list = map.get(e.dayKey) ?? [];
      list.push(e);
      map.set(e.dayKey, list);
    }
    return Array.from(map.entries()).map(([dayKey, rows]) => ({
      dayKey,
      rows,
    }));
  }, [data]);

  const filterOptions: Array<{
    value: string;
    label: string;
    count: number;
  }> = data
    ? [
        { value: "all", label: "Semua", count: data.counts.total },
        { value: "manager", label: "Atasan", count: data.counts.manager },
        {
          value: "department",
          label: "Departemen",
          count: data.counts.department,
        },
        { value: "team", label: "Tim", count: data.counts.team },
        { value: "position", label: "Posisi", count: data.counts.position },
        {
          value: "dotted",
          label: "Jalur Sekunder",
          count: data.counts.dottedLine,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Top actors & summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" />
            Ringkasan Aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data ? (
            <div className="grid gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-5">
                {filterOptions.slice(1).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilter(opt.value)}
                    className={cn(
                      "rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 cursor-pointer",
                      filter === opt.value && "border-primary/50 bg-primary/5",
                    )}
                  >
                    <p className="text-[11px] text-muted-foreground">
                      {opt.label}
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      {opt.count}
                    </p>
                  </button>
                ))}
              </div>
              {data.topActors.length > 0 ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Paling Aktif Mengubah Struktur
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.topActors.map((a) => (
                      <button
                        key={a.user._id}
                        type="button"
                        onClick={() =>
                          setActorId(
                            actorId === a.user._id ? "all" : a.user._id,
                          )
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-full border bg-card px-2 py-1 text-xs transition-colors hover:border-primary/40 cursor-pointer",
                          actorId === a.user._id &&
                            "border-primary/50 bg-primary/5",
                        )}
                      >
                        <Avatar className="size-5">
                          {a.user.avatarUrl ? (
                            <AvatarImage
                              src={a.user.avatarUrl}
                              alt={a.user.name ?? ""}
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                            {getInitials(a.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {a.user.name ?? "Admin"}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          · {a.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari perubahan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} ({opt.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actorId !== "all" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActorId("all")}
              >
                Hapus filter pelaku
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Riwayat Perubahan Struktur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {search || filter !== "all" || actorId !== "all"
                ? "Tidak ada perubahan yang cocok dengan filter"
                : "Belum ada perubahan tercatat"}
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.dayKey} className="space-y-3">
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-card pb-1">
                    <div className="h-px flex-1 bg-border" />
                    <p className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {formatDayLabel(group.dayKey)}
                    </p>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="relative space-y-3 pl-4">
                    <div className="absolute left-1 top-2 bottom-2 w-0.5 bg-border" />
                    {group.rows.map((h) => {
                      const meta = getEventMeta(h.row.eventType);
                      const Icon = meta.icon;
                      return (
                        <div key={h.row._id} className="relative">
                          <div
                            className={cn(
                              "absolute -left-3.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-background",
                              meta.color,
                            )}
                          >
                            <Icon className="size-3" />
                          </div>
                          <div className="rounded-lg border bg-card p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]", meta.color)}
                              >
                                {meta.label}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {h.row.subjectName}
                              </Badge>
                              <p className="text-[11px] text-muted-foreground">
                                {format(
                                  parseISO(h.row.timestamp),
                                  "HH:mm",
                                  { locale: localeId },
                                )}
                              </p>
                            </div>
                            <p className="text-sm">{h.row.summary}</p>
                            {h.actor ? (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Avatar className="size-4">
                                  {h.actor.avatarUrl ? (
                                    <AvatarImage
                                      src={h.actor.avatarUrl}
                                      alt={h.actor.name ?? ""}
                                    />
                                  ) : null}
                                  <AvatarFallback className="bg-primary/10 text-[8px] font-semibold text-primary">
                                    {getInitials(h.actor.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>oleh {h.actor.name ?? "Admin"}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {data.hasMore && limit < 500 ? (
                <div className="flex justify-center pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setLimit(Math.min(limit + 100, 500))}
                  >
                    Muat lebih banyak
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
