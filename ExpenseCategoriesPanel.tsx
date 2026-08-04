import { useQuery, useMutation } from "convex/react";
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
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_ICON_NAMES,
  CATEGORY_COLOR_KEYS,
  CATEGORY_COLORS,
  getCategoryIcon,
  categoryDisplayFromRecord,
  type ExpenseCategoryRecord,
} from "../_lib/expense-utils.ts";

type ResolvedCat = ExpenseCategoryRecord & {
  id: Id<"expenseCategories"> | null;
};

// ── Icon + color pickers ─────────────────────────────────────────────────────

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = getCategoryIcon(name);
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border transition-colors cursor-pointer",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input hover:bg-muted",
            )}
            aria-label={name}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLOR_KEYS.map((key) => {
        const color = CATEGORY_COLORS[key]!;
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

// ── Create / edit dialog ──────────────────────────────────────────────────────

function CategoryDialog({
  mode,
  existing,
  trigger,
}: {
  mode: "create" | "edit";
  existing?: ResolvedCat;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? CATEGORY_ICON_NAMES[0]!);
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLOR_KEYS[0]!);
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.expenseCategories.create);
  const update = useMutation(api.expenseCategories.update);

  const reset = () => {
    setLabel(existing?.label ?? "");
    setIcon(existing?.icon ?? CATEGORY_ICON_NAMES[0]!);
    setColor(existing?.color ?? CATEGORY_COLOR_KEYS[0]!);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (label.trim().length < 2) {
      toast.error("Nama kategori minimal 2 karakter");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await create({ label: label.trim(), icon, color });
        toast.success("Kategori dibuat");
      } else if (existing?.id) {
        await update({
          id: existing.id,
          label: label.trim(),
          icon,
          color,
        });
        toast.success("Kategori diperbarui");
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

  const PreviewIcon = getCategoryIcon(icon);
  const preview = categoryDisplayFromRecord({ label, icon, color });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          setOpen(v);
          if (!v) reset();
          if (v && mode === "edit" && existing) {
            setLabel(existing.label);
            setIcon(existing.icon);
            setColor(existing.color);
          }
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Kategori Baru" : "Ubah Kategori"}
          </DialogTitle>
          <DialogDescription>
            Beri nama, pilih ikon, dan warna untuk kategori pengeluaran ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-label">Nama Kategori</Label>
            <Input
              id="cat-label"
              placeholder="Pemasaran"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={submitting}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label>Ikon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          <div className="space-y-2">
            <Label>Warna</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="space-y-2">
            <Label>Pratinjau</Label>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  preview.iconBg,
                )}
              >
                <PreviewIcon className="size-5" />
              </div>
              <Badge variant="outline" className={preview.badge}>
                {label.trim() || "Nama kategori"}
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

// ── Row ───────────────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  index,
  total,
  onMove,
}: {
  cat: ResolvedCat;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const update = useMutation(api.expenseCategories.update);
  const remove = useMutation(api.expenseCategories.remove);
  const cfg = categoryDisplayFromRecord(cat);
  const Icon = cfg.icon;

  const toggleActive = async (v: boolean) => {
    if (!cat.id) return;
    try {
      await update({ id: cat.id, isActive: v });
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui");
      } else {
        toast.error("Gagal memperbarui");
      }
    }
  };

  const handleRemove = async () => {
    if (!cat.id) return;
    try {
      await remove({ id: cat.id });
      toast.success("Kategori dihapus");
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
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          cfg.iconBg,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{cat.label}</p>
        <p className="text-xs text-muted-foreground">
          {cat.isActive ? "Aktif" : "Non-aktif"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={cat.isActive}
          onCheckedChange={toggleActive}
          aria-label="Aktifkan kategori"
        />
        <CategoryDialog
          mode="edit"
          existing={cat}
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

export default function ExpenseCategoriesPanel() {
  const categories = useQuery(api.expenseCategories.list, {});
  const reorder = useMutation(api.expenseCategories.reorder);

  if (categories === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // Only rows with a real id (materialized) can be reordered/edited. Default
  // (virtual) categories are shown but the first edit will materialize them.
  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const ids = categories.map((c) => c.id).filter((id): id is Id<"expenseCategories"> => !!id);
    // If not yet materialized, creating/editing a category seeds real rows.
    if (ids.length !== categories.length) {
      toast.info(
        "Buat atau ubah satu kategori terlebih dahulu untuk mengaktifkan pengurutan.",
      );
      return;
    }
    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    try {
      await reorder({
        orderedIds: reordered
          .map((c) => c.id)
          .filter((id): id is Id<"expenseCategories"> => !!id),
      });
    } catch {
      toast.error("Gagal mengubah urutan");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="text-sm">
          <p className="font-medium">Kategori Pengeluaran</p>
          <p className="mt-1 text-muted-foreground">
            Sesuaikan kategori reimbursement agar cocok dengan cara kerja
            organisasi Anda. Non-aktifkan kategori untuk menyembunyikannya dari
            pengajuan baru tanpa menghapus riwayat.
          </p>
        </div>
        <CategoryDialog
          mode="create"
          trigger={
            <Button className="gap-2 cursor-pointer">
              <Plus className="size-4" />
              Tambah Kategori
            </Button>
          }
        />
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Tag className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Belum ada kategori. Tambahkan kategori pertama Anda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, i) => (
            <CategoryRow
              key={cat.id ?? cat.key}
              cat={cat}
              index={i}
              total={categories.length}
              onMove={handleMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
