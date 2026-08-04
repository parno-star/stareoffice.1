import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { TRAINING_CATEGORIES } from "../_lib/history-utils.ts";
import HistoryAttachmentField, {
  type StagedAttachment,
} from "./HistoryAttachmentField.tsx";
import { useHistoryAttachmentUpload } from "../_hooks/use-history-attachment-upload.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  editing:
    | (Doc<"employeeTrainingHistory"> & { attachmentUrl?: string | null })
    | null;
};

export default function TrainingFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
}: Props) {
  const create = useMutation(api.employeeHistory.createTraining);
  const update = useMutation(api.employeeHistory.updateTraining);
  const uploadFile = useHistoryAttachmentUpload();

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? "");
  const [category, setCategory] = useState(editing?.category ?? "internal");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [durationHours, setDurationHours] = useState<string>(
    editing?.durationHours ? String(editing.durationHours) : "",
  );
  const [result, setResult] = useState(editing?.result ?? "");
  const [hasCertificate, setHasCertificate] = useState(
    editing?.hasCertificate ?? false,
  );
  const [certificateNumber, setCertificateNumber] = useState(
    editing?.certificateNumber ?? "",
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [stagedAttachment, setStagedAttachment] =
    useState<StagedAttachment | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Nama pelatihan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const durN = durationHours ? Number(durationHours) : undefined;
      const payload = {
        title,
        provider: provider || undefined,
        category,
        location: location || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        durationHours: Number.isFinite(durN) ? durN : undefined,
        result: result || undefined,
        hasCertificate,
        certificateNumber: certificateNumber || undefined,
        description: description || undefined,
        attachmentStorageId: stagedAttachment?.storageId,
        attachmentName: stagedAttachment?.name,
        attachmentSize: stagedAttachment?.size,
        attachmentType: stagedAttachment?.type,
        removeAttachment: removeAttachment || undefined,
      };
      if (editing) {
        const res = await update({ id: editing._id, ...payload });
        toast.success(
          res?.queued
            ? "Perubahan diajukan untuk verifikasi HR"
            : "Riwayat pelatihan diperbarui",
        );
      } else {
        const res = await create({ userId, ...payload });
        toast.success(
          res?.queued
            ? "Riwayat pelatihan diajukan untuk verifikasi HR"
            : "Riwayat pelatihan ditambahkan",
        );
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Riwayat Pelatihan" : "Tambah Riwayat Pelatihan"}
          </DialogTitle>
          <DialogDescription>
            Catat pelatihan, sertifikasi, workshop, atau seminar yang pernah
            diikuti.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tr-title">Nama Pelatihan</Label>
            <Input
              id="tr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leadership Development Program"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-provider">Penyelenggara</Label>
              <Input
                id="tr-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Prasetiya Mulya"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-cat">Jenis</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="tr-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-start">Tanggal Mulai</Label>
              <DateField
                id="tr-start"
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-end">Tanggal Selesai</Label>
              <DateField
                id="tr-end"
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-dur">Durasi (jam)</Label>
              <Input
                id="tr-dur"
                type="number"
                inputMode="numeric"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="16"
                min={0}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-loc">Lokasi</Label>
              <Input
                id="tr-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Jakarta / Online"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-result">Hasil / Nilai</Label>
              <Input
                id="tr-result"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="Lulus dengan Predikat A"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={hasCertificate}
              onCheckedChange={(v) => setHasCertificate(v === true)}
            />
            <span>Mendapat sertifikat</span>
          </label>

          {hasCertificate ? (
            <div className="space-y-1.5">
              <Label htmlFor="tr-certno">Nomor Sertifikat</Label>
              <Input
                id="tr-certno"
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="CERT-2024-00123"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="tr-desc">Deskripsi / Catatan</Label>
            <Textarea
              id="tr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Materi, manfaat, pengalaman..."
              rows={3}
            />
          </div>

          <HistoryAttachmentField
            existing={
              editing?.attachmentName
                ? {
                    name: editing.attachmentName ?? null,
                    size: editing.attachmentSize ?? null,
                    url: editing.attachmentUrl ?? null,
                  }
                : null
            }
            staged={stagedAttachment}
            onStagedChange={setStagedAttachment}
            removeExisting={removeAttachment}
            onRemoveExistingChange={setRemoveAttachment}
            uploadFile={uploadFile}
            disabled={saving}
            label="Dokumen (Sertifikat)"
            hint="PDF atau gambar sertifikat, maksimal 10 MB."
          />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
