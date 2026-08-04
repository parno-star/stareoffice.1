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
  BookOpen,
  Award,
  Hash,
  Filter,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type NomenclatureFormData = {
  departmentId: Id<"departments"> | "";
  name: string;
  nomenclature: string;
  titulature: string;
  grade: string;
  type: "struktural" | "fungsional";
  description: string;
};

const EMPTY_FORM: NomenclatureFormData = {
  departmentId: "",
  name: "",
  nomenclature: "",
  titulature: "",
  grade: "",
  type: "struktural",
  description: "",
};

export default function NomenclaturePanel({ isAdmin }: { isAdmin: boolean }) {
  const nomenclatures = useQuery(api.positionNomenclature.list, {});
  const nomenclatureStats = useQuery(api.positionNomenclature.stats, {});
  const departments = useQuery(api.organization.listDepartments, {});
  const createNomenclature = useMutation(api.positionNomenclature.create);
  const updateNomenclature = useMutation(api.positionNomenclature.update);
  const removeNomenclature = useMutation(api.positionNomenclature.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"positionNomenclature"> | null>(null);
  const [form, setForm] = useState<NomenclatureFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"positionNomenclature"> | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const filteredData = useMemo(() => {
    if (!nomenclatures) return [];
    let result = nomenclatures;
    if (filterType !== "all") {
      result = result.filter((n) => n.type === filterType);
    }
    if (filterDept !== "all") {
      result = result.filter((n) => n.departmentId === filterDept);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.nomenclature.toLowerCase().includes(q) ||
          n.titulature.toLowerCase().includes(q) ||
          n.grade.toLowerCase().includes(q)
      );
    }
    return result;
  }, [nomenclatures, filterType, filterDept, search]);

  // Group by department
  const groupedByDept = useMemo(() => {
    const map = new Map<string, { dept: { _id: string; name: string }; items: Doc<"positionNomenclature">[] }>();
    for (const item of filteredData) {
      const deptId = item.departmentId;
      if (!map.has(deptId)) {
        const dept = departments?.find((d) => d.department._id === deptId);
        map.set(deptId, {
          dept: { _id: deptId, name: dept?.department.name ?? "Departemen tidak dikenal" },
          items: [],
        });
      }
      map.get(deptId)!.items.push(item);
    }
    return Array.from(map.values());
  }, [filteredData, departments]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: Doc<"positionNomenclature">) => {
    setEditingId(item._id);
    setForm({
      departmentId: item.departmentId,
      name: item.name,
      nomenclature: item.nomenclature,
      titulature: item.titulature,
      grade: item.grade,
      type: item.type as "struktural" | "fungsional",
      description: item.description ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.departmentId || !form.name || !form.nomenclature || !form.titulature || !form.grade) {
      toast.error("Semua field wajib harus diisi");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateNomenclature({
          id: editingId,
          departmentId: form.departmentId as Id<"departments">,
          name: form.name,
          nomenclature: form.nomenclature,
          titulature: form.titulature,
          grade: form.grade,
          type: form.type,
          description: form.description || undefined,
        });
        toast.success("Nomenklatur jabatan berhasil diperbarui");
      } else {
        await createNomenclature({
          departmentId: form.departmentId as Id<"departments">,
          name: form.name,
          nomenclature: form.nomenclature,
          titulature: form.titulature,
          grade: form.grade,
          type: form.type,
          description: form.description || undefined,
        });
        toast.success("Nomenklatur jabatan berhasil ditambahkan");
      }
      setDialogOpen(false);
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
      await removeNomenclature({ id: deleteTarget._id });
      toast.success("Nomenklatur jabatan berhasil dihapus");
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

  const isLoading = nomenclatures === undefined || departments === undefined;

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
              <p className="text-xl font-bold">{nomenclatureStats?.total ?? 0}</p>
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
              <p className="text-xl font-bold">{nomenclatureStats?.struktural ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <BookOpen className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fungsional</p>
              <p className="text-xl font-bold">{nomenclatureStats?.fungsional ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Hash className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Departemen</p>
              <p className="text-xl font-bold">{nomenclatureStats?.departments ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama jabatan, nomenklatur, titelatur, atau grade..."
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
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-44 gap-1.5">
                  <Building2 className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d.department._id} value={d.department._id}>
                      {d.department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button size="sm" className="gap-1.5 cursor-pointer" onClick={handleOpenCreate}>
                  <Plus className="size-4" />
                  Tambah Jabatan
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {filteredData.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>
              {search || filterType !== "all" || filterDept !== "all"
                ? "Tidak ada data yang cocok"
                : "Belum ada nomenklatur jabatan"}
            </EmptyTitle>
            <EmptyDescription>
              {search || filterType !== "all" || filterDept !== "all"
                ? "Coba ubah filter atau kata kunci pencarian."
                : "Tambahkan nomenklatur dan titelatur jabatan untuk setiap departemen."}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && !search && filterType === "all" && filterDept === "all" && (
            <EmptyContent>
              <Button size="sm" className="cursor-pointer" onClick={handleOpenCreate}>
                <Plus className="size-4 mr-1" />
                Tambah Jabatan Pertama
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-4">
          {groupedByDept.map((group) => (
            <Card key={group.dept._id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-muted-foreground" />
                  {group.dept.name}
                  <Badge variant="secondary" className="ml-auto">
                    {group.items.length} jabatan
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t bg-muted/50">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Jabatan</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nomenklatur</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Titelatur</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Grade</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tipe</th>
                        {isAdmin && (
                          <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Aksi</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item._id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {item.nomenclature}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.titulature}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{item.grade}</Badge>
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
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
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
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Nomenklatur Jabatan" : "Tambah Nomenklatur Jabatan"}
            </DialogTitle>
            <DialogDescription>
              Tentukan nomenklatur, titelatur, dan grade untuk jabatan di departemen tertentu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Departemen *</Label>
              <Select
                value={form.departmentId as string}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v as Id<"departments"> }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih departemen" />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d.department._id} value={d.department._id}>
                      {d.department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama Jabatan *</Label>
              <Input
                placeholder="cth: Kepala Bagian Keuangan"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nomenklatur *</Label>
                <Input
                  placeholder="cth: KABAG-KEU"
                  value={form.nomenclature}
                  onChange={(e) => setForm((f) => ({ ...f, nomenclature: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Titelatur *</Label>
                <Input
                  placeholder="cth: Kepala Bagian"
                  value={form.titulature}
                  onChange={(e) => setForm((f) => ({ ...f, titulature: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grade *</Label>
                <Input
                  placeholder="cth: III/a, G-15"
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipe Jabatan *</Label>
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
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Textarea
                placeholder="Deskripsi tugas dan tanggung jawab jabatan..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="cursor-pointer">
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Nomenklatur Jabatan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus jabatan &quot;{deleteTarget?.name}&quot;? Tindakan ini tidak
              dapat dibatalkan.
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
