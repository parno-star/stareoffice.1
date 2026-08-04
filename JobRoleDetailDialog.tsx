import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Briefcase,
  ListChecks,
  Target,
  Users,
  Edit3,
  BookOpen,
  CircleCheck,
  CircleAlert,
  CircleX,
} from "lucide-react";
import { colorClasses, getInitials } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  roleId: Id<"jobRoles"> | null;
  currentUserId: Id<"users"> | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (roleId: Id<"jobRoles">) => void;
  onSelectUser: (user: Doc<"users">) => void;
  onRecordKpi: (kpi: Doc<"jobRoleKpis">) => void;
};

const KPI_UNIT_LABELS: Record<string, string> = {
  number: "Angka",
  percent: "%",
  currency: "Rp",
  duration: "menit",
  rating: "/5",
};

const KPI_FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Bulanan",
  quarterly: "Kuartalan",
  yearly: "Tahunan",
};

const SOP_FREQUENCY_LABELS: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  quarterly: "Kuartalan",
  adhoc: "Sesuai kebutuhan",
};

function renderMarkdownList(content: string) {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  const looksLikeList = lines.every((l) => /^[-*•]/.test(l));
  if (looksLikeList) {
    return (
      <ul className="list-inside list-disc space-y-1 text-sm">
        {lines.map((l, i) => (
          <li key={i}>{l.replace(/^[-*•]\s*/, "")}</li>
        ))}
      </ul>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
      {content}
    </p>
  );
}

export default function JobRoleDetailDialog({
  roleId,
  currentUserId,
  isAdmin,
  open,
  onOpenChange,
  onEdit,
  onSelectUser,
  onRecordKpi,
}: Props) {
  const detail = useQuery(
    api.orgAdvanced.jobRoles.getRole,
    roleId ? { roleId } : "skip",
  );

  const sopGroups = useMemo(() => {
    const sops = detail?.sops ?? [];
    const map = new Map<string, Array<Doc<"jobRoleSops">>>();
    for (const s of sops) {
      const list = map.get(s.procedureName) ?? [];
      list.push(s);
      map.set(s.procedureName, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [detail]);

  if (!roleId) return null;
  const role = detail?.role;
  const colorCls = role ? colorClasses(role.color) : colorClasses("blue");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                colorCls.bg,
                colorCls.text,
              )}
            >
              <Briefcase className="size-4" />
            </span>
            {role?.title ?? "Job Description"}
            {role ? (
              <>
                <Badge variant="secondary">v{role.version}</Badge>
                {!role.isActive ? (
                  <Badge variant="outline">Tidak Aktif</Badge>
                ) : null}
              </>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {role ? (
              <>
                {role.department || "Seluruh perusahaan"} · Level {role.level}
              </>
            ) : (
              "Memuat detail..."
            )}
          </DialogDescription>
        </DialogHeader>

        {!detail ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !role ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Job description tidak ditemukan.
          </p>
        ) : (
          <Tabs defaultValue="jobdesk">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="jobdesk" className="gap-1.5">
                <BookOpen className="size-4" />
                Jobdesk
              </TabsTrigger>
              <TabsTrigger value="sop" className="gap-1.5">
                <ListChecks className="size-4" />
                SOP ({detail.sops.length})
              </TabsTrigger>
              <TabsTrigger value="kpi" className="gap-1.5">
                <Target className="size-4" />
                KPI ({detail.kpis.length})
              </TabsTrigger>
              <TabsTrigger value="holders" className="gap-1.5">
                <Users className="size-4" />
                Pemegang ({detail.holders.length})
              </TabsTrigger>
            </TabsList>

            {/* Jobdesk */}
            <TabsContent value="jobdesk" className="space-y-4 pt-4">
              <Card>
                <CardContent className="space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Tujuan Posisi
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {role.purpose || "—"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Tanggung Jawab
                  </p>
                  {renderMarkdownList(role.responsibilities)}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Persyaratan
                  </p>
                  {renderMarkdownList(role.requirements)}
                </CardContent>
              </Card>

              {role.extraNotes ? (
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Catatan Tambahan
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {role.extraNotes}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            {/* SOP */}
            <TabsContent value="sop" className="space-y-4 pt-4">
              {sopGroups.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada SOP untuk jabatan ini.
                </p>
              ) : (
                sopGroups.map(([procedure, steps]) => (
                  <Card key={procedure}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center gap-2">
                        <ListChecks className="size-4 text-primary" />
                        <p className="text-sm font-semibold">{procedure}</p>
                        <Badge variant="secondary" className="ml-auto">
                          {steps.length} langkah
                        </Badge>
                      </div>
                      <ol className="space-y-2">
                        {steps.map((s, idx) => (
                          <li
                            key={s._id}
                            className="flex items-start gap-2 rounded-lg border bg-card p-3"
                          >
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{s.title}</p>
                              {s.description ? (
                                <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                                  {s.description}
                                </p>
                              ) : null}
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                                {s.frequency ? (
                                  <span className="rounded-md border bg-muted px-1.5 py-0.5">
                                    {SOP_FREQUENCY_LABELS[s.frequency] ??
                                      s.frequency}
                                  </span>
                                ) : null}
                                {s.ownerRole ? (
                                  <span className="rounded-md border bg-muted px-1.5 py-0.5">
                                    PIC: {s.ownerRole}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* KPI */}
            <TabsContent value="kpi" className="space-y-3 pt-4">
              {detail.kpis.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada KPI untuk jabatan ini.
                </p>
              ) : (
                detail.kpis.map((k) => (
                  <Card key={k._id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start gap-2">
                        <Target className="mt-0.5 size-4 text-violet-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{k.name}</p>
                          {k.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {k.description}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                            {k.target !== undefined ? (
                              <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-violet-600 dark:text-violet-400">
                                Target: {k.target}
                                {k.unit !== "number"
                                  ? ` ${KPI_UNIT_LABELS[k.unit] ?? k.unit}`
                                  : ""}
                              </span>
                            ) : null}
                            <span className="rounded-md border bg-muted px-1.5 py-0.5">
                              {KPI_FREQUENCY_LABELS[k.frequency] ?? k.frequency}
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5",
                                k.priority === "high"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : k.priority === "medium"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-muted",
                              )}
                            >
                              Prioritas {k.priority}
                            </span>
                            {k.weight !== undefined ? (
                              <span className="rounded-md border bg-muted px-1.5 py-0.5">
                                Bobot {k.weight}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {currentUserId &&
                        detail.holders.some(
                          (h) => h._id === currentUserId,
                        ) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => onRecordKpi(k)}
                          >
                            Catat
                          </Button>
                        ) : null}
                      </div>
                      <KpiRecentMeasurements kpiId={k._id} />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Holders */}
            <TabsContent value="holders" className="space-y-2 pt-4">
              {detail.holders.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada karyawan yang memegang jabatan ini.
                </p>
              ) : (
                detail.holders.map((h) => (
                  <button
                    key={h._id}
                    type="button"
                    onClick={() => onSelectUser(h)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                  >
                    <Avatar>
                      <AvatarImage src={h.avatarUrl} />
                      <AvatarFallback>{getInitials(h.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {h.jobTitle ?? "—"}
                        {h.department ? ` · ${h.department}` : ""}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          {isAdmin && role ? (
            <Button type="button" onClick={() => onEdit(role._id)}>
              <Edit3 className="mr-1.5 size-4" /> Kelola
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiRecentMeasurements({ kpiId }: { kpiId: Id<"jobRoleKpis"> }) {
  // Lightweight inline view: grab the 3 most recent measurements for this kpi
  // across all users via client filter on latest measurements we have.
  // Backend doesn't expose a per-kpi list, so we rely on a small query below.
  const kpiData = useQuery(
    api.orgAdvanced.jobRoles.listMeasurementsForKpi,
    { kpiId, limit: 5 },
  );

  if (kpiData === undefined) {
    return <Skeleton className="h-6 w-full" />;
  }
  if (kpiData.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-t pt-2">
      {kpiData.map((m) => {
        const icon =
          m.measurement.status === "on_track" ? (
            <CircleCheck className="size-3 text-emerald-500" />
          ) : m.measurement.status === "at_risk" ? (
            <CircleAlert className="size-3 text-amber-500" />
          ) : (
            <CircleX className="size-3 text-rose-500" />
          );
        return (
          <span
            key={m.measurement._id}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px]"
          >
            {icon}
            <span className="font-medium">
              {m.user?.name ?? "—"}
            </span>
            <span className="text-muted-foreground">
              {m.measurement.periodLabel}: {m.measurement.actualValue}
            </span>
          </span>
        );
      })}
    </div>
  );
}
