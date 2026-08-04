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

const LEVEL_GRADES = [
  { value: "entry", label: "Entry / Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Principal" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
];

type Props = {
  trigger: React.ReactNode;
  trackId: Doc<"careerTracks">["_id"];
  level?: Doc<"careerLevels"> | null;
};

export default function CareerLevelFormDialog({
  trigger,
  trackId,
  level,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [levelGrade, setLevelGrade] = useState("entry");
  const [description, setDescription] = useState("");
  const [minYears, setMinYears] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [expectations, setExpectations] = useState("");
  const [saving, setSaving] = useState(false);

  const createLevel = useMutation(api.training.careers.createLevel);
  const updateLevel = useMutation(api.training.careers.updateLevel);
  const deleteLevel = useMutation(api.training.careers.deleteLevel);

  useEffect(() => {
    if (!open) return;
    if (level) {
      setTitle(level.title);
      setLevelGrade(level.levelGrade);
      setDescription(level.description ?? "");
      setMinYears(
        level.minYearsInLevel !== undefined
          ? String(level.minYearsInLevel)
          : "",
      );
      setSalaryMin(
        level.salaryMin !== undefined ? String(level.salaryMin) : "",
      );
      setSalaryMax(
        level.salaryMax !== undefined ? String(level.salaryMax) : "",
      );
      setExpectations(level.expectations ?? "");
    } else {
      setTitle("");
      setLevelGrade("entry");
      setDescription("");
      setMinYears("");
      setSalaryMin("");
      setSalaryMax("");
      setExpectations("");
    }
  }, [open, level]);

  const parseNum = (v: string): number | undefined => {
    if (v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        levelGrade,
        description: description.trim() || undefined,
        minYearsInLevel: parseNum(minYears),
        salaryMin: parseNum(salaryMin),
        salaryMax: parseNum(salaryMax),
        expectations: expectations.trim() || undefined,
      };
      if (level) {
        await updateLevel({ id: level._id, ...payload });
        toast.success("Level diperbarui");
      } else {
        await createLevel({ trackId, ...payload });
        toast.success("Level ditambahkan");
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
    if (!level) return;
    if (!window.confirm("Hapus level ini?")) return;
    try {
      await deleteLevel({ id: level._id });
      toast.success("Level dihapus");
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {level ? "Ubah level" : "Tambah level"}
            </DialogTitle>
            <DialogDescription>
              Definisikan jabatan, tingkat senioritas, dan kriteria promosi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Judul level</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Senior Engineer"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select value={levelGrade} onValueChange={setLevelGrade}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_GRADES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Minimal tahun di level</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={minYears}
                onChange={(e) => setMinYears(e.target.value)}
                placeholder="Contoh: 2"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gaji min (IDR)</Label>
              <Input
                type="number"
                min={0}
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="8.000.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gaji maks (IDR)</Label>
              <Input
                type="number"
                min={0}
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="15.000.000"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Deskripsi singkat</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Kriteria promosi (markdown)</Label>
              <Textarea
                value={expectations}
                onChange={(e) => setExpectations(e.target.value)}
                rows={4}
                placeholder="- Memimpin minimal 2 proyek lintas tim\n- Menjadi mentor untuk level junior"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {level ? (
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
