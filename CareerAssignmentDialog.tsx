import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

type Props = {
  trigger: React.ReactNode;
  assignment?: {
    assignment: Doc<"careerAssignments">;
    user: Doc<"users"> | null;
    track: Doc<"careerTracks"> | null;
    currentLevel: Doc<"careerLevels"> | null;
    targetLevel: Doc<"careerLevels"> | null;
  } | null;
};

export default function CareerAssignmentDialog({ trigger, assignment }: Props) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [trackId, setTrackId] = useState<string>("");
  const [currentLevelId, setCurrentLevelId] = useState<string>("");
  const [targetLevelId, setTargetLevelId] = useState<string>("__none__");
  const [startedAt, setStartedAt] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const users = useQuery(api.users.listEmployees, { search: "" });
  const tracks = useQuery(api.training.careers.listTracks, {
    activeOnly: false,
  });
  const upsert = useMutation(api.training.careers.upsertAssignment);
  const remove = useMutation(api.training.careers.removeAssignment);

  useEffect(() => {
    if (!open) return;
    if (assignment) {
      setUserId(assignment.assignment.userId);
      setTrackId(assignment.assignment.trackId);
      setCurrentLevelId(assignment.assignment.currentLevelId);
      setTargetLevelId(
        assignment.assignment.targetLevelId ?? "__none__",
      );
      setStartedAt(
        assignment.assignment.startedAt.slice(0, 10),
      );
      setNote(assignment.assignment.note ?? "");
    } else {
      setUserId("");
      setTrackId("");
      setCurrentLevelId("");
      setTargetLevelId("__none__");
      setStartedAt(new Date().toISOString().slice(0, 10));
      setNote("");
    }
  }, [open, assignment]);

  const levels = useMemo(() => {
    if (!tracks) return [];
    const t = tracks.find((tr) => tr._id === trackId);
    return t ? t.levels : [];
  }, [tracks, trackId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !trackId || !currentLevelId) {
      toast.error("Lengkapi karyawan, jalur, dan level saat ini");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        userId: userId as Id<"users">,
        trackId: trackId as Id<"careerTracks">,
        currentLevelId: currentLevelId as Id<"careerLevels">,
        targetLevelId:
          targetLevelId === "__none__"
            ? undefined
            : (targetLevelId as Id<"careerLevels">),
        startedAt,
        note: note.trim() || undefined,
      });
      toast.success("Penugasan disimpan");
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!assignment) return;
    if (!window.confirm("Hapus penugasan jalur karir ini?")) return;
    try {
      await remove({ id: assignment.assignment._id });
      toast.success("Penugasan dihapus");
      setOpen(false);
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger}
      </div>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {assignment ? "Ubah penugasan" : "Tugaskan jalur karir"}
            </DialogTitle>
            <DialogDescription>
              Kaitkan karyawan ke jalur karir, tentukan level saat ini, dan
              level yang ingin dicapai.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Karyawan</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? u.email ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Jalur karir</Label>
              <Select
                value={trackId}
                onValueChange={(val) => {
                  setTrackId(val);
                  setCurrentLevelId("");
                  setTargetLevelId("__none__");
                }}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih jalur..." />
                </SelectTrigger>
                <SelectContent>
                  {(tracks ?? []).map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                      {t.department ? ` · ${t.department}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level saat ini</Label>
              <Select
                value={currentLevelId}
                onValueChange={setCurrentLevelId}
                disabled={!trackId}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih level..." />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.order}. {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level target</Label>
              <Select
                value={targetLevelId}
                onValueChange={setTargetLevelId}
                disabled={!trackId}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Belum ditentukan</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.order}. {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal mulai</Label>
              <DateField
                value={startedAt}
                onChange={(v) => setStartedAt(v)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Catatan</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {assignment ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRemove}
                  className="cursor-pointer"
                >
                  Hapus
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="cursor-pointer"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
