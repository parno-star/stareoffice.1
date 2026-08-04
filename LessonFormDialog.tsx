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
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Mode = "create" | "edit";

export default function LessonFormDialog({
  trigger,
  mode = "create",
  courseId,
  initialValues,
}: {
  trigger: React.ReactNode;
  mode?: Mode;
  courseId: Id<"courses">;
  initialValues?: {
    lessonId: Id<"courseLessons">;
    title: string;
    content: string;
    videoUrl?: string;
    durationMinutes: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [videoUrl, setVideoUrl] = useState(initialValues?.videoUrl ?? "");
  const [durationMinutes, setDurationMinutes] = useState(
    String(initialValues?.durationMinutes ?? 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const addLesson = useMutation(api.courses.addLesson);
  const updateLesson = useMutation(api.courses.updateLesson);

  const reset = () => {
    if (mode === "create") {
      setTitle("");
      setContent("");
      setVideoUrl("");
      setDurationMinutes("10");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0) {
      toast.error("Judul pelajaran wajib diisi");
      return;
    }
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration < 0) {
      toast.error("Durasi tidak valid");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        await addLesson({
          courseId,
          title: title.trim(),
          content,
          videoUrl: videoUrl.trim() || undefined,
          durationMinutes: duration,
        });
        toast.success("Pelajaran ditambahkan");
        setOpen(false);
        reset();
      } else if (initialValues) {
        await updateLesson({
          id: initialValues.lessonId,
          title: title.trim(),
          content,
          videoUrl: videoUrl.trim(),
          durationMinutes: duration,
        });
        toast.success("Pelajaran diperbarui");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah pelajaran" : "Ubah pelajaran"}
          </DialogTitle>
          <DialogDescription>
            Tulis materi menggunakan markdown. Link video (YouTube / Vimeo)
            akan otomatis tertanam.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Judul</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Mengenal Firewall"
              maxLength={120}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lesson-duration">Durasi (menit)</Label>
              <Input
                id="lesson-duration"
                type="number"
                min="0"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lesson-video">URL video (opsional)</Label>
              <Input
                id="lesson-video"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lesson-content">Materi (markdown)</Label>
            <Textarea
              id="lesson-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder={`# Pendahuluan\n\nTulis materi Anda di sini.\n\n- Poin penting 1\n- Poin penting 2\n\n## Contoh\n\n\`\`\`\nkode contoh\n\`\`\``}
            />
            <p className="text-xs text-muted-foreground">
              Mendukung markdown: judul, daftar, blok kode, tabel, tautan, dan
              gambar.
            </p>
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
                  ? "Tambah pelajaran"
                  : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
