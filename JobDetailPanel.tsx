import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Users,
  CalendarDays,
  Trash2,
  Star,
  X as XIcon,
} from "lucide-react";
import JobFormDialog from "./JobFormDialog.tsx";
import ApplicationDetailPanel from "./ApplicationDetailPanel.tsx";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  JOB_STATUS_CONFIG,
  LEVELS,
  PIPELINE_STAGES,
  RECRUITMENT_STAGES,
  STAGE_CONFIG,
  formatSalaryRange,
  type JobStatus,
  type RecruitmentStage,
} from "../_lib/recruitment-utils.ts";

function labelOf(
  collection: ReadonlyArray<{ value: string; label: string }>,
  value: string,
): string {
  return collection.find((c) => c.value === value)?.label ?? value;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

export default function JobDetailPanel({
  jobId,
  onBack,
}: {
  jobId: Id<"recruitmentJobs">;
  onBack: () => void;
}) {
  const job = useQuery(api.recruitment.jobs.getById, { id: jobId });
  const pipeline = useQuery(api.recruitment.applications.getPipeline, { jobId });
  const setStatus = useMutation(api.recruitment.jobs.setStatus);
  const remove = useMutation(api.recruitment.jobs.remove);
  const setStage = useMutation(api.recruitment.applications.setStage);
  const bulkSetStage = useMutation(api.recruitment.applications.bulkSetStage);

  const [openApp, setOpenApp] = useState<Id<"candidateApplications"> | null>(
    null,
  );
  const [selection, setSelection] = useState<
    Set<Id<"candidateApplications">>
  >(new Set());
  const [bulkStage, setBulkStage] = useState<string>("none");

  const toggleSelect = (id: Id<"candidateApplications">) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelection(new Set());

  const status = job?.status as JobStatus | undefined;
  const statusConfig = status
    ? JOB_STATUS_CONFIG[status]
    : JOB_STATUS_CONFIG.open;

  const totalPipeline = useMemo(() => {
    if (!pipeline) return 0;
    return PIPELINE_STAGES.reduce(
      (sum, stage) => sum + pipeline[stage].length,
      0,
    );
  }, [pipeline]);

  const handleChangeStatus = async (newStatus: string) => {
    try {
      await setStatus({ id: jobId, status: newStatus });
      toast.success("Status lowongan diperbarui");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  const handleRemoveJob = async () => {
    if (!confirm("Hapus lowongan ini? Semua lamaran akan dihapus.")) return;
    try {
      await remove({ id: jobId });
      toast.success("Lowongan dihapus");
      onBack();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  const handleStageChange = async (
    id: Id<"candidateApplications">,
    stage: RecruitmentStage,
  ) => {
    try {
      await setStage({ id, stage });
      toast.success(`Dipindah ke ${STAGE_CONFIG[stage].label}`);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      }
    }
  };

  const handleBulkStage = async () => {
    if (bulkStage === "none" || selection.size === 0) return;
    try {
      const { count } = await bulkSetStage({
        ids: [...selection],
        stage: bulkStage,
      });
      toast.success(
        `${count} lamaran dipindah ke ${STAGE_CONFIG[bulkStage as RecruitmentStage].label}`,
      );
      clearSelection();
      setBulkStage("none");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      } else {
        toast.error("Gagal memproses");
      }
    }
  };

  if (job === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (job === null) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Lowongan tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{job.title}</h2>
                <Badge variant="outline" className={statusConfig.badge}>
                  {statusConfig.label}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="size-3.5" />
                  {job.department}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {job.location}
                </span>
                <span>
                  {labelOf(EMPLOYMENT_TYPES, job.employmentType)} ·{" "}
                  {labelOf(LEVELS, job.level)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {job.candidateCount} kandidat
                </span>
                {job.closingDate ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    Tutup {job.closingDate}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-medium">
                {formatSalaryRange(job.salaryMin, job.salaryMax)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recruiter: {job.recruiterName ?? "-"} · Hiring manager:{" "}
                {job.hiringManagerName ?? "-"} · {job.hiredCount}/{job.headcount}{" "}
                posisi terisi
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={job.status} onValueChange={handleChangeStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {JOB_STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <JobFormDialog
                mode="edit"
                job={{
                  _id: job._id,
                  title: job.title,
                  department: job.department,
                  location: job.location,
                  employmentType: job.employmentType,
                  level: job.level,
                  description: job.description,
                  responsibilities: job.responsibilities,
                  requirements: job.requirements,
                  salaryMin: job.salaryMin,
                  salaryMax: job.salaryMax,
                  openingDate: job.openingDate,
                  closingDate: job.closingDate,
                  headcount: job.headcount,
                  status: job.status,
                  hiringManagerId: job.hiringManagerId,
                  recruiterId: job.recruiterId,
                  internalNote: job.internalNote,
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer text-red-600 hover:text-red-600"
                onClick={handleRemoveJob}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {job.description ? (
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deskripsi
              </p>
              <p className="whitespace-pre-wrap text-sm">{job.description}</p>
            </CardContent>
          </Card>
        ) : null}
        {job.responsibilities ? (
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tanggung jawab
              </p>
              <p className="whitespace-pre-wrap text-sm">
                {job.responsibilities}
              </p>
            </CardContent>
          </Card>
        ) : null}
        {job.requirements ? (
          <Card>
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kualifikasi
              </p>
              <p className="whitespace-pre-wrap text-sm">{job.requirements}</p>
            </CardContent>
          </Card>
        ) : null}
        {job.internalNote ? (
          <Card className="border-amber-300/60 bg-amber-500/5">
            <CardContent className="p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Catatan internal
              </p>
              <p className="whitespace-pre-wrap text-sm">{job.internalNote}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Pipeline ({totalPipeline} kandidat)
          </h3>
          {selection.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selection.size} dipilih
              </span>
              <Select value={bulkStage} onValueChange={setBulkStage}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Pindah ke tahap..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    Pindah ke tahap...
                  </SelectItem>
                  {RECRUITMENT_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkStage}
                disabled={bulkStage === "none"}
                className="cursor-pointer"
              >
                Terapkan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="cursor-pointer"
              >
                Batal Pilih
              </Button>
            </div>
          ) : null}
        </div>
        {pipeline === undefined ? (
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {PIPELINE_STAGES.map((s) => (
              <Skeleton key={s} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {PIPELINE_STAGES.map((stage) => {
              const cards = pipeline[stage];
              const cfg = STAGE_CONFIG[stage];
              return (
                <div
                  key={stage}
                  className={`space-y-2 rounded-lg border p-2 ${cfg.column}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {cfg.label}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {cards.length}
                    </Badge>
                  </div>
                  {cards.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                      —
                    </p>
                  ) : (
                    cards.map((app) => (
                      <Card
                        key={app._id}
                        className={`cursor-pointer ${selection.has(app._id) ? "ring-2 ring-primary" : ""}`}
                        onClick={() => setOpenApp(app._id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div
                              className="pt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selection.has(app._id)}
                                onCheckedChange={() => toggleSelect(app._id)}
                                aria-label="Pilih lamaran"
                                className="cursor-pointer"
                              />
                            </div>
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">
                                {initialsOf(app.candidateName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {app.candidateName}
                              </p>
                              {app.candidateCurrentTitle ? (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {app.candidateCurrentTitle}
                                </p>
                              ) : null}
                              {app.rating ? (
                                <div className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                                  <Star className="size-3 fill-current" />
                                  {app.rating.toFixed(1)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div
                            className="mt-2 flex flex-wrap gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Select
                              value={stage}
                              onValueChange={(v) =>
                                handleStageChange(
                                  app._id,
                                  v as RecruitmentStage,
                                )
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RECRUITMENT_STAGES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STAGE_CONFIG[s].label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Also show rejected/withdrawn as small list */}
        {pipeline &&
        (pipeline.rejected.length > 0 || pipeline.withdrawn.length > 0) ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ditutup ({pipeline.rejected.length + pipeline.withdrawn.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {[...pipeline.rejected, ...pipeline.withdrawn].map((app) => {
                const s = app.stage as RecruitmentStage;
                return (
                  <button
                    key={app._id}
                    onClick={() => setOpenApp(app._id)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs hover:border-primary/40"
                  >
                    <XIcon className="size-3 text-muted-foreground" />
                    <span>{app.candidateName}</span>
                    <Badge
                      variant="outline"
                      className={STAGE_CONFIG[s].badge + " text-[10px]"}
                    >
                      {STAGE_CONFIG[s].label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <ApplicationDetailPanel
        applicationId={openApp}
        onClose={() => setOpenApp(null)}
      />
    </div>
  );
}
