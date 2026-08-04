import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  getColorConfig,
} from "../_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";

type Mode = "create" | "edit";

export default function LearningPathFormDialog({
  trigger,
  mode = "create",
  initialValues,
}: {
  trigger: React.ReactNode;
  mode?: Mode;
  initialValues?: {
    pathId: Id<"learningPaths">;
    title: string;
    description: string;
    coverColor: string;
    icon?: string;
    category: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [coverColor, setCoverColor] = useState(
    initialValues?.coverColor ?? "indigo",
  );
  const [icon, setIcon] = useState(initialValues?.icon ?? "🎯");
  const [category, setCategory] = useState(
    initialValues?.category ?? "leadership",
  );
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.training.paths.createPath);
  const update = useMutation(api.training.paths.updatePath);

  const handleSubmit = async () => {
    if (title.trim().length === 0) {
      toast.error("Judul wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await create({
          title: title.trim(),
          description: description.trim(),
          coverColor,
          icon: icon.trim() || undefined,
          category,
        });
        toast.success("Jalur pembelajaran dibuat");
      } else if (initialValues) {
        await update({
          id: initialValues.pathId,
          title: title.trim(),
          description: description.trim(),
          coverColor,
          icon: icon.trim() || undefined,
          category,
        });
        toast.success("Jalur diperbarui");
      }
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Buat jalur pembelajaran" : "Ubah jalur"}
          </DialogTitle>
          <DialogDescription>
            Kurasi kelas untuk mencapai milestone pembelajaran tertentu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="path-title">Judul</Label>
            <Input
              id="path-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Jalur Manajer Baru"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="path-desc">Deskripsi</Label>
            <Textarea
              id="path-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Untuk siapa jalur ini dan apa hasil yang diharapkan"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="path-icon">Ikon (emoji)</Label>
              <Input
                id="path-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🎯"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Warna</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setCoverColor(c.value)}
                  className={cn(
                    "h-9 w-9 cursor-pointer rounded-full transition-all",
                    getColorConfig(c.value).cover,
                    coverColor === c.value
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting
              ? "Menyimpan..."
              : mode === "create"
                ? "Buat jalur"
                : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
