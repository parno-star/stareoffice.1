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
import { useMutation, useQuery } from "convex/react";
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

export default function MicrolessonFormDialog({
  trigger,
  mode = "create",
  initialValues,
}: {
  trigger: React.ReactNode;
  mode?: Mode;
  initialValues?: {
    id: Id<"microlessons">;
    title: string;
    summary: string;
    content: string;
    category: string;
    durationMinutes: number;
    coverColor: string;
    icon?: string;
    deckId?: Id<"flashcardDecks">;
    isPublished: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [summary, setSummary] = useState(initialValues?.summary ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [category, setCategory] = useState(
    initialValues?.category ?? "technical",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(initialValues?.durationMinutes ?? 5),
  );
  const [coverColor, setCoverColor] = useState(
    initialValues?.coverColor ?? "indigo",
  );
  const [icon, setIcon] = useState(initialValues?.icon ?? "💡");
  const [deckId, setDeckId] = useState<string>(
    initialValues?.deckId ?? "none",
  );
  const [isPublished, setIsPublished] = useState(
    initialValues?.isPublished ?? true,
  );
  const [submitting, setSubmitting] = useState(false);

  const decks = useQuery(
    api.training.flashcards.listDecks,
    open ? { includeUnpublished: true } : "skip",
  );

  const create = useMutation(api.training.microlessons.createMicrolesson);
  const update = useMutation(api.training.microlessons.updateMicrolesson);

  const reset = () => {
    if (mode === "create") {
      setTitle("");
      setSummary("");
      setContent("");
      setCategory("technical");
      setDurationMinutes("5");
      setCoverColor("indigo");
      setIcon("💡");
      setDeckId("none");
      setIsPublished(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0 || summary.trim().length === 0) {
      toast.error("Judul dan ringkasan wajib diisi");
      return;
    }
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Durasi tidak valid (min 1 menit)");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        content,
        category,
        durationMinutes: duration,
        coverColor,
        icon: icon.trim() || undefined,
        deckId:
          deckId === "none"
            ? undefined
            : (deckId as Id<"flashcardDecks">),
        isPublished,
      };
      if (mode === "create") {
        await create(payload);
        toast.success("Microlesson dibuat");
      } else if (initialValues) {
        await update({ id: initialValues.id, ...payload });
        toast.success("Microlesson diperbarui");
      }
      setOpen(false);
      reset();
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Buat microlesson" : "Ubah microlesson"}
          </DialogTitle>
          <DialogDescription>
            Microlesson adalah pelajaran singkat 1-15 menit untuk belajar cepat.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="ml-icon">Ikon</Label>
              <Input
                id="ml-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                placeholder="💡"
                className="w-20 text-center text-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ml-title">Judul</Label>
              <Input
                id="ml-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: 5 tips komunikasi efektif"
                maxLength={120}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ml-summary">Ringkasan</Label>
            <Input
              id="ml-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Satu kalimat yang menggambarkan isi pelajaran"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ml-content">Konten (markdown)</Label>
            <Textarea
              id="ml-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis konten singkat dengan markdown..."
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
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
              <Label htmlFor="ml-duration">Durasi (menit)</Label>
              <Input
                id="ml-duration"
                type="number"
                min="1"
                max="15"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deck flashcard</Label>
              <Select value={deckId} onValueChange={setDeckId}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {(decks ?? []).map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                Microlesson yang dipublikasikan bisa dilihat semua karyawan.
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
                  ? "Buat microlesson"
                  : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
