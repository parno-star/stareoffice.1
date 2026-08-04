import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  Wallet,
  Users as UsersIcon,
  Lock,
  Unlock,
  Trash2,
  UserCheck,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import MarkdownContent from "@/pages/wiki/_components/MarkdownContent.tsx";
import {
  formatJobDate,
  formatSalaryRange,
  getApplicationStatusConfig,
  getEmploymentTypeConfig,
  getLevelConfig,
  getStatusConfig,
  isJobClosed,
} from "./_lib/job-utils.ts";
import JobFormDialog from "./_components/JobFormDialog.tsx";
import ApplyJobDialog from "./_components/ApplyJobDialog.tsx";
import ApplicantCard from "./_components/ApplicantCard.tsx";

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applicantStatusFilter, setApplicantStatusFilter] = useState("all");

  const id = jobId as Id<"jobPostings">;
  const job = useQuery(api.jobs.getById, jobId ? { id } : "skip");
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const stats = useQuery(api.jobs.getStats, {});

  const canManage =
    job !== undefined &&
    job !== null &&
    currentUser !== undefined &&
    currentUser !== null &&
    (currentUser._id === job.postedById ||
      currentUser._id === job.hiringManagerId ||
      currentUser.role === "super_admin" ||
      currentUser.role === "admin");

  const applications = useQuery(
    api.jobs.listApplicationsForJob,
    canManage && jobId
      ? { jobId: id, status: applicantStatusFilter }
      : "skip",
  );

  const setStatus = useMutation(api.jobs.setStatus);
  const remove = useMutation(api.jobs.remove);
  const withdraw = useMutation(api.jobs.withdraw);

  if (job === undefined || currentUser === undefined || stats === undefined) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/jobs")}
          className="mb-4 gap-1 cursor-pointer"
        >
          <ArrowLeft className="size-4" /> Kembali
        </Button>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle />
            </EmptyMedia>
            <EmptyTitle>Lowongan tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Lowongan ini mungkin sudah dihapus atau tidak tersedia lagi.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const employment = getEmploymentTypeConfig(job.employmentType);
  const level = getLevelConfig(job.level);
  const status = getStatusConfig(job.status);
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax);
  const closed = job.status !== "open" || isJobClosed(job.closingDate);
  const alreadyApplied = job.myApplicationStatus !== null;
  const myAppStatusCfg = job.myApplicationStatus
    ? getApplicationStatusConfig(job.myApplicationStatus)
    : null;
  const EmploymentIcon = employment.icon;

  const handleToggleStatus = async () => {
    try {
      await setStatus({
        id: job._id,
        status: job.status === "open" ? "closed" : "open",
      });
      toast.success(
        job.status === "open" ? "Lowongan ditutup" : "Lowongan dibuka kembali",
      );
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui status");
      } else {
        toast.error("Gagal memperbarui status");
      }
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Hapus lowongan ini beserta semua lamarannya? Tindakan ini tidak dapat dibatalkan.",
      )
    ) {
      return;
    }
    try {
      await remove({ id: job._id });
      toast.success("Lowongan dihapus");
      navigate("/jobs");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus lowongan");
      } else {
        toast.error("Gagal menghapus lowongan");
      }
    }
  };

  const handleWithdraw = async () => {
    if (!job.myApplicationId) return;
    if (!window.confirm("Tarik lamaran Anda untuk posisi ini?")) return;
    try {
      await withdraw({ id: job.myApplicationId });
      toast.success("Lamaran ditarik");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menarik lamaran");
      } else {
        toast.error("Gagal menarik lamaran");
      }
    }
  };

  const canApply =
    !alreadyApplied &&
    !closed &&
    currentUser !== null &&
    currentUser._id !== job.postedById;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/jobs")}
        className="gap-1 cursor-pointer"
      >
        <ArrowLeft className="size-4" /> Semua Lowongan
      </Button>

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={status.badge}>
                  {status.label}
                </Badge>
                {myAppStatusCfg ? (
                  <Badge variant="outline" className={myAppStatusCfg.badge}>
                    Lamaran Anda: {myAppStatusCfg.label}
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {job.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" />
                  {job.department}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {job.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UsersIcon className="size-4" />
                  {job.applicationCount} pelamar
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={employment.badge}>
                  <EmploymentIcon className="size-3" />
                  {employment.label}
                </Badge>
                <Badge variant="outline" className={level.badge}>
                  {level.label}
                </Badge>
                {salary ? (
                  <span className="inline-flex items-center gap-1 text-sm font-medium">
                    <Wallet className="size-4" />
                    {salary}
                  </span>
                ) : null}
                {job.closingDate ? (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="size-4" />
                    Tutup {formatJobDate(job.closingDate)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {canApply ? (
                <Button
                  onClick={() => setApplyOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Briefcase className="size-4" />
                  Lamar Sekarang
                </Button>
              ) : null}

              {alreadyApplied &&
              job.myApplicationStatus !== "accepted" &&
              job.myApplicationStatus !== "rejected" &&
              job.myApplicationStatus !== "withdrawn" ? (
                <Button
                  variant="ghost"
                  onClick={handleWithdraw}
                  className="gap-2 cursor-pointer"
                >
                  Tarik Lamaran
                </Button>
              ) : null}

              {canManage ? (
                <>
                  <JobFormDialog
                    mode="edit"
                    job={job}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                  />
                  <Button
                    variant="ghost"
                    onClick={handleToggleStatus}
                    className="gap-2 cursor-pointer"
                  >
                    {job.status === "open" ? (
                      <>
                        <Lock className="size-4" /> Tutup
                      </>
                    ) : (
                      <>
                        <Unlock className="size-4" /> Buka
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDelete}
                    className="gap-2 cursor-pointer text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Hapus
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {(job.postedByName || job.hiringManagerName) && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              {job.postedByName ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="size-3.5" />
                  Diposting oleh {job.postedByName}
                </span>
              ) : null}
              {job.hiringManagerName ? (
                <span className="inline-flex items-center gap-1.5">
                  <UsersIcon className="size-3.5" />
                  Hiring manager: {job.hiringManagerName}
                </span>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="cursor-pointer">
            Detail Posisi
          </TabsTrigger>
          {canManage ? (
            <TabsTrigger value="applicants" className="cursor-pointer">
              Pelamar ({job.applicationCount})
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <section>
                <h2 className="text-base font-semibold">Deskripsi</h2>
                <div className="mt-2">
                  <MarkdownContent content={job.description} />
                </div>
              </section>

              {job.responsibilities.trim() ? (
                <section>
                  <h2 className="text-base font-semibold">Tanggung Jawab</h2>
                  <div className="mt-2">
                    <MarkdownContent content={job.responsibilities} />
                  </div>
                </section>
              ) : null}

              {job.requirements.trim() ? (
                <section>
                  <h2 className="text-base font-semibold">Persyaratan</h2>
                  <div className="mt-2">
                    <MarkdownContent content={job.requirements} />
                  </div>
                </section>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage ? (
          <TabsContent value="applicants" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {applications === undefined
                  ? "Memuat..."
                  : `${applications.length} pelamar`}
              </p>
              <Select
                value={applicantStatusFilter}
                onValueChange={setApplicantStatusFilter}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="submitted">Terkirim</SelectItem>
                  <SelectItem value="reviewing">Ditinjau</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="accepted">Diterima</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                  <SelectItem value="withdrawn">Ditarik</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {applications === undefined ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : applications.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon />
                  </EmptyMedia>
                  <EmptyTitle>Belum ada pelamar</EmptyTitle>
                  <EmptyDescription>
                    Lamaran akan muncul di sini saat karyawan mulai mendaftar.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <ApplicantCard
                    key={app._id}
                    application={app}
                    canReview={canManage}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ) : null}
      </Tabs>

      <ApplyJobDialog
        jobId={job._id}
        jobTitle={job.title}
        open={applyOpen}
        onOpenChange={setApplyOpen}
      />
    </div>
  );
}
