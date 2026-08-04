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
  getColorConfig,
} from "@/pages/training/_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";

type Mode = "create" | "edit";

type Initial = {
  id: Id<"peerGroups">;
  name: string;
  description: string;
  category: string;
  coverColor: string;
  icon?: string;
  joinPolicy: string;
  capacity: number;
  cadence?: string;
  meetingUrl?: string;
};

export default function PeerGroupFormDialog({
  trigger,
  mode = "create",
  initialValues,
}: {
  trigger: React.ReactNode;
  mode?: Mode;
  initialValues?: Initial;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [category, setCategory] = useState(
    initialValues?.category ?? "technical",
  );
  const [coverColor, setCoverColor] = useState(
    initialValues?.coverColor ?? "blue",
  );
  const [icon, setIcon] = useState(initialValues?.icon ?? "🤝");
  const [joinPolicy, setJoinPolicy] = useState(
    initialValues?.joinPolicy ?? "open",
  );
  const [capacity, setCapacity] = useState(initialValues?.capacity ?? 20);
  const [cadence, setCadence] = useState(initialValues?.cadence ?? "");
  const [meetingUrl, setMeetingUrl] = useState(initialValues?.meetingUrl ?? "");
  const [submitting, setSubmitting] = useState(false);

  const create = useMutation(api.training.peerGroups.createGroup);
  const update = useMutation(api.training.peerGroups.updateGroup);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "edit" && initialValues) {
        await update({
          groupId: initialValues.id,
          name,
          description,
          category,
          coverColor,
          icon: icon || undefined,
          joinPolicy,
          capacity,
          cadence: cadence || undefined,
          meetingUrl: meetingUrl || undefined,
        });
        toast.success("Grup diperbarui");
      } else {
        await create({
          name,
          description,
          category,
          coverColor,
          icon: icon || undefined,
          joinPolicy,
          capacity,
          cadence: cadence || undefined,
          meetingUrl: meetingUrl || undefined,
        });
        toast.success("Grup dibuat");
      }
      setOpen(false);
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
          <DialogTitle>
            {mode === "edit" ? "Edit grup belajar" : "Buat grup belajar"}
          </DialogTitle>
          <DialogDescription>
            Grup belajar peer untuk diskusi dan berbagi insight antar karyawan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nama grup</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: React Study Circle"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Apa yang akan dipelajari bersama?"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="cursor-pointer">
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
              <Label>Ikon (emoji)</Label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
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
                  className={cn(
                    "size-8 rounded-full border-2 transition-all",
                    getColorConfig(c.value).cover,
                    coverColor === c.value
                      ? "border-foreground ring-2 ring-offset-2"
                      : "border-transparent",
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kebijakan bergabung</Label>
              <Select value={joinPolicy} onValueChange={setJoinPolicy}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Terbuka (bebas gabung)</SelectItem>
                  <SelectItem value="invite">Undangan saja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kapasitas (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Jadwal pertemuan (opsional)</Label>
            <Input
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              placeholder="Contoh: Senin 19:00 WIB"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link meeting (opsional)</Label>
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet..."
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
            {mode === "edit" ? "Simpan" : "Buat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
