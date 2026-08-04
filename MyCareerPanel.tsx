import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Milestone,
  Sparkles,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

function LevelDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={
            i < value
              ? "size-2 rounded-full bg-primary"
              : "size-2 rounded-full bg-muted"
          }
        />
      ))}
    </span>
  );
}

function SelfAssessDialog({
  competency,
  currentSelf,
}: {
  competency: Doc<"competencies">;
  currentSelf: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<string>(
    currentSelf ? String(currentSelf) : "3",
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const save = useMutation(api.training.careers.saveSelfAssessment);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        competencyId: competency._id,
        level: Number(level),
        notes: notes.trim() || undefined,
      });
      toast.success("Penilaian diri disimpan");
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="secondary"
        className="cursor-pointer"
        onClick={() => setOpen(true)}
      >
        {currentSelf ? "Perbarui" : "Nilai sendiri"}
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{competency.name}</DialogTitle>
          <DialogDescription>{competency.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Level Anda saat ini</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((v) => (
                  <SelectItem key={v} value={String(v)}>
                    Level {v} -{" "}
                    {competency.levelDescriptors[v - 1]?.split(" - ")[0] ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium">Level {level} - deskripsi:</p>
            <p className="mt-1 text-muted-foreground">
              {competency.levelDescriptors[Number(level) - 1]}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Catatan pendukung (opsional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contoh: memimpin 2 proyek lintas tim di Q1..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GapCard({
  gap,
}: {
  gap: {
    competency: Doc<"competencies">;
    expectedLevel: number;
    currentLevel: number;
    selfLevel: number | null;
    managerLevel: number | null;
    courseLevel: number | null;
    gap: number;
    recommendedCourses: Array<{ courseId: Id<"courses">; title: string }>;
  };
}) {
  const percent = Math.min(
    100,
    Math.round((gap.currentLevel / Math.max(1, gap.expectedLevel)) * 100),
  );
  const isMet = gap.gap === 0;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {gap.competency.icon ? (
                <span className="text-lg">{gap.competency.icon}</span>
              ) : null}
              <h4 className="truncate font-semibold">
                {gap.competency.name}
              </h4>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {gap.competency.description}
            </p>
          </div>
          {isMet ? (
            <Badge className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mr-1 size-3" /> Terpenuhi
            </Badge>
          ) : (
            <Badge className="shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Gap {gap.gap}
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Level saat ini: {gap.currentLevel}
            </span>
            <span className="font-medium">
              Target: {gap.expectedLevel}
            </span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3" />
            Diri: {gap.selfLevel ?? "-"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3" />
            Atasan: {gap.managerLevel ?? "-"}
          </span>
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-3" />
            Kelas: {gap.courseLevel ?? "-"}
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <LevelDots value={gap.currentLevel} />
          <SelfAssessDialog
            competency={gap.competency}
            currentSelf={gap.selfLevel}
          />
        </div>

        {gap.recommendedCourses.length > 0 && !isMet ? (
          <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <BookOpen className="size-3.5" />
              Rekomendasi kelas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gap.recommendedCourses.slice(0, 3).map((c) => (
                <Link
                  key={c.courseId}
                  to={`/training/${c.courseId}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-background px-2 py-1 text-[11px] font-medium hover:bg-primary/10"
                >
                  <span className="truncate">{c.title}</span>
                  <ChevronRight className="size-3 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function MyCareerPanel() {
  const overview = useQuery(api.training.careers.getMyCareerOverview, {});

  if (overview === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview.assignment || !overview.track || !overview.currentLevel) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Milestone />
          </EmptyMedia>
          <EmptyTitle>Belum terdaftar pada jalur karir</EmptyTitle>
          <EmptyDescription>
            Hubungi admin HR untuk menetapkan jalur karir dan level Anda saat
            ini sehingga Anda dapat melihat ekspektasi dan gap kompetensi.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { track, currentLevel, targetLevel, allLevels, targetGaps, readinessPercent } =
    overview;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="overflow-hidden border-0">
        <CardContent className="bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                Jalur Karir
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {track.icon ? `${track.icon} ` : ""}
                {track.name}
              </h2>
              {track.department ? (
                <p className="mt-1 text-sm text-white/85">{track.department}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="flex size-20 items-center justify-center rounded-full border-4 border-white/30 bg-white/10 backdrop-blur-sm">
                  <div>
                    <p className="text-2xl font-bold leading-none">
                      {readinessPercent}%
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-white/80">
                      Readiness
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm">
            <Badge className="bg-white/20 text-white hover:bg-white/30">
              Saat ini: {currentLevel.title}
            </Badge>
            <ArrowRight className="size-4 text-white/80" />
            <Badge className="bg-white/20 text-white hover:bg-white/30">
              Target:{" "}
              {targetLevel ? targetLevel.title : "Belum ditentukan"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Ladder */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="font-semibold">Tangga Karir</h3>
          </div>
          <ol className="relative space-y-3">
            {allLevels.map((lv) => {
              const isCurrent = lv._id === currentLevel._id;
              const isTarget = targetLevel && lv._id === targetLevel._id;
              const isPast = lv.order < currentLevel.order;
              return (
                <li
                  key={lv._id}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : isTarget
                        ? "border-fuchsia-500/60 bg-fuchsia-500/5"
                        : "bg-card"
                  }`}
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isPast
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : isCurrent
                          ? "bg-primary text-primary-foreground"
                          : isTarget
                            ? "bg-fuchsia-500 text-white"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {lv.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{lv.title}</h4>
                      {isCurrent ? (
                        <Badge className="bg-primary/15 text-primary">
                          Anda di sini
                        </Badge>
                      ) : null}
                      {isTarget ? (
                        <Badge className="bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300">
                          Target
                        </Badge>
                      ) : null}
                    </div>
                    {lv.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {lv.description}
                      </p>
                    ) : null}
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
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Target level expectations */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              Ekspektasi untuk{" "}
              {targetLevel ? targetLevel.title : currentLevel.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              Kompetensi yang harus dicapai untuk promosi. Perbarui level Anda
              kapan saja.
            </p>
          </div>
        </div>
        {targetGaps.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles />
              </EmptyMedia>
              <EmptyTitle>Belum ada ekspektasi</EmptyTitle>
              <EmptyDescription>
                Admin belum menetapkan kompetensi untuk level ini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {targetGaps.map((g) => (
              <GapCard key={g.competency._id} gap={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
