import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  GraduationCap,
  BookOpen,
  Briefcase,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Award,
  MapPin,
  Building2,
  FileBadge,
  Clock,
  Sparkles,
  Users2,
  Trophy,
  Paperclip,
  Download,
  ShieldCheck,
} from "lucide-react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import EducationFormDialog from "./EducationFormDialog.tsx";
import TrainingFormDialog from "./TrainingFormDialog.tsx";
import PositionFormDialog from "./PositionFormDialog.tsx";
import OrganizationFormDialog from "./OrganizationFormDialog.tsx";
import AwardFormDialog from "./AwardFormDialog.tsx";
import {
  AWARD_CATEGORY_LABEL,
  AWARD_LEVEL_LABEL,
  EDUCATION_LEVEL_LABEL,
  ORGANIZATION_CATEGORY_LABEL,
  POSITION_CHANGE_LABEL,
  TRAINING_CATEGORY_LABEL,
  formatDateId,
  formatDateRangeId,
  formatYearRange,
} from "../_lib/history-utils.ts";

type Props = {
  userId: Id<"users">;
};

export default function EmployeeHistorySection({ userId }: Props) {
  const education = useQuery(api.employeeHistory.listEducation, { userId });
  const training = useQuery(api.employeeHistory.listTraining, { userId });
  const positions = useQuery(api.employeeHistory.listPositions, { userId });
  const organizations = useQuery(api.employeeHistory.listOrganizations, {
    userId,
  });
  const awards = useQuery(api.employeeHistory.listAwards, { userId });
  const permissions = useQuery(api.employeeHistory.historyPermissions, {
    userId,
  });
  const canManage = permissions?.canManage ?? false;
  const requiresApproval = permissions?.requiresApproval ?? false;
  const canManagePosition = permissions?.canManagePosition ?? false;

  const [tab, setTab] = useState<
    "positions" | "education" | "training" | "organizations" | "awards"
  >("positions");

  // Dialog state
  const [eduDialogOpen, setEduDialogOpen] = useState(false);
  const [editingEdu, setEditingEdu] = useState<
    (Doc<"employeeEducation"> & { attachmentUrl?: string | null }) | null
  >(null);

  const [trDialogOpen, setTrDialogOpen] = useState(false);
  const [editingTr, setEditingTr] = useState<
    (Doc<"employeeTrainingHistory"> & { attachmentUrl?: string | null }) | null
  >(null);

  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [editingPos, setEditingPos] =
    useState<Doc<"employeePositionHistory"> | null>(null);

  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<
    | (Doc<"employeeOrganizationHistory"> & { attachmentUrl?: string | null })
    | null
  >(null);

  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [editingAward, setEditingAward] = useState<
    (Doc<"employeeAwardHistory"> & { attachmentUrl?: string | null }) | null
  >(null);

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "education"; id: Id<"employeeEducation">; label: string }
    | { kind: "training"; id: Id<"employeeTrainingHistory">; label: string }
    | { kind: "position"; id: Id<"employeePositionHistory">; label: string }
    | {
        kind: "organization";
        id: Id<"employeeOrganizationHistory">;
        label: string;
      }
    | { kind: "award"; id: Id<"employeeAwardHistory">; label: string }
    | null
  >(null);

  const deleteEdu = useMutation(api.employeeHistory.deleteEducation);
  const deleteTr = useMutation(api.employeeHistory.deleteTraining);
  const deletePos = useMutation(api.employeeHistory.deletePosition);
  const deleteOrg = useMutation(api.employeeHistory.deleteOrganization);
  const deleteAward = useMutation(api.employeeHistory.deleteAward);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      let queued = false;
      if (pendingDelete.kind === "education") {
        const res = await deleteEdu({ id: pendingDelete.id });
        queued = res?.queued ?? false;
      } else if (pendingDelete.kind === "training") {
        const res = await deleteTr({ id: pendingDelete.id });
        queued = res?.queued ?? false;
      } else if (pendingDelete.kind === "position") {
        await deletePos({ id: pendingDelete.id });
      } else if (pendingDelete.kind === "organization") {
        const res = await deleteOrg({ id: pendingDelete.id });
        queued = res?.queued ?? false;
      } else {
        const res = await deleteAward({ id: pendingDelete.id });
        queued = res?.queued ?? false;
      }
      toast.success(
        queued
          ? "Permintaan penghapusan dikirim untuk verifikasi HR"
          : "Data dihapus",
      );
      setPendingDelete(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="mr-1 inline size-3" />
              Riwayat Karyawan
            </h2>
            <p className="text-xs text-muted-foreground">
              Jabatan, pendidikan, pelatihan, organisasi, dan penghargaan.
            </p>
          </div>
        </div>

        {requiresApproval ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Perubahan riwayat yang Anda buat akan ditinjau oleh HR terlebih
              dahulu sebelum ditampilkan.
            </span>
          </div>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(v) =>
            setTab(
              v as
                | "positions"
                | "education"
                | "training"
                | "organizations"
                | "awards",
            )
          }
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="positions" className="gap-1.5">
              <Briefcase className="size-3.5" />
              <span className="hidden sm:inline">Jabatan</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {positions?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="education" className="gap-1.5">
              <GraduationCap className="size-3.5" />
              <span className="hidden sm:inline">Pendidikan</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {education?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-1.5">
              <BookOpen className="size-3.5" />
              <span className="hidden sm:inline">Pelatihan</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {training?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="organizations" className="gap-1.5">
              <Users2 className="size-3.5" />
              <span className="hidden sm:inline">Organisasi</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {organizations?.length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="awards" className="gap-1.5">
              <Trophy className="size-3.5" />
              <span className="hidden sm:inline">Penghargaan</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {awards?.length ?? 0}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="positions" className="m-0">
              {canManagePosition ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingPos(null);
                      setPosDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Tambah Jabatan
                  </Button>
                </div>
              ) : canManage ? (
                <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Riwayat jabatan dikelola oleh HR dan tidak dapat diubah dari
                  sini.
                </p>
              ) : null}

              {positions === undefined ? (
                <ListSkeleton />
              ) : positions.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Briefcase />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada riwayat jabatan</EmptyTitle>
                    <EmptyDescription>
                      Tambahkan jabatan awal, promosi, atau mutasi.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Timeline>
                  {positions.map((p) => (
                    <PositionItem
                      key={p._id}
                      item={p}
                      canManage={canManagePosition}
                      onEdit={() => {
                        setEditingPos(p);
                        setPosDialogOpen(true);
                      }}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "position",
                          id: p._id,
                          label: p.jobTitle,
                        })
                      }
                    />
                  ))}
                </Timeline>
              )}
            </TabsContent>

            <TabsContent value="education" className="m-0">
              {canManage ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingEdu(null);
                      setEduDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Tambah Pendidikan
                  </Button>
                </div>
              ) : null}

              {education === undefined ? (
                <ListSkeleton />
              ) : education.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <GraduationCap />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada riwayat pendidikan</EmptyTitle>
                    <EmptyDescription>
                      Tambahkan jenjang SMA, D3, S1, dan seterusnya.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Timeline>
                  {education.map((e) => (
                    <EducationItem
                      key={e._id}
                      item={e}
                      canManage={!!canManage}
                      onEdit={() => {
                        setEditingEdu(e);
                        setEduDialogOpen(true);
                      }}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "education",
                          id: e._id,
                          label: e.institution,
                        })
                      }
                    />
                  ))}
                </Timeline>
              )}
            </TabsContent>

            <TabsContent value="training" className="m-0">
              {canManage ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingTr(null);
                      setTrDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Tambah Pelatihan
                  </Button>
                </div>
              ) : null}

              {training === undefined ? (
                <ListSkeleton />
              ) : training.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BookOpen />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada riwayat pelatihan</EmptyTitle>
                    <EmptyDescription>
                      Catat pelatihan, sertifikasi, atau workshop yang pernah
                      diikuti.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Timeline>
                  {training.map((t) => (
                    <TrainingItem
                      key={t._id}
                      item={t}
                      canManage={!!canManage}
                      onEdit={() => {
                        setEditingTr(t);
                        setTrDialogOpen(true);
                      }}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "training",
                          id: t._id,
                          label: t.title,
                        })
                      }
                    />
                  ))}
                </Timeline>
              )}
            </TabsContent>

            <TabsContent value="organizations" className="m-0">
              {canManage ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingOrg(null);
                      setOrgDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Tambah Organisasi
                  </Button>
                </div>
              ) : null}

              {organizations === undefined ? (
                <ListSkeleton />
              ) : organizations.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Users2 />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada riwayat organisasi</EmptyTitle>
                    <EmptyDescription>
                      Tambahkan organisasi internal, komunitas, asosiasi profesi,
                      atau keanggotaan lainnya.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Timeline>
                  {organizations.map((o) => (
                    <OrganizationItem
                      key={o._id}
                      item={o}
                      canManage={!!canManage}
                      onEdit={() => {
                        setEditingOrg(o);
                        setOrgDialogOpen(true);
                      }}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "organization",
                          id: o._id,
                          label: o.organizationName,
                        })
                      }
                    />
                  ))}
                </Timeline>
              )}
            </TabsContent>

            <TabsContent value="awards" className="m-0">
              {canManage ? (
                <div className="mb-3 flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setEditingAward(null);
                      setAwardDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Tambah Penghargaan
                  </Button>
                </div>
              ) : null}

              {awards === undefined ? (
                <ListSkeleton />
              ) : awards.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Trophy />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada riwayat penghargaan</EmptyTitle>
                    <EmptyDescription>
                      Catat penghargaan, apresiasi, atau kompetisi yang pernah
                      diterima.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Timeline>
                  {awards.map((a) => (
                    <AwardItem
                      key={a._id}
                      item={a}
                      canManage={!!canManage}
                      onEdit={() => {
                        setEditingAward(a);
                        setAwardDialogOpen(true);
                      }}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "award",
                          id: a._id,
                          label: a.title,
                        })
                      }
                    />
                  ))}
                </Timeline>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>

      {/* Dialogs - only rendered when open to reset form state between add/edit */}
      {eduDialogOpen ? (
        <EducationFormDialog
          open={eduDialogOpen}
          onOpenChange={(open) => {
            setEduDialogOpen(open);
            if (!open) setEditingEdu(null);
          }}
          userId={userId}
          editing={editingEdu}
        />
      ) : null}
      {trDialogOpen ? (
        <TrainingFormDialog
          open={trDialogOpen}
          onOpenChange={(open) => {
            setTrDialogOpen(open);
            if (!open) setEditingTr(null);
          }}
          userId={userId}
          editing={editingTr}
        />
      ) : null}
      {posDialogOpen ? (
        <PositionFormDialog
          open={posDialogOpen}
          onOpenChange={(open) => {
            setPosDialogOpen(open);
            if (!open) setEditingPos(null);
          }}
          userId={userId}
          editing={editingPos}
        />
      ) : null}
      {orgDialogOpen ? (
        <OrganizationFormDialog
          open={orgDialogOpen}
          onOpenChange={(open) => {
            setOrgDialogOpen(open);
            if (!open) setEditingOrg(null);
          }}
          userId={userId}
          editing={editingOrg}
        />
      ) : null}
      {awardDialogOpen ? (
        <AwardFormDialog
          open={awardDialogOpen}
          onOpenChange={(open) => {
            setAwardDialogOpen(open);
            if (!open) setEditingAward(null);
          }}
          userId={userId}
          editing={editingAward}
        />
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.label}" akan dihapus dari riwayat. Tindakan ini tidak dapat dibatalkan.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Timeline({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative space-y-3 border-l-2 border-muted pl-5">
      {children}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

function ItemActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Menu tindakan"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={onEdit}
          className="cursor-pointer gap-2"
        >
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimelineDot({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="absolute -left-[30px] flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary/15 text-primary ring-2 ring-primary/20">
      {icon}
    </div>
  );
}

// Small download chip shown on a history entry when it has an attached document.
function AttachmentLink({
  url,
  name,
}: {
  url: string | null | undefined;
  name: string | null | undefined;
}) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:bg-muted/60 cursor-pointer"
    >
      <Paperclip className="size-3 shrink-0" />
      <span className="truncate">{name ?? "Dokumen"}</span>
      <Download className="size-3 shrink-0 text-muted-foreground" />
    </a>
  );
}

function PositionItem({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: Doc<"employeePositionHistory">;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const changeLabel = item.changeType
    ? POSITION_CHANGE_LABEL[item.changeType] ?? item.changeType
    : null;
  return (
    <div className="relative rounded-lg border bg-background p-3">
      <TimelineDot icon={<Briefcase className="size-3.5" />} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.jobTitle}</p>
            {item.isCurrent ? (
              <Badge className="h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Saat Ini
              </Badge>
            ) : null}
            {changeLabel ? (
              <Badge variant="secondary" className="h-5 text-xs">
                {changeLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <Clock className="mr-1 inline size-3" />
            {formatDateRangeId(item.startDate, item.endDate, item.isCurrent)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.department ? (
              <span>
                <Building2 className="mr-1 inline size-3" />
                {item.department}
              </span>
            ) : null}
            {item.location ? (
              <span>
                <MapPin className="mr-1 inline size-3" />
                {item.location}
              </span>
            ) : null}
            {item.managerName ? (
              <span>Atasan: {item.managerName}</span>
            ) : null}
            {item.referenceNumber ? (
              <span>
                <FileBadge className="mr-1 inline size-3" />
                {item.referenceNumber}
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <ItemActions onEdit={onEdit} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}

function EducationItem({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: Doc<"employeeEducation"> & { attachmentUrl?: string | null };
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const levelLabel = EDUCATION_LEVEL_LABEL[item.level] ?? item.level;
  return (
    <div className="relative rounded-lg border bg-background p-3">
      <TimelineDot icon={<GraduationCap className="size-3.5" />} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.institution}</p>
            <Badge variant="secondary" className="h-5 text-xs">
              {levelLabel}
            </Badge>
            {item.isCurrent ? (
              <Badge className="h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Berlangsung
              </Badge>
            ) : null}
          </div>
          {item.fieldOfStudy ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {item.fieldOfStudy}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <Clock className="mr-1 inline size-3" />
              {formatYearRange(item.startYear, item.endYear, item.isCurrent)}
            </span>
            {item.gpa !== undefined ? (
              <span>
                <Award className="mr-1 inline size-3" />
                IPK / Nilai: {item.gpa}
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description}
            </p>
          ) : null}
          <AttachmentLink url={item.attachmentUrl} name={item.attachmentName} />
        </div>
        {canManage ? (
          <ItemActions onEdit={onEdit} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}

function TrainingItem({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: Doc<"employeeTrainingHistory"> & { attachmentUrl?: string | null };
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catLabel = TRAINING_CATEGORY_LABEL[item.category] ?? item.category;
  return (
    <div className="relative rounded-lg border bg-background p-3">
      <TimelineDot icon={<BookOpen className="size-3.5" />} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.title}</p>
            <Badge variant="secondary" className="h-5 text-xs">
              {catLabel}
            </Badge>
            {item.hasCertificate ? (
              <Badge className="h-5 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <FileBadge className="mr-1 size-3" />
                Sertifikat
              </Badge>
            ) : null}
          </div>
          {item.provider ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {item.provider}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.startDate || item.endDate ? (
              <span>
                <Clock className="mr-1 inline size-3" />
                {formatDateRangeId(item.startDate, item.endDate)}
              </span>
            ) : null}
            {item.durationHours !== undefined ? (
              <span>{item.durationHours} jam</span>
            ) : null}
            {item.location ? (
              <span>
                <MapPin className="mr-1 inline size-3" />
                {item.location}
              </span>
            ) : null}
            {item.result ? <span>Hasil: {item.result}</span> : null}
            {item.certificateNumber ? (
              <span>Nomor: {item.certificateNumber}</span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description}
            </p>
          ) : null}
          <AttachmentLink url={item.attachmentUrl} name={item.attachmentName} />
        </div>
        {canManage ? (
          <ItemActions onEdit={onEdit} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}

function OrganizationItem({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: Doc<"employeeOrganizationHistory"> & { attachmentUrl?: string | null };
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const categoryLabel = item.category
    ? ORGANIZATION_CATEGORY_LABEL[item.category] ?? item.category
    : null;
  return (
    <div className="relative rounded-lg border bg-background p-3">
      <TimelineDot icon={<Users2 className="size-3.5" />} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.organizationName}</p>
            {categoryLabel ? (
              <Badge variant="secondary" className="h-5 text-xs">
                {categoryLabel}
              </Badge>
            ) : null}
            {item.isCurrent ? (
              <Badge className="h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Aktif
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <Briefcase className="mr-1 inline size-3" />
            {item.role}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.startDate || item.endDate || item.isCurrent ? (
              <span>
                <Clock className="mr-1 inline size-3" />
                {formatDateRangeId(
                  item.startDate,
                  item.endDate,
                  item.isCurrent,
                )}
              </span>
            ) : null}
            {item.location ? (
              <span>
                <MapPin className="mr-1 inline size-3" />
                {item.location}
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description}
            </p>
          ) : null}
          {item.achievements ? (
            <div className="mt-2 rounded-md bg-amber-500/10 p-2 text-sm">
              <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <Trophy className="size-3" />
                Pencapaian
              </p>
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                {item.achievements}
              </p>
            </div>
          ) : null}
          <AttachmentLink url={item.attachmentUrl} name={item.attachmentName} />
        </div>
        {canManage ? (
          <ItemActions onEdit={onEdit} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}

function AwardItem({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: Doc<"employeeAwardHistory"> & { attachmentUrl?: string | null };
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const categoryLabel = item.category
    ? AWARD_CATEGORY_LABEL[item.category] ?? item.category
    : null;
  const levelLabel = item.level
    ? AWARD_LEVEL_LABEL[item.level] ?? item.level
    : null;
  return (
    <div className="relative rounded-lg border bg-background p-3">
      <TimelineDot icon={<Trophy className="size-3.5" />} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.title}</p>
            {categoryLabel ? (
              <Badge variant="secondary" className="h-5 text-xs">
                {categoryLabel}
              </Badge>
            ) : null}
            {levelLabel ? (
              <Badge className="h-5 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                {levelLabel}
              </Badge>
            ) : null}
            {item.hasCertificate ? (
              <Badge className="h-5 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <FileBadge className="mr-1 size-3" />
                Sertifikat
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <Award className="mr-1 inline size-3" />
            {item.issuer}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.awardDate ? (
              <span>
                <Clock className="mr-1 inline size-3" />
                {formatDateId(item.awardDate)}
              </span>
            ) : null}
            {item.location ? (
              <span>
                <MapPin className="mr-1 inline size-3" />
                {item.location}
              </span>
            ) : null}
            {item.certificateNumber ? (
              <span>Nomor: {item.certificateNumber}</span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description}
            </p>
          ) : null}
          <AttachmentLink url={item.attachmentUrl} name={item.attachmentName} />
        </div>
        {canManage ? (
          <ItemActions onEdit={onEdit} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}
