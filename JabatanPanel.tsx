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
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  FolderOpen,
  Filter,
  Wand2,
  ArrowRight,
  Tag,
  Hash,
  BookOpen,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { ROLE_LABELS, ROLE_VALUES } from "@/convex/roles.ts";

// Roles that may be set as a jabatan's default role. Platform/tenant-owner
// roles (super_admin, admin) are intentionally excluded.
const ASSIGNABLE_DEFAULT_ROLES = ROLE_VALUES.filter(
  (r) => r !== "super_admin" && r !== "admin",
);

// ─── Master Data Card Component ──────────────────────────────────────────────
function MasterDataCard({
  title,
  icon: Icon,
  items,
  onAdd,
  onEdit,
  onRemove,
  isAdmin,
  placeholder,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ _id: string; name: string }> | undefined;
  onAdd: (name: string) => Promise<void>;
  onEdit: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  isAdmin: boolean;
  placeholder: string;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await onAdd(newName.trim());
      setNewName("");
    } catch {
      // error handled by parent
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await onEdit(id, editingName.trim());
      setEditingId(null);
    } catch {
      // error handled by parent
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" />
          {title}
          <Badge variant="secondary" className="ml-auto">{items?.length ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin && (
          <div className="flex gap-2">
            <Input
              placeholder={placeholder}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              className="flex-1"
            />
            <Button size="sm" disabled={!newName.trim() || adding} onClick={handleAdd} className="cursor-pointer shrink-0">
              <Plus className="size-4" />
            </Button>
          </div>
        )}
        {!items || items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Belum ada data</p>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {items.map((item) => (
              <div key={item._id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                {editingId === item._id ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEdit(item._id); if (e.key === "Escape") setEditingId(null); }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="size-7 p-0 cursor-pointer" onClick={() => handleEdit(item._id)}>
                      <ArrowRight className="size-3.5 text-primary" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-1 truncate">{item.name}</span>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-6 p-0 cursor-pointer"
                          onClick={() => { setEditingId(item._id); setEditingName(item.name); }}
                        >
                          <Edit2 className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-6 p-0 text-destructive cursor-pointer"
                          onClick={() => onRemove(item._id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function JabatanPanel({ isAdmin }: { isAdmin: boolean }) {
  const departments = useQuery(api.organization.listDepartments, {});
  const directory = useQuery(api.positionDirectory.list, {});
  const titulatures = useQuery(api.positionMasterData.listTitulatures, {});
  const sections = useQuery(api.positionMasterData.listSections, {});
  const grades = useQuery(api.positionMasterData.listGrades, {});
  const nomenclatures = useQuery(api.positionMasterData.listNomenclatures, {});
  const tingkatJabatanList = useQuery(api.positionMasterData.listTingkatJabatan, {});
  const tingkatJabatanFungsionalList = useQuery(api.positionMasterData.listTingkatJabatanFungsional, {});

  const createEntry = useMutation(api.positionDirectory.create);
  const updateEntry = useMutation(api.positionDirectory.update);
  const removeEntry = useMutation(api.positionDirectory.remove);
  const toggleActive = useMutation(api.positionDirectory.toggleActive);

  const createTitulature = useMutation(api.positionMasterData.createTitulature);
  const updateTitulature = useMutation(api.positionMasterData.updateTitulature);
  const removeTitulature = useMutation(api.positionMasterData.removeTitulature);
  const createSection = useMutation(api.positionMasterData.createSection);
  const updateSection = useMutation(api.positionMasterData.updateSection);
  const removeSection = useMutation(api.positionMasterData.removeSection);
  const createGrade = useMutation(api.positionMasterData.createGrade);
  const updateGrade = useMutation(api.positionMasterData.updateGrade);
  const removeGrade = useMutation(api.positionMasterData.removeGrade);
  const createNomenclature = useMutation(api.positionMasterData.createNomenclature);
  const updateNomenclature = useMutation(api.positionMasterData.updateNomenclature);
  const removeNomenclature = useMutation(api.positionMasterData.removeNomenclature);
  const createTingkatJabatan = useMutation(api.positionMasterData.createTingkatJabatan);
  const updateTingkatJabatan = useMutation(api.positionMasterData.updateTingkatJabatan);
  const removeTingkatJabatan = useMutation(api.positionMasterData.removeTingkatJabatan);
  const createTingkatJabatanFungsional = useMutation(api.positionMasterData.createTingkatJabatanFungsional);
  const updateTingkatJabatanFungsional = useMutation(api.positionMasterData.updateTingkatJabatanFungsional);
  const removeTingkatJabatanFungsional = useMutation(api.positionMasterData.removeTingkatJabatanFungsional);

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"positionDirectory"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"positionDirectory"> | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  // Composer form
  const [formDept, setFormDept] = useState<string>("");
  const [formType, setFormType] = useState<"struktural" | "fungsional">("struktural");
  const [formTitulature, setFormTitulature] = useState<string>("");
  const [formSection, setFormSection] = useState<string>("");
  const [formGrade, setFormGrade] = useState<string>("");
  const [formNomenclature, setFormNomenclature] = useState<string>("");
  const [formTingkatJabatan, setFormTingkatJabatan] = useState<string>("");
  const [formDefaultRole, setFormDefaultRole] = useState<string>("");

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

  // Composed name preview
  const composedName = useMemo(() => {
    const parts: string[] = [];
    if (formTitulature) parts.push(formTitulature);
    if (formSection) parts.push(formSection);
    if (formNomenclature) parts.push(formNomenclature);
    return parts.join(" ");
  }, [formTitulature, formSection, formNomenclature]);

  const handleOpenComposer = () => {
    setEditingId(null);
    setFormDept("");
    setFormType("struktural");
    setFormTitulature("");
    setFormSection("");
    setFormGrade("");
    setFormNomenclature("");
    setFormTingkatJabatan("");
    setFormDefaultRole("");
    setComposerOpen(true);
  };

  const handleOpenEdit = (item: Doc<"positionDirectory">) => {
    setEditingId(item._id);
    setFormDept(item.departmentId ?? "");
    setFormType(item.type as "struktural" | "fungsional");
    setFormTitulature(item.titulature);
    setFormSection(item.specificSection);
    setFormGrade(item.grade ?? "");
    setFormNomenclature(item.nomenclature);
    setFormTingkatJabatan(item.tingkatJabatan ?? "");
    setFormDefaultRole(item.defaultRole ?? "");
    setComposerOpen(true);
  };

  const handleSave = async () => {
    if (!formTitulature || !formSection || !formNomenclature) {
      toast.error("Titelatur, Bagian, dan Nomenklatur wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateEntry({
          id: editingId,
          titulature: formTitulature,
          specificSection: formSection,
          nomenclature: formNomenclature,
          type: formType,
          grade: formGrade || undefined,
          tingkatJabatan: formTingkatJabatan || undefined,
          defaultRole: formDefaultRole || "none",
          departmentId: formDept ? (formDept as Id<"departments">) : undefined,
        });
        toast.success("Jabatan berhasil diperbarui");
      } else {
        await createEntry({
          titulature: formTitulature,
          specificSection: formSection,
          nomenclature: formNomenclature,
          type: formType,
          grade: formGrade || undefined,
          tingkatJabatan: formTingkatJabatan || undefined,
          defaultRole: formDefaultRole || undefined,
          departmentId: formDept ? (formDept as Id<"departments">) : undefined,
        });
        toast.success("Jabatan berhasil ditambahkan");
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
      toast.success("Jabatan dihapus");
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
    } catch {
      toast.error("Gagal mengubah status");
    }
  };

  const getDeptName = (deptId: Id<"departments"> | undefined) => {
    if (!deptId || !departments) return "-";
    const dept = departments.find((d) => d.department._id === deptId);
    return dept?.department.name ?? "-";
  };

  // Master data handlers - Titulature
  const handleAddTitulature = async (name: string) => {
    try { await createTitulature({ name }); toast.success("Titelatur ditambahkan"); }
    catch (e) { if (e instanceof ConvexError) toast.error((e.data as { message?: string }).message ?? "Gagal"); else toast.error("Gagal"); throw e; }
  };
  const handleEditTitulature = async (id: string, name: string) => {
    try { await updateTitulature({ id: id as Id<"positionTitulatures">, name }); toast.success("Titelatur diperbarui"); }
    catch { toast.error("Gagal memperbarui"); }
  };
  const handleRemoveTitulature = async (id: string) => {
    try { await removeTitulature({ id: id as Id<"positionTitulatures"> }); toast.success("Titelatur dihapus"); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Master data handlers - Section
  const handleAddSection = async (name: string) => {
    try { await createSection({ name }); toast.success("Bagian ditambahkan"); }
    catch (e) { if (e instanceof ConvexError) toast.error((e.data as { message?: string }).message ?? "Gagal"); else toast.error("Gagal"); throw e; }
  };
  const handleEditSection = async (id: string, name: string) => {
    try { await updateSection({ id: id as Id<"positionSections">, name }); toast.success("Bagian diperbarui"); }
    catch { toast.error("Gagal memperbarui"); }
  };
  const handleRemoveSection = async (id: string) => {
    try { await removeSection({ id: id as Id<"positionSections"> }); toast.success("Bagian dihapus"); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Master data handlers - Grade
  const handleAddGrade = async (name: string) => {
    try { await createGrade({ name }); toast.success("Grade ditambahkan"); }
    catch (e) { if (e instanceof ConvexError) toast.error((e.data as { message?: string }).message ?? "Gagal"); else toast.error("Gagal"); throw e; }
  };
  const handleEditGrade = async (id: string, name: string) => {
    try { await updateGrade({ id: id as Id<"positionGrades">, name }); toast.success("Grade diperbarui"); }
    catch { toast.error("Gagal memperbarui"); }
  };
  const handleRemoveGrade = async (id: string) => {
    try { await removeGrade({ id: id as Id<"positionGrades"> }); toast.success("Grade dihapus"); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Master data handlers - Nomenklatur
  const handleAddNomenclature = async (name: string) => {
    try { await createNomenclature({ name }); toast.success("Nomenklatur ditambahkan"); }
    catch (e) { if (e instanceof ConvexError) toast.error((e.data as { message?: string }).message ?? "Gagal"); else toast.error("Gagal"); throw e; }
  };
  const handleEditNomenclature = async (id: string, name: string) => {
    try { await updateNomenclature({ id: id as Id<"positionNomenclatures">, name }); toast.success("Nomenklatur diperbarui"); }
    catch { toast.error("Gagal memperbarui"); }
  };
  const handleRemoveNomenclature = async (id: string) => {
    try { await removeNomenclature({ id: id as Id<"positionNomenclatures"> }); toast.success("Nomenklatur dihapus"); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Master data handlers - Tingkat Jabatan
  const handleAddTingkatJabatan = async (name: string) => {
    try { await createTingkatJabatan({ name }); toast.success("Tingkat Jabatan ditambahkan"); }
    catch (e) { if (e instanceof ConvexError) toast.error((e.data as { message?: string }).message ?? "Gagal"); else toast.error("Gagal"); throw e; }
  };
  const handleEditTingkatJabatan = async (id: string, name: string) => {
    try { await updateTingkatJabatan({ id: id as Id<"positionTingkatJabatan">, name }); toast.success("Tingkat Jabatan diperbarui"); }
    catch { toast.error("Gagal memperbarui"); }
  };
  const handleRemoveTingkatJabatan = async (id: string) => {
    try { await removeTingkatJabatan({ id: id as Id<"positionTingkatJabatan"> }); toast.success("Tingkat Jabatan dihapus"); }
    catch { toast.error("Gagal menghapus"); }
  };

  // Master data handlers - Tingkat Jabatan Fungsional
  const handleAddTingkatJabatanFungsional = async (name: string) => {
    try { await createTingkatJabatanFungsional({ name }); toast.success("Tingkat Jabatan Fungsional ditambahkan"); }
    catch (e) { if (e instanceof ConvexError) toast.error((e.data as { message?: string }).message ?? "Gagal"); else toast.error("Gagal"); throw e; }
  };
  const handleEditTingkatJabatanFungsional = async (id: string, name: string) => {
    try { await updateTingkatJabatanFungsional({ id: id as Id<"positionTingkatJabatanFungsional">, name }); toast.success("Tingkat Jabatan Fungsional diperbarui"); }
    catch { toast.error("Gagal memperbarui"); }
  };
  const handleRemoveTingkatJabatanFungsional = async (id: string) => {
    try { await removeTingkatJabatanFungsional({ id: id as Id<"positionTingkatJabatanFungsional"> }); toast.success("Tingkat Jabatan Fungsional dihapus"); }
    catch { toast.error("Gagal menghapus"); }
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
    <div className="space-y-6">
      {/* ══════════════ CARD UTAMA: NAMA JABATAN ══════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="size-5 text-primary" />
              Nama Jabatan
              <Badge variant="secondary" className="ml-2">{filteredData.length}</Badge>
            </CardTitle>
            {isAdmin && (
              <Button size="sm" className="gap-1.5 cursor-pointer" onClick={handleOpenComposer}>
                <Wand2 className="size-4" />
                Tentukan Jabatan
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter */}
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
          </div>

          {/* Table / Empty */}
          {filteredData.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
                <EmptyTitle>
                  {search || filterType !== "all" ? "Tidak ada data yang cocok" : "Belum ada jabatan"}
                </EmptyTitle>
                <EmptyDescription>
                  {search || filterType !== "all"
                    ? "Coba ubah filter atau kata kunci."
                    : "Isi data master terlebih dahulu, lalu gunakan 'Tentukan Jabatan' untuk membuat jabatan."}
                </EmptyDescription>
              </EmptyHeader>
              {isAdmin && !search && filterType === "all" && (
                <EmptyContent>
                  <Button size="sm" className="cursor-pointer" onClick={handleOpenComposer}>
                    <Wand2 className="size-4 mr-1" />Tentukan Jabatan
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nama Jabatan</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nomenklatur</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tingkat Jabatan</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Grade</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Tipe</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Peran Default</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Departemen</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Status</th>
                    {isAdmin && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item._id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.fullName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.nomenclature}</code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">{item.tingkatJabatan || "-"}</td>
                      <td className="px-4 py-3">{item.grade ? <Badge variant="secondary">{item.grade}</Badge> : <span className="text-muted-foreground text-sm">-</span>}</td>
                      <td className="px-4 py-3">
                        <Badge className={item.type === "struktural"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        }>
                          {item.type === "struktural" ? "Struktural" : "Fungsional"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.defaultRole && ROLE_LABELS[item.defaultRole as keyof typeof ROLE_LABELS] ? (
                          <Badge variant="secondary" className="font-normal">
                            {ROLE_LABELS[item.defaultRole as keyof typeof ROLE_LABELS]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{getDeptName(item.departmentId)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={item.isActive
                          ? "bg-green-500/10 text-green-700 dark:text-green-300"
                          : "bg-muted text-muted-foreground"
                        }>
                          {item.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="size-8 p-0 cursor-pointer" onClick={() => handleToggleActive(item)}>
                              {item.isActive ? <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-700 cursor-pointer">ON</Badge> : <Badge variant="secondary" className="text-[10px] px-1 py-0 cursor-pointer">OFF</Badge>}
                            </Button>
                            <Button variant="ghost" size="sm" className="size-8 p-0 cursor-pointer" onClick={() => handleOpenEdit(item)}>
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="size-8 p-0 text-destructive cursor-pointer" onClick={() => setDeleteTarget(item)}>
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
          )}
        </CardContent>
      </Card>

      {/* ══════════════ MASTER DATA CARDS ══════════════ */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MasterDataCard
          title="Titelatur"
          icon={Tag}
          items={titulatures}
          onAdd={handleAddTitulature}
          onEdit={handleEditTitulature}
          onRemove={handleRemoveTitulature}
          isAdmin={isAdmin}
          placeholder="cth: Kepala Bagian"
        />
        <MasterDataCard
          title="Bagian"
          icon={Building2}
          items={sections}
          onAdd={handleAddSection}
          onEdit={handleEditSection}
          onRemove={handleRemoveSection}
          isAdmin={isAdmin}
          placeholder="cth: Keuangan"
        />
        <MasterDataCard
          title="Nomenklatur"
          icon={BookOpen}
          items={nomenclatures}
          onAdd={handleAddNomenclature}
          onEdit={handleEditNomenclature}
          onRemove={handleRemoveNomenclature}
          isAdmin={isAdmin}
          placeholder="cth: KABAG-KEU"
        />
        <MasterDataCard
          title="Tingkat Jabatan Struktural"
          icon={Hash}
          items={tingkatJabatanList}
          onAdd={handleAddTingkatJabatan}
          onEdit={handleEditTingkatJabatan}
          onRemove={handleRemoveTingkatJabatan}
          isAdmin={isAdmin}
          placeholder="cth: Eselon I, Eselon II"
        />
        <MasterDataCard
          title="Tingkat Jabatan Fungsional"
          icon={Hash}
          items={tingkatJabatanFungsionalList}
          onAdd={handleAddTingkatJabatanFungsional}
          onEdit={handleEditTingkatJabatanFungsional}
          onRemove={handleRemoveTingkatJabatanFungsional}
          isAdmin={isAdmin}
          placeholder="cth: Ahli Utama, Ahli Madya"
        />
        <MasterDataCard
          title="Grade"
          icon={Award}
          items={grades}
          onAdd={handleAddGrade}
          onEdit={handleEditGrade}
          onRemove={handleRemoveGrade}
          isAdmin={isAdmin}
          placeholder="cth: III/a, G-15"
        />
      </div>

      {/* ══════════════ COMPOSER DIALOG ══════════════ */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="size-5 text-primary" />
              {editingId ? "Edit Jabatan" : "Tentukan Jabatan Baru"}
            </DialogTitle>
            <DialogDescription>
              Pilih kombinasi dari data master untuk membentuk nama jabatan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Department & Type */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Departemen</Label>
                <Select value={formDept || "none"} onValueChange={(v) => setFormDept(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih departemen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Opsional --</SelectItem>
                    {(departments ?? []).map((d) => (
                      <SelectItem key={d.department._id} value={d.department._id}>
                        {d.department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jenis Jabatan *</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as "struktural" | "fungsional")}>
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

            {/* Grade & Tingkat Jabatan */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Grade Jabatan</Label>
                <Select value={formGrade || "placeholder"} onValueChange={(v) => setFormGrade(v === "placeholder" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih grade (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder">Tanpa grade</SelectItem>
                    {(grades ?? []).map((g) => (
                      <SelectItem key={g._id} value={g.name}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(grades ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Opsional. Tambahkan pilihan grade di card Grade di bawah bila diperlukan.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tingkat Jabatan</Label>
                <Select value={formTingkatJabatan || "placeholder"} onValueChange={(v) => setFormTingkatJabatan(v === "placeholder" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tingkat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>Pilih tingkat jabatan</SelectItem>
                    {(tingkatJabatanList ?? []).map((t) => (
                      <SelectItem key={t._id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(tingkatJabatanList ?? []).length === 0 && (
                  <p className="text-xs text-amber-600">Belum ada tingkat jabatan. Tambahkan di card Tingkat Jabatan di bawah.</p>
                )}
              </div>
            </div>

            {/* Peran Default (hak akses) */}
            <div className="space-y-2">
              <Label>Peran Default (Hak Akses)</Label>
              <Select value={formDefaultRole || "none"} onValueChange={(v) => setFormDefaultRole(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih peran default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Tanpa peran default --</SelectItem>
                  {ASSIGNABLE_DEFAULT_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Saat karyawan ditempatkan pada jabatan ini, perannya akan otomatis mengikuti peran ini. Admin tetap dapat mengubah peran secara manual.
              </p>
            </div>

            {/* Nama Jabatan Composer - 3 dropdowns */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium text-primary">
                  Nama Jabatan = Titelatur + Bagian + Nomenklatur
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">1. Titelatur *</Label>
                    <Select value={formTitulature || "placeholder"} onValueChange={(v) => setFormTitulature(v === "placeholder" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>Pilih titelatur</SelectItem>
                        {(titulatures ?? []).map((t) => (
                          <SelectItem key={t._id} value={t.name}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">2. Bagian *</Label>
                    <Select value={formSection || "placeholder"} onValueChange={(v) => setFormSection(v === "placeholder" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>Pilih bagian</SelectItem>
                        {(sections ?? []).map((s) => (
                          <SelectItem key={s._id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">3. Nomenklatur *</Label>
                    <Select value={formNomenclature || "placeholder"} onValueChange={(v) => setFormNomenclature(v === "placeholder" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>Pilih nomenklatur</SelectItem>
                        {(nomenclatures ?? []).map((n) => (
                          <SelectItem key={n._id} value={n.name}>{n.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Preview */}
                {composedName && (
                  <div className="flex items-center gap-2 rounded-lg bg-background p-3 border mt-2">
                    <ArrowRight className="size-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm">{composedName}</span>
                  </div>
                )}
                {(titulatures ?? []).length === 0 && (
                  <p className="text-xs text-amber-600">Belum ada titelatur. Tambahkan di card Titelatur terlebih dahulu.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setComposerOpen(false)} className="cursor-pointer">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer gap-1.5">
              {saving ? "Menyimpan..." : (
                <><Plus className="size-4" />{editingId ? "Simpan" : "Tambah Jabatan"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jabatan</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus &quot;{deleteTarget?.fullName}&quot; dari direktori?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
