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
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Briefcase,
  Plus,
  ListChecks,
  Target,
  Users,
  Search,
  Sparkles,
  CircleCheck,
  CircleAlert,
  CircleX,
  BookOpen,
  Edit3,
  ClipboardList,
} from "lucide-react";
import JobRoleEditorDialog from "./JobRoleEditorDialog.tsx";
import JobRoleDetailDialog from "./JobRoleDetailDialog.tsx";
import KpiMeasurementDialog from "./KpiMeasurementDialog.tsx";
import { colorClasses } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  allUsers: Array<Doc<"users">>;
  currentUser: Doc<"users"> | null;
  isAdmin: boolean;
  onSelectUser: (user: Doc<"users">) => void;
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: "primary" | "emerald" | "amber" | "rose" | "violet";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
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
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobDescPanel({
  allUsers,
  currentUser,
  isAdmin,
  onSelectUser,
}: Props) {
  const roles = useQuery(api.orgAdvanced.jobRoles.listRoles, {});
  const kpiSummary = useQuery(api.orgAdvanced.jobRoles.getKpiSummary, {});
  const myRole = useQuery(
    api.orgAdvanced.jobRoles.getRoleForUser,
    currentUser ? { userId: currentUser._id } : "skip",
  );
  const myMeasurements = useQuery(
    api.orgAdvanced.jobRoles.listMeasurementsForUser,
    currentUser ? { userId: currentUser._id } : "skip",
  );

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<Id<"jobRoles"> | null>(
    null,
  );
  const [detailRoleId, setDetailRoleId] = useState<Id<"jobRoles"> | null>(null);
  const [measurementKpi, setMeasurementKpi] =
    useState<Doc<"jobRoleKpis"> | null>(null);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of allUsers) {
      if (u.department && u.department.trim().length > 0) {
        set.add(u.department.trim());
      }
    }
    return Array.from(set).sort();
  }, [allUsers]);

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    const q = search.trim().toLowerCase();
    return roles.filter((r) => {
      if (departmentFilter === "__company__") {
        if (r.role.department !== "") return false;
      } else if (departmentFilter !== "all") {
        if (r.role.department !== departmentFilter) return false;
      }
      if (!q) return true;
      return (
        r.role.title.toLowerCase().includes(q) ||
        r.role.department.toLowerCase().includes(q) ||
        r.role.purpose.toLowerCase().includes(q)
      );
    });
  }, [roles, search, departmentFilter]);

  const handleCreateNew = () => {
    setEditingRoleId(null);
    setEditorOpen(true);
  };

  const handleEdit = (roleId: Id<"jobRoles">) => {
    setEditingRoleId(roleId);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-primary" />
          <p className="text-sm font-semibold">
            Jobdesk, SOP & KPI Perusahaan
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" className="gap-1.5" onClick={handleCreateNew}>
            <Plus className="size-4" />
            Job Description Baru
          </Button>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpiSummary === undefined ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : (
          <>
            <StatCard
              icon={Briefcase}
              label="Job Description"
              value={kpiSummary.totalRoles}
              tone="primary"
            />
            <StatCard
              icon={Target}
              label="Total KPI"
              value={kpiSummary.totalKpis}
              tone="violet"
            />
            <StatCard
              icon={CircleCheck}
              label="KPI On Track"
              value={kpiSummary.onTrack}
              tone="emerald"
            />
            <StatCard
              icon={CircleAlert}
              label="KPI Berisiko"
              value={kpiSummary.atRisk}
              tone="amber"
            />
            <StatCard
              icon={CircleX}
              label="KPI Off Track"
              value={kpiSummary.offTrack}
              tone="rose"
            />
          </>
        )}
      </div>

      {/* Personal KPI snapshot */}
      {currentUser ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Jobdesk & KPI Saya
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myRole === undefined ? (
              <Skeleton className="h-24 w-full" />
            ) : !myRole.role ? (
              <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                Job description untuk jabatan{" "}
                <span className="font-medium text-foreground">
                  {currentUser.jobTitle ?? "Anda"}
                </span>{" "}
                belum didefinisikan.{" "}
                {isAdmin
                  ? "Silakan buat dari daftar di bawah."
                  : "Hubungi admin untuk mencatatnya."}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      colorClasses(myRole.role.color).bg,
                      colorClasses(myRole.role.color).text,
                    )}
                  >
                    <Briefcase className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {myRole.role.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {myRole.role.department || "Seluruh perusahaan"} · Versi{" "}
                      {myRole.role.version}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {myRole.role.purpose}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDetailRoleId(myRole.role?._id ?? null)}
                  >
                    <BookOpen className="mr-1.5 size-3.5" />
                    Baca
                  </Button>
                </div>
                {myRole.kpis.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      KPI Saya ({myRole.kpis.length})
                    </p>
                    {myRole.kpis.slice(0, 3).map((k) => {
                      const latest = (myMeasurements ?? []).find(
                        (m) => m.measurement.kpiId === k._id,
                      );
                      const status = latest?.measurement.status;
                      return (
                        <button
                          key={k._id}
                          type="button"
                          onClick={() => setMeasurementKpi(k)}
                          className="flex w-full items-center gap-2 rounded-md border bg-card p-2 text-left text-xs transition hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                        >
                          <Target className="size-3.5 text-violet-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{k.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Target {k.target ?? "—"} · Terakhir{" "}
                              {latest
                                ? `${latest.measurement.actualValue} (${latest.measurement.periodLabel})`
                                : "belum ada"}
                            </p>
                          </div>
                          {status ? (
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                                status === "on_track"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : status === "at_risk"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {status === "on_track"
                                ? "On Track"
                                : status === "at_risk"
                                  ? "Berisiko"
                                  : "Off Track"}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="shrink-0">
                              Catat
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                    {myRole.kpis.length > 3 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() =>
                          setDetailRoleId(myRole.role?._id ?? null)
                        }
                      >
                        Lihat semua {myRole.kpis.length} KPI
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari jabatan atau departemen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={departmentFilter}
          onValueChange={setDepartmentFilter}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Semua departemen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Departemen</SelectItem>
            <SelectItem value="__company__">Seluruh perusahaan</SelectItem>
            {departmentOptions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Roles list */}
      {roles === undefined ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filteredRoles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>
              {roles.length === 0
                ? "Belum ada job description"
                : "Tidak ada yang cocok"}
            </EmptyTitle>
            <EmptyDescription>
              {roles.length === 0
                ? "Mulai dengan membuat deskripsi jabatan, SOP, dan KPI untuk setiap posisi."
                : "Coba kata kunci lain atau ubah filter departemen."}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && roles.length === 0 ? (
            <EmptyContent>
              <Button size="sm" onClick={handleCreateNew}>
                <Plus className="mr-1.5 size-4" /> Job Description Baru
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredRoles.map(({ role, sopCount, kpiCount, holderCount }) => {
            const colorCls = colorClasses(role.color);
            return (
              <Card
                key={role._id}
                onClick={() => setDetailRoleId(role._id)}
                className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        colorCls.bg,
                        colorCls.text,
                      )}
                    >
                      <Briefcase className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {role.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {role.department || "Seluruh perusahaan"} ·{" "}
                        {role.level}
                      </p>
                    </div>
                    {!role.isActive ? (
                      <Badge variant="outline" className="shrink-0">
                        Tidak Aktif
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        v{role.version}
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {role.purpose || "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1">
                      <ListChecks className="size-3" /> {sopCount} SOP
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1">
                      <Target className="size-3" /> {kpiCount} KPI
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1">
                      <Users className="size-3" /> {holderCount} orang
                    </span>
                    {isAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7 gap-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(role._id);
                        }}
                      >
                        <Edit3 className="size-3.5" /> Ubah
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <JobRoleEditorDialog
        roleId={editingRoleId}
        departments={departmentOptions}
        open={editorOpen}
        onOpenChange={(v) => {
          setEditorOpen(v);
          if (!v) setEditingRoleId(null);
        }}
        onCreated={(newId) => {
          setEditingRoleId(newId);
        }}
      />

      <JobRoleDetailDialog
        roleId={detailRoleId}
        currentUserId={currentUser?._id ?? null}
        isAdmin={isAdmin}
        open={detailRoleId !== null}
        onOpenChange={(v) => {
          if (!v) setDetailRoleId(null);
        }}
        onEdit={(rid) => {
          setDetailRoleId(null);
          handleEdit(rid);
        }}
        onSelectUser={onSelectUser}
        onRecordKpi={(k) => setMeasurementKpi(k)}
      />

      <KpiMeasurementDialog
        kpi={measurementKpi}
        user={currentUser}
        open={measurementKpi !== null}
        onOpenChange={(v) => {
          if (!v) setMeasurementKpi(null);
        }}
      />
    </div>
  );
}
