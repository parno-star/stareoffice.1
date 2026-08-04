import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Briefcase,
  ListChecks,
  Target,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { COLOR_TOKENS, colorClasses } from "../_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  roleId: Id<"jobRoles"> | null;
  departments: Array<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (roleId: Id<"jobRoles">) => void;
};

const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
];

const KPI_UNITS: Array<{ value: string; label: string }> = [
  { value: "number", label: "Angka" },
  { value: "percent", label: "Persentase (%)" },
  { value: "currency", label: "Rupiah" },
  { value: "duration", label: "Durasi (menit)" },
  { value: "rating", label: "Rating (1-5)" },
];

const KPI_DIRECTIONS: Array<{ value: string; label: string }> = [
  { value: "higher_is_better", label: "Semakin tinggi semakin baik" },
  { value: "lower_is_better", label: "Semakin rendah semakin baik" },
  { value: "range", label: "Berada di kisaran target" },
];

const KPI_FREQUENCIES: Array<{ value: string; label: string }> = [
  { value: "monthly", label: "Bulanan" },
  { value: "quarterly", label: "Kuartalan" },
  { value: "yearly", label: "Tahunan" },
];

const KPI_PRIORITIES: Array<{ value: string; label: string }> = [
  { value: "low", label: "Rendah" },
  { value: "medium", label: "Sedang" },
  { value: "high", label: "Tinggi" },
];

const SOP_FREQUENCIES: Array<{ value: string; label: string }> = [
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "quarterly", label: "Kuartalan" },
  { value: "adhoc", label: "Sesuai Kebutuhan" },
];

export default function JobRoleEditorDialog({
  roleId,
  departments,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const detail = useQuery(
    api.orgAdvanced.jobRoles.getRole,
    roleId ? { roleId } : "skip",
  );

  const createRole = useMutation(api.orgAdvanced.jobRoles.createRole);
  const updateRole = useMutation(api.orgAdvanced.jobRoles.updateRole);
  const deleteRole = useMutation(api.orgAdvanced.jobRoles.deleteRole);
  const upsertSop = useMutation(api.orgAdvanced.jobRoles.upsertSop);
  const deleteSop = useMutation(api.orgAdvanced.jobRoles.deleteSop);
  const reorderSops = useMutation(api.orgAdvanced.jobRoles.reorderSops);
  const upsertKpi = useMutation(api.orgAdvanced.jobRoles.upsertKpi);
  const deleteKpi = useMutation(api.orgAdvanced.jobRoles.deleteKpi);

  // --- Role form state ---
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("mid");
  const [purpose, setPurpose] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [requirements, setRequirements] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [color, setColor] = useState<string>("blue");
  const [version, setVersion] = useState("1.0");
  const [isActive, setIsActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"jobdesk" | "sop" | "kpi">("jobdesk");

  // Preload when editing existing
  useEffect(() => {
    if (!open) return;
    if (roleId && detail?.role) {
      const r = detail.role;
      setTitle(r.title);
      setDepartment(r.department);
      setLevel(r.level);
      setPurpose(r.purpose);
      setResponsibilities(r.responsibilities);
      setRequirements(r.requirements);
      setExtraNotes(r.extraNotes ?? "");
      setColor(r.color);
      setVersion(r.version);
      setIsActive(r.isActive);
    } else if (!roleId) {
      setTitle("");
      setDepartment("");
      setLevel("mid");
      setPurpose("");
      setResponsibilities("");
      setRequirements("");
      setExtraNotes("");
      setColor("blue");
      setVersion("1.0");
      setIsActive(true);
      setActiveTab("jobdesk");
    }
  }, [open, roleId, detail]);

  const handleSaveRole = async () => {
    if (title.trim().length === 0) {
      toast.error("Judul jabatan wajib diisi");
      return;
    }
    try {
      if (roleId) {
        await updateRole({
          roleId,
          title,
          department,
          level,
          purpose,
          responsibilities,
          requirements,
          extraNotes: extraNotes || undefined,
          color,
          version,
          isActive,
        });
        toast.success("Job description diperbarui");
      } else {
        const newId = await createRole({
          title,
          department,
          level,
          purpose,
          responsibilities,
          requirements,
          extraNotes: extraNotes || undefined,
          color,
          version,
        });
        toast.success("Job description dibuat");
        onCreated?.(newId);
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error(
          (error.data as { message?: string }).message ?? "Gagal menyimpan",
        );
      } else {
        toast.error("Gagal menyimpan");
      }
    }
  };

  const handleDelete = async () => {
    if (!roleId) return;
    if (
      !window.confirm(
        "Hapus job description ini beserta SOP dan KPI-nya? Tindakan tidak bisa dibatalkan.",
      )
    )
      return;
    try {
      await deleteRole({ roleId });
      toast.success("Job description dihapus");
      onOpenChange(false);
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  // --- SOP section ---
  const sops = useMemo(() => detail?.sops ?? [], [detail]);
  const sopGroups = useMemo(() => {
    const map = new Map<string, Array<Doc<"jobRoleSops">>>();
    for (const s of sops) {
      const list = map.get(s.procedureName) ?? [];
      list.push(s);
      map.set(s.procedureName, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [sops]);

  const [newSopProcedure, setNewSopProcedure] = useState("SOP Utama");
  const [newSopTitle, setNewSopTitle] = useState("");
  const [newSopDescription, setNewSopDescription] = useState("");
  const [newSopFrequency, setNewSopFrequency] = useState<string>("none");
  const [newSopOwnerRole, setNewSopOwnerRole] = useState("");

  const handleAddSop = async () => {
    if (!roleId) {
      toast.error("Simpan job description terlebih dulu");
      return;
    }
    if (newSopTitle.trim().length === 0) {
      toast.error("Judul langkah SOP wajib diisi");
      return;
    }
    const procedureName = newSopProcedure.trim() || "SOP Utama";
    const siblings = sops.filter((s) => s.procedureName === procedureName);
    const order = siblings.length;
    try {
      await upsertSop({
        roleId,
        procedureName,
        order,
        title: newSopTitle,
        description: newSopDescription || undefined,
        frequency: newSopFrequency === "none" ? undefined : newSopFrequency,
        ownerRole: newSopOwnerRole || undefined,
      });
      toast.success("Langkah SOP ditambahkan");
      setNewSopTitle("");
      setNewSopDescription("");
      setNewSopFrequency("none");
      setNewSopOwnerRole("");
    } catch {
      toast.error("Gagal menambahkan");
    }
  };

  const handleRemoveSop = async (sopId: Id<"jobRoleSops">) => {
    try {
      await deleteSop({ sopId });
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleMoveSop = async (
    procedureName: string,
    sopId: Id<"jobRoleSops">,
    direction: "up" | "down",
  ) => {
    const group = sops
      .filter((s) => s.procedureName === procedureName)
      .sort((a, b) => a.order - b.order);
    const idx = group.findIndex((s) => s._id === sopId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const a = group[idx];
    const b = group[swapIdx];
    if (!a || !b) return;
    try {
      await reorderSops({
        updates: [
          { sopId: a._id, order: b.order },
          { sopId: b._id, order: a.order },
        ],
      });
    } catch {
      toast.error("Gagal mengubah urutan");
    }
  };

  // --- KPI section ---
  const kpis = detail?.kpis ?? [];
  const [kpiForm, setKpiForm] = useState<{
    editingId: Id<"jobRoleKpis"> | null;
    name: string;
    description: string;
    unit: string;
    target: string;
    direction: string;
    frequency: string;
    priority: string;
    weight: string;
  }>({
    editingId: null,
    name: "",
    description: "",
    unit: "number",
    target: "",
    direction: "higher_is_better",
    frequency: "monthly",
    priority: "medium",
    weight: "",
  });

  const resetKpiForm = () => {
    setKpiForm({
      editingId: null,
      name: "",
      description: "",
      unit: "number",
      target: "",
      direction: "higher_is_better",
      frequency: "monthly",
      priority: "medium",
      weight: "",
    });
  };

  const handleSaveKpi = async () => {
    if (!roleId) {
      toast.error("Simpan job description terlebih dulu");
      return;
    }
    if (kpiForm.name.trim().length === 0) {
      toast.error("Nama KPI wajib diisi");
      return;
    }
    const targetNum = kpiForm.target.trim() ? Number(kpiForm.target) : NaN;
    const weightNum = kpiForm.weight.trim() ? Number(kpiForm.weight) : NaN;
    const nextOrder = kpiForm.editingId
      ? undefined
      : kpis.length;
    try {
      await upsertKpi({
        kpiId: kpiForm.editingId ?? undefined,
        roleId,
        name: kpiForm.name,
        description: kpiForm.description || undefined,
        unit: kpiForm.unit,
        target: Number.isFinite(targetNum) ? targetNum : undefined,
        direction: kpiForm.direction,
        frequency: kpiForm.frequency,
        priority: kpiForm.priority,
        weight: Number.isFinite(weightNum) ? weightNum : undefined,
        order: nextOrder ?? 0,
      });
      toast.success(kpiForm.editingId ? "KPI diperbarui" : "KPI ditambahkan");
      resetKpiForm();
    } catch {
      toast.error("Gagal menyimpan KPI");
    }
  };

  const handleEditKpi = (k: Doc<"jobRoleKpis">) => {
    setKpiForm({
      editingId: k._id,
      name: k.name,
      description: k.description ?? "",
      unit: k.unit,
      target: k.target !== undefined ? String(k.target) : "",
      direction: k.direction,
      frequency: k.frequency,
      priority: k.priority,
      weight: k.weight !== undefined ? String(k.weight) : "",
    });
  };

  const handleRemoveKpi = async (kpiId: Id<"jobRoleKpis">) => {
    if (!window.confirm("Hapus KPI ini dan semua pencatatannya?")) return;
    try {
      await deleteKpi({ kpiId });
      if (kpiForm.editingId === kpiId) resetKpiForm();
      toast.success("KPI dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const colorCls = colorClasses(color);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                colorCls.bg,
                colorCls.text,
              )}
            >
              <Briefcase className="size-4" />
            </span>
            {roleId ? "Kelola Job Description" : "Job Description Baru"}
          </DialogTitle>
          <DialogDescription>
            Definisikan jabatan beserta SOP operasional dan KPI yang dijalankan
            oleh pemegang posisi ini.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "jobdesk" | "sop" | "kpi")}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jobdesk" className="gap-1.5">
              <Briefcase className="size-4" />
              Job Description
            </TabsTrigger>
            <TabsTrigger value="sop" className="gap-1.5" disabled={!roleId}>
              <ListChecks className="size-4" />
              SOP ({sops.length})
            </TabsTrigger>
            <TabsTrigger value="kpi" className="gap-1.5" disabled={!roleId}>
              <Target className="size-4" />
              KPI ({kpis.length})
            </TabsTrigger>
          </TabsList>

          {/* Jobdesk tab */}
          <TabsContent value="jobdesk" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="role-title">Judul Jabatan</Label>
                <Input
                  id="role-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Senior Frontend Engineer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-dept">Departemen</Label>
                <Select
                  value={department === "" ? "__all__" : department}
                  onValueChange={(v) =>
                    setDepartment(v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger id="role-dept">
                    <SelectValue placeholder="Pilih departemen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      Seluruh perusahaan
                    </SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-level">Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger id="role-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-version">Versi</Label>
                <Input
                  id="role-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Warna Penanda</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_TOKENS.map((c) => {
                  const cls = colorClasses(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-7 rounded-full border-2 transition cursor-pointer",
                        cls.bgSolid,
                        color === c
                          ? "border-foreground"
                          : "border-transparent",
                      )}
                      aria-label={c}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role-purpose">
                Tujuan Posisi (Job Purpose)
              </Label>
              <Textarea
                id="role-purpose"
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Mengapa posisi ini ada dan apa dampaknya bagi perusahaan..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-resp">Tanggung Jawab Utama</Label>
              <Textarea
                id="role-resp"
                rows={5}
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder={"- Membangun fitur baru\n- Mengulas kode\n- Mentoring junior"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-req">Persyaratan</Label>
              <Textarea
                id="role-req"
                rows={5}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={"- Pengalaman 3+ tahun\n- Menguasai React\n- Komunikasi baik"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-extra">
                Catatan Tambahan (opsional)
              </Label>
              <Textarea
                id="role-extra"
                rows={3}
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                placeholder="Kompetensi perilaku, tools yang dipakai, dsb."
              />
            </div>

            {roleId ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <p className="text-xs text-muted-foreground">
                    Hanya job description aktif yang dipakai mencocokkan
                    karyawan.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isActive ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setIsActive((v) => !v)}
                >
                  {isActive ? "Aktif" : "Tidak Aktif"}
                </Button>
              </div>
            ) : null}
          </TabsContent>

          {/* SOP tab */}
          <TabsContent value="sop" className="space-y-4 pt-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Tambah Langkah SOP</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nama Prosedur</Label>
                    <Input
                      value={newSopProcedure}
                      onChange={(e) => setNewSopProcedure(e.target.value)}
                      placeholder="SOP Onboarding Klien"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Judul Langkah</Label>
                    <Input
                      value={newSopTitle}
                      onChange={(e) => setNewSopTitle(e.target.value)}
                      placeholder="Menghubungi klien dalam 24 jam"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frekuensi</Label>
                    <Select
                      value={newSopFrequency}
                      onValueChange={setNewSopFrequency}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {SOP_FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Penanggung Jawab (opsional)</Label>
                    <Input
                      value={newSopOwnerRole}
                      onChange={(e) => setNewSopOwnerRole(e.target.value)}
                      placeholder="Account Manager"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Deskripsi Langkah</Label>
                  <Textarea
                    rows={3}
                    value={newSopDescription}
                    onChange={(e) => setNewSopDescription(e.target.value)}
                    placeholder="Detail aktivitas, cara kerja, output yang diharapkan..."
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddSop}
                  className="gap-1.5"
                >
                  <Plus className="size-4" /> Tambah Langkah
                </Button>
              </CardContent>
            </Card>

            {sopGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Belum ada SOP untuk jabatan ini.
              </p>
            ) : (
              <div className="space-y-4">
                {sopGroups.map(([procedure, steps]) => (
                  <Card key={procedure}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center gap-2">
                        <ListChecks className="size-4 text-primary" />
                        <p className="text-sm font-semibold">{procedure}</p>
                        <Badge variant="secondary" className="ml-auto">
                          {steps.length} langkah
                        </Badge>
                      </div>
                      <ol className="space-y-2">
                        {steps.map((s, idx) => (
                          <li
                            key={s._id}
                            className="flex items-start gap-2 rounded-lg border bg-card p-3"
                          >
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {s.title}
                              </p>
                              {s.description ? (
                                <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                                  {s.description}
                                </p>
                              ) : null}
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                                {s.frequency ? (
                                  <span className="rounded-md border bg-muted px-1.5 py-0.5">
                                    {SOP_FREQUENCIES.find(
                                      (f) => f.value === s.frequency,
                                    )?.label ?? s.frequency}
                                  </span>
                                ) : null}
                                {s.ownerRole ? (
                                  <span className="rounded-md border bg-muted px-1.5 py-0.5">
                                    PIC: {s.ownerRole}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                disabled={idx === 0}
                                onClick={() =>
                                  handleMoveSop(procedure, s._id, "up")
                                }
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                disabled={idx === steps.length - 1}
                                onClick={() =>
                                  handleMoveSop(procedure, s._id, "down")
                                }
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 text-rose-500 hover:text-rose-500"
                                onClick={() => handleRemoveSop(s._id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* KPI tab */}
          <TabsContent value="kpi" className="space-y-4 pt-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">
                  {kpiForm.editingId ? "Ubah KPI" : "Tambah KPI"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Nama KPI</Label>
                    <Input
                      value={kpiForm.name}
                      onChange={(e) =>
                        setKpiForm({ ...kpiForm, name: e.target.value })
                      }
                      placeholder="Contoh: Tiket selesai tepat waktu"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Deskripsi (opsional)</Label>
                    <Textarea
                      rows={2}
                      value={kpiForm.description}
                      onChange={(e) =>
                        setKpiForm({
                          ...kpiForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Bagaimana KPI ini diukur..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Select
                      value={kpiForm.unit}
                      onValueChange={(v) =>
                        setKpiForm({ ...kpiForm, unit: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KPI_UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={kpiForm.target}
                      onChange={(e) =>
                        setKpiForm({ ...kpiForm, target: e.target.value })
                      }
                      placeholder="Contoh: 90"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Arah</Label>
                    <Select
                      value={kpiForm.direction}
                      onValueChange={(v) =>
                        setKpiForm({ ...kpiForm, direction: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KPI_DIRECTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frekuensi</Label>
                    <Select
                      value={kpiForm.frequency}
                      onValueChange={(v) =>
                        setKpiForm({ ...kpiForm, frequency: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KPI_FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioritas</Label>
                    <Select
                      value={kpiForm.priority}
                      onValueChange={(v) =>
                        setKpiForm({ ...kpiForm, priority: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KPI_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bobot (%) opsional</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={kpiForm.weight}
                      onChange={(e) =>
                        setKpiForm({ ...kpiForm, weight: e.target.value })
                      }
                      placeholder="0-100"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveKpi}
                    className="gap-1.5"
                  >
                    <Save className="size-4" />
                    {kpiForm.editingId ? "Simpan Perubahan" : "Tambah KPI"}
                  </Button>
                  {kpiForm.editingId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={resetKpiForm}
                    >
                      Batal
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {kpis.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Belum ada KPI untuk jabatan ini.
              </p>
            ) : (
              <div className="space-y-2">
                {kpis.map((k) => (
                  <div
                    key={k._id}
                    className="flex items-start gap-2 rounded-lg border bg-card p-3"
                  >
                    <Target className="mt-0.5 size-4 text-violet-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{k.name}</p>
                      {k.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {k.description}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-md border bg-muted px-1.5 py-0.5">
                          {KPI_UNITS.find((u) => u.value === k.unit)?.label ??
                            k.unit}
                        </span>
                        {k.target !== undefined ? (
                          <span className="rounded-md border bg-muted px-1.5 py-0.5">
                            Target: {k.target}
                          </span>
                        ) : null}
                        <span className="rounded-md border bg-muted px-1.5 py-0.5">
                          {KPI_FREQUENCIES.find(
                            (f) => f.value === k.frequency,
                          )?.label ?? k.frequency}
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5",
                            k.priority === "high"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : k.priority === "medium"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted",
                          )}
                        >
                          Prioritas{" "}
                          {KPI_PRIORITIES.find(
                            (p) => p.value === k.priority,
                          )?.label ?? k.priority}
                        </span>
                        {k.weight !== undefined ? (
                          <span className="rounded-md border bg-muted px-1.5 py-0.5">
                            Bobot {k.weight}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditKpi(k)}
                      >
                        Ubah
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-500"
                        onClick={() => handleRemoveKpi(k._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-wrap items-center gap-2 sm:justify-between">
          {roleId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-rose-500 hover:text-rose-500"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 size-4" /> Hapus Job Description
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button type="button" onClick={handleSaveRole}>
              {roleId ? "Simpan Perubahan" : "Buat Job Description"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
