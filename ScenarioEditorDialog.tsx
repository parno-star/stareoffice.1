import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUsers: Array<Doc<"users">>;
  onCreated: (scenarioId: Id<"orgScenarios">) => void;
};

export default function ScenarioEditorDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const createScenario = useMutation(api.orgAdvanced.scenarios.createScenario);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setEffectiveDate("");
  };

  const handleCreate = async () => {
    if (name.trim().length < 2) {
      toast.error("Nama skenario minimal 2 karakter");
      return;
    }
    setSaving(true);
    try {
      const id = await createScenario({
        name: name.trim(),
        description: description.trim() || undefined,
        effectiveDate: effectiveDate || undefined,
      });
      toast.success("Skenario berhasil dibuat");
      reset();
      onCreated(id);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat skenario");
      } else {
        toast.error("Gagal membuat skenario");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Skenario Reorganisasi Baru</DialogTitle>
          <DialogDescription>
            Buat draft skenario. Tambah perubahan dan approver di halaman detail
            sebelum diajukan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-name">Nama Skenario</Label>
            <Input
              id="scenario-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Reorganisasi Divisi Produk Q2 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scenario-desc">Deskripsi</Label>
            <Textarea
              id="scenario-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tujuan, konteks, dan rasional skenario ini..."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scenario-date">Tanggal Efektif (opsional)</Label>
            <DateField
              id="scenario-date"
              value={effectiveDate}
              onChange={(v) => setEffectiveDate(v)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Menyimpan..." : "Buat Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
