import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ListChecks,
  MessageSquareHeart,
  SkipForward,
  Trash2,
  Users,
  Clock,
  CheckCheck,
  X,
} from "lucide-react";
import {
  formatDate,
  daysUntil,
  getCategoryConfig,
  getExitTypeConfig,
  OWNER_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "../_lib/offboarding-utils.ts";
import AddCaseTaskDialog from "./AddCaseTaskDialog.tsx";
import AddHandoverDialog from "./AddHandoverDialog.tsx";
import ExitInterviewDialog from "./ExitInterviewDialog.tsx";
import { cn } from "@/lib/utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: Id<"offboardingCases"> | null;
  isAdmin: boolean;
  currentUserId?: Id<"users">;
};

export default function CaseDetailDialog({
  open,
  onOpenChange,
  caseId,
  isAdmin,
  currentUserId,
}: Props) {
  const data = useQuery(
    api.offboarding.getCase,
    open && caseId ? { id: caseId } : "skip",
  );
  const updateTaskStatus = useMutation(api.offboarding.updateTaskStatus);
  const removeTask = useMutation(api.offboarding.removeTask);
  const updateHandover = useMutation(api.offboarding.updateHandover);
  const removeHandover = useMutation(api.offboarding.removeHandover);
  const updateCase = useMutation(api.offboarding.updateCase);
  const reviewInterview = useMutation(api.offboarding.reviewExitInterview);

  const [eiOpen, setEiOpen] = useState(false);

  const isLoading = open && caseId && !data;

  async function handleTaskAction(
    id: Id<"offboardingTasks">,
    status: string,
  ) {
    try {
      await updateTaskStatus({ id, status });
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengubah status");
      } else {
        toast.error("Gagal mengubah status");
      }
    }
  }

  async function handleRemoveTask(id: Id<"offboardingTasks">) {
    try {
      await removeTask({ id });
      toast.success("Tugas dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  async function handleHandoverStatus(
    id: Id<"offboardingHandovers">,
    status: string,
  ) {
    try {
      await updateHandover({ id, status });
    } catch {
      toast.error("Gagal mengubah status");
    }
  }

  async function handleRemoveHandover(id: Id<"offboardingHandovers">) {
    try {
      await removeHandover({ id });
      toast.success("Handover dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  async function handleCompleteCase() {
    if (!caseId) return;
    try {
      await updateCase({ id: caseId, status: "completed" });
      toast.success("Case offboarding diselesaikan");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menyelesaikan");
      } else {
        toast.error("Gagal menyelesaikan");
      }
    }
  }

  async function handleReviewInterview() {
    if (!data?.exitInterview) return;
    try {
      await reviewInterview({ id: data.exitInterview._id });
      toast.success("Exit interview ditandai telah direview");
    } catch {
      toast.error("Gagal menandai review");
    }
  }

  if (!open || !caseId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <Avatar className="size-12">
                  {data.userAvatar ? (
                    <AvatarImage src={data.userAvatar} alt={data.userName} />
                  ) : null}
                  <AvatarFallback>
                    {(data.userName ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <DialogTitle>{data.userName}</DialogTitle>
                  <DialogDescription>
                    {data.userJobTitle ? `${data.userJobTitle} · ` : ""}
                    {data.userDepartment ?? "Tidak ada departemen"}
                  </DialogDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE[data.status] ?? ""}
                    >
                      {STATUS_LABELS[data.status] ?? data.status}
                    </Badge>
                    <ExitTypeBadge exitType={data.exitType} />
                    <Badge variant="outline" className="gap-1">
                      <CalendarClock className="size-3" />
                      Hari terakhir: {formatDate(data.lastWorkingDay)}
                    </Badge>
                    {data.tenureYears != null ? (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="size-3" />
                        {data.tenureYears} th masa kerja
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Progress Offboarding</span>
                <span className="text-muted-foreground">
                  {data.progress.done} / {data.progress.total} tugas
                </span>
              </div>
              <Progress value={data.progress.percent} />
            </div>

            <Tabs defaultValue="tasks" className="space-y-3">
              <TabsList>
                <TabsTrigger value="tasks" className="cursor-pointer">
                  <ListChecks className="size-4" />
                  Checklist
                </TabsTrigger>
                <TabsTrigger value="handover" className="cursor-pointer">
                  <Users className="size-4" />
                  Handover
                </TabsTrigger>
                <TabsTrigger value="interview" className="cursor-pointer">
                  <MessageSquareHeart className="size-4" />
                  Exit Interview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="space-y-3">
                {isAdmin ? (
                  <div className="flex justify-end">
                    <AddCaseTaskDialog
                      caseId={data._id}
                      lastWorkingDay={data.lastWorkingDay}
                    />
                  </div>
                ) : null}
                {data.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada tugas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.tasks.map((t) => {
                      const cat = getCategoryConfig(t.category);
                      const Icon = cat.icon;
                      const isDone = t.status === "done";
                      const isSkipped = t.status === "skipped";
                      const due = t.dueDate;
                      const dayCount = due ? daysUntil(due) : null;
                      const isOverdue =
                        !isDone && !isSkipped && dayCount !== null && dayCount < 0;
                      return (
                        <div
                          key={t._id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-lg",
                              cat.iconBg,
                            )}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "truncate text-sm font-medium",
                                    (isDone || isSkipped) &&
                                      "text-muted-foreground line-through",
                                  )}
                                >
                                  {t.title}
                                </p>
                                {t.description ? (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {t.description}
                                  </p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                  <Badge variant="outline" className={cat.badge}>
                                    {cat.label}
                                  </Badge>
                                  <Badge variant="outline">
                                    {OWNER_LABELS[t.ownerRole] ?? t.ownerRole}
                                  </Badge>
                                  {due ? (
                                    <span
                                      className={cn(
                                        "text-xs",
                                        isOverdue
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      <CalendarClock className="mr-1 inline size-3" />
                                      {formatDate(due)}
                                    </span>
                                  ) : null}
                                  <Badge
                                    variant="outline"
                                    className={STATUS_BADGE[t.status] ?? ""}
                                  >
                                    {STATUS_LABELS[t.status] ?? t.status}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {!isDone ? (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleTaskAction(t._id, "done")
                                    }
                                    title="Tandai selesai"
                                    className="cursor-pointer"
                                  >
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleTaskAction(t._id, "todo")
                                    }
                                    title="Batalkan"
                                    className="cursor-pointer"
                                  >
                                    <Circle className="size-4" />
                                  </Button>
                                )}
                                {isAdmin && !isDone && !isSkipped ? (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleTaskAction(t._id, "skipped")
                                    }
                                    title="Lewati"
                                    className="cursor-pointer"
                                  >
                                    <SkipForward className="size-4" />
                                  </Button>
                                ) : null}
                                {isAdmin ? (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveTask(t._id)}
                                    title="Hapus"
                                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="handover" className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Daftar proyek, akses, dan tanggung jawab yang diserahkan.
                  </p>
                  <AddHandoverDialog caseId={data._id} />
                </div>
                {data.handovers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada item handover.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.handovers.map((h) => (
                      <div
                        key={h._id}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {h.topic}
                            </p>
                            {h.description ? (
                              <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap">
                                {h.description}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant="outline"
                            className={STATUS_BADGE[h.status] ?? ""}
                          >
                            {STATUS_LABELS[h.status] ?? h.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            {h.successorId ? (
                              <SuccessorName userId={h.successorId} />
                            ) : (
                              <span className="text-muted-foreground">
                                Belum ada penerus
                              </span>
                            )}
                            {h.dueDate ? (
                              <span className="text-muted-foreground">
                                <CalendarClock className="mr-1 inline size-3" />
                                {formatDate(h.dueDate)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Select
                              value={h.status}
                              onValueChange={(v) =>
                                handleHandoverStatus(h._id, v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">
                                  Berjalan
                                </SelectItem>
                                <SelectItem value="completed">Selesai</SelectItem>
                              </SelectContent>
                            </Select>
                            {(isAdmin || h.userId === currentUserId) && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => handleRemoveHandover(h._id)}
                                className="cursor-pointer text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="interview" className="space-y-3">
                {data.exitInterview ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Exit Interview
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          STATUS_BADGE[data.exitInterview.status] ?? ""
                        }
                      >
                        {STATUS_LABELS[data.exitInterview.status] ??
                          data.exitInterview.status}
                      </Badge>
                    </div>

                    {data.exitInterview.status === "pending" ? (
                      data.userId === currentUserId ? (
                        <div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Silakan isi exit interview. Feedback Anda sangat
                            berharga.
                          </p>
                          <Button
                            onClick={() => setEiOpen(true)}
                            className="cursor-pointer"
                          >
                            <MessageSquareHeart className="size-4" />
                            Isi Exit Interview
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Karyawan belum mengisi exit interview.
                        </p>
                      )
                    ) : (
                      <InterviewSummary
                        interview={data.exitInterview}
                        isAdmin={isAdmin}
                        onReview={handleReviewInterview}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Exit interview belum tersedia.
                  </p>
                )}
              </TabsContent>
            </Tabs>

            {isAdmin && data.status === "in_progress" ? (
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button
                  onClick={handleCompleteCase}
                  className="cursor-pointer"
                >
                  <CheckCheck className="size-4" />
                  Tandai Selesai
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (!caseId) return;
                    try {
                      await updateCase({ id: caseId, status: "cancelled" });
                      toast.success("Case dibatalkan");
                    } catch {
                      toast.error("Gagal membatalkan");
                    }
                  }}
                  className="cursor-pointer"
                >
                  <X className="size-4" />
                  Batalkan
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>

      {data?.exitInterview ? (
        <ExitInterviewDialog
          open={eiOpen}
          onOpenChange={setEiOpen}
          interviewId={data.exitInterview._id}
        />
      ) : null}
    </Dialog>
  );
}

function ExitTypeBadge({ exitType }: { exitType: string }) {
  const c = getExitTypeConfig(exitType);
  const Icon = c.icon;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className={cn("size-3", c.color)} />
      {c.label}
    </Badge>
  );
}

function SuccessorName({ userId }: { userId: Id<"users"> }) {
  const user = useQuery(api.users.getEmployeeById, { userId });
  return (
    <span className="text-muted-foreground">
      <Users className="mr-1 inline size-3" />
      {user?.name ?? "-"}
    </span>
  );
}

function InterviewSummary({
  interview,
  isAdmin,
  onReview,
}: {
  interview: {
    status: string;
    isAnonymous: boolean;
    overallSatisfaction?: number;
    recommendScore?: number;
    wouldReturnScore?: number;
    compensationRating?: number;
    managementRating?: number;
    workLifeBalanceRating?: number;
    growthRating?: number;
    cultureRating?: number;
    primaryReason?: string;
    likedMost?: string;
    areasForImprovement?: string;
    whyLeaving?: string;
    suggestions?: string;
  };
  isAdmin: boolean;
  onReview: () => void;
}) {
  const fields: Array<{ label: string; value?: number }> = [
    { label: "Kepuasan Keseluruhan", value: interview.overallSatisfaction },
    { label: "Rekomendasi (0-10)", value: interview.recommendScore },
    { label: "Mau Kembali", value: interview.wouldReturnScore },
    { label: "Kompensasi", value: interview.compensationRating },
    { label: "Manajemen", value: interview.managementRating },
    { label: "WLB", value: interview.workLifeBalanceRating },
    { label: "Pertumbuhan", value: interview.growthRating },
    { label: "Budaya", value: interview.cultureRating },
  ];
  return (
    <div className="space-y-3">
      {interview.isAnonymous ? (
        <Badge variant="outline" className="bg-muted">
          Anonim
        </Badge>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {fields.map((f) => (
          <div
            key={f.label}
            className="rounded-md border p-2 text-center"
          >
            <p className="text-[10px] text-muted-foreground">{f.label}</p>
            <p className="text-lg font-semibold">
              {f.value != null ? f.value : "-"}
            </p>
          </div>
        ))}
      </div>
      {interview.likedMost ? (
        <div>
          <p className="text-xs font-medium">Paling disukai</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {interview.likedMost}
          </p>
        </div>
      ) : null}
      {interview.areasForImprovement ? (
        <div>
          <p className="text-xs font-medium">Area untuk diperbaiki</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {interview.areasForImprovement}
          </p>
        </div>
      ) : null}
      {interview.whyLeaving ? (
        <div>
          <p className="text-xs font-medium">Alasan pergi</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {interview.whyLeaving}
          </p>
        </div>
      ) : null}
      {interview.suggestions ? (
        <div>
          <p className="text-xs font-medium">Saran</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {interview.suggestions}
          </p>
        </div>
      ) : null}
      {isAdmin && interview.status === "submitted" ? (
        <Button onClick={onReview} size="sm" className="cursor-pointer">
          <CheckCheck className="size-4" />
          Tandai Telah Direview
        </Button>
      ) : null}
    </div>
  );
}
