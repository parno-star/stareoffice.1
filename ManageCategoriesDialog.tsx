import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Plus,
  Trash2,
  Check,
  X,
  Pencil,
  Tags,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  CATEGORY_CONFIG,
  CATEGORY_COLORS,
  getCategoryConfig,
} from "../_lib/fund-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ManageCategoriesDialog({ open, onClose }: Props) {
  const customs = useQuery(api.fundRequests.listCategories, {});
  const createCategory = useMutation(api.fundRequests.createCategory);
  const updateCategory = useMutation(api.fundRequests.updateCategory);
  const deleteCategory = useMutation(api.fundRequests.deleteCategory);

  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState<string>("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<Id<"fundCategories"> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("slate");
  const [editDescription, setEditDescription] = useState("");

  const isLoading = customs === undefined;

  const resetNewForm = () => {
    setNewLabel("");
    setNewDescription("");
    setNewColor("blue");
  };

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (label.length < 2) {
      toast.error("Nama kategori minimal 2 karakter");
      return;
    }
    setIsSubmitting(true);
    try {
      await createCategory({
        label,
        description: newDescription.trim() || undefined,
        color: newColor,
      });
      toast.success("Kategori baru ditambahkan");
      resetNewForm();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menambah kategori");
      } else {
        toast.error("Gagal menambah kategori");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (row: {
    _id: Id<"fundCategories">;
    label: string;
    color: string;
    description?: string;
  }) => {
    setEditingId(row._id);
    setEditLabel(row.label);
    setEditColor(row.color);
    setEditDescription(row.description ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditColor("slate");
    setEditDescription("");
  };

  const saveEdit = async (id: Id<"fundCategories">) => {
    const label = editLabel.trim();
    if (label.length < 2) {
      toast.error("Nama kategori minimal 2 karakter");
      return;
    }
    try {
      await updateCategory({
        id,
        label,
        color: editColor,
        description: editDescription,
      });
      toast.success("Kategori diperbarui");
      cancelEdit();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal memperbarui kategori");
      } else {
        toast.error("Gagal memperbarui kategori");
      }
    }
  };

  const toggleActive = async (
    id: Id<"fundCategories">,
    currentlyActive: boolean,
  ) => {
    try {
      await updateCategory({ id, isActive: !currentlyActive });
      toast.success(
        !currentlyActive ? "Kategori diaktifkan" : "Kategori disembunyikan",
      );
    } catch {
      toast.error("Gagal mengubah status kategori");
    }
  };

  const handleDelete = async (id: Id<"fundCategories">, label: string) => {
    if (!window.confirm(`Hapus kategori "${label}"?`)) return;
    try {
      await deleteCategory({ id });
      toast.success("Kategori dihapus");
    } catch {
      toast.error("Gagal menghapus kategori");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Tags className="size-5" />
            Kelola Kategori Pengajuan Dana
          </DialogTitle>
          <DialogDescription>
            Tambah kategori khusus yang akan muncul di dropdown saat karyawan
            membuat pengajuan dana.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4" type="always">
          <div className="space-y-6">
            {/* Create new category */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Plus className="size-4" />
                Tambah Kategori Baru
              </h3>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nama Kategori</label>
                  <Input
                    placeholder="Mis. Donasi CSR, Renovasi Kantor"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Deskripsi (opsional)
                  </label>
                  <Textarea
                    placeholder="Penjelasan singkat kategori ini…"
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Warna Badge</label>
                  <ColorPicker value={newColor} onChange={setNewColor} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetNewForm}
                  disabled={isSubmitting}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={isSubmitting || newLabel.trim().length < 2}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Tambah Kategori
                </Button>
              </div>
            </div>

            {/* Built-in categories (read-only) */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">
                Kategori Bawaan
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (tidak bisa dihapus)
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <div
                    key={key}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs",
                      cfg.bg,
                      cfg.border,
                    )}
                  >
                    <p className={cn("font-semibold", cfg.color)}>
                      {cfg.label}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      Kunci: {key}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom categories list */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">
                Kategori Tambahan
                {customs ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({customs.length})
                  </span>
                ) : null}
              </h3>

              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : customs.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Tags />
                    </EmptyMedia>
                    <EmptyTitle>Belum ada kategori tambahan</EmptyTitle>
                    <EmptyDescription>
                      Tambahkan kategori khusus di atas agar muncul di form
                      pengajuan.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-2">
                  {customs.map((row) => {
                    const cfg = getCategoryConfig(row.key, [row]);
                    const isEditing = editingId === row._id;
                    if (isEditing) {
                      return (
                        <div
                          key={row._id}
                          className="rounded-lg border bg-muted/30 p-3 space-y-3"
                        >
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Nama kategori"
                          />
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Deskripsi"
                            rows={2}
                          />
                          <ColorPicker
                            value={editColor}
                            onChange={setEditColor}
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                            >
                              <X className="size-4" />
                              Batal
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(row._id)}>
                              <Check className="size-4" />
                              Simpan
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={row._id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                          row.isActive ? "bg-card" : "bg-muted/40 opacity-70",
                        )}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "border shrink-0",
                            cfg.bg,
                            cfg.color,
                            cfg.border,
                          )}
                        >
                          {cfg.label}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground truncate">
                            Kunci: <span className="font-mono">{row.key}</span>
                            {row.description ? ` · ${row.description}` : ""}
                          </p>
                          {!row.isActive ? (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Disembunyikan dari dropdown
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              toggleActive(row._id, row.isActive)
                            }
                            aria-label={
                              row.isActive ? "Sembunyikan" : "Tampilkan"
                            }
                            className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {row.isActive ? (
                              <Eye className="size-4" />
                            ) : (
                              <EyeOff className="size-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            aria-label="Edit"
                            className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row._id, row.label)}
                            aria-label="Hapus"
                            className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4 shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Color Picker ──────────────────────────────────────────────────────────
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_COLORS.map((c) => {
        const selected = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all cursor-pointer",
              c.visual.bg,
              c.visual.color,
              selected
                ? "ring-2 ring-offset-1 ring-offset-background ring-primary scale-105"
                : "border-transparent hover:brightness-110",
            )}
          >
            {selected ? <Check className="size-3" /> : null}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
