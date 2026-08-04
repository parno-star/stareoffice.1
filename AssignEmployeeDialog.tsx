import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  positionId: Id<"ggsPositions">;
  positionTitle: string;
};

export default function AssignEmployeeDialog({
  positionId,
  positionTitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [salary, setSalary] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const employees = useQuery(
    api.users.listEmployees,
    open ? { search: undefined } : "skip",
  );
  const assign = useMutation(api.grading.assignEmployee);

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      await assign({
        userId: userId as Id<"users">,
        positionId,
        currentSalary: salary ? Number(salary) : undefined,
        note: note.trim() || undefined,
      });
      toast.success("Karyawan berhasil dipetakan ke jabatan");
      setOpen(false);
      setUserId("");
      setSalary("");
      setNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="cursor-pointer">
          <UserPlus className="size-4" />
          Tambah Karyawan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Petakan Karyawan ke Jabatan</DialogTitle>
          <DialogDescription>
            Kaitkan karyawan ke jabatan{" "}
            <span className="font-medium">{positionTitle}</span>. Karyawan
            secara otomatis mewarisi grade jabatan ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Karyawan</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih karyawan" />
              </SelectTrigger>
              <SelectContent>
                {(employees ?? []).map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? "—"}
                    {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gaji Saat Ini (IDR/bulan, opsional)</Label>
            <Input
              type="number"
              placeholder="Contoh: 15000000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Dipakai untuk menghitung Compa-Ratio terhadap Mid Salary band.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
