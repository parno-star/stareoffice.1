import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
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

const COMPETENCY_CATEGORIES = [
  { value: "technical", label: "Teknis" },
  { value: "leadership", label: "Kepemimpinan" },
  { value: "soft_skills", label: "Soft skills" },
  { value: "product", label: "Produk" },
  { value: "compliance", label: "Kepatuhan" },
  { value: "domain", label: "Domain" },
  { value: "other", label: "Lainnya" },
];

const DEFAULT_LEVELS = [
  "Novice - memerlukan bimbingan penuh untuk tugas dasar.",
  "Advanced Beginner - mampu menyelesaikan tugas rutin dengan supervisi.",
  "Competent - mandiri pada tugas standar dan memahami konteks lebih luas.",
  "Proficient - menguasai topik, memimpin tugas kompleks, dan melatih rekan.",
  "Expert - rujukan utama, membentuk standar, dan memengaruhi strategi.",
];

type Props = {
  trigger: React.ReactNode;
  competency?: Doc<"competencies"> | null;
};

export default function CompetencyFormDialog({ trigger, competency }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technical");
  const [levels, setLevels] = useState<Array<string>>(DEFAULT_LEVELS);
  const [color, setColor] = useState("blue");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const createCompetency = useMutation(
    api.training.careers.createCompetency,
  );
  const updateCompetency = useMutation(
    api.training.careers.updateCompetency,
  );
  const deleteCompetency = useMutation(
    api.training.careers.deleteCompetency,
  );

  useEffect(() => {
    if (!open) return;
    if (competency) {
      setName(competency.name);
      setDescription(competency.description);
      setCategory(competency.category);
      setLevels(
        competency.levelDescriptors.length === 5
          ? [...competency.levelDescriptors]
          : [...DEFAULT_LEVELS],
      );
      setColor(competency.color);
      setIcon(competency.icon ?? "");
      setIsActive(competency.isActive);
    } else {
      setName("");
      setDescription("");
      setCategory("technical");
      setLevels([...DEFAULT_LEVELS]);
      setColor("blue");
      setIcon("");
      setIsActive(true);
    }
  }, [open, competency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (competency) {
        await updateCompetency({
          id: competency._id,
          name,
          description,
          category,
          levelDescriptors: levels,
          color,
          icon: icon.trim() || undefined,
          isActive,
        });
        toast.success("Kompetensi diperbarui");
      } else {
        await createCompetency({
          name,
          description,
          category,
          levelDescriptors: levels,
          color,
          icon: icon.trim() || undefined,
          isActive,
        });
        toast.success("Kompetensi dibuat");
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
    if (!competency) return;
    if (
      !window.confirm(
        "Hapus kompetensi ini? Semua penilaian dan kaitan kelas akan ikut terhapus.",
      )
    )
      return;
    try {
      await deleteCompetency({ id: competency._id });
      toast.success("Kompetensi dihapus");
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {competency ? "Ubah kompetensi" : "Kompetensi baru"}
            </DialogTitle>
            <DialogDescription>
              Definisikan kemampuan utama beserta perilaku yang diharapkan di
              tiap level 1 - 5.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nama kompetensi</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Komunikasi Efektif"
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Mengapa kompetensi ini penting..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPETENCY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
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
                placeholder="Contoh: 🧠"
                maxLength={4}
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  id="competency-active"
                />
                <Label htmlFor="competency-active">Aktif</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Deskriptor level 1 - 5</Label>
            {levels.map((text, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                  {idx + 1}
                </span>
                <Textarea
                  value={text}
                  rows={2}
                  onChange={(e) => {
                    const copy = [...levels];
                    copy[idx] = e.target.value;
                    setLevels(copy);
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {competency ? (
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

// Utility dialog to link courses to a competency
export function CompetencyCoursesDialog({
  trigger,
  competencyId,
  allCourses,
}: {
  trigger: React.ReactNode;
  competencyId: Id<"competencies">;
  allCourses: Array<Doc<"courses">>;
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState<string>("");
  const [levelImpact, setLevelImpact] = useState(3);
  const addLink = useMutation(api.training.careers.addCompetencyCourse);

  const handleAdd = async () => {
    if (!courseId) {
      toast.error("Pilih kelas terlebih dahulu");
      return;
    }
    try {
      await addLink({
        competencyId,
        courseId: courseId as Id<"courses">,
        levelImpact,
      });
      toast.success("Kelas dikaitkan");
      setCourseId("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger}
      </div>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kaitkan kelas</DialogTitle>
          <DialogDescription>
            Tentukan kelas yang meningkatkan kompetensi ini dan level yang
            diperoleh setelah selesai.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Kelas</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Pilih kelas..." />
              </SelectTrigger>
              <SelectContent>
                {allCourses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Level yang diperoleh (1 - 5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={levelImpact}
              onChange={(e) =>
                setLevelImpact(Math.max(1, Math.min(5, Number(e.target.value))))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="cursor-pointer"
          >
            Tutup
          </Button>
          <Button onClick={handleAdd} className="cursor-pointer">
            Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
