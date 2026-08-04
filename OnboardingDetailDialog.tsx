import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  CheckCircle2,
  Plus,
  Trash2,
  Users,
  Briefcase,
  StickyNote,
  Route,
  MessageCircleHeart,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { CheckinWithUser } from "@/convex/onboarding/checkins.ts";
import AddTaskDialog from "./AddTaskDialog.tsx";
import PhaseTimeline from "./PhaseTimeline.tsx";
import CheckinReviewDialog from "./CheckinReviewDialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  getInitials,
  formatDate,
  MOOD_CONFIG,
} from "../_lib/onboarding-utils.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users"> | null;
  canManage: boolean; // admin
};

export default function OnboardingDetailDialog({
  open,
  onOpenChange,
  userId,
  canManage,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCheckin, setSelectedCheckin] =
    useState<CheckinWithUser | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const data = useQuery(
    api.onboarding.getByUser,
    open && userId ? { userId } : "skip",
  );
  const checkins = useQuery(
    api.onboarding.checkins.listByOnboarding,
    open && data ? { onboardingId: data._id } : "skip",
  );
  const currentUser = useQuery(api.users.getCurrentUser, open ? {} : "skip");
  const updateOnboarding = useMutation(api.onboarding.updateOnboarding);
  const removeOnboarding = useMutation(api.onboarding.removeOnboarding);

  const isLoading = data === undefined && open && userId;

  // Not all toggles are used but kept for future use; guard to avoid unused warning
  void currentUser;

  const handleComplete = async () => {
    if (!data) return;
    try {
      await updateOnboarding({
        id: data._id,
        status: "completed",
      });
      toast.success("Onboarding ditandai selesai");
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal memperbarui");
      } else {
        toast.error("Gagal memperbarui");
      }
    }
  };

  const handleRemove = async () => {
    if (!data) return;
    try {
      await removeOnboarding({ id: data._id });
      toast.success("Onboarding dihapus");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>
        ) : !data ? (
          <div>
            <DialogHeader>
              <DialogTitle>Tidak ada onboarding</DialogTitle>
              <DialogDescription>
                Karyawan ini belum memiliki proses onboarding aktif.
              </DialogDescription>
            </DialogHeader>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <Avatar className="size-12">
                  {data.userAvatar ? (
                    <AvatarImage src={data.userAvatar} />
                  ) : null}
                  <AvatarFallback>
                    {getInitials(data.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-left">
                    {data.userName ?? "Karyawan"}
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    {data.userJobTitle ?? ""}
                    {data.userJobTitle && data.userDepartment ? " · " : ""}
                    {data.userDepartment ?? ""}
                  </DialogDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    data.status === "completed"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                      : data.status === "paused"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
                  }
                >
                  {data.status === "completed"
                    ? "Selesai"
                    : data.status === "paused"
                      ? "Ditunda"
                      : "Aktif"}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Progress
                    </p>
                    <p className="mt-0.5 text-2xl font-bold">
                      {data.progress.percent}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.progress.done} dari {data.progress.total} tugas
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-xs text-muted-foreground">
                      Mulai kerja
                    </p>
                    <p className="font-medium">{formatDate(data.startDate)}</p>
                  </div>
                </div>
                <Progress value={data.progress.percent} className="mt-3" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Manajer</p>
                    <p className="truncate text-sm font-medium">
                      {data.managerName ?? "Belum ditentukan"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Buddy</p>
                    <p className="truncate text-sm font-medium">
                      {data.buddyName ?? "Belum ditentukan"}
                    </p>
                  </div>
                </div>
              </div>

              {data.notes ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                    <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Route className="size-4 text-primary" />
                    Perjalanan ({data.progress.done}/{data.progress.total})
                  </h3>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 cursor-pointer"
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="size-4" />
                      Tambah Tugas
                    </Button>
                  ) : null}
                </div>
                {data.tasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Belum ada tugas. Tambahkan template onboarding atau tugas
                    khusus.
                  </p>
                ) : (
                  <PhaseTimeline
                    tasks={data.tasks}
                    startDate={data.startDate}
                    canToggle={canManage}
                    canDelete={canManage}
                  />
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                    <MessageCircleHeart className="size-4 text-primary" />
                    Check-in 30/60/90 Hari
                  </h3>
                </div>
                {checkins === undefined ? (
                  <Skeleton className="h-16 w-full" />
                ) : checkins.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Belum ada check-in terjadwal.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {checkins.map((c) => {
                      const moodCfg =
                        c.moodScore != null ? MOOD_CONFIG[c.moodScore] : null;
                      const statusBadge =
                        c.status === "reviewed"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : c.status === "submitted"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : "bg-muted text-muted-foreground border-border";
                      const statusLabel =
                        c.status === "reviewed"
                          ? "Ditinjau"
                          : c.status === "submitted"
                            ? "Menunggu Tinjauan"
                            : "Dijadwalkan";
                      const canOpen = c.status !== "pending";
                      return (
                        <div
                          key={c._id}
                          onClick={
                            canOpen
                              ? () => {
                                  setSelectedCheckin(c);
                                  setCheckinOpen(true);
                                }
                              : undefined
                          }
                          className={
                            "flex items-center gap-3 rounded-lg border p-3 " +
                            (canOpen
                              ? "cursor-pointer hover:border-primary/50 transition-colors"
                              : "opacity-80")
                          }
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <MessageCircleHeart className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {c.label}
                              </p>
                              <Badge variant="outline" className={statusBadge}>
                                {statusLabel}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(c.scheduledDate)}
                              {moodCfg
                                ? ` · ${moodCfg.emoji} ${moodCfg.label}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {canManage ? (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-4" />
                        Hapus
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Onboarding?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tindakan ini akan menghapus onboarding beserta semua
                          tugas terkait. Tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRemove}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Hapus
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {data.status !== "completed" ? (
                    <Button
                      size="sm"
                      onClick={handleComplete}
                      className="gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="size-4" />
                      Tandai Selesai
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <AddTaskDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              onboardingId={data._id}
            />
            <CheckinReviewDialog
              open={checkinOpen}
              onOpenChange={setCheckinOpen}
              checkin={selectedCheckin}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
