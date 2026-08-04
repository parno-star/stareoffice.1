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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_CONFIG,
  OWNER_CONFIG,
  PHASE_CONFIG,
  PHASE_ORDER,
  type OnboardingCategory,
  type OnboardingPhase,
  type OwnerRole,
} from "../_lib/onboarding-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboardingId: Id<"onboardingEmployees">;
};

export default function AddTaskDialog({
  open,
  onOpenChange,
  onboardingId,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<OnboardingCategory>("other");
  const [ownerRole, setOwnerRole] = useState<OwnerRole>("hr");
  const [phase, setPhase] = useState<OnboardingPhase>("first_week");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addTask = useMutation(api.onboarding.addCustomTask);

  const reset = () => {
    setTitle("");
    setDescription("");
    setCategory("other");
    setOwnerRole("hr");
    setPhase("first_week");
    setDueDate("");
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      toast.error("Judul wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      await addTask({
        onboardingId,
        title: trimmed,
        description: description.trim() || undefined,
        category,
        ownerRole,
        phase,
        dueDate: dueDate || undefined,
      });
      toast.success("Tugas ditambahkan");
      reset();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menambahkan");
      } else {
        toast.error("Gagal menambahkan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) {
          onOpenChange(v);
          if (!v) reset();
        }
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Tugas Khusus</DialogTitle>
          <DialogDescription>
            Tambahkan tugas onboarding spesifik untuk karyawan ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-title">Judul</Label>
            <Input
              id="custom-title"
              placeholder="Tour kantor bersama manajer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="custom-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as OnboardingCategory)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => (
                    <SelectItem key={value} value={value}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Penanggung Jawab</Label>
              <Select
                value={ownerRole}
                onValueChange={(v) => setOwnerRole(v as OwnerRole)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OWNER_CONFIG).map(([value, cfg]) => (
                    <SelectItem key={value} value={value}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fase Onboarding</Label>
            <Select
              value={phase}
              onValueChange={(v) => setPhase(v as OnboardingPhase)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_ORDER.map((p) => {
                  const cfg = PHASE_CONFIG[p];
                  const Icon = cfg.icon;
                  return (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-date">Deadline (opsional)</Label>
            <DateField
              id="custom-date"
              value={dueDate}
              onChange={(v) => setDueDate(v)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menambahkan..." : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
