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
import { EDUCATION_LEVELS } from "../_lib/history-utils.ts";
import HistoryAttachmentField, {
  type StagedAttachment,
} from "./HistoryAttachmentField.tsx";
import { useHistoryAttachmentUpload } from "../_hooks/use-history-attachment-upload.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  editing: (Doc<"employeeEducation"> & { attachmentUrl?: string | null }) | null;
};

export default function EducationFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
}: Props) {
  const create = useMutation(api.employeeHistory.createEducation);
  const update = useMutation(api.employeeHistory.updateEducation);
  const uploadFile = useHistoryAttachmentUpload();

  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState(editing?.level ?? "s1");
  const [institution, setInstitution] = useState(editing?.institution ?? "");
  const [fieldOfStudy, setFieldOfStudy] = useState(editing?.fieldOfStudy ?? "");
  const [startYear, setStartYear] = useState<string>(
    editing?.startYear ? String(editing.startYear) : "",
  );
  const [endYear, setEndYear] = useState<string>(
    editing?.endYear ? String(editing.endYear) : "",
  );
  const [gpa, setGpa] = useState<string>(editing?.gpa ? String(editing.gpa) : "");
  const [isCurrent, setIsCurrent] = useState<boolean>(
    editing?.isCurrent ?? false,
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [stagedAttachment, setStagedAttachment] =
    useState<StagedAttachment | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution.trim()) {
      toast.error("Nama institusi wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const startY = startYear ? Number(startYear) : undefined;
      const endY = endYear ? Number(endYear) : undefined;
      const gpaN = gpa ? Number(gpa) : undefined;
      const payload = {
        level,
        institution,
        fieldOfStudy: fieldOfStudy || undefined,
        startYear: Number.isFinite(startY) ? startY : undefined,
        endYear: Number.isFinite(endY) ? endY : undefined,
        gpa: Number.isFinite(gpaN) ? gpaN : undefined,
        description: description || undefined,
        isCurrent,
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
            : "Riwayat pendidikan diperbarui",
        );
      } else {
        const res = await create({ userId, ...payload });
        toast.success(
          res?.queued
            ? "Riwayat pendidikan diajukan untuk verifikasi HR"
            : "Riwayat pendidikan ditambahkan",
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
            {editing ? "Edit Riwayat Pendidikan" : "Tambah Riwayat Pendidikan"}
          </DialogTitle>
          <DialogDescription>
            Tambahkan jenjang pendidikan formal, nama kampus atau sekolah, serta
            tahun studi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edu-level">Jenjang Pendidikan</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger id="edu-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((lv) => (
                  <SelectItem key={lv.value} value={lv.value}>
                    {lv.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edu-institution">Nama Institusi</Label>
            <Input
              id="edu-institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Universitas Indonesia"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edu-field">Jurusan / Program Studi</Label>
            <Input
              id="edu-field"
              value={fieldOfStudy}
              onChange={(e) => setFieldOfStudy(e.target.value)}
              placeholder="Manajemen Sumber Daya Manusia"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="edu-start">Tahun Mulai</Label>
              <Input
                id="edu-start"
                type="number"
                inputMode="numeric"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                placeholder="2016"
                min={1950}
                max={2100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edu-end">Tahun Lulus</Label>
              <Input
                id="edu-end"
                type="number"
                inputMode="numeric"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                placeholder="2020"
                disabled={isCurrent}
                min={1950}
                max={2100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edu-gpa">IPK / Nilai</Label>
              <Input
                id="edu-gpa"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="3.75"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isCurrent}
              onCheckedChange={(v) => setIsCurrent(v === true)}
            />
            <span>Masih berlangsung</span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="edu-desc">Catatan</Label>
            <Textarea
              id="edu-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Prestasi, penghargaan, tesis, dsb."
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
            label="Dokumen (Ijazah / Transkrip)"
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
