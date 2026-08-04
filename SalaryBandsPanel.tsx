import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { BookOpen, Trash2, Pencil } from "lucide-react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  bandColorForGrade,
  bandLabelForGrade,
  formatIDR,
} from "../_lib/grading-utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";

export default function SalaryBandsPanel() {
  const bands = useQuery(api.grading.listSalaryBands, {});
  const upsert = useMutation(api.grading.upsertSalaryBand);
  const remove = useMutation(api.grading.deleteSalaryBand);

  const [editing, setEditing] = useState<Doc<"ggsSalaryBands"> | null>(null);
  const [formGrade, setFormGrade] = useState<string>("");
  const [bandLabel, setBandLabel] = useState("");
  const [minSalary, setMinSalary] = useState<string>("");
  const [midSalary, setMidSalary] = useState<string>("");
  const [maxSalary, setMaxSalary] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (band: Doc<"ggsSalaryBands"> | null) => {
    setEditing(band);
    setFormGrade(band ? String(band.grade) : "");
    setBandLabel(band?.bandLabel ?? "");
    setMinSalary(band ? String(band.minSalary) : "");
    setMidSalary(band ? String(band.midSalary) : "");
    setMaxSalary(band ? String(band.maxSalary) : "");
    setNote(band?.note ?? "");
  };

  const reset = () => {
    setEditing(null);
    setFormGrade("");
    setBandLabel("");
    setMinSalary("");
    setMidSalary("");
    setMaxSalary("");
    setNote("");
  };

  const handleSave = async () => {
    const grade = Number(formGrade);
    const minS = Number(minSalary);
    const midS = Number(midSalary);
    const maxS = Number(maxSalary);
    if (!grade || grade < 1 || grade > 25) {
      toast.error("Grade harus 1..25");
      return;
    }
    if (!bandLabel.trim()) {
      toast.error("Nama band wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        grade,
        bandLabel: bandLabel.trim(),
        minSalary: minS,
        midSalary: midS,
        maxSalary: maxS,
        currency: "IDR",
        note: note.trim() || undefined,
        isActive: true,
      });
      toast.success("Salary band disimpan");
      reset();
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

  const handleDelete = async (id: Doc<"ggsSalaryBands">["_id"]) => {
    if (!window.confirm("Hapus band ini?")) return;
    try {
      await remove({ id });
      toast.success("Band dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Salary Bands</h3>
              <p className="text-xs text-muted-foreground">
                Rentang gaji (IDR) per global grade. Digunakan untuk compa-ratio
                dan pemetaan jabatan → gaji.
              </p>
            </div>
          </div>
          {bands === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : bands.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>Belum ada salary band</EmptyTitle>
                <EmptyDescription>
                  Tambahkan band pertama melalui form di sebelah kanan.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Mid</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bands.map((b) => (
                    <TableRow key={b._id}>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-md text-sm font-bold",
                            bandColorForGrade(b.grade),
                          )}
                        >
                          {b.grade}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{b.bandLabel}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {bandLabelForGrade(b.grade)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatIDR(b.minSalary)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {formatIDR(b.midSalary)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatIDR(b.maxSalary)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="cursor-pointer"
                          onClick={() => startEdit(b)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="cursor-pointer text-destructive"
                          onClick={() => handleDelete(b._id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {editing ? "Edit Band" : "Tambah Band"}
            </h3>
            {editing ? <Badge variant="outline">Grade {editing.grade}</Badge> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Global Grade (1–25)</Label>
            <Input
              type="number"
              min={1}
              max={25}
              value={formGrade}
              disabled={!!editing}
              onChange={(e) => setFormGrade(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Band Label</Label>
            <Input
              placeholder="Contoh: P3, Manager I, dll."
              value={bandLabel}
              onChange={(e) => setBandLabel(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mid</Label>
              <Input
                type="number"
                value={midSalary}
                onChange={(e) => setMidSalary(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {editing ? (
              <Button
                variant="ghost"
                className="cursor-pointer"
                onClick={reset}
              >
                Batal
              </Button>
            ) : null}
            <Button
              className="ml-auto cursor-pointer"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : editing ? "Update" : "Tambah"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
