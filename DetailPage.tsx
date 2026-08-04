import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Compass,
  Inbox,
  PartyPopper,
  Pencil,
  Play,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Users2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import { isAdminRole } from "@/convex/roles.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CYCLE_STATUS_CONFIG,
  REVIEW_STATUS_CONFIG,
  INVITE_STATUS_CONFIG,
  RELATIONSHIP_BADGE,
  RELATIONSHIP_ICONS,
  RELATIONSHIP_LABELS,
  formatScore,
  getCoverClass,
  scoreColor,
} from "@/pages/feedback360/_lib/feedback360-utils.ts";
import RespondReviewerDialog from "@/pages/feedback360/_components/RespondReviewerDialog.tsx";
import AddRevieweeDialog from "@/pages/feedback360/_components/AddRevieweeDialog.tsx";
import ReviewReportPanel from "@/pages/feedback360/_components/ReviewReportPanel.tsx";
import NominatePeerPopover from "@/pages/feedback360/_components/NominatePeerPopover.tsx";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ---- Admin: reviewees list -----------------------------------------------
function AdminRevieweesPanel({
  cycleId,
  canModify,
  onViewReport,
}: {
  cycleId: Id<"feedback360Cycles">;
  canModify: boolean;
  onViewReport: (reviewId: Id<"feedback360Reviews">) => void;
}) {
  const rows = useQuery(api.feedback360.reviews.listReviewsForCycle, {
    cycleId,
  });
  const cycleReviewers = useQuery(api.feedback360.reviews.listCycleReviewers, {
    cycleId,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] =
    useState<Id<"feedback360Reviews"> | null>(null);

  const removeReviewee = useMutation(api.feedback360.cycles.removeReviewee);
  const shareReview = useMutation(api.feedback360.reviews.shareReview);
  const unshareReview = useMutation(api.feedback360.reviews.unshareReview);

  const reviewerMap = useMemo(() => {
    const map = new Map<
      Id<"feedback360Reviews">,
      NonNullable<typeof cycleReviewers>[number]["reviewers"]
    >();
    for (const row of cycleReviewers ?? []) {
      map.set(row.reviewId, row.reviewers);
    }
    return map;
  }, [cycleReviewers]);

  async function handleShare(reviewId: Id<"feedback360Reviews">) {
    try {
      await shareReview({ reviewId });
      toast.success("Laporan dibagikan kepada karyawan");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal membagikan");
      } else {
        toast.error("Gagal membagikan");
      }
    }
  }

  async function handleUnshare(reviewId: Id<"feedback360Reviews">) {
    try {
      await unshareReview({ reviewId });
      toast.success("Pembagian laporan dibatalkan");
    } catch {
      toast.error("Gagal membatalkan pembagian");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await removeReviewee({ reviewId: deleteId });
      toast.success("Karyawan dihapus dari siklus");
      setDeleteId(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Karyawan yang dinilai</h3>
          <p className="text-xs text-muted-foreground">
            Setiap karyawan mendapat reviewer otomatis (diri sendiri, atasan,
            bawahan). Tambahkan peer secara manual jika diperlukan.
          </p>
        </div>
        {canModify ? (
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="cursor-pointer"
          >
            <UserPlus className="size-4" />
            Tambah Karyawan
          </Button>
        ) : null}
      </div>

      {rows === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users2 />
            </EmptyMedia>
            <EmptyTitle>Belum ada karyawan</EmptyTitle>
            <EmptyDescription>
              Tambahkan karyawan terlebih dahulu sebelum mengaktifkan siklus.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const reviewers = reviewerMap.get(r._id) ?? [];
            const statusCfg =
              REVIEW_STATUS_CONFIG[r.status] ?? REVIEW_STATUS_CONFIG.pending;
            return (
              <Card key={r._id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar className="size-11 shrink-0">
                      {r.revieweeAvatar ? (
                        <AvatarImage src={r.revieweeAvatar} />
                      ) : null}
                      <AvatarFallback>
                        {initials(r.revieweeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {r.revieweeName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.revieweeJobTitle ??
                              r.revieweeDepartment ??
                              "Karyawan"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            className={cn("border", statusCfg.badge)}
                          >
                            {statusCfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {r.completedReviewers}/{r.totalReviewers} feedback
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {[
                          { label: "Overall", v: r.overallScore },
                          { label: "Diri", v: r.selfScore },
                          { label: "Atasan", v: r.managerScore },
                          { label: "Rekan", v: r.peerScore },
                          { label: "Bawahan", v: r.reportScore },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className="rounded-md bg-muted/50 p-2 text-center"
                          >
                            <p className="text-[11px] text-muted-foreground">
                              {s.label}
                            </p>
                            <p
                              className={cn(
                                "text-sm font-semibold",
                                scoreColor(s.v),
                              )}
                            >
                              {formatScore(s.v)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {reviewers.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {reviewers.map((rev) => {
                            const rel = rev.relationship as
                              | "self"
                              | "manager"
                              | "peer"
                              | "report";
                            const Icon =
                              RELATIONSHIP_ICONS[rel] ??
                              RELATIONSHIP_ICONS.peer;
                            const invStatus =
                              INVITE_STATUS_CONFIG[rev.status] ??
                              INVITE_STATUS_CONFIG.pending;
                            return (
                              <span
                                key={rev._id}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                                  RELATIONSHIP_BADGE[rel],
                                )}
                                title={`${rev.reviewerName ?? "Reviewer"} · ${invStatus.label}`}
                              >
                                <Icon className="size-3" />
                                <span className="max-w-[120px] truncate">
                                  {rev.reviewerName ?? "Reviewer"}
                                </span>
                                {rev.status === "submitted" ? (
                                  <CheckCircle2 className="size-3" />
                                ) : rev.status === "declined" ? (
                                  <XCircle className="size-3" />
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onViewReport(r._id)}
                          className="cursor-pointer"
                        >
                          Lihat Laporan
                        </Button>
                        {r.status === "shared" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnshare(r._id)}
                            className="cursor-pointer"
                          >
                            Batalkan Bagikan
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleShare(r._id)}
                            disabled={r.completedReviewers === 0}
                            className="cursor-pointer"
                          >
                            <Share2 className="size-4" />
                            Bagikan ke Karyawan
                          </Button>
                        )}
                        {canModify ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteId(r._id)}
                            className="cursor-pointer text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Hapus
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddRevieweeDialog
        cycleId={cycleId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus karyawan dari siklus?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua jawaban reviewer untuk karyawan ini akan dihapus dan tidak
              dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Reviewee: my reviewers + share nomination ---------------------------
function MyReviewerList({ cycleId }: { cycleId: Id<"feedback360Cycles"> }) {
  const reviewers = useQuery(api.feedback360.reviewers.listMyReviewers, {
    cycleId,
  });

  if (reviewers === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (reviewers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada reviewer yang diundang untuk Anda.
      </p>
    );
  }
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {reviewers.map((rev) => {
        const rel = rev.relationship as
          | "self"
          | "manager"
          | "peer"
          | "report";
        const Icon = RELATIONSHIP_ICONS[rel] ?? RELATIONSHIP_ICONS.peer;
        const invStatus =
          INVITE_STATUS_CONFIG[rev.status] ?? INVITE_STATUS_CONFIG.pending;
        const anonymous = rel === "peer" || rel === "report";
        return (
          <div
            key={rev._id}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-md border",
                RELATIONSHIP_BADGE[rel],
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {anonymous ? "Anonim" : rev.reviewerName ?? "Reviewer"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {RELATIONSHIP_LABELS[rel]}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("border", invStatus.badge)}
            >
              {invStatus.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ---- Main detail page ----------------------------------------------------
function Feedback360DetailInner({
  cycleId,
}: {
  cycleId: Id<"feedback360Cycles">;
}) {
  const navigate = useNavigate();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const cycle = useQuery(api.feedback360.cycles.getCycle, { cycleId });
  const myInvitesAll = useQuery(api.feedback360.reviewers.listMyInvites, {
    filter: "all",
  });

  const [respondRowId, setRespondRowId] =
    useState<Id<"feedback360Reviewers"> | null>(null);
  const [viewReportId, setViewReportId] =
    useState<Id<"feedback360Reviews"> | null>(null);
  const [confirmAction, setConfirmAction] =
    useState<null | "publish" | "close" | "delete">(null);

  const publishCycle = useMutation(api.feedback360.cycles.publishCycle);
  const closeCycle = useMutation(api.feedback360.cycles.closeCycle);
  const removeCycle = useMutation(api.feedback360.cycles.removeCycle);
  const bulkRemindPending = useMutation(
    api.feedback360.reviewers.bulkRemindPending,
  );

  const isAdmin = isAdminRole(currentUser?.role);

  const myInvitesInCycle = useMemo(() => {
    if (!myInvitesAll) return [];
    return myInvitesAll.filter((inv) => inv.cycleId === cycleId);
  }, [myInvitesAll, cycleId]);

  if (cycle === undefined) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (cycle === null) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Compass />
            </EmptyMedia>
            <EmptyTitle>Siklus tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Siklus feedback ini mungkin sudah dihapus atau Anda tidak memiliki
              akses.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Button
          variant="secondary"
          onClick={() => navigate("/feedback360")}
          className="mt-4 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
      </div>
    );
  }

  const statusCfg =
    CYCLE_STATUS_CONFIG[cycle.status] ?? CYCLE_STATUS_CONFIG.draft;
  const completionRate =
    cycle.totalReviewerCount > 0
      ? Math.round(
          (cycle.completedReviewerCount / cycle.totalReviewerCount) * 100,
        )
      : 0;

  async function handlePublish() {
    try {
      await publishCycle({ cycleId });
      toast.success("Siklus diaktifkan. Notifikasi terkirim ke reviewer.");
      setConfirmAction(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal mengaktifkan siklus");
      } else {
        toast.error("Gagal mengaktifkan siklus");
      }
    }
  }
  async function handleClose() {
    try {
      await closeCycle({ cycleId });
      toast.success("Siklus ditutup");
      setConfirmAction(null);
    } catch {
      toast.error("Gagal menutup siklus");
    }
  }
  async function handleDelete() {
    try {
      await removeCycle({ cycleId });
      toast.success("Siklus dihapus");
      navigate("/feedback360");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  }

  async function handleRemindPending() {
    try {
      const res = await bulkRemindPending({ cycleId });
      if (res.count === 0) {
        toast.info("Tidak ada reviewer yang masih perlu diingatkan");
      } else {
        toast.success(`${res.count} pengingat terkirim ke reviewer`);
      }
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim pengingat");
      } else {
        toast.error("Gagal mengirim pengingat");
      }
    }
  }

  const defaultTab = isAdmin
    ? "reviewees"
    : cycle.myReviewId
      ? "my-report"
      : "inbox";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/feedback360")}
          className="cursor-pointer gap-1 pl-2"
        >
          <ArrowLeft className="size-4" />
          Semua siklus
        </Button>
      </div>

      {/* Hero */}
      <Card className="overflow-hidden p-0">
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white",
            getCoverClass(cycle.color),
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-white/15">
              <Compass className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
                {cycle.periodLabel}
              </p>
              <h1 className="text-xl font-bold md:text-2xl">{cycle.title}</h1>
              {cycle.description ? (
                <p className="mt-1 max-w-2xl text-sm text-white/90">
                  {cycle.description}
                </p>
              ) : null}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("border", statusCfg.badge)}
          >
            {statusCfg.label}
          </Badge>
        </div>
        <CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users2 className="size-3.5" />
              Karyawan dinilai
            </div>
            <p className="mt-0.5 text-lg font-bold">{cycle.reviewCount}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Send className="size-3.5" />
              Progres feedback
            </div>
            <p className="mt-0.5 text-lg font-bold">
              {cycle.completedReviewerCount}/{cycle.totalReviewerCount}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                ({completionRate}%)
              </span>
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" />
              Periode
            </div>
            <p className="mt-0.5 text-sm font-semibold">
              {format(new Date(cycle.startDate), "d MMM", {
                locale: idLocale,
              })}
              {" – "}
              {format(new Date(cycle.endDate), "d MMM yyyy", {
                locale: idLocale,
              })}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Pertanyaan
            </div>
            <p className="mt-0.5 text-lg font-bold">{cycle.questionCount}</p>
          </div>
        </CardContent>

        {isAdmin ? (
          <div className="flex flex-wrap gap-2 border-t bg-muted/30 px-4 py-3">
            {cycle.status === "draft" ? (
              <Button
                size="sm"
                onClick={() => setConfirmAction("publish")}
                className="cursor-pointer"
              >
                <Play className="size-4" />
                Aktifkan Siklus
              </Button>
            ) : null}
            {cycle.status === "active" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmAction("close")}
                className="cursor-pointer"
              >
                <XCircle className="size-4" />
                Tutup Siklus
              </Button>
            ) : null}
            {cycle.status === "active" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemindPending}
                className="cursor-pointer"
              >
                <BellRing className="size-4" />
                Ingatkan Reviewer
              </Button>
            ) : null}
            {cycle.status !== "active" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmAction("delete")}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Hapus Siklus
              </Button>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              Dibuat oleh {cycle.authorName ?? "-"}
            </span>
          </div>
        ) : null}
      </Card>

      {/* My invites on this cycle banner */}
      {myInvitesInCycle.filter((i) => i.status === "pending").length > 0 ? (
        <Card className="border-amber-200/50 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
              <Inbox className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">
                Anda memiliki{" "}
                {myInvitesInCycle.filter((i) => i.status === "pending").length}{" "}
                feedback untuk diisi
              </h3>
              <p className="text-sm text-muted-foreground">
                Klik salah satu di tab "Feedback Saya" di bawah.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          {isAdmin ? (
            <TabsTrigger value="reviewees" className="cursor-pointer gap-2">
              <Users2 className="size-4" />
              Karyawan
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="inbox" className="cursor-pointer gap-2">
            <Inbox className="size-4" />
            Feedback Saya
          </TabsTrigger>
          {cycle.myReviewId ? (
            <TabsTrigger value="my-report" className="cursor-pointer gap-2">
              <PartyPopper className="size-4" />
              Laporan Untuk Saya
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="questions" className="cursor-pointer gap-2">
            <Pencil className="size-4" />
            Pertanyaan
          </TabsTrigger>
        </TabsList>

        {isAdmin ? (
          <TabsContent value="reviewees">
            <AdminRevieweesPanel
              cycleId={cycleId}
              canModify={cycle.status !== "closed"}
              onViewReport={setViewReportId}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="inbox" className="space-y-3">
          {myInvitesInCycle.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox />
                </EmptyMedia>
                <EmptyTitle>Tidak ada feedback yang perlu diisi</EmptyTitle>
                <EmptyDescription>
                  Anda tidak terdaftar sebagai reviewer pada siklus ini.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              {myInvitesInCycle.map((inv) => {
                const rel = inv.relationship;
                const Icon = RELATIONSHIP_ICONS[rel];
                const invStatus =
                  INVITE_STATUS_CONFIG[inv.status] ??
                  INVITE_STATUS_CONFIG.pending;
                return (
                  <Card
                    key={inv._id}
                    className={cn(
                      inv.status === "pending" &&
                        "cursor-pointer transition-colors hover:border-primary/40",
                    )}
                    onClick={() => {
                      if (inv.status === "pending") setRespondRowId(inv._id);
                    }}
                  >
                    <CardContent className="flex flex-wrap items-start gap-3 p-4">
                      <Avatar className="size-10 shrink-0">
                        {inv.revieweeAvatar ? (
                          <AvatarImage src={inv.revieweeAvatar} />
                        ) : null}
                        <AvatarFallback>
                          {initials(inv.revieweeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {inv.revieweeName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {inv.revieweeJobTitle ??
                            inv.revieweeDepartment ??
                            "Karyawan"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("border", RELATIONSHIP_BADGE[rel])}
                      >
                        <Icon className="mr-1 size-3" />
                        {RELATIONSHIP_LABELS[rel]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("border", invStatus.badge)}
                      >
                        {invStatus.label}
                      </Badge>
                      {inv.status === "pending" ? (
                        <Button size="sm" className="cursor-pointer">
                          Isi
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {cycle.myReviewId ? (
          <TabsContent value="my-report" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Laporan feedback untuk saya</h3>
                <p className="text-xs text-muted-foreground">
                  Anda dapat melihat hasilnya setelah admin membagikan laporan.
                  Rekan dan bawahan tetap anonim.
                </p>
              </div>
              {cycle.status === "active" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="secondary" className="cursor-pointer">
                      <UserPlus className="size-4" />
                      Nominasikan Rekan
                      <ChevronDown className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <NominatePeerPopover cycleId={cycleId} />
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reviewer saya
                </h4>
                <MyReviewerList cycleId={cycleId} />
              </div>
              <ReviewReportPanel reviewId={cycle.myReviewId} />
            </div>
          </TabsContent>
        ) : null}

        <TabsContent value="questions" className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <h3 className="font-semibold">Daftar pertanyaan</h3>
                <p className="text-xs text-muted-foreground">
                  Semua reviewer akan menjawab pertanyaan berikut.
                </p>
              </div>
              <ol className="space-y-2">
                {cycle.questions.map((q, idx) => (
                  <li
                    key={q.id}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{q.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span>{q.type === "rating" ? "Skala 1-5" : "Teks"}</span>
                        {q.category ? <span>· {q.category}</span> : null}
                        {q.required ? <span>· Wajib</span> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RespondReviewerDialog
        reviewerRowId={respondRowId}
        onOpenChange={(o) => {
          if (!o) setRespondRowId(null);
        }}
      />

      {/* Report viewer (admin) */}
      {viewReportId ? (
        <AlertDialog
          open={viewReportId !== null}
          onOpenChange={(o) => {
            if (!o) setViewReportId(null);
          }}
        >
          <AlertDialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Laporan Feedback 360°</AlertDialogTitle>
              <AlertDialogDescription>
                Lihat semua jawaban yang terkumpul. Identitas reviewer
                peer/bawahan hanya terlihat oleh admin.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ReviewReportPanel reviewId={viewReportId} />
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">
                Tutup
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* Confirm publish/close/delete */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "publish"
                ? "Aktifkan siklus feedback?"
                : confirmAction === "close"
                  ? "Tutup siklus ini?"
                  : "Hapus siklus ini?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "publish"
                ? "Reviewer akan mendapatkan notifikasi dan dapat mulai mengisi feedback."
                : confirmAction === "close"
                  ? "Reviewer tidak dapat lagi mengirim feedback baru setelah ditutup."
                  : "Semua review dan jawaban reviewer akan dihapus permanen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction === "publish") handlePublish();
                else if (confirmAction === "close") handleClose();
                else if (confirmAction === "delete") handleDelete();
              }}
              className={cn(
                "cursor-pointer",
                confirmAction === "delete" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Feedback360DetailPage() {
  const params = useParams();
  const cycleId = params.cycleId as Id<"feedback360Cycles"> | undefined;

  return (
    <>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-full flex-col items-center justify-center gap-4 p-10">
          <p className="text-muted-foreground">
            Silakan masuk untuk mengakses Feedback 360°.
          </p>
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        {cycleId ? (
          <Feedback360DetailInner cycleId={cycleId} />
        ) : (
          <div className="p-10 text-center text-muted-foreground">
            Siklus tidak ditemukan.
          </div>
        )}
      </Authenticated>
    </>
  );
}
