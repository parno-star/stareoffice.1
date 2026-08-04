import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
} from "@/components/ui/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  Columns3,
  Flag,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  OPS_COLOR_KEYS,
  OPS_COLORS,
  getOpsColor,
} from "../_lib/ops-utils.ts";
import { useOpsConfig } from "../_lib/use-ops-config.ts";

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPS_COLOR_KEYS.map((key) => {
        const color = OPS_COLORS[key]!;
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "size-8 rounded-full border-2 transition-transform cursor-pointer",
              active
                ? "border-foreground scale-110"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color.swatch }}
            aria-label={color.label}
            title={color.label}
          />
        );
      })}
    </div>
  );
}

// ── Stage dialog ──────────────────────────────────────────────────────────────

type StageExisting = {
  id: Id<"taskStatuses"> | null;
  label: string;
  color: string;
  isCompleted: boolean;
};

function StageDialog({
  mode,
  existing,
  trigger,
}: {
  mode: "create" | "edit";
  existing?: StageExisting;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [color, setColor] = useState(existing?.color ?? OPS_COLOR_KEYS[0]!);
  const [isCompleted, setIsCompleted] = useState(existing?.isCompleted ?? false);
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.operationsSettings.createStatus);
  const update = useMutation(api.operationsSettings.updateStatus);

  const reset = () => {
    setLabel(existing?.label ?? "");
    setColor(existing?.color ?? OPS_COLOR_KEYS[0]!);
    setIsCompleted(existing?.isCompleted ?? false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (label.trim().length < 2) {
      toast.error("Nama tahapan minimal 2 karakter");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await create({ label: label.trim(), color, isCompleted });
        toast.success("Tahapan dibuat");
      } else if (existing?.id) {
        await update({ id: existing.id, label: label.trim(), color, isCompleted });
        toast.success("Tahapan diperbarui");
      }
      setOpen(false);
      reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          setOpen(v);
          if (!v) reset();
          if (v && mode === "edit" && existing) {
            setLabel(existing.label);
            setColor(existing.color);
            setIsCompleted(existing.isCompleted);
          }
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tahapan Baru" : "Ubah Tahapan"}
          </DialogTitle>
          <DialogDescription>
            Tahapan adalah kolom pada papan tugas (mis. Belum Dimulai,
            Dikerjakan, Selesai).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stage-label">Nama Tahapan</Label>
            <Input
              id="stage-label"
              placeholder="Menunggu Persetujuan"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={submitting}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label>Warna</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="text-sm">
              <p className="font-medium">Tahapan penyelesaian</p>
              <p className="text-xs text-muted-foreground">
                Tugas pada tahapan ini dihitung sebagai selesai (progres 100%).
              </p>
            </div>
            <Switch
              checked={isCompleted}
              onCheckedChange={setIsCompleted}
              aria-label="Tahapan penyelesaian"
            />
          </div>

          <div className="space-y-2">
            <Label>Pratinjau</Label>
            <div className="rounded-lg border p-3">
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded",
                  getOpsColor(color).badge,
                )}
              >
                {label.trim() || "Nama tahapan"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Priority dialog ─────────────────────────────────────────────────────────

type PriorityExisting = {
  id: Id<"taskPriorities"> | null;
  label: string;
  color: string;
};

function PriorityDialog({
  mode,
  existing,
  trigger,
}: {
  mode: "create" | "edit";
  existing?: PriorityExisting;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [color, setColor] = useState(existing?.color ?? OPS_COLOR_KEYS[0]!);
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.operationsSettings.createPriority);
  const update = useMutation(api.operationsSettings.updatePriority);

  const reset = () => {
    setLabel(existing?.label ?? "");
    setColor(existing?.color ?? OPS_COLOR_KEYS[0]!);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (label.trim().length < 2) {
      toast.error("Nama prioritas minimal 2 karakter");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await create({ label: label.trim(), color });
        toast.success("Prioritas dibuat");
      } else if (existing?.id) {
        await update({ id: existing.id, label: label.trim(), color });
        toast.success("Prioritas diperbarui");
      }
      setOpen(false);
      reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          setOpen(v);
          if (!v) reset();
          if (v && mode === "edit" && existing) {
            setLabel(existing.label);
            setColor(existing.color);
          }
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Prioritas Baru" : "Ubah Prioritas"}
          </DialogTitle>
          <DialogDescription>
            Urutan atas ke bawah menentukan tingkat urgensi (paling bawah =
            paling mendesak).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prio-label">Nama Prioritas</Label>
            <Input
              id="prio-label"
              placeholder="Kritis"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={submitting}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label>Warna</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="space-y-2">
            <Label>Pratinjau</Label>
            <div className="rounded-lg border p-3">
              <Badge variant="secondary" className={getOpsColor(color).badge}>
                {label.trim() || "Nama prioritas"}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function StageRow({
  stage,
  index,
  total,
  onMove,
}: {
  stage: {
    id: Id<"taskStatuses"> | null;
    key: string;
    label: string;
    color: string;
    isActive: boolean;
    isCompleted: boolean;
  };
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const update = useMutation(api.operationsSettings.updateStatus);
  const remove = useMutation(api.operationsSettings.removeStatus);

  const toggleActive = async (v: boolean) => {
    if (!stage.id) return;
    try {
      await update({ id: stage.id, isActive: v });
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string }).message
          : undefined;
      toast.error(msg ?? "Gagal memperbarui");
    }
  };

  const handleRemove = async () => {
    if (!stage.id) return;
    try {
      await remove({ id: stage.id });
      toast.success("Tahapan dihapus");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string }).message
          : undefined;
      toast.error(msg ?? "Gagal menghapus");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex flex-col">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-6 cursor-pointer"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label="Naikkan"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-6 cursor-pointer"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label="Turunkan"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
      <span
        className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded shrink-0",
          getOpsColor(stage.color).badge,
        )}
      >
        {stage.label}
      </span>
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {stage.isCompleted && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <CheckCircle2 className="size-3" />
            Selesai
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {stage.isActive ? "Aktif" : "Non-aktif"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={stage.isActive}
          onCheckedChange={toggleActive}
          aria-label="Aktifkan tahapan"
        />
        <StageDialog
          mode="edit"
          existing={{
            id: stage.id,
            label: stage.label,
            color: stage.color,
            isCompleted: stage.isCompleted,
          }}
          trigger={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="cursor-pointer"
              aria-label="Ubah"
            >
              <Pencil className="size-4" />
            </Button>
          }
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="cursor-pointer text-destructive"
          onClick={handleRemove}
          aria-label="Hapus"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PriorityRow({
  prio,
  index,
  total,
  onMove,
}: {
  prio: {
    id: Id<"taskPriorities"> | null;
    key: string;
    label: string;
    color: string;
    isActive: boolean;
  };
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const update = useMutation(api.operationsSettings.updatePriority);
  const remove = useMutation(api.operationsSettings.removePriority);

  const toggleActive = async (v: boolean) => {
    if (!prio.id) return;
    try {
      await update({ id: prio.id, isActive: v });
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string }).message
          : undefined;
      toast.error(msg ?? "Gagal memperbarui");
    }
  };

  const handleRemove = async () => {
    if (!prio.id) return;
    try {
      await remove({ id: prio.id });
      toast.success("Prioritas dihapus");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string }).message
          : undefined;
      toast.error(msg ?? "Gagal menghapus");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex flex-col">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-6 cursor-pointer"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label="Naikkan"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-6 cursor-pointer"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label="Turunkan"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>
      <Badge variant="secondary" className={cn("shrink-0", getOpsColor(prio.color).badge)}>
        {prio.label}
      </Badge>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-muted-foreground">
          {prio.isActive ? "Aktif" : "Non-aktif"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={prio.isActive}
          onCheckedChange={toggleActive}
          aria-label="Aktifkan prioritas"
        />
        <PriorityDialog
          mode="edit"
          existing={{ id: prio.id, label: prio.label, color: prio.color }}
          trigger={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="cursor-pointer"
              aria-label="Ubah"
            >
              <Pencil className="size-4" />
            </Button>
          }
        />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="cursor-pointer text-destructive"
          onClick={handleRemove}
          aria-label="Hapus"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function OperationsSettingsPanel() {
  const { statuses, priorities, isLoading } = useOpsConfig();
  const reorderStatuses = useMutation(api.operationsSettings.reorderStatuses);
  const reorderPriorities = useMutation(
    api.operationsSettings.reorderPriorities,
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const moveStage = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= statuses.length) return;
    const ids = statuses
      .map((s) => s.id)
      .filter((id): id is Id<"taskStatuses"> => !!id);
    if (ids.length !== statuses.length) {
      toast.info(
        "Buat atau ubah satu tahapan terlebih dahulu untuk mengaktifkan pengurutan.",
      );
      return;
    }
    const reordered = [...statuses];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    try {
      await reorderStatuses({
        orderedIds: reordered
          .map((s) => s.id)
          .filter((id): id is Id<"taskStatuses"> => !!id),
      });
    } catch {
      toast.error("Gagal mengubah urutan");
    }
  };

  const movePriority = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= priorities.length) return;
    const ids = priorities
      .map((p) => p.id)
      .filter((id): id is Id<"taskPriorities"> => !!id);
    if (ids.length !== priorities.length) {
      toast.info(
        "Buat atau ubah satu prioritas terlebih dahulu untuk mengaktifkan pengurutan.",
      );
      return;
    }
    const reordered = [...priorities];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    try {
      await reorderPriorities({
        orderedIds: reordered
          .map((p) => p.id)
          .filter((id): id is Id<"taskPriorities"> => !!id),
      });
    } catch {
      toast.error("Gagal mengubah urutan");
    }
  };

  return (
    <div className="space-y-8">
      {/* Stages */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="text-sm">
            <p className="font-medium flex items-center gap-2">
              <Columns3 className="size-4" />
              Tahapan Tugas
            </p>
            <p className="mt-1 text-muted-foreground">
              Kolom pada papan tugas. Tandai tahapan akhir sebagai
              "penyelesaian" agar progres terhitung benar. Non-aktifkan untuk
              menyembunyikan tanpa menghapus riwayat.
            </p>
          </div>
          <StageDialog
            mode="create"
            trigger={
              <Button className="gap-2 cursor-pointer">
                <Plus className="size-4" />
                Tambah Tahapan
              </Button>
            }
          />
        </div>

        {statuses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Columns3 className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Belum ada tahapan. Tambahkan tahapan pertama Anda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {statuses.map((stage, i) => (
              <StageRow
                key={stage.id ?? stage.key}
                stage={stage}
                index={i}
                total={statuses.length}
                onMove={moveStage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Priorities */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="text-sm">
            <p className="font-medium flex items-center gap-2">
              <Flag className="size-4" />
              Tingkat Prioritas
            </p>
            <p className="mt-1 text-muted-foreground">
              Level prioritas tugas. Urutan menentukan tingkat urgensi dalam
              daftar tugas.
            </p>
          </div>
          <PriorityDialog
            mode="create"
            trigger={
              <Button className="gap-2 cursor-pointer">
                <Plus className="size-4" />
                Tambah Prioritas
              </Button>
            }
          />
        </div>

        {priorities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Flag className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Belum ada prioritas. Tambahkan prioritas pertama Anda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {priorities.map((prio, i) => (
              <PriorityRow
                key={prio.id ?? prio.key}
                prio={prio}
                index={i}
                total={priorities.length}
                onMove={movePriority}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
