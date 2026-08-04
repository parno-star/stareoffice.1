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
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_CONFIG,
  OWNER_CONFIG,
  PHASE_CONFIG,
  PHASE_ORDER,
  phaseFromOffset,
  type OnboardingCategory,
  type OnboardingPhase,
  type OwnerRole,
} from "../_lib/onboarding-utils.ts";

type Props = {
  template?: Doc<"onboardingTemplates">;
  trigger: ReactNode;
};

export default function TemplateFormDialog({ template, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState<OnboardingCategory>(
    (template?.category as OnboardingCategory) ?? "paperwork",
  );
  const [ownerRole, setOwnerRole] = useState<OwnerRole>(
    (template?.ownerRole as OwnerRole) ?? "hr",
  );
  const [dueOffsetDays, setDueOffsetDays] = useState(
    String(template?.dueOffsetDays ?? 7),
  );
  const [phase, setPhase] = useState<OnboardingPhase>(
    (template?.phase as OnboardingPhase) ??
      phaseFromOffset(template?.dueOffsetDays ?? 7),
  );
  const [submitting, setSubmitting] = useState(false);

  const createTemplate = useMutation(api.onboarding.createTemplate);
  const updateTemplate = useMutation(api.onboarding.updateTemplate);

  const reset = () => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? "");
      setCategory(template.category as OnboardingCategory);
      setOwnerRole(template.ownerRole as OwnerRole);
      setDueOffsetDays(String(template.dueOffsetDays));
      setPhase(
        (template.phase as OnboardingPhase) ??
          phaseFromOffset(template.dueOffsetDays),
      );
    } else {
      setTitle("");
      setDescription("");
      setCategory("paperwork");
      setOwnerRole("hr");
      setDueOffsetDays("7");
      setPhase("first_week");
    }
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      toast.error("Judul tugas wajib diisi");
      return;
    }
    const offset = Number(dueOffsetDays);
    if (!Number.isFinite(offset)) {
      toast.error("Masukkan jumlah hari yang valid");
      return;
    }
    setSubmitting(true);
    try {
      if (template) {
        await updateTemplate({
          id: template._id,
          title: trimmed,
          description: description.trim(),
          category,
          ownerRole,
          phase,
          dueOffsetDays: offset,
        });
        toast.success("Template diperbarui");
      } else {
        await createTemplate({
          title: trimmed,
          description: description.trim() || undefined,
          category,
          ownerRole,
          phase,
          dueOffsetDays: offset,
        });
        toast.success("Template ditambahkan");
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
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
          setOpen(v);
          if (!v) reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template Tugas" : "Template Tugas Baru"}
          </DialogTitle>
          <DialogDescription>
            Template ini akan otomatis ditambahkan ke checklist saat karyawan
            baru memulai onboarding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-title">Judul</Label>
            <Input
              id="tpl-title"
              placeholder="Tanda tangan kontrak kerja"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Deskripsi (opsional)</Label>
            <Textarea
              id="tpl-desc"
              rows={3}
              placeholder="Instruksi atau detail tambahan..."
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
                  {Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={value} value={value}>
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
                  {Object.entries(OWNER_CONFIG).map(([value, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={value} value={value}>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="tpl-offset">
                Deadline (hari dari start)
              </Label>
              <Input
                id="tpl-offset"
                type="number"
                placeholder="7"
                value={dueOffsetDays}
                onChange={(e) => {
                  setDueOffsetDays(e.target.value);
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setPhase(phaseFromOffset(v));
                }}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Contoh: 0 = hari pertama, 7 = minggu pertama.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Menyimpan..." : template ? "Simpan" : "Tambah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
