import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
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
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type Props = {
  courseId: Id<"courses">;
  trigger: ReactNode;
  initialValues?: {
    sessionId: Id<"trainingSessions">;
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    format: string;
    location?: string;
    meetingUrl?: string;
    capacity?: number;
    trainerName?: string;
  };
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export default function SessionEditorDialog({
  courseId,
  trigger,
  initialValues,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [startAt, setStartAt] = useState(
    initialValues ? toLocalInput(initialValues.startAt) : "",
  );
  const [endAt, setEndAt] = useState(
    initialValues ? toLocalInput(initialValues.endAt) : "",
  );
  const [format, setFormat] = useState(initialValues?.format ?? "online");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(
    initialValues?.meetingUrl ?? "",
  );
  const [capacity, setCapacity] = useState(
    initialValues?.capacity ? String(initialValues.capacity) : "",
  );
  const [trainerName, setTrainerName] = useState(
    initialValues?.trainerName ?? "",
  );
  const [busy, setBusy] = useState(false);

  const create = useMutation(api.training.sessions.createSession);
  const update = useMutation(api.training.sessions.updateSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt || !endAt) {
      toast.error("Judul, waktu mulai & selesai wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: fromLocalInput(startAt),
        endAt: fromLocalInput(endAt),
        format,
        location: location.trim() || undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        trainerName: trainerName.trim() || undefined,
      };
      if (initialValues) {
        await update({ id: initialValues.sessionId, ...payload });
        toast.success("Sesi diperbarui");
      } else {
        await create({ courseId, ...payload });
        toast.success("Sesi dibuat");
      }
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {initialValues ? "Ubah sesi" : "Buat sesi pelatihan"}
            </DialogTitle>
            <DialogDescription>
              Jadwalkan sesi live training (webinar, kelas tatap muka).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="title">Judul sesi</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Live demo React Server Components"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="desc">Deskripsi</Label>
              <Textarea
                id="desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="start">Mulai</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="end">Selesai</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Tatap Muka</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cap">Kapasitas</Label>
                <Input
                  id="cap"
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Kosongkan jika tanpa batas"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trainer">Trainer</Label>
              <Input
                id="trainer"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                placeholder="Nama trainer"
              />
            </div>
            {format !== "offline" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="url">Link meeting</Label>
                <Input
                  id="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.example.com/..."
                />
              </div>
            ) : null}
            {format !== "online" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="loc">Lokasi</Label>
                <Input
                  id="loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ruang Meeting A, Lantai 3"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="cursor-pointer">
              {busy
                ? "Menyimpan..."
                : initialValues
                  ? "Simpan"
                  : "Buat sesi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
