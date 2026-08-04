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
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus } from "lucide-react";
import { todayIsoDate } from "../_lib/gallery-utils.ts";
import { useNavigate } from "react-router-dom";

export default function CreateAlbumDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate());
  const [submitting, setSubmitting] = useState(false);

  const createAlbum = useMutation(api.gallery.createAlbum);
  const navigate = useNavigate();

  const reset = () => {
    setTitle("");
    setDescription("");
    setEventDate(todayIsoDate());
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (title.trim().length === 0) {
      toast.error("Judul album wajib diisi");
      return;
    }
    if (!eventDate) {
      toast.error("Tanggal kegiatan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const albumId = await createAlbum({
        title: title.trim(),
        description: description.trim() || undefined,
        eventDate,
      });
      toast.success("Album berhasil dibuat");
      reset();
      setOpen(false);
      navigate(`/gallery/${albumId}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat album");
      } else {
        toast.error("Gagal membuat album");
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
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          Buat Album
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Album Baru</DialogTitle>
          <DialogDescription>
            Dokumentasikan kegiatan perusahaan dalam album foto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="album-title">Judul Kegiatan</Label>
            <Input
              id="album-title"
              placeholder="Outing Tim 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="album-date">Tanggal Kegiatan</Label>
            <DateField
              id="album-date"
              value={eventDate}
              onChange={(v) => setEventDate(v)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="album-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="album-desc"
              rows={3}
              placeholder="Cerita singkat tentang kegiatan ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
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
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Menyimpan..." : "Buat Album"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
