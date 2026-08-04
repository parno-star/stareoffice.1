import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
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
import { COLOR_OPTIONS } from "../_lib/training-utils.ts";

type Props = {
  trigger: React.ReactNode;
  track?: Doc<"careerTracks"> | null;
  departments: Array<string>;
};

export default function CareerTrackFormDialog({
  trigger,
  track,
  departments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("__all__");
  const [color, setColor] = useState("indigo");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const createTrack = useMutation(api.training.careers.createTrack);
  const updateTrack = useMutation(api.training.careers.updateTrack);
  const deleteTrack = useMutation(api.training.careers.deleteTrack);

  useEffect(() => {
    if (!open) return;
    if (track) {
      setName(track.name);
      setDescription(track.description);
      setDepartment(track.department ? track.department : "__all__");
      setColor(track.color);
      setIcon(track.icon ?? "");
      setIsActive(track.isActive);
    } else {
      setName("");
      setDescription("");
      setDepartment("__all__");
      setColor("indigo");
      setIcon("");
      setIsActive(true);
    }
  }, [open, track]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        department: department === "__all__" ? "" : department,
        color,
        icon: icon.trim() || undefined,
        isActive,
      };
      if (track) {
        await updateTrack({ id: track._id, ...payload });
        toast.success("Jalur karir diperbarui");
      } else {
        await createTrack(payload);
        toast.success("Jalur karir dibuat");
      }
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

  const handleDelete = async () => {
    if (!track) return;
    if (
      !window.confirm(
        "Hapus jalur karir ini? Semua level dan penugasan akan terhapus.",
      )
    )
      return;
    try {
      await deleteTrack({ id: track._id });
      toast.success("Jalur karir dihapus");
      setOpen(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
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
              {track ? "Ubah jalur karir" : "Jalur karir baru"}
            </DialogTitle>
            <DialogDescription>
              Buat tangga karir yang jelas: beri nama, pilih departemen, dan
              tambahkan level setelah disimpan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nama jalur</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Software Engineering"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Narasi singkat tentang jalur ini..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Departemen</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua departemen</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ikon (emoji)</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Contoh: 🚀"
                maxLength={4}
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  id="track-active"
                />
                <Label htmlFor="track-active">Aktif</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {track ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
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
