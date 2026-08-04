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
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function ScheduleSessionDialog({
  trigger,
  mentorshipId,
}: {
  trigger: React.ReactNode;
  mentorshipId: Id<"mentorships">;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const schedule = useMutation(api.training.mentorships.scheduleSession);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    if (!date || !time) {
      toast.error("Tanggal & waktu wajib diisi");
      return;
    }
    const iso = new Date(`${date}T${time}`).toISOString();
    setSubmitting(true);
    try {
      await schedule({
        mentorshipId,
        title,
        agenda: agenda || undefined,
        scheduledAt: iso,
        durationMinutes: duration,
        meetingUrl: meetingUrl || undefined,
        location: location || undefined,
      });
      toast.success("Sesi dijadwalkan");
      setOpen(false);
      setTitle("");
      setAgenda("");
      setDate("");
      setTime("");
      setDuration(60);
      setMeetingUrl("");
      setLocation("");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Jadwalkan sesi mentorship</DialogTitle>
          <DialogDescription>
            Atur pertemuan mentor-mentee beserta agendanya.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Judul sesi</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Review milestone minggu ke-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Agenda (opsional)</Label>
            <Textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              placeholder="Poin yang akan dibahas..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <DateField
                value={date}
                onChange={(v) => setDate(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Waktu</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min={15}
                max={480}
                step={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 60)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Link meeting (opsional)</Label>
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lokasi (opsional)</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ruang Melati / Lantai 3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            className="cursor-pointer"
            onClick={handleSubmit}
            disabled={submitting}
          >
            Jadwalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
