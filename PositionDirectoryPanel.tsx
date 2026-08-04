import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  FolderOpen,
  Filter,
  Layers,
  Wand2,
  Check,
  X,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type ComposerFormData = {
  titulature: string;
  specificSection: string;
  nomenclature: string;
  type: "struktural" | "fungsional";
  grade: string;
  departmentId: Id<"departments"> | "";
  description: string;
};

const EMPTY_FORM: ComposerFormData = {
  titulature: "",
  specificSection: "",
  nomenclature: "",
  type: "struktural",
  grade: "",
  departmentId: "",
  description: "",
};

export default function PositionDirectoryPanel({ isAdmin }: { isAdmin: boolean }) {
  const directory = useQuery(api.positionDirectory.list, {});
  const dirStats = useQuery(api.positionDirectory.stats, {});
  const departments = useQuery(api.organization.listDepartments, {});
  const uniqueTitulatures = useQuery(api.positionDirectory.getUniqueTitulatures, {});
  const uniqueNomenclatures = useQuery(api.positionDirectory.getUniqueNomenclatures, {});
  const uniqueGrades = useQuery(api.positionDirectory.getUniqueGrades, {});

  const createEntry = useMutation(api.positionDirectory.create);
  const updateEntry = useMutation(api.positionDirectory.update);
  const removeEntry = useMutation(api.positionDirectory.remove);
  const toggleActive = useMutation(api.positionDirectory.toggleActive);

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"positionDirectory"> | null>(null);
  const [form, setForm] = useState<ComposerFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"positionDirectory"> | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  // Custom titulature/nomenclature/grade input toggle
  const [customTitulature, setCustomTitulature] = useState(false);
  const [customNomenclature, setCustomNomenclature] = useState(false);
  const [customGrade, setCustomGrade] = useState(false);

  const filteredData = useMemo(() => {
    if (!directory) return [];
    let result = directory;
    if (filterType !== "all") {
      result = result.filter((n) => n.type === filterType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.fullName.toLowerCase().includes(q) ||
          n.nomenclature.toLowerCase().includes(q) ||
          n.titulature.toLowerCase().includes(q) ||
          n.specificSection.toLowerCase().includes(q) ||
          (n.grade ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [directory, filterType, search]);

  // Derived composed name preview
  const composedName = useMemo(() => {
    const tit = form.titulature.trim();
    const sec = form.specificSection.trim();
    if (!tit && !sec) return "";
    if (!tit) return sec;
    if (!sec) return tit;
    return `${tit} ${sec}`;
  }, [form.titulature, form.specificSection]);

  const handleOpenComposer = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCustomTitulature(false);
    setCustomNomenclature(false);
    setCustomGrade(false);
    setComposerOpen(true);
  };

  const handleOpenEdit = (item: Doc<"positionDirectory">) => {
    setEditingId(item._id);
    setForm({
      titulature: item.titulature,
      specificSection: item.specificSection,
      nomenclature: item.nomenclature,
      type: item.type as "struktural" | "fungsional",
      grade: item.grade ?? "",
      departmentId: item.departmentId ?? "",
      description: item.description ?? "",
    });
    // Check if values are in existing options
    const titExists = (uniqueTitulatures ?? []).includes(item.titulature);
    const nomExists = (uniqueNomenclatures ?? []).includes(item.nomenclature);
    const gradeExists = (uniqueGrades ?? []).includes(item.grade ?? "");
    setCustomTitulature(!titExists);
    setCustomNomenclature(!nomExists);
    setCustomGrade(!gradeExists);
    setComposerOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulature.trim() || !form.specificSection.trim() || !form.nomenclature.trim()) {
      toast.error("Titelatur, Bagian Spesifik, dan Nomenklatur wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateEntry({
          id: editingId,
          titulature: form.titulature,
          specificSection: form.specificSection,
          nomenclature: form.nomenclature,
          type: form.type,
          grade: form.grade || undefined,
          departmentId: form.departmentId ? (form.departmentId as Id<"departments">) : undefined,
          description: form.description || undefined,
        });
        toast.success("Jabatan berhasil diperbarui");
      } else {
        await createEntry({
          titulature: form.titulature,
          specificSection: form.specificSection,
          nomenclature: form.nomenclature,
          type: form.type,
          grade: form.grade || undefined,
          departmentId: form.departmentId ? (form.departmentId as Id<"departments">) : undefined,
          description: form.description || undefined,
        });
        toast.success("Jabatan berhasil ditambahkan ke direktori");
      }
      setComposerOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeEntry({ id: deleteTarget._id });
      toast.success("Jabatan dihapus dari direktori");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (item: Doc<"positionDirectory">) => {
    try {
      await toggleActive({ id: item._id });
      toast.success(item.isActive ? "Jabatan dinonaktifkan" : "Jabatan diaktifkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengubah status");
      } else {
        toast.error("Gagal mengubah status");
      }
    }
  };

  const getDeptName = (deptId: Id<"departments"> | undefined) => {
    if (!deptId || !departments) return "-";
    const dept = departments.find((d) => d.department._id === deptId);
    return dept?.department.name ?? "-";
  };

  const isLoading = directory === undefined || departments === undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Jabatan</p>
              <p className="text-xl font-bold">{dirStats?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Building2 className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Struktural</p>
              <p className="text-xl font-bold">{dirStats?.struktural ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <FolderOpen className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fungsional</p>
              <p className="text-xl font-bold">{dirStats?.fungsional ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Check className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktif</p>
              <p className="text-xl font-bold">{dirStats?.active ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari jabatan, nomenklatur, grade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36 gap-1.5">
                  <Filter className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="struktural">Struktural</SelectItem>
                  <SelectItem value="fungsional">Fungsional</SelectItem>
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button size="sm" className="gap-1.5 cursor-pointer" onClick={handleOpenComposer}>
                  <Wand2 className="size-4" />
                  Racik Jabatan
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Directory List */}
      {filteredData.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>
              {search || filterType !== "all"
                ? "Tidak ada data yang cocok"
                : "Direktori Jabatan Kosong"}
            </EmptyTitle>
            <EmptyDescription>
              {search || filterType !== "all"
                ? "Coba ubah filter atau kata kunci pencarian."
                : "Gunakan fitur Racik Jabatan untuk membuat kombinasi jabatan dari titelatur, nomenklatur, tipe, dan grade."}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && !search && filterType === "all" && (
            <EmptyContent>
              <Button size="sm" className="cursor-pointer" onClick={handleOpenComposer}>
                <Wand2 className="size-4 mr-1" />
                Racik Jabatan Pertama
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="size-4 text-muted-foreground" />
              Direktori Jabatan
              <Badge variant="secondary" className="ml-auto">
                {filteredData.length} jabatan
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Jabatan</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Titelatur</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Bagian Spesifik</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nomenklatur</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Grade</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tipe</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Departemen</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Status</th>
                    {isAdmin && (
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item._id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.fullName}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.titulature}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.specificSection}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.nomenclature}</code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{item.grade || "-"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={item.type === "struktural" ? "default" : "secondary"}
                          className={
                            item.type === "struktural"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          }
                        >
                          {item.type === "struktural" ? "Struktural" : "Fungsional"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {getDeptName(item.departmentId)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isActive ? (
                          <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Nonaktif
                          </Badge>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 cursor-pointer"
                              onClick={() => handleToggleActive(item)}
                              title={item.isActive ? "Nonaktifkan" : "Aktifkan"}
                            >
                              {item.isActive ? (
                                <ToggleRight className="size-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="size-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 cursor-pointer"
                              onClick={() => handleOpenEdit(item)}
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-destructive cursor-pointer"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Composer Dialog */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5 text-primary" />
              {editingId ? "Edit Jabatan" : "Racik Jabatan Baru"}
            </DialogTitle>
            <DialogDescription>
              Kombinasikan titelatur dengan bagian spesifik untuk membentuk nama jabatan, lalu tentukan nomenklatur, tipe, dan grade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name Composer Section */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium text-primary">Nama Jabatan = Titelatur + Bagian Spesifik</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Titelatur *</Label>
                      <button
                        type="button"
                        className="text-xs text-primary cursor-pointer hover:underline"
                        onClick={() => { setCustomTitulature(!customTitulature); setForm((f) => ({ ...f, titulature: "" })); }}
                      >
                        {customTitulature ? "Pilih dari daftar" : "Ketik manual"}
                      </button>
                    </div>
                    {customTitulature ? (
                      <Input
                        placeholder="cth: Kepala Bagian"
                        value={form.titulature}
                        onChange={(e) => setForm((f) => ({ ...f, titulature: e.target.value }))}
                      />
                    ) : (
                      <Select
                        value={form.titulature}
                        onValueChange={(v) => setForm((f) => ({ ...f, titulature: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih titelatur" />
                        </SelectTrigger>
                        <SelectContent>
                          {(uniqueTitulatures ?? []).map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                          {(uniqueTitulatures ?? []).length === 0 && (
                            <SelectItem value="__none" disabled>Belum ada data</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Bagian Spesifik *</Label>
                    <Input
                      placeholder="cth: Keuangan, SDM, Operasional"
                      value={form.specificSection}
                      onChange={(e) => setForm((f) => ({ ...f, specificSection: e.target.value }))}
                    />
                  </div>
                </div>
                {/* Preview */}
                {composedName && (
                  <div className="flex items-center gap-2 rounded-lg bg-background p-3 border">
                    <ArrowRight className="size-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm">{composedName}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nomenclature, Type, Grade */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Nomenklatur *</Label>
                  <button
                    type="button"
                    className="text-xs text-primary cursor-pointer hover:underline"
                    onClick={() => { setCustomNomenclature(!customNomenclature); setForm((f) => ({ ...f, nomenclature: "" })); }}
                  >
                    {customNomenclature ? "Pilih" : "Manual"}
                  </button>
                </div>
                {customNomenclature ? (
                  <Input
                    placeholder="cth: KABAG-KEU"
                    value={form.nomenclature}
                    onChange={(e) => setForm((f) => ({ ...f, nomenclature: e.target.value }))}
                  />
                ) : (
                  <Select
                    value={form.nomenclature}
                    onValueChange={(v) => setForm((f) => ({ ...f, nomenclature: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      {(uniqueNomenclatures ?? []).map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                      {(uniqueNomenclatures ?? []).length === 0 && (
                        <SelectItem value="__none" disabled>Belum ada data</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tipe Jabatan *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as "struktural" | "fungsional" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="struktural">Struktural</SelectItem>
                    <SelectItem value="fungsional">Fungsional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Grade</Label>
                  <button
                    type="button"
                    className="text-xs text-primary cursor-pointer hover:underline"
                    onClick={() => { setCustomGrade(!customGrade); setForm((f) => ({ ...f, grade: "" })); }}
                  >
                    {customGrade ? "Pilih" : "Manual"}
                  </button>
                </div>
                {customGrade ? (
                  <Input
                    placeholder="cth: III/a, G-15"
                    value={form.grade}
                    onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  />
                ) : (
                  <Select
                    value={form.grade}
                    onValueChange={(v) => setForm((f) => ({ ...f, grade: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent>
                      {(uniqueGrades ?? []).map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                      {(uniqueGrades ?? []).length === 0 && (
                        <SelectItem value="__none" disabled>Belum ada data</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Optional: department link */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Departemen (opsional)</Label>
                <Select
                  value={(form.departmentId as string) || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v === "none" ? "" : (v as Id<"departments">) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih departemen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tidak terkait --</SelectItem>
                    {(departments ?? []).map((d) => (
                      <SelectItem key={d.department._id} value={d.department._id}>
                        {d.department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Deskripsi (opsional)</Label>
                <Textarea
                  placeholder="Deskripsi singkat jabatan..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setComposerOpen(false)} className="cursor-pointer">
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer gap-1.5">
              {saving ? "Menyimpan..." : (
                <>
                  <Plus className="size-4" />
                  {editingId ? "Simpan Perubahan" : "Tambah ke Direktori"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jabatan dari Direktori</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus &quot;{deleteTarget?.fullName}&quot; dari direktori jabatan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
