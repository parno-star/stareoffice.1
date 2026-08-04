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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { METRIC_TYPE_OPTIONS } from "../_lib/okr-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: Id<"objectives">;
  keyResult?: Doc<"keyResults"> | null;
  defaultOwnerId: Id<"users">;
};

export default function KeyResultFormDialog({
  open,
  onOpenChange,
  objectiveId,
  keyResult,
  defaultOwnerId,
}: Props) {
  const isEdit = Boolean(keyResult);
  const createKr = useMutation(api.okr.keyResults.createKeyResult);
  const updateKr = useMutation(api.okr.keyResults.updateKeyResult);
  const users = useQuery(api.users.listEmployees, {});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metricType, setMetricType] = useState("number");
  const [startValue, setStartValue] = useState("0");
  const [targetValue, setTargetValue] = useState("100");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState("higher_is_better");
  const [weight, setWeight] = useState("1");
  const [ownerId, setOwnerId] = useState<string>(defaultOwnerId as string);
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (keyResult) {
      setTitle(keyResult.title);
      setDescription(keyResult.description ?? "");
      setMetricType(keyResult.metricType);
      setStartValue(String(keyResult.startValue));
      setTargetValue(String(keyResult.targetValue));
      setUnit(keyResult.unit ?? "");
      setDirection(keyResult.direction);
      setWeight(String(keyResult.weight));
      setOwnerId(keyResult.ownerId as string);
      setDueDate(keyResult.dueDate ?? "");
    } else {
      setTitle("");
      setDescription("");
      setMetricType("number");
      setStartValue("0");
      setTargetValue("100");
      setUnit("");
      setDirection("higher_is_better");
      setWeight("1");
      setOwnerId(defaultOwnerId as string);
      setDueDate("");
    }
  }, [open, keyResult, defaultOwnerId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Judul KR wajib");
      return;
    }
    const startNum = Number(startValue);
    const targetNum = Number(targetValue);
    if (Number.isNaN(startNum) || Number.isNaN(targetNum)) {
      toast.error("Nilai awal & target harus berupa angka");
      return;
    }
    const weightNum = Math.max(0.1, Number(weight) || 1);
    setSubmitting(true);
    try {
      if (isEdit && keyResult) {
        await updateKr({
          keyResultId: keyResult._id,
          title: title.trim(),
          description: description.trim() || undefined,
          metricType,
          startValue: startNum,
          targetValue: targetNum,
          direction,
          unit: unit.trim() || undefined,
          weight: weightNum,
          ownerId: ownerId as Id<"users">,
          dueDate: dueDate || undefined,
        });
        toast.success("Key result diperbarui");
      } else {
        await createKr({
          objectiveId,
          title: title.trim(),
          description: description.trim() || undefined,
          metricType,
          startValue: startNum,
          targetValue: targetNum,
          direction,
          unit: unit.trim() || undefined,
          weight: weightNum,
          ownerId: ownerId as Id<"users">,
          dueDate: dueDate || undefined,
        });
        toast.success("Key result ditambahkan");
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const valueLabel =
    metricType === "boolean"
      ? "0 = Belum, 1 = Selesai"
      : metricType === "percent"
        ? "Persen (0-100)"
        : metricType === "currency"
          ? "Nominal IDR"
          : "Angka";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Key Result" : "Tambah Key Result"}
          </DialogTitle>
          <DialogDescription>
            Key result adalah ukuran numerik yang jelas. Mulai dari nilai
            sekarang, target yang ingin dicapai.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="kr-title">Judul</Label>
            <Input
              id="kr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: eNPS naik dari 25 menjadi 50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="kr-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="kr-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bagaimana KR ini diukur?"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Tipe metrik</Label>
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_TYPE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{valueLabel}</p>
            </div>

            <div className="grid gap-2">
              <Label>Arah</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="higher_is_better">
                    Lebih tinggi lebih baik
                  </SelectItem>
                  <SelectItem value="lower_is_better">
                    Lebih rendah lebih baik
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kr-start">Nilai awal</Label>
              <Input
                id="kr-start"
                type="number"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kr-target">Target</Label>
              <Input
                id="kr-target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kr-unit">Unit (opsional)</Label>
              <Input
                id="kr-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="customers, hari, dll"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kr-weight">Bobot</Label>
              <Input
                id="kr-weight"
                type="number"
                step="0.1"
                min="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name ?? u.email ?? "Tanpa nama"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kr-due">Tenggat (opsional)</Label>
              <DateField
                id="kr-due"
                value={dueDate}
                onChange={(v) => setDueDate(v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah KR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
