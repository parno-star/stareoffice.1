import { Button } from "@/components/ui/button.tsx";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  getColorConfig,
} from "../_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";

type Mode = "create" | "edit";

export default function DeckFormDialog({
  trigger,
  mode = "create",
  initialValues,
  onCreated,
}: {
  trigger: React.ReactNode;
  mode?: Mode;
  initialValues?: {
    id: Id<"flashcardDecks">;
    title: string;
    description?: string;
    category: string;
    coverColor: string;
    icon?: string;
    isPublished: boolean;
  };
  onCreated?: (id: Id<"flashcardDecks">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [category, setCategory] = useState(
    initialValues?.category ?? "technical",
  );
  const [coverColor, setCoverColor] = useState(
    initialValues?.coverColor ?? "teal",
  );
  const [icon, setIcon] = useState(initialValues?.icon ?? "🃏");
  const [isPublished, setIsPublished] = useState(
    initialValues?.isPublished ?? true,
  );
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.training.flashcards.createDeck);
  const update = useMutation(api.training.flashcards.updateDeck);

  const reset = () => {
    if (mode === "create") {
      setTitle("");
      setDescription("");
      setCategory("technical");
      setCoverColor("teal");
      setIcon("🃏");
      setIsPublished(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0) {
      toast.error("Judul deck wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        coverColor,
        icon: icon.trim() || undefined,
        isPublished,
      };
      if (mode === "create") {
        const id = await create(payload);
        toast.success("Deck dibuat. Tambahkan kartu sekarang.");
        setOpen(false);
        reset();
        onCreated?.(id);
      } else if (initialValues) {
        await update({ id: initialValues.id, ...payload });
        toast.success("Deck diperbarui");
        setOpen(false);
      }
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Buat deck flashcard" : "Ubah deck"}
          </DialogTitle>
          <DialogDescription>
            Deck adalah kumpulan kartu flashcard untuk dihafal dengan sistem
            pengulangan berjangka (spaced repetition).
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="deck-icon">Ikon</Label>
              <Input
                id="deck-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                placeholder="🃏"
                className="w-20 text-center text-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deck-title">Judul</Label>
              <Input
                id="deck-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Istilah keuangan dasar"
                maxLength={120}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deck-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="deck-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan deck ini secara singkat..."
              rows={3}
              maxLength={400}
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
          <div className="space-y-1.5">
            <Label>Warna sampul</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCoverColor(c.value)}
                  title={c.label}
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Publikasikan</p>
              <p className="text-xs text-muted-foreground">
                Deck yang dipublikasikan bisa dipelajari semua karyawan.
              </p>
            </div>
            <Switch
              checked={isPublished}
              onCheckedChange={setIsPublished}
              className="cursor-pointer"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting
                ? "Menyimpan..."
                : mode === "create"
                  ? "Buat deck"
                  : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
