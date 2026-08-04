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
import { ORGANIZATION_CATEGORIES } from "../_lib/history-utils.ts";
import HistoryAttachmentField, {
  type StagedAttachment,
} from "./HistoryAttachmentField.tsx";
import { useHistoryAttachmentUpload } from "../_hooks/use-history-attachment-upload.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  editing:
    | (Doc<"employeeOrganizationHistory"> & { attachmentUrl?: string | null })
    | null;
};

export default function OrganizationFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
}: Props) {
  const create = useMutation(api.employeeHistory.createOrganization);
  const update = useMutation(api.employeeHistory.updateOrganization);
  const uploadFile = useHistoryAttachmentUpload();

  const [saving, setSaving] = useState(false);
  const [organizationName, setOrganizationName] = useState(
    editing?.organizationName ?? "",
  );
  const [role, setRole] = useState(editing?.role ?? "");
  const [category, setCategory] = useState(editing?.category ?? "community");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [isCurrent, setIsCurrent] = useState<boolean>(
    editing?.isCurrent ?? false,
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [achievements, setAchievements] = useState(editing?.achievements ?? "");
  const [stagedAttachment, setStagedAttachment] =
    useState<StagedAttachment | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationName.trim()) {
      toast.error("Nama organisasi wajib diisi");
      return;
    }
    if (!role.trim()) {
      toast.error("Jabatan di organisasi wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        organizationName,
        role,
        category,
        location: location || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isCurrent,
        description: description || undefined,
        achievements: achievements || undefined,
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
            : "Riwayat organisasi diperbarui",
        );
      } else {
        const res = await create({ userId, ...payload });
        toast.success(
          res?.queued
            ? "Riwayat organisasi diajukan untuk verifikasi HR"
            : "Riwayat organisasi ditambahkan",
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
            {editing ? "Edit Riwayat Organisasi" : "Tambah Riwayat Organisasi"}
          </DialogTitle>
          <DialogDescription>
            Catat keikutsertaan di organisasi internal maupun eksternal, termasuk
            peran dan pencapaian Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Nama Organisasi</Label>
            <Input
              id="org-name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Himpunan Mahasiswa Informatika"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-role">Jabatan / Peran</Label>
              <Input
                id="org-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ketua, Sekretaris, Anggota, dsb."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="org-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZATION_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-location">Lokasi</Label>
            <Input
              id="org-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jakarta"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-start">Tanggal Mulai</Label>
              <DateField
                id="org-start"
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-end">Tanggal Selesai</Label>
              <DateField
                id="org-end"
                value={endDate}
                onChange={(v) => setEndDate(v)}
                disabled={isCurrent}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isCurrent}
              onCheckedChange={(v) => setIsCurrent(v === true)}
            />
            <span>Masih aktif di organisasi ini</span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="org-desc">Deskripsi Peran</Label>
            <Textarea
              id="org-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tugas dan tanggung jawab utama selama di organisasi."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-ach">Pencapaian</Label>
            <Textarea
              id="org-ach"
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="Program yang dijalankan, penghargaan, dampak, dsb."
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
            label="Dokumen (SK / Sertifikat)"
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
