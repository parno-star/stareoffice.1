import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Loader2, X } from "lucide-react";
import {
  INTERVIEW_FORMATS,
  INTERVIEW_TYPES,
} from "../_lib/recruitment-utils.ts";

export default function ScheduleInterviewDialog({
  applicationId,
  open,
  onClose,
}: {
  applicationId: Id<"candidateApplications">;
  open: boolean;
  onClose: () => void;
}) {
  const now = new Date();
  now.setMinutes(0);
  const defaultDatetime = new Date(now.getTime() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [title, setTitle] = useState("Interview Awal");
  const [interviewType, setInterviewType] = useState("screening");
  const [format, setFormat] = useState("online");
  const [scheduledAt, setScheduledAt] = useState(defaultDatetime);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [interviewerIds, setInterviewerIds] = useState<Array<Id<"users">>>([]);
  const [submitting, setSubmitting] = useState(false);

  const employees = useQuery(api.users.listEmployees, open ? {} : "skip");
  const schedule = useMutation(api.recruitment.interviews.schedule);

  const addInterviewer = (id: string) => {
    if (id === "none") return;
    if (interviewerIds.includes(id as Id<"users">)) return;
    setInterviewerIds([...interviewerIds, id as Id<"users">]);
  };

  const removeInterviewer = (id: Id<"users">) => {
    setInterviewerIds(interviewerIds.filter((x) => x !== id));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await schedule({
        applicationId,
        title,
        interviewType,
        format,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: Number(durationMinutes) || 60,
        meetingUrl: meetingUrl || undefined,
        location: location || undefined,
        interviewerIds,
      });
      toast.success("Interview dijadwalkan");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal");
      } else {
        toast.error("Gagal menjadwalkan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Jadwalkan Interview</DialogTitle>
          <DialogDescription>
            Atur jadwal interview dan pewawancara.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Judul</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal & waktu</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Durasi (menit)</Label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>
          {format === "online" || format === "phone" ? (
            <div className="space-y-2">
              <Label>Link meeting</Label>
              <Input
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/..."
              />
            </div>
          ) : null}
          {format === "onsite" ? (
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ruang meeting / alamat"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Pewawancara</Label>
            <Select onValueChange={addInterviewer} value="none">
              <SelectTrigger>
                <SelectValue placeholder="Tambah pewawancara..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tambah pewawancara...</SelectItem>
                {(employees ?? [])
                  .filter((u) => !interviewerIds.includes(u._id))
                  .map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? u.email ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {interviewerIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {interviewerIds.map((id) => {
                  const u = employees?.find((e) => e._id === id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="cursor-pointer gap-1"
                    >
                      {u?.name ?? "?"}
                      <button
                        onClick={() => removeInterviewer(id)}
                        className="ml-1 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Jadwalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
