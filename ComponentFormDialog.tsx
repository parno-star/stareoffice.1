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
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component?: Doc<"payrollComponents"> | null;
};

export default function ComponentFormDialog({
  open,
  onOpenChange,
  component,
}: Props) {
  const isEdit = Boolean(component);
  const createComponent = useMutation(api.payroll.components.createComponent);
  const updateComponent = useMutation(api.payroll.components.updateComponent);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"earning" | "deduction">("earning");
  const [calculation, setCalculation] =
    useState<"fixed" | "percent_of_basic">("fixed");
  const [defaultAmount, setDefaultAmount] = useState<string>("0");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isTaxable, setIsTaxable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(component?.name ?? "");
      setCode(component?.code ?? "");
      setType(
        (component?.type === "deduction" ? "deduction" : "earning") as
          | "earning"
          | "deduction",
      );
      setCalculation(
        (component?.calculation === "percent_of_basic"
          ? "percent_of_basic"
          : "fixed") as "fixed" | "percent_of_basic",
      );
      setDefaultAmount(String(component?.defaultAmount ?? 0));
      setDescription(component?.description ?? "");
      setIsActive(component?.isActive ?? true);
      setIsTaxable(component?.isTaxable ?? true);
    }
  }, [open, component]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const amt = Number(defaultAmount);
      if (!Number.isFinite(amt) || amt < 0) {
        toast.error("Nilai default tidak valid");
        return;
      }
      if (isEdit && component) {
        await updateComponent({
          id: component._id,
          name: name.trim(),
          code: code.trim(),
          type,
          calculation,
          defaultAmount: amt,
          description: description.trim() || undefined,
          isActive,
          isTaxable,
        });
        toast.success("Komponen diperbarui");
      } else {
        await createComponent({
          name: name.trim(),
          code: code.trim(),
          type,
          calculation,
          defaultAmount: amt,
          description: description.trim() || undefined,
          isTaxable,
        });
        toast.success("Komponen ditambahkan");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Komponen Gaji" : "Tambah Komponen Gaji"}
          </DialogTitle>
          <DialogDescription>
            Komponen ini akan digunakan untuk membentuk slip gaji semua karyawan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="comp-name">Nama komponen</Label>
            <Input
              id="comp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Gaji Pokok"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comp-code">Kode</Label>
            <Input
              id="comp-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BASIC"
              className="uppercase"
              required
            />
            <p className="text-xs text-muted-foreground">
              Gunakan kode "BASIC" untuk gaji pokok. Kode lain bebas (mis. TRANS, BPJS).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Tipe</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "earning" | "deduction")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Penerimaan</SelectItem>
                  <SelectItem value="deduction">Potongan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Perhitungan</Label>
              <Select
                value={calculation}
                onValueChange={(v) =>
                  setCalculation(v as "fixed" | "percent_of_basic")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Nominal tetap (IDR)</SelectItem>
                  <SelectItem value="percent_of_basic">
                    Persen dari gaji pokok
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comp-amount">
              {calculation === "percent_of_basic"
                ? "Persen default (%)"
                : "Nominal default (IDR)"}
            </Label>
            <Input
              id="comp-amount"
              type="number"
              min="0"
              step={calculation === "percent_of_basic" ? "0.01" : "1000"}
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comp-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="comp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Penjelasan singkat"
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Kena pajak (PPh21)</p>
              <p className="text-xs text-muted-foreground">
                Jika penerimaan ini merupakan dasar perhitungan PPh21
              </p>
            </div>
            <Switch checked={isTaxable} onCheckedChange={setIsTaxable} />
          </div>
          {isEdit ? (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Aktif</p>
                <p className="text-xs text-muted-foreground">
                  Nonaktifkan untuk menghentikan komponen tanpa menghapus
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
