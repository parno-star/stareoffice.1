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
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  LEVEL_OPTIONS,
  getColorConfig,
} from "../_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";

type Mode = "create" | "edit";

export default function CourseFormDialog({
  trigger,
  mode = "create",
  initialValues,
  onCreated,
}: {
  trigger: React.ReactNode;
  mode?: Mode;
  initialValues?: {
    courseId: Id<"courses">;
    title: string;
    description: string;
    category: string;
    level: string;
    durationMinutes: number;
    coverColor: string;
    instructorName?: string;
  };
  onCreated?: (id: Id<"courses">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [category, setCategory] = useState(
    initialValues?.category ?? "technical",
  );
  const [level, setLevel] = useState(initialValues?.level ?? "beginner");
  const [durationMinutes, setDurationMinutes] = useState(
    String(initialValues?.durationMinutes ?? 30),
  );
  const [coverColor, setCoverColor] = useState(
    initialValues?.coverColor ?? "blue",
  );
  const [instructorName, setInstructorName] = useState(
    initialValues?.instructorName ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.courses.createCourse);
  const update = useMutation(api.courses.updateCourse);

  const reset = () => {
    if (mode === "create") {
      setTitle("");
      setDescription("");
      setCategory("technical");
      setLevel("beginner");
      setDurationMinutes("30");
      setCoverColor("blue");
      setInstructorName("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0 || description.trim().length === 0) {
      toast.error("Judul dan deskripsi wajib diisi");
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
        const id = await create({
          title: title.trim(),
          description: description.trim(),
          category,
          level,
          durationMinutes: duration,
          coverColor,
          instructorName: instructorName.trim() || undefined,
        });
        toast.success("Kelas dibuat. Tambahkan pelajaran lalu publikasikan.");
        setOpen(false);
        reset();
        onCreated?.(id);
      } else if (initialValues) {
        await update({
          id: initialValues.courseId,
          title: title.trim(),
          description: description.trim(),
          category,
          level,
          durationMinutes: duration,
          coverColor,
          instructorName: instructorName.trim() || undefined,
        });
        toast.success("Kelas diperbarui");
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
            {mode === "create" ? "Buat kelas baru" : "Ubah kelas"}
          </DialogTitle>
          <DialogDescription>
            Bangun program pelatihan untuk tim Anda dengan beberapa pelajaran
            bertahap.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="course-title">Judul kelas</Label>
            <Input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Dasar Keamanan Siber"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="course-desc">Deskripsi</Label>
            <Textarea
              id="course-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ceritakan apa yang akan dipelajari peserta..."
              rows={3}
              maxLength={600}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="course-duration">Estimasi durasi (menit)</Label>
              <Input
                id="course-duration"
                type="number"
                min="0"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-instructor">Instruktur (opsional)</Label>
              <Input
                id="course-instructor"
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                maxLength={80}
              />
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
                  ? "Buat kelas"
                  : "Simpan perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
