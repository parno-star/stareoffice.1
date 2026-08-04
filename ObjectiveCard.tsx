import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu.tsx";
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
  MoreVertical,
  Plus,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Archive,
  CheckCircle2,
  RotateCcw,
  Calendar,
  History,
  Target,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  HEALTH_CONFIG,
  STATUS_CONFIG,
  SCOPE_ICONS,
  SCOPE_LABELS,
  CATEGORY_LABELS,
  formatMetricValue,
} from "../_lib/okr-utils.ts";
import KeyResultFormDialog from "./KeyResultFormDialog.tsx";
import CheckInDialog from "./CheckInDialog.tsx";
import CheckInHistoryDialog from "./CheckInHistoryDialog.tsx";
import { cn } from "@/lib/utils.ts";

type ObjectiveWithOwner = Doc<"objectives"> & {
  owner?: {
    _id: Id<"users">;
    name?: string;
    avatarUrl?: string;
    department?: string;
    jobTitle?: string;
  } | null;
};

type Props = {
  objective: ObjectiveWithOwner;
  currentUser: Doc<"users">;
  isAdmin: boolean;
  onEdit: (o: ObjectiveWithOwner) => void;
  defaultExpanded?: boolean;
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function ObjectiveCard({
  objective,
  currentUser,
  isAdmin,
  onEdit,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [krDialogOpen, setKrDialogOpen] = useState(false);
  const [editingKr, setEditingKr] = useState<Doc<"keyResults"> | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<Doc<"keyResults"> | null>(
    null,
  );
  const [historyTarget, setHistoryTarget] = useState<Doc<"keyResults"> | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Doc<"keyResults"> | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const keyResults = useQuery(
    api.okr.keyResults.listByObjective,
    expanded ? { objectiveId: objective._id } : "skip",
  );

  const deleteObjective = useMutation(api.okr.objectives.deleteObjective);
  const setStatus = useMutation(api.okr.objectives.setObjectiveStatus);
  const deleteKr = useMutation(api.okr.keyResults.deleteKeyResult);

  const canEdit =
    isAdmin ||
    currentUser._id === objective.ownerId ||
    currentUser._id === objective.authorId;

  const ScopeIcon = SCOPE_ICONS[objective.scope] ?? Target;
  const health = HEALTH_CONFIG[objective.health] ?? HEALTH_CONFIG.on_track;
  const statusCfg = STATUS_CONFIG[objective.status] ?? STATUS_CONFIG.active;

  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10 text-primary",
            )}
          >
            <ScopeIcon className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1">
                    <span
                      className={cn("size-1.5 rounded-full", health.dot)}
                    />
                    {SCOPE_LABELS[objective.scope] ?? objective.scope}
                  </Badge>
                  <span>{objective.periodLabel}</span>
                  <span>·</span>
                  <span>{CATEGORY_LABELS[objective.category] ?? objective.category}</span>
                  {objective.status !== "active" ? (
                    <Badge className={cn("border", statusCfg.badge)}>
                      {statusCfg.label}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-1 break-words text-base font-semibold md:text-lg">
                  {objective.title}
                </h3>
                {objective.description ? (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {objective.description}
                  </p>
                ) : null}
              </div>

              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onEdit(objective)}
                      className="cursor-pointer"
                    >
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    {objective.status === "active" ? (
                      <DropdownMenuItem
                        onClick={async () => {
                          await setStatus({
                            objectiveId: objective._id,
                            status: "completed",
                          });
                          toast.success("OKR ditandai selesai");
                        }}
                        className="cursor-pointer"
                      >
                        <CheckCircle2 className="mr-2 size-4" />
                        Tandai selesai
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={async () => {
                          await setStatus({
                            objectiveId: objective._id,
                            status: "active",
                          });
                          toast.success("OKR diaktifkan kembali");
                        }}
                        className="cursor-pointer"
                      >
                        <RotateCcw className="mr-2 size-4" />
                        Aktifkan lagi
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={async () => {
                        await setStatus({
                          objectiveId: objective._id,
                          status: "archived",
                        });
                        toast.success("Diarsipkan");
                      }}
                      className="cursor-pointer"
                    >
                      <Archive className="mr-2 size-4" />
                      Arsipkan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmDelete(true)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Progress value={objective.progress} className="h-2 flex-1" />
              <span className="text-sm font-semibold tabular-nums">
                {objective.progress}%
              </span>
              <Badge className={cn("border", health.badge)}>
                {health.label}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {objective.owner ? (
                  <>
                    <Avatar className="size-5">
                      <AvatarImage
                        src={objective.owner.avatarUrl}
                        alt={objective.owner.name ?? ""}
                      />
                      <AvatarFallback className="text-[10px]">
                        {initials(objective.owner.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {objective.owner.name ?? "Owner"}
                    </span>
                  </>
                ) : (
                  <span>Tanpa owner</span>
                )}
                <span>·</span>
                <span>{objective.keyResultCount} KR</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="mr-1 size-3.5" />
                    Tutup
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 size-3.5" />
                    Lihat KR
                  </>
                )}
              </Button>
            </div>

            {expanded ? (
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Key Results</h4>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        setEditingKr(null);
                        setKrDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-1 size-3.5" />
                      Tambah KR
                    </Button>
                  ) : null}
                </div>

                {keyResults === undefined ? (
                  <p className="text-sm text-muted-foreground">Memuat...</p>
                ) : keyResults.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                    Belum ada key result. Tambah minimal 2-3 KR terukur.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {keyResults.map((kr) => {
                      const krHealth =
                        HEALTH_CONFIG[kr.status] ?? HEALTH_CONFIG.on_track;
                      const canUpdate =
                        isAdmin ||
                        currentUser._id === kr.ownerId ||
                        currentUser._id === objective.ownerId;
                      return (
                        <div
                          key={kr._id}
                          className="rounded-lg border bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-medium">
                                {kr.title}
                              </p>
                              {kr.description ? (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {kr.description}
                                </p>
                              ) : null}
                            </div>
                            <Badge
                              className={cn(
                                "shrink-0 border text-xs",
                                krHealth.badge,
                              )}
                            >
                              {krHealth.label}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={kr.progress} className="h-1.5 flex-1" />
                            <span className="text-xs font-semibold tabular-nums">
                              {kr.progress}%
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span>
                                {formatMetricValue(
                                  kr.currentValue,
                                  kr.metricType,
                                  kr.unit,
                                )}
                              </span>
                              <span>→</span>
                              <span className="font-medium">
                                {formatMetricValue(
                                  kr.targetValue,
                                  kr.metricType,
                                  kr.unit,
                                )}
                              </span>
                              {kr.dueDate ? (
                                <>
                                  <span>·</span>
                                  <Calendar className="size-3" />
                                  <span>{kr.dueDate}</span>
                                </>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1">
                              {canUpdate ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 cursor-pointer px-2 text-xs"
                                  onClick={() => setCheckInTarget(kr)}
                                >
                                  <TrendingUp className="mr-1 size-3" />
                                  Check-in
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer px-2 text-xs"
                                onClick={() => setHistoryTarget(kr)}
                              >
                                <History className="size-3" />
                              </Button>
                              {canEdit ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 cursor-pointer px-2"
                                    >
                                      <MoreVertical className="size-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingKr(kr);
                                        setKrDialogOpen(true);
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Pencil className="mr-2 size-3.5" />
                                      Edit KR
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setDeleteTarget(kr)}
                                      className="cursor-pointer text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 size-3.5" />
                                      Hapus
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>

      <KeyResultFormDialog
        open={krDialogOpen}
        onOpenChange={(o) => {
          setKrDialogOpen(o);
          if (!o) setEditingKr(null);
        }}
        objectiveId={objective._id}
        keyResult={editingKr}
        defaultOwnerId={objective.ownerId}
      />

      <CheckInDialog
        open={Boolean(checkInTarget)}
        onOpenChange={(o) => {
          if (!o) setCheckInTarget(null);
        }}
        keyResult={checkInTarget}
      />

      <CheckInHistoryDialog
        open={Boolean(historyTarget)}
        onOpenChange={(o) => {
          if (!o) setHistoryTarget(null);
        }}
        keyResult={historyTarget}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus OKR ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua key results dan riwayat check-in akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await deleteObjective({ objectiveId: objective._id });
                  toast.success("OKR dihapus");
                } catch {
                  toast.error("Gagal menghapus");
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Key Result?</AlertDialogTitle>
            <AlertDialogDescription>
              Riwayat check-in pada KR ini juga akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteKr({ keyResultId: deleteTarget._id });
                  toast.success("KR dihapus");
                  setDeleteTarget(null);
                } catch {
                  toast.error("Gagal menghapus");
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
