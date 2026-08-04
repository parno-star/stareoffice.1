import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
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
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Rocket,
  UserPlus,
  ArrowRight,
  Clock,
  Ban,
  Briefcase,
  Building2,
  UserCog,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import { STATUS_STYLES } from "./ScenariosPanel.tsx";

type Props = {
  scenarioId: Id<"orgScenarios"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUsers: Array<Doc<"users">>;
  currentUserId: Id<"users"> | null;
  isAdmin: boolean;
};

const CHANGE_TYPES: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  set_manager: {
    label: "Ganti Atasan",
    icon: UserCog,
    color: "text-sky-600 dark:text-sky-400",
  },
  set_department: {
    label: "Pindah Departemen",
    icon: Building2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  set_job_title: {
    label: "Ubah Jabatan",
    icon: Briefcase,
    color: "text-amber-600 dark:text-amber-400",
  },
};

export default function ScenarioDetailDialog({
  scenarioId,
  open,
  onOpenChange,
  allUsers,
  currentUserId,
  isAdmin,
}: Props) {
  const detail = useQuery(
    api.orgAdvanced.scenarios.getScenario,
    scenarioId ? { scenarioId } : "skip",
  );

  const addChange = useMutation(api.orgAdvanced.scenarios.addChange);
  const removeChange = useMutation(api.orgAdvanced.scenarios.removeChange);
  const setApprovers = useMutation(api.orgAdvanced.scenarios.setApprovers);
  const submitForApproval = useMutation(
    api.orgAdvanced.scenarios.submitForApproval,
  );
  const decideApproval = useMutation(api.orgAdvanced.scenarios.decideApproval);
  const applyScenario = useMutation(api.orgAdvanced.scenarios.applyScenario);
  const deleteScenario = useMutation(api.orgAdvanced.scenarios.deleteScenario);
  const cancelScenario = useMutation(api.orgAdvanced.scenarios.cancelScenario);

  const [showAddChange, setShowAddChange] = useState(false);
  const [decideDialog, setDecideDialog] = useState<"approve" | "reject" | null>(
    null,
  );
  const [decideNote, setDecideNote] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (!scenarioId) return null;

  const isLoading = detail === undefined;
  const scenario = detail?.scenario ?? null;
  const changes = detail?.changes ?? [];
  const approvals = detail?.approvals ?? [];

  const style = scenario ? STATUS_STYLES[scenario.status] : null;
  const StatusIcon = style?.icon ?? Clock;

  const canEdit = isAdmin && scenario?.status === "draft";
  const myApproval = approvals.find(
    (a) => a.approval.approverId === currentUserId,
  );
  const earlierApproved = myApproval
    ? approvals
        .filter((a) => a.approval.order < myApproval.approval.order)
        .every((a) => a.approval.decision === "approved")
    : false;
  const canDecide =
    scenario?.status === "pending" &&
    myApproval?.approval.decision === "pending" &&
    earlierApproved;
  const canApply = isAdmin && scenario?.status === "approved";
  const canSubmit =
    canEdit && changes.length > 0 && approvals.length > 0;

  const handleSubmit = async () => {
    if (!scenarioId) return;
    try {
      await submitForApproval({ scenarioId });
      toast.success("Skenario diajukan untuk disetujui");
    } catch (error) {
      showError(error, "Gagal mengajukan skenario");
    }
  };

  const handleApply = async () => {
    if (!scenarioId) return;
    try {
      await applyScenario({ scenarioId });
      toast.success("Skenario berhasil diterapkan");
    } catch (error) {
      showError(error, "Gagal menerapkan skenario");
    }
  };

  const handleDecide = async () => {
    if (!scenarioId || !decideDialog) return;
    try {
      await decideApproval({
        scenarioId,
        approve: decideDialog === "approve",
        note: decideNote.trim() || undefined,
      });
      toast.success(
        decideDialog === "approve" ? "Persetujuan diberikan" : "Skenario ditolak",
      );
      setDecideDialog(null);
      setDecideNote("");
    } catch (error) {
      showError(error, "Gagal memperbarui keputusan");
    }
  };

  const handleDelete = async () => {
    if (!scenarioId) return;
    try {
      await deleteScenario({ scenarioId });
      toast.success("Skenario dihapus");
      setDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      showError(error, "Gagal menghapus skenario");
    }
  };

  const handleCancel = async () => {
    if (!scenarioId) return;
    try {
      await cancelScenario({ scenarioId });
      toast.success("Skenario dibatalkan");
    } catch (error) {
      showError(error, "Gagal membatalkan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {style ? (
                  <Badge className={cn("gap-1 border-0", style.className)}>
                    <StatusIcon className="size-3" />
                    {style.label}
                  </Badge>
                ) : null}
                {scenario?.effectiveDate ? (
                  <span className="text-xs text-muted-foreground">
                    berlaku {scenario.effectiveDate}
                  </span>
                ) : null}
              </div>
              <DialogTitle className="mt-1.5 text-xl">
                {scenario?.name ?? "Memuat..."}
              </DialogTitle>
              {scenario?.description ? (
                <DialogDescription className="mt-1">
                  {scenario.description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !scenario ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Skenario tidak ditemukan.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Changes */}
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Perubahan ({changes.length})
                </h3>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={() => setShowAddChange((v) => !v)}
                  >
                    <Plus className="size-4" />
                    Tambah
                  </Button>
                ) : null}
              </div>

              {showAddChange && canEdit ? (
                <AddChangeForm
                  scenarioId={scenario._id}
                  allUsers={allUsers}
                  onAdded={() => setShowAddChange(false)}
                  onCancel={() => setShowAddChange(false)}
                  addChange={addChange}
                />
              ) : null}

              {changes.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  Belum ada perubahan. Tambahkan minimal 1 perubahan sebelum
                  mengajukan.
                </p>
              ) : (
                <ul className="space-y-2">
                  {changes.map(({ change, user, afterManager }) => {
                    const meta = CHANGE_TYPES[change.changeType];
                    const Icon = meta?.icon ?? GripVertical;
                    return (
                      <li
                        key={change._id}
                        className="flex items-start gap-3 rounded-lg border bg-card p-3"
                      >
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
                            meta?.color,
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-medium">
                            {meta?.label ?? change.changeType}{" "}
                            <span className="text-muted-foreground">
                              · {user?.name ?? "—"}
                            </span>
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {change.beforeValue ?? "—"}
                            </span>
                            <ArrowRight className="size-3" />
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                              {change.changeType === "set_manager"
                                ? afterManager?.name ??
                                  (change.afterManagerId === null
                                    ? "— (tanpa atasan)"
                                    : "—")
                                : change.afterValue ?? "—"}
                            </span>
                          </div>
                          {change.note ? (
                            <p className="mt-1 text-[11px] italic text-muted-foreground">
                              {change.note}
                            </p>
                          ) : null}
                        </div>
                        {canEdit ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await removeChange({ changeId: change._id });
                                toast.success("Perubahan dihapus");
                              } catch (err) {
                                showError(err, "Gagal menghapus");
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Approvers */}
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Rantai Persetujuan ({approvals.length})
                </h3>
                {canEdit ? (
                  <ApproverPicker
                    scenarioId={scenario._id}
                    allUsers={allUsers}
                    current={approvals}
                    setApprovers={setApprovers}
                  />
                ) : null}
              </div>
              {approvals.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  Belum ada approver. Tambahkan urutan approver untuk bisa
                  diajukan.
                </p>
              ) : (
                <ol className="space-y-2">
                  {approvals.map(({ approval, approver }) => (
                    <li
                      key={approval._id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border bg-card p-3",
                        approval.decision === "approved" &&
                          "border-emerald-500/40 bg-emerald-500/5",
                        approval.decision === "rejected" &&
                          "border-rose-500/40 bg-rose-500/5",
                      )}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {approval.order}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">
                          {approver?.name ?? "Pengguna dihapus"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {approver?.jobTitle ?? "—"}
                        </p>
                        {approval.note ? (
                          <p className="mt-1 text-[11px] italic text-muted-foreground">
                            "{approval.note}"
                          </p>
                        ) : null}
                      </div>
                      <Badge
                        className={cn(
                          "border-0",
                          approval.decision === "approved" &&
                            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                          approval.decision === "rejected" &&
                            "bg-rose-500/15 text-rose-700 dark:text-rose-400",
                          approval.decision === "pending" &&
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {approval.decision === "approved"
                          ? "Disetujui"
                          : approval.decision === "rejected"
                            ? "Ditolak"
                            : "Menunggu"}
                      </Badge>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              {canDecide ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDecideDialog("reject");
                      setDecideNote("");
                    }}
                    className="gap-1.5 text-rose-600 hover:text-rose-600 dark:text-rose-400"
                  >
                    <XCircle className="size-4" />
                    Tolak
                  </Button>
                  <Button
                    onClick={() => {
                      setDecideDialog("approve");
                      setDecideNote("");
                    }}
                    className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="size-4" />
                    Setujui
                  </Button>
                </>
              ) : null}
              {canSubmit ? (
                <Button onClick={handleSubmit} className="gap-1.5">
                  <Send className="size-4" />
                  Ajukan Persetujuan
                </Button>
              ) : null}
              {canApply ? (
                <Button
                  onClick={handleApply}
                  className="gap-1.5 bg-sky-600 text-white hover:bg-sky-700"
                >
                  <Rocket className="size-4" />
                  Terapkan Skenario
                </Button>
              ) : null}
              {isAdmin &&
              scenario.status !== "applied" &&
              scenario.status !== "cancelled" ? (
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="gap-1.5"
                >
                  <Ban className="size-4" />
                  Batalkan
                </Button>
              ) : null}
              {isAdmin && scenario.status !== "applied" ? (
                <Button
                  variant="ghost"
                  onClick={() => setDeleteConfirm(true)}
                  className="gap-1.5 text-rose-600 hover:text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="size-4" />
                  Hapus
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={decideDialog !== null} onOpenChange={(v) => !v && setDecideDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decideDialog === "approve"
                ? "Setujui skenario?"
                : "Tolak skenario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decideDialog === "approve"
                ? "Skenario akan diteruskan ke approver berikutnya (jika ada)."
                : "Penolakan akan menghentikan alur dan menandai skenario sebagai ditolak."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="decide-note" className="text-xs">
              Catatan (opsional)
            </Label>
            <Textarea
              id="decide-note"
              value={decideNote}
              onChange={(e) => setDecideNote(e.target.value)}
              rows={2}
              placeholder="Tambahkan alasan atau komentar..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecide}>
              {decideDialog === "approve" ? "Setujui" : "Tolak"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus skenario?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Semua perubahan & approver
              akan hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function showError(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string };
    toast.error(data.message ?? fallback);
  } else {
    toast.error(fallback);
  }
}

type AddChangeMutation = ReturnType<
  typeof useMutation<typeof api.orgAdvanced.scenarios.addChange>
>;
type SetApproversMutation = ReturnType<
  typeof useMutation<typeof api.orgAdvanced.scenarios.setApprovers>
>;

function AddChangeForm({
  scenarioId,
  allUsers,
  onAdded,
  onCancel,
  addChange,
}: {
  scenarioId: Id<"orgScenarios">;
  allUsers: Array<Doc<"users">>;
  onAdded: () => void;
  onCancel: () => void;
  addChange: AddChangeMutation;
}) {
  const [changeType, setChangeType] = useState<string>("set_manager");
  const [userId, setUserId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("none");
  const [textValue, setTextValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of allUsers) {
      if (u.department && u.department.trim().length > 0) {
        set.add(u.department.trim());
      }
    }
    return Array.from(set).sort();
  }, [allUsers]);

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Pilih karyawan");
      return;
    }
    setSaving(true);
    try {
      if (changeType === "set_manager") {
        await addChange({
          scenarioId,
          changeType,
          userId: userId as Id<"users">,
          afterManagerId:
            managerId === "none"
              ? null
              : managerId === ""
                ? undefined
                : (managerId as Id<"users">),
          note: note.trim() || undefined,
        });
      } else {
        if (!textValue.trim()) {
          toast.error("Masukkan nilai baru");
          setSaving(false);
          return;
        }
        await addChange({
          scenarioId,
          changeType,
          userId: userId as Id<"users">,
          afterValue: textValue.trim(),
          note: note.trim() || undefined,
        });
      }
      toast.success("Perubahan ditambahkan");
      setUserId("");
      setManagerId("none");
      setTextValue("");
      setNote("");
      onAdded();
    } catch (err) {
      showError(err, "Gagal menambah perubahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Jenis Perubahan</Label>
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set_manager">Ganti Atasan</SelectItem>
              <SelectItem value="set_department">Pindah Departemen</SelectItem>
              <SelectItem value="set_job_title">Ubah Jabatan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Karyawan</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih karyawan" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {allUsers.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name ?? "Tanpa Nama"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {changeType === "set_manager" ? (
        <div className="space-y-1">
          <Label className="text-xs">Atasan Baru</Label>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih atasan" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">— (Tanpa Atasan)</SelectItem>
              {allUsers
                .filter((u) => u._id !== userId)
                .map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? "Tanpa Nama"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : changeType === "set_department" ? (
        <div className="space-y-1">
          <Label className="text-xs">Departemen Baru</Label>
          <Input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Nama departemen"
            list="scenario-department-suggestions"
          />
          <datalist id="scenario-department-suggestions">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Jabatan Baru</Label>
          <Input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Contoh: Senior Product Manager"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Catatan (opsional)</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Alasan atau konteks..."
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? "Menambahkan..." : "Tambah Perubahan"}
        </Button>
      </div>
    </div>
  );
}

function ApproverPicker({
  scenarioId,
  allUsers,
  current,
  setApprovers,
}: {
  scenarioId: Id<"orgScenarios">;
  allUsers: Array<Doc<"users">>;
  current: Array<{
    approval: Doc<"orgScenarioApprovals">;
    approver: Doc<"users"> | null;
  }>;
  setApprovers: SetApproversMutation;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Array<Id<"users">>>(
    current.map((a) => a.approval.approverId),
  );
  const [saving, setSaving] = useState(false);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelected((arr) => {
      const next = arr.slice();
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (idx: number) => {
    setSelected((arr) => {
      if (idx >= arr.length - 1) return arr;
      const next = arr.slice();
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setApprovers({ scenarioId, approverIds: selected });
      toast.success("Approver diperbarui");
      setOpen(false);
    } catch (err) {
      showError(err, "Gagal menyimpan approver");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5"
        onClick={() => {
          setSelected(current.map((a) => a.approval.approverId));
          setOpen(true);
        }}
      >
        <UserPlus className="size-4" />
        Atur Approver
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Rantai Approver</DialogTitle>
            <DialogDescription>
              Pilih approver berurutan. Persetujuan harus diberikan sesuai
              urutan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Select
              value=""
              onValueChange={(v) => {
                if (!v) return;
                if (!selected.includes(v as Id<"users">)) {
                  setSelected((arr) => [...arr, v as Id<"users">]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tambahkan approver..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {allUsers
                  .filter((u) => !selected.includes(u._id))
                  .map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? "Tanpa Nama"}
                      {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {selected.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                Belum ada approver.
              </p>
            ) : (
              <ol className="space-y-2">
                {selected.map((uid, idx) => {
                  const u = allUsers.find((x) => x._id === uid);
                  return (
                    <li
                      key={uid}
                      className="flex items-center gap-2 rounded-lg border bg-card p-2"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {u?.name ?? "Tanpa Nama"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {u?.jobTitle ?? "—"}
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => moveDown(idx)}
                        disabled={idx === selected.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() =>
                          setSelected((arr) => arr.filter((x) => x !== uid))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
