import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Plus, Trash2, Pencil, Loader2, ArrowUp, ArrowDown,
  FileCheck, GitBranch, Star, ChevronRight, Users, Shield,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_ROLES = [
  { value: "konseptor", label: "Konseptor" },
  { value: "pemeriksa_1", label: "Pemeriksa I" },
  { value: "pemeriksa_2", label: "Pemeriksa II" },
  { value: "penyetuju", label: "Penyetuju / Penandatangan" },
];

const RESOLVER_TYPES = [
  { value: "author", label: "Pembuat Surat (Konseptor)" },
  { value: "direct_manager", label: "Atasan Langsung" },
  { value: "department_head", label: "Kepala Departemen/Bagian" },
  { value: "position_level", label: "Berdasarkan Jenjang Jabatan" },
  { value: "specific_user", label: "Pengguna Tertentu" },
];

const LETTER_TYPES = [
  { value: "keluar", label: "Surat Keluar" },
  { value: "masuk", label: "Surat Masuk" },
  { value: "memo", label: "Nota" },
  { value: "sk", label: "Surat Keputusan (SK)" },
  { value: "all", label: "Semua Jenis Surat" },
];

const ROLE_COLORS: Record<string, string> = {
  konseptor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  pemeriksa_1: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  pemeriksa_2: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  penyetuju: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type StepData = {
  order: number;
  role: string;
  label: string;
  resolverType: string;
  minPositionLevelCode?: string;
  specificUserId?: Id<"users">;
};

// ─── Step Editor ─────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  total,
  positionLevels,
  employees,
  onUpdate,
  onRemove,
  onMove,
}: {
  step: StepData;
  index: number;
  total: number;
  positionLevels: Array<{ _id: Id<"positionLevels">; code: string; name: string; rank: number }>;
  employees: Array<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department">> | undefined;
  onUpdate: (s: StepData) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <Badge variant="secondary" className="text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full">
            {step.order}
          </Badge>
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={() => onMove("up")} disabled={index === 0}
              className="cursor-pointer disabled:opacity-20 p-0.5 hover:bg-muted rounded">
              <ArrowUp className="size-3.5" />
            </button>
            <button type="button" onClick={() => onMove("down")} disabled={index === total - 1}
              className="cursor-pointer disabled:opacity-20 p-0.5 hover:bg-muted rounded">
              <ArrowDown className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Role */}
            <div className="space-y-1">
              <Label className="text-xs">Peran</Label>
              <Select value={step.role} onValueChange={(v) => {
                const roleLabel = STEP_ROLES.find((r) => r.value === v)?.label ?? v;
                onUpdate({ ...step, role: v, label: roleLabel });
              }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STEP_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="cursor-pointer">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label (editable) */}
            <div className="space-y-1">
              <Label className="text-xs">Label Tampilan</Label>
              <Input className="h-9" value={step.label} onChange={(e) => onUpdate({ ...step, label: e.target.value })} placeholder="Konseptor" />
            </div>
          </div>

          {/* Resolver type */}
          <div className="space-y-1">
            <Label className="text-xs">Cara Menentukan Approver</Label>
            <Select value={step.resolverType} onValueChange={(v) => onUpdate({ ...step, resolverType: v, minPositionLevelCode: undefined, specificUserId: undefined })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESOLVER_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="cursor-pointer">{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position level picker */}
          {step.resolverType === "position_level" && (
            <div className="space-y-1">
              <Label className="text-xs">Minimum Jenjang Jabatan</Label>
              <Select value={step.minPositionLevelCode ?? "none"} onValueChange={(v) => onUpdate({ ...step, minPositionLevelCode: v === "none" ? undefined : v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">(Pilih Jenjang)</SelectItem>
                  {positionLevels.map((pl) => (
                    <SelectItem key={pl.code} value={pl.code} className="cursor-pointer">
                      {pl.code} — {pl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Specific user picker */}
          {step.resolverType === "specific_user" && employees && (
            <div className="space-y-1">
              <Label className="text-xs">Pilih Pengguna</Label>
              <Select value={step.specificUserId ?? "none"} onValueChange={(v) => onUpdate({ ...step, specificUserId: (v === "none" ? undefined : v) as Id<"users"> | undefined })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">(Pilih Pengguna)</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id} className="cursor-pointer">
                      {emp.name} {emp.jobTitle ? `— ${emp.jobTitle}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <button type="button" onClick={onRemove}
          className="cursor-pointer p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors mt-1">
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Template Form ───────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Doc<"letterApprovalTemplates"> | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const createTemplate = useMutation(api.letterApprovalTemplates.create);
  const updateTemplate = useMutation(api.letterApprovalTemplates.update);
  const positionLevels = useQuery(api.positionLevels.listActive) ?? [];
  const employees = useQuery(api.users.listEmployees, { search: "", department: "" });

  const [name, setName] = useState(initial?.name ?? "");
  const [letterType, setLetterType] = useState(initial?.letterType ?? "keluar");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [steps, setSteps] = useState<StepData[]>(
    initial?.steps ?? [
      { order: 1, role: "konseptor", label: "Konseptor", resolverType: "author" },
    ],
  );
  const [saving, setSaving] = useState(false);

  const addStep = () => {
    const nextOrder = steps.length + 1;
    const defaultRole = nextOrder === 1 ? "konseptor" : nextOrder <= 3 ? `pemeriksa_${nextOrder - 1}` : "penyetuju";
    const defaultLabel = STEP_ROLES.find((r) => r.value === defaultRole)?.label ?? "Langkah";
    setSteps([...steps, {
      order: nextOrder,
      role: defaultRole,
      label: defaultLabel,
      resolverType: nextOrder === 1 ? "author" : "direct_manager",
    }]);
  };

  const updateStep = (index: number, step: StepData) => {
    const newSteps = [...steps];
    newSteps[index] = step;
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
    setSteps(newSteps);
  };

  const moveStep = (index: number, dir: "up" | "down") => {
    const newSteps = [...steps];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newSteps.length) return;
    [newSteps[index], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nama template wajib diisi"); return; }
    if (steps.length === 0) { toast.error("Tambahkan minimal 1 langkah"); return; }
    setSaving(true);
    try {
      const cleanSteps = steps.map((s) => ({
        order: s.order,
        role: s.role,
        label: s.label,
        resolverType: s.resolverType,
        ...(s.minPositionLevelCode ? { minPositionLevelCode: s.minPositionLevelCode } : {}),
        ...(s.specificUserId ? { specificUserId: s.specificUserId } : {}),
      }));

      if (initial) {
        await updateTemplate({
          id: initial._id,
          name,
          letterType,
          description: description || undefined,
          steps: cleanSteps,
          isActive,
          isDefault,
        });
        toast.success("Template berhasil diperbarui");
      } else {
        await createTemplate({
          name,
          letterType,
          description: description || undefined,
          steps: cleanSteps,
          isActive,
          isDefault,
        });
        toast.success("Template berhasil dibuat");
      }
      onSave();
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Nama Template *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Surat Keluar Standar" />
        </div>
        <div className="space-y-1">
          <Label>Jenis Surat</Label>
          <Select value={letterType} onValueChange={setLetterType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LETTER_TYPES.map((lt) => (
                <SelectItem key={lt.value} value={lt.value} className="cursor-pointer">{lt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm">Aktif</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <span className="text-sm flex items-center gap-1"><Star className="size-3.5 text-amber-500" /> Default</span>
          </label>
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Deskripsi (opsional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan alur persetujuan ini..." rows={2} />
        </div>
      </div>

      <Separator />

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Langkah Persetujuan</h3>
            <p className="text-xs text-muted-foreground">Atur urutan persetujuan dari konseptor hingga penyetuju</p>
          </div>
          <Button size="sm" onClick={addStep} className="gap-1.5">
            <Plus className="size-3.5" /> Tambah Langkah
          </Button>
        </div>

        {/* Flow preview */}
        {steps.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap py-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Badge className={`text-[10px] font-medium ${ROLE_COLORS[s.role] ?? "bg-muted text-muted-foreground"}`}>
                  {s.label}
                </Badge>
                {i < steps.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {steps.map((step, i) => (
            <StepEditor
              key={i}
              step={step}
              index={i}
              total={steps.length}
              positionLevels={positionLevels}
              employees={employees}
              onUpdate={(s) => updateStep(i, s)}
              onRemove={() => removeStep(i)}
              onMove={(dir) => moveStep(i, dir)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Batal</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {initial ? "Simpan Perubahan" : "Buat Template"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export default function LetterApprovalTemplatePanel() {
  const templates = useQuery(api.letterApprovalTemplates.list);
  const removeTemplate = useMutation(api.letterApprovalTemplates.remove);
  const seedDefaults = useMutation(api.letterApprovalTemplates.seedDefaults);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editing, setEditing] = useState<Doc<"letterApprovalTemplates"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"letterApprovalTemplates"> | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTemplate({ id: deleteTarget._id });
      toast.success("Template dihapus");
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal menghapus");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedDefaults();
      if (result.created > 0) {
        toast.success(`${result.created} template default berhasil dibuat`);
      } else {
        toast.info("Semua template default sudah ada");
      }
    } catch (err) {
      if (err instanceof ConvexError) toast.error((err.data as { message: string }).message);
      else toast.error("Gagal membuat template default");
    } finally {
      setSeeding(false);
    }
  };

  if (mode === "create" || mode === "edit") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); setEditing(null); }}>
            ← Kembali
          </Button>
          <h3 className="font-semibold">{mode === "create" ? "Buat Template Baru" : "Edit Template"}</h3>
        </div>
        <TemplateForm
          initial={mode === "edit" ? editing : null}
          onSave={() => { setMode("list"); setEditing(null); }}
          onCancel={() => { setMode("list"); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <GitBranch className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">Template Persetujuan Surat</h2>
          <p className="text-sm text-muted-foreground">
            Atur alur persetujuan berjenjang: Konseptor → Pemeriksa → Penyetuju
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setMode("create")} className="gap-1.5">
          <Plus className="size-3.5" /> Buat Template
        </Button>
        <Button size="sm" variant="secondary" onClick={handleSeed} disabled={seeding} className="gap-1.5">
          {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5" />}
          Muat Template BUMN
        </Button>
      </div>

      {!templates ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <FileCheck className="mx-auto mb-3 size-10 opacity-25" />
          <p className="font-medium text-sm">Belum ada template persetujuan</p>
          <p className="text-xs mt-1 mb-4">Buat template atau muat template standar BUMN</p>
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={() => setMode("create")} className="gap-1.5">
              <Plus className="size-3.5" /> Buat Template
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSeed} disabled={seeding}>
              {seeding && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Muat Template BUMN
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t._id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileCheck className="size-4.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    {t.isDefault && (
                      <Badge variant="secondary" className="text-[9px] gap-0.5 shrink-0">
                        <Star className="size-2.5 text-amber-500" /> Default
                      </Badge>
                    )}
                    {!t.isActive && (
                      <Badge variant="destructive" className="text-[9px] shrink-0">Nonaktif</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {LETTER_TYPES.find((lt) => lt.value === t.letterType)?.label ?? t.letterType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      <Users className="inline size-3 mr-0.5" /> {t.steps.length} langkah
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8 cursor-pointer"
                    onClick={() => { setEditing(t); setMode("edit"); }}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost"
                    className="size-8 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Step flow preview */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {t.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] font-medium ${ROLE_COLORS[s.role] ?? "bg-muted text-muted-foreground"}`}>
                      {s.label}
                    </Badge>
                    {i < t.steps.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Template <strong>{deleteTarget?.name}</strong> akan dihapus permanen. Surat yang sudah menggunakan template ini tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
