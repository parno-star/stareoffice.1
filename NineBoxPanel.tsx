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
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Grid3x3,
  Plus,
  Search,
  Star,
  Users as UsersIcon,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { getInitials } from "../_lib/org-utils.ts";
import {
  BOX_DESCRIPTIONS,
  BOX_LABELS,
  BOX_TONES,
  cellPosition,
} from "./nine-box-utils.ts";

type Props = {
  allUsers: Array<Doc<"users">>;
  isAdmin: boolean;
  onAssessUser: (user: Doc<"users">) => void;
  onSelectUser: (user: Doc<"users">) => void;
};

export default function NineBoxPanel({
  allUsers,
  isAdmin,
  onAssessUser,
  onSelectUser,
}: Props) {
  const entries = useQuery(api.orgAdvanced.nineBox.listAll, {});
  const [search, setSearch] = useState("");

  const userById = useMemo(() => {
    const m = new Map<Id<"users">, Doc<"users">>();
    for (const u of allUsers) m.set(u._id, u);
    return m;
  }, [allUsers]);

  const cellBuckets = useMemo(() => {
    const map = new Map<string, Array<Doc<"nineBoxAssessments">>>();
    for (const e of entries ?? []) {
      const key = `${e.assessment.performance}-${e.assessment.potential}`;
      const list = map.get(key) ?? [];
      list.push(e.assessment);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const assessedIds = useMemo(() => {
    const set = new Set<Id<"users">>();
    for (const e of entries ?? []) set.add(e.assessment.userId);
    return set;
  }, [entries]);

  const unassessed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers
      .filter((u) => !assessedIds.has(u._id))
      .filter((u) => {
        if (!q) return true;
        return (
          (u.name ?? "").toLowerCase().includes(q) ||
          (u.jobTitle ?? "").toLowerCase().includes(q) ||
          (u.department ?? "").toLowerCase().includes(q)
        );
      });
  }, [allUsers, assessedIds, search]);

  const totalAssessed = entries?.length ?? 0;
  const starCount = cellBuckets.get("3-3")?.length ?? 0;
  const riskCount = cellBuckets.get("1-1")?.length ?? 0;

  if (!entries) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Grid3x3 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Karyawan dinilai</p>
              <p className="text-2xl font-bold tabular-nums">{totalAssessed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Star className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bintang (3-3)</p>
              <p className="text-2xl font-bold tabular-nums">{starCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <UserCog className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Risiko (1-1)</p>
              <p className="text-2xl font-bold tabular-nums">{riskCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <UsersIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Belum dinilai</p>
              <p className="text-2xl font-bold tabular-nums">
                {allUsers.length - totalAssessed}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="size-4 text-primary" />
            Matriks 9-Box Talent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {/* Y-axis label */}
            <div className="hidden flex-col items-center justify-center sm:flex">
              <p className="rotate-180 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl]">
                Potensi
              </p>
            </div>

            <div className="flex-1 space-y-2">
              {/* Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[3, 2, 1].flatMap((potential) =>
                  [1, 2, 3].map((performance) => {
                    const key = `${performance}-${potential}`;
                    const list = cellBuckets.get(key) ?? [];
                    const label = BOX_LABELS[key] ?? "—";
                    const tone = BOX_TONES[key] ?? "bg-muted text-foreground";
                    const desc = BOX_DESCRIPTIONS[key] ?? "";
                    const pos = cellPosition(performance, potential);
                    return (
                      <div
                        key={key}
                        style={{
                          gridRow: pos.row + 1,
                          gridColumn: pos.col + 1,
                        }}
                        className={cn(
                          "flex min-h-[160px] flex-col rounded-lg border p-2",
                          tone,
                        )}
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider opacity-70">
                              P{performance} · Pot{potential}
                            </p>
                            <p className="text-xs font-bold leading-tight">
                              {label}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-background/70 text-foreground"
                          >
                            {list.length}
                          </Badge>
                        </div>
                        <p className="mb-2 text-[10px] leading-tight opacity-80">
                          {desc}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-1">
                          {list.slice(0, 6).map((a) => {
                            const u = userById.get(a.userId);
                            if (!u) return null;
                            return (
                              <button
                                key={a._id}
                                type="button"
                                onClick={() => onSelectUser(u)}
                                title={u.name ?? ""}
                                className="rounded-full ring-2 ring-background transition hover:ring-primary cursor-pointer"
                              >
                                <Avatar className="size-7">
                                  <AvatarImage src={u.avatarUrl} />
                                  <AvatarFallback className="text-[10px]">
                                    {getInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                              </button>
                            );
                          })}
                          {list.length > 6 ? (
                            <span className="flex size-7 items-center justify-center rounded-full bg-background/70 text-[10px] font-medium">
                              +{list.length - 6}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>

              {/* X-axis label */}
              <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Performa →
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                Karyawan Belum Dinilai ({unassessed.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari karyawan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {unassessed.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Grid3x3 />
                  </EmptyMedia>
                  <EmptyTitle>Semua karyawan sudah dinilai</EmptyTitle>
                  <EmptyDescription>
                    Tetap up-to-date dengan penilaian periodik.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unassessed.slice(0, 30).map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center gap-2 rounded-lg border bg-card p-2"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={u.avatarUrl} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {u.jobTitle ?? "—"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onAssessUser(u)}
                    >
                      Nilai
                    </Button>
                  </div>
                ))}
                {unassessed.length > 30 ? (
                  <p className="col-span-full text-center text-xs text-muted-foreground">
                    Dan {unassessed.length - 30} karyawan lainnya...
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
