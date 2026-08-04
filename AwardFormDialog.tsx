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
import { AWARD_CATEGORIES, AWARD_LEVELS } from "../_lib/history-utils.ts";
import HistoryAttachmentField, {
  type StagedAttachment,
} from "./HistoryAttachmentField.tsx";
import { useHistoryAttachmentUpload } from "../_hooks/use-history-attachment-upload.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  editing:
    | (Doc<"employeeAwardHistory"> & { attachmentUrl?: string | null })
    | null;
};

export default function AwardFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
}: Props) {
  const create = useMutation(api.employeeHistory.createAward);
  const update = useMutation(api.employeeHistory.updateAward);
  const uploadFile = useHistoryAttachmentUpload();

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [issuer, setIssuer] = useState(editing?.issuer ?? "");
  const [category, setCategory] = useState(editing?.category ?? "company");
  const [level, setLevel] = useState(editing?.level ?? "internal");
  const [awardDate, setAwardDate] = useState(editing?.awardDate ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [hasCertificate, setHasCertificate] = useState<boolean>(
    editing?.hasCertificate ?? false,
  );
  const [certificateNumber, setCertificateNumber] = useState(
    editing?.certificateNumber ?? "",
  );
  const [stagedAttachment, setStagedAttachment] =
    useState<StagedAttachment | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Nama penghargaan wajib diisi");
      return;
    }
    if (!issuer.trim()) {
      toast.error("Pemberi penghargaan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        issuer,
        category,
        level,
        awardDate: awardDate || undefined,
        location: location || undefined,
        description: description || undefined,
        hasCertificate,
        certificateNumber: hasCertificate
          ? certificateNumber || undefined
          : undefined,
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
            : "Riwayat penghargaan diperbarui",
        );
      } else {
        const res = await create({ userId, ...payload });
        toast.success(
          res?.queued
            ? "Riwayat penghargaan diajukan untuk verifikasi HR"
            : "Riwayat penghargaan ditambahkan",
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
            {editing ? "Edit Riwayat Penghargaan" : "Tambah Riwayat Penghargaan"}
          </DialogTitle>
          <DialogDescription>
            Catat penghargaan yang pernah diterima, baik dari perusahaan maupun
            dari pihak eksternal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="award-title">Nama Penghargaan</Label>
            <Input
              id="award-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Employee of the Year 2025"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="award-issuer">Pemberi Penghargaan</Label>
            <Input
              id="award-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="PT Contoh Sejahtera, Kementerian, dll."
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="award-category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="award-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AWARD_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="award-level">Tingkat</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger id="award-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AWARD_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="award-date">Tanggal Penghargaan</Label>
              <DateField
                id="award-date"
                value={awardDate}
                onChange={(v) => setAwardDate(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="award-location">Lokasi</Label>
              <Input
                id="award-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Jakarta"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="award-desc">Deskripsi</Label>
            <Textarea
              id="award-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Alasan penghargaan, pencapaian, atau keterangan lain."
              rows={3}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={hasCertificate}
              onCheckedChange={(v) => setHasCertificate(v === true)}
            />
            <span>Memiliki sertifikat / piagam</span>
          </label>

          {hasCertificate && (
            <div className="space-y-1.5">
              <Label htmlFor="award-cert">Nomor Sertifikat</Label>
              <Input
                id="award-cert"
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="Nomor atau referensi sertifikat"
              />
            </div>
          )}

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
            label="Dokumen (Sertifikat / Piagam)"
            hint="PDF atau gambar, maksimal 10 MB."
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
