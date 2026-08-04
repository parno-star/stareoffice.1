import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  Plus,
  Route,
  Search,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import CompetencyFormDialog, {
  CompetencyCoursesDialog,
} from "./CompetencyFormDialog.tsx";
import CareerTrackFormDialog from "./CareerTrackFormDialog.tsx";
import CareerLevelFormDialog from "./CareerLevelFormDialog.tsx";
import CareerAssignmentDialog from "./CareerAssignmentDialog.tsx";

function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex size-10 items-center justify-center rounded-lg ${tone}`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CompetenciesTab() {
  const competencies = useQuery(api.training.careers.listCompetencies, {});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const courses = useQuery(api.courses.listCourses, { filter: "all" });

  const filtered = useMemo(() => {
    if (!competencies) return [];
    return competencies.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [competencies, category, search]);

  if (competencies === undefined) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kompetensi..."
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full cursor-pointer sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            <SelectItem value="technical">Teknis</SelectItem>
            <SelectItem value="leadership">Kepemimpinan</SelectItem>
            <SelectItem value="soft_skills">Soft skills</SelectItem>
            <SelectItem value="product">Produk</SelectItem>
            <SelectItem value="compliance">Kepatuhan</SelectItem>
            <SelectItem value="domain">Domain</SelectItem>
            <SelectItem value="other">Lainnya</SelectItem>
          </SelectContent>
        </Select>
        <CompetencyFormDialog
          trigger={
            <Button size="sm" className="cursor-pointer gap-1">
              <Plus className="size-4" />
              Kompetensi
            </Button>
          }
        />
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BrainCircuit />
            </EmptyMedia>
            <EmptyTitle>Belum ada kompetensi</EmptyTitle>
            <EmptyDescription>
              Mulai dengan mendefinisikan kompetensi inti beserta 5 level
              perilakunya.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CompetencyFormDialog
              trigger={
                <Button size="sm" className="cursor-pointer gap-1">
                  <Plus className="size-4" />
                  Buat kompetensi
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c._id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {c.icon ? <span className="text-xl">{c.icon}</span> : null}
                      <h4 className="truncate font-semibold">{c.name}</h4>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  </div>
                  {!c.isActive ? (
                    <Badge variant="secondary">Nonaktif</Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {c.category}
                  </Badge>
                </div>
                <div className="flex gap-2 border-t pt-3">
                  <CompetencyFormDialog
                    competency={c}
                    trigger={
                      <Button
                        size="sm"
                        variant="secondary"
                        className="cursor-pointer"
                      >
                        Ubah
                      </Button>
                    }
                  />
                  <CompetencyCoursesDialog
                    competencyId={c._id}
                    allCourses={(courses ?? []) as Array<Doc<"courses">>}
                    trigger={
                      <Button
                        size="sm"
                        variant="secondary"
                        className="cursor-pointer gap-1"
                      >
                        <BookOpen className="size-3.5" />
                        Kelas
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LevelExpectationDialog({
  levelId,
  trackId: _trackId,
  existing,
  competencies,
  onClose,
}: {
  levelId: Id<"careerLevels">;
  trackId: Id<"careerTracks">;
  existing: Array<
    Doc<"careerLevelCompetencies"> & { competency: Doc<"competencies"> | null }
  >;
  competencies: Array<Doc<"competencies">>;
  onClose: () => void;
}) {
  const [competencyId, setCompetencyId] = useState<string>("");
  const [expectedLevel, setExpectedLevel] = useState(3);
  const save = useMutation(api.training.careers.setLevelExpectation);
  const remove = useMutation(api.training.careers.removeLevelExpectation);

  const addExpectation = async () => {
    if (!competencyId) {
      toast.error("Pilih kompetensi");
      return;
    }
    try {
      await save({
        levelId,
        competencyId: competencyId as Id<"competencies">,
        expectedLevel,
      });
      toast.success("Ekspektasi disimpan");
      setCompetencyId("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    }
  };

  const handleRemove = async (id: Id<"careerLevelCompetencies">) => {
    if (!window.confirm("Hapus ekspektasi ini?")) return;
    try {
      await remove({ id });
      toast.success("Ekspektasi dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kompetensi level</DialogTitle>
          <DialogDescription>
            Definisikan kompetensi apa saja yang dibutuhkan dan level
            minimalnya.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <Select value={competencyId} onValueChange={setCompetencyId}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Pilih kompetensi..." />
            </SelectTrigger>
            <SelectContent>
              {competencies
                .filter(
                  (c) => !existing.some((e) => e.competencyId === c._id),
                )
                .map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={String(expectedLevel)}
            onValueChange={(v) => setExpectedLevel(Number(v))}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((v) => (
                <SelectItem key={v} value={String(v)}>
                  Level {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addExpectation} className="cursor-pointer gap-1">
            <Plus className="size-4" /> Tambah
          </Button>
        </div>

        <div className="space-y-2">
          {existing.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Belum ada kompetensi di level ini.
            </p>
          ) : (
            existing.map((e) => (
              <div
                key={e._id}
                className="flex items-center justify-between gap-2 rounded-md border p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {e.competency?.name ?? "Kompetensi dihapus"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Level minimal: {e.expectedLevel}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemove(e._id)}
                  className="cursor-pointer text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="cursor-pointer">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrackDetailPanel({ trackId }: { trackId: Id<"careerTracks"> }) {
  const detail = useQuery(api.training.careers.getTrackDetail, {
    id: trackId,
  });
  const competencies = useQuery(api.training.careers.listCompetencies, {
    activeOnly: true,
  });
  const reorder = useMutation(api.training.careers.reorderLevel);
  const [expandLevel, setExpandLevel] = useState<Id<"careerLevels"> | null>(
    null,
  );

  if (detail === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (detail === null) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {detail.track.icon ? <span>{detail.track.icon}</span> : null}
            {detail.track.name}
            {!detail.track.isActive ? (
              <Badge variant="secondary">Nonaktif</Badge>
            ) : null}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {detail.track.description}
          </p>
        </div>
        <CareerLevelFormDialog
          trackId={trackId}
          trigger={
            <Button size="sm" className="cursor-pointer gap-1">
              <Plus className="size-4" /> Level
            </Button>
          }
        />
      </div>

      {detail.levels.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Target />
            </EmptyMedia>
            <EmptyTitle>Belum ada level</EmptyTitle>
            <EmptyDescription>
              Tambahkan minimal 2 level untuk membuat tangga karir yang
              bermakna.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="space-y-2">
          {detail.levels.map((lv, idx) => (
            <li
              key={lv._id}
              className="rounded-lg border bg-card p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                  {lv.order}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{lv.title}</h4>
                    <Badge variant="secondary" className="capitalize">
                      {lv.levelGrade}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {lv.minYearsInLevel !== undefined ? (
                      <span>Min. {lv.minYearsInLevel} thn</span>
                    ) : null}
                    {lv.salaryMin && lv.salaryMax ? (
                      <span>
                        Rp{(lv.salaryMin / 1_000_000).toFixed(1)}jt - Rp
                        {(lv.salaryMax / 1_000_000).toFixed(1)}jt
                      </span>
                    ) : null}
                    <span>
                      {lv.expectations.length} ekspektasi kompetensi
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={async () => {
                      try {
                        await reorder({ id: lv._id, direction: "up" });
                      } catch {
                        toast.error("Gagal mengurutkan");
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={idx === detail.levels.length - 1}
                    onClick={async () => {
                      try {
                        await reorder({ id: lv._id, direction: "down" });
                      } catch {
                        toast.error("Gagal mengurutkan");
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <CareerLevelFormDialog
                    trackId={trackId}
                    level={{
                      _id: lv._id,
                      _creationTime: lv._creationTime,
                      trackId: lv.trackId,
                      order: lv.order,
                      title: lv.title,
                      levelGrade: lv.levelGrade,
                      description: lv.description,
                      minYearsInLevel: lv.minYearsInLevel,
                      salaryMin: lv.salaryMin,
                      salaryMax: lv.salaryMax,
                      expectations: lv.expectationsText,
                    }}
                    trigger={
                      <Button
                        size="sm"
                        variant="secondary"
                        className="cursor-pointer"
                      >
                        Ubah
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => setExpandLevel(lv._id)}
                  >
                    <Target className="size-3.5" />
                    Kompetensi
                  </Button>
                </div>
              </div>
              {lv.expectations.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                  {lv.expectations.map((e) => (
                    <Badge
                      key={e._id}
                      variant="secondary"
                      className="text-[11px]"
                    >
                      {e.competency?.name ?? "?"} · L{e.expectedLevel}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {expandLevel === lv._id ? (
                <LevelExpectationDialog
                  levelId={lv._id}
                  trackId={trackId}
                  existing={lv.expectations}
                  competencies={competencies ?? []}
                  onClose={() => setExpandLevel(null)}
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TracksTab() {
  const tracks = useQuery(api.training.careers.listTracks, {});
  const departments = useQuery(api.users.listDepartments, {});
  const [selected, setSelected] = useState<Id<"careerTracks"> | null>(null);

  if (tracks === undefined) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Route />
          </EmptyMedia>
          <EmptyTitle>Belum ada jalur karir</EmptyTitle>
          <EmptyDescription>
            Buat jalur karir pertama - misalnya Software Engineering, HR
            Operations, atau Marketing.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <CareerTrackFormDialog
            departments={departments ?? []}
            trigger={
              <Button size="sm" className="cursor-pointer gap-1">
                <Plus className="size-4" /> Jalur karir
              </Button>
            }
          />
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Semua Jalur</h3>
          <CareerTrackFormDialog
            departments={departments ?? []}
            trigger={
              <Button size="sm" className="cursor-pointer gap-1">
                <Plus className="size-4" /> Baru
              </Button>
            }
          />
        </div>
        <div className="space-y-1.5">
          {tracks.map((t) => {
            const isActive = selected === t._id;
            return (
              <button
                key={t._id}
                onClick={() => setSelected(t._id)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {t.icon ? <span>{t.icon}</span> : null}
                    {t.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.department || "Semua departemen"} · {t.levels.length}{" "}
                    level
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          {selected ? (
            <TrackDetailPanel trackId={selected} />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Route className="size-10" />
              <p className="text-sm">Pilih jalur karir untuk melihat detail.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssignmentsTab() {
  const assignments = useQuery(api.training.careers.listAssignments, {});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!assignments) return [];
    const q = search.toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const name = (a.user?.name ?? "").toLowerCase();
      const track = (a.track?.name ?? "").toLowerCase();
      return name.includes(q) || track.includes(q);
    });
  }, [assignments, search]);

  if (assignments === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau jalur..."
            className="pl-9"
          />
        </div>
        <CareerAssignmentDialog
          trigger={
            <Button size="sm" className="cursor-pointer gap-1">
              <Plus className="size-4" /> Tugaskan
            </Button>
          }
        />
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Belum ada penugasan</EmptyTitle>
            <EmptyDescription>
              Tugaskan jalur karir ke karyawan agar mereka bisa melihat
              ekspektasi dan gap kompetensi.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <CareerAssignmentDialog
              key={a.assignment._id}
              assignment={a}
              trigger={
                <button className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40">
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={a.user?.avatarUrl} />
                    <AvatarFallback>
                      {(a.user?.name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {a.user?.name ?? "Karyawan dihapus"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.track?.name ?? "-"} · {a.currentLevel?.title ?? "-"}
                      {a.targetLevel ? (
                        <>
                          {" "}
                          <ChevronRight className="inline size-3" />{" "}
                          {a.targetLevel.title}
                        </>
                      ) : null}
                    </p>
                  </div>
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CareerAdminPanel() {
  const stats = useQuery(api.training.careers.getCareerStats, {});

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats === undefined ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : (
          <>
            <StatPill
              icon={BrainCircuit}
              label="Kompetensi"
              value={String(stats.competencyCount)}
              tone="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            />
            <StatPill
              icon={Route}
              label="Jalur Karir"
              value={String(stats.trackCount)}
              tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            />
            <StatPill
              icon={Users}
              label="Karyawan Terdaftar"
              value={`${stats.assignedUsers}/${stats.totalUsers}`}
              tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
            <StatPill
              icon={Target}
              label="Rata-rata Readiness"
              value={`${stats.averageReadiness}%`}
              tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <StatPill
              icon={GraduationCap}
              label="Karyawan tanpa jalur"
              value={String(
                Math.max(0, stats.totalUsers - stats.assignedUsers),
              )}
              tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="tracks" className="space-y-4">
        <TabsList className="no-scrollbar flex h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="tracks" className="cursor-pointer gap-1">
            <Route className="size-3.5" /> Jalur & Level
          </TabsTrigger>
          <TabsTrigger value="competencies" className="cursor-pointer gap-1">
            <LayoutGrid className="size-3.5" /> Kompetensi
          </TabsTrigger>
          <TabsTrigger value="assignments" className="cursor-pointer gap-1">
            <Users className="size-3.5" /> Penugasan
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tracks">
          <TracksTab />
        </TabsContent>
        <TabsContent value="competencies">
          <CompetenciesTab />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
