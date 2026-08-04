import { useState, useMemo } from "react";
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
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { POSITION_CHANGE_TYPES } from "../_lib/history-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  editing: Doc<"employeePositionHistory"> | null;
};

export default function PositionFormDialog({
  open,
  onOpenChange,
  userId,
  editing,
}: Props) {
  const create = useMutation(api.employeeHistory.createPosition);
  const update = useMutation(api.employeeHistory.updatePosition);
  const positionDirectory = useQuery(api.positionDirectory.list, {});

  const [saving, setSaving] = useState(false);
  const [jobTitle, setJobTitle] = useState(editing?.jobTitle ?? "");
  const [department, setDepartment] = useState(editing?.department ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [changeType, setChangeType] = useState<string>(
    editing?.changeType ?? "initial",
  );
  const [startDate, setStartDate] = useState(editing?.startDate ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [isCurrent, setIsCurrent] = useState<boolean>(
    editing?.isCurrent ?? false,
  );
  const [referenceNumber, setReferenceNumber] = useState(
    editing?.referenceNumber ?? "",
  );
  const [managerName, setManagerName] = useState(editing?.managerName ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  // Source job title options from the "Nama Jabatan" master data
  const jobTitleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of positionDirectory ?? []) {
      if (p.isActive && p.fullName.trim()) set.add(p.fullName.trim());
    }
    if (jobTitle.trim()) set.add(jobTitle.trim());
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  }, [positionDirectory, jobTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) {
      toast.error("Jabatan wajib diisi");
      return;
    }
    if (!startDate) {
      toast.error("Tanggal mulai jabatan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        jobTitle,
        department: department || undefined,
        location: location || undefined,
        changeType,
        startDate,
        endDate: endDate || undefined,
        isCurrent,
        referenceNumber: referenceNumber || undefined,
        description: description || undefined,
        managerName: managerName || undefined,
      };
      if (editing) {
        await update({ id: editing._id, ...payload });
        toast.success("Riwayat jabatan diperbarui");
      } else {
        await create({ userId, ...payload });
        toast.success("Riwayat jabatan ditambahkan");
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
            {editing ? "Edit Riwayat Jabatan" : "Tambah Riwayat Jabatan"}
          </DialogTitle>
          <DialogDescription>
            Catat riwayat jabatan, promosi, mutasi, atau rotasi di perusahaan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pos-title">Jabatan</Label>
            <Select
              value={jobTitle ? jobTitle : "__empty__"}
              onValueChange={(val) => setJobTitle(val === "__empty__" ? "" : val)}
            >
              <SelectTrigger id="pos-title" className="w-full cursor-pointer">
                <SelectValue placeholder="Pilih jabatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">-- Pilih jabatan --</SelectItem>
                {jobTitleOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-dept">Departemen</Label>
              <Input
                id="pos-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Kepegawaian"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-loc">Lokasi</Label>
              <Input
                id="pos-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Kantor Pusat"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-type">Jenis Perubahan</Label>
            <Select value={changeType} onValueChange={setChangeType}>
              <SelectTrigger id="pos-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_CHANGE_TYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-start">Tanggal Mulai</Label>
              <DateField
                id="pos-start"
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-end">Tanggal Selesai</Label>
              <DateField
                id="pos-end"
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
            <span>Jabatan saat ini</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pos-ref">Nomor SK / Referensi</Label>
              <Input
                id="pos-ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="SK-HR-2024-0012"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-mgr">Nama Atasan</Label>
              <Input
                id="pos-mgr"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Budi Santoso"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pos-desc">Uraian / Tanggung Jawab</Label>
            <Textarea
              id="pos-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ringkasan tugas utama pada jabatan ini..."
              rows={3}
            />
          </div>

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
