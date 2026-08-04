import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Settings2,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  Type,
  Hash,
  Calendar,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  buildOrderedColumns,
  isMasaKerjaLabel,
  isUsiaLabel,
  type ColumnFieldType,
} from "../_lib/directory-columns.ts";

type FieldType = ColumnFieldType;

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Teks",
  number: "Angka",
  date: "Tanggal",
  select: "Pilihan",
};

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="size-4" />,
  number: <Hash className="size-4" />,
  date: <Calendar className="size-4" />,
  select: <ListChecks className="size-4" />,
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function ManageFieldsDialog({ open, onOpenChange }: Props) {
  const fields = useQuery(api.directoryFields.list, {});
  const savedOrder = useQuery(api.directoryFields.getColumnOrder, {});
  const createField = useMutation(api.directoryFields.create);
  const updateField = useMutation(api.directoryFields.update);
  const removeField = useMutation(api.directoryFields.remove);
  const setColumnOrder = useMutation(api.directoryFields.setColumnOrder);

  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingField, setEditingField] = useState<Doc<"directoryFields"> | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formType, setFormType] = useState<FieldType>("text");
  const [formOptions, setFormOptions] = useState("");
  const [formRequired, setFormRequired] = useState(false);
  const [formShowInList, setFormShowInList] = useState(false);
  const [formEmployeeEditable, setFormEmployeeEditable] = useState(false);

  const resetForm = () => {
    setFormKey("");
    setFormLabel("");
    setFormType("text");
    setFormOptions("");
    setFormRequired(false);
    setFormShowInList(false);
    setFormEmployeeEditable(false);
    setEditingField(null);
  };

  const openAdd = () => {
    resetForm();
    setMode("add");
  };

  const openEdit = (field: Doc<"directoryFields">) => {
    setEditingField(field);
    setFormKey(field.key);
    setFormLabel(field.label);
    setFormType(field.type as FieldType);
    setFormOptions(field.options ?? "");
    setFormRequired(field.required ?? false);
    setFormShowInList(field.showInList ?? false);
    setFormEmployeeEditable(field.employeeEditable ?? false);
    setMode("edit");
  };

  const handleSave = async () => {
    if (!formLabel.trim()) {
      toast.error("Label field wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (mode === "add") {
        const key = formKey.trim() || formLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        await createField({
          key,
          label: formLabel.trim(),
          type: formType,
          options: formType === "select" ? formOptions : undefined,
          required: formRequired,
          showInList: formShowInList,
          employeeEditable: formEmployeeEditable,
        });
        toast.success(`Field "${formLabel.trim()}" berhasil ditambahkan`);
      } else if (mode === "edit" && editingField) {
        await updateField({
          id: editingField._id,
          label: formLabel.trim(),
          type: formType,
          options: formType === "select" ? formOptions : undefined,
          required: formRequired,
          showInList: formShowInList,
          employeeEditable: formEmployeeEditable,
        });
        toast.success(`Field "${formLabel.trim()}" berhasil diperbarui`);
      }
      resetForm();
      setMode("list");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan field");
      } else {
        toast.error("Gagal menyimpan field");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field: Doc<"directoryFields">) => {
    try {
      await removeField({ id: field._id });
      toast.success(`Field "${field.label}" berhasil dihapus`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus field");
      } else {
        toast.error("Gagal menghapus field");
      }
    }
  };

  const orderedColumns = buildOrderedColumns(fields ?? [], savedOrder ?? []);

  const persistOrder = async (tokens: Array<string>) => {
    try {
      await setColumnOrder({ orderedTokens: tokens });
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan urutan");
      } else {
        toast.error("Gagal menyimpan urutan");
      }
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0 || index >= orderedColumns.length) return;
    const tokens = orderedColumns.map((c) => c.token);
    const temp = tokens[index - 1]!;
    tokens[index - 1] = tokens[index]!;
    tokens[index] = temp;
    await persistOrder(tokens);
  };

  const handleMoveDown = async (index: number) => {
    if (index < 0 || index >= orderedColumns.length - 1) return;
    const tokens = orderedColumns.map((c) => c.token);
    const temp = tokens[index + 1]!;
    tokens[index + 1] = tokens[index]!;
    tokens[index] = temp;
    await persistOrder(tokens);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" />
            Kelola Field Direktori
          </DialogTitle>
          <DialogDescription>
            Tambah, edit, atau hapus kolom kustom yang ditampilkan di profil karyawan.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
        {mode === "list" && (
          <div className="space-y-4">
            {/* Fields list (built-in + custom) */}
            {fields === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table className="min-w-[640px]" containerClassName="always-scrollbar max-h-[55vh] overflow-y-auto">
                  <TableHeader className="sticky top-0 z-20">
                    <TableRow>
                      <TableHead className="w-10 sticky left-0 top-0 z-30 bg-background">#</TableHead>
                      <TableHead className="whitespace-nowrap sticky left-10 top-0 z-30 bg-background">Label</TableHead>
                      <TableHead className="whitespace-nowrap bg-background">Key</TableHead>
                      <TableHead className="whitespace-nowrap bg-background">Tipe</TableHead>
                      <TableHead className="w-20 whitespace-nowrap bg-background">Wajib</TableHead>
                      <TableHead className="w-20 whitespace-nowrap bg-background">List</TableHead>
                      <TableHead className="w-28 whitespace-nowrap bg-background">Edit Karyawan</TableHead>
                      <TableHead className="w-24 text-right whitespace-nowrap bg-background">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderedColumns.map((col, index) => (
                      <TableRow
                        key={col.token}
                        className={col.kind === "builtin" ? "bg-muted/30" : undefined}
                      >
                        <TableCell
                          className={`sticky left-0 z-10 ${col.kind === "builtin" ? "bg-muted" : "bg-background"}`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <button
                              className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={index === 0}
                              onClick={() => void handleMoveUp(index)}
                              aria-label="Naikkan"
                            >
                              <ArrowUp className="size-3" />
                            </button>
                            <button
                              className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-30"
                              disabled={index === orderedColumns.length - 1}
                              onClick={() => void handleMoveDown(index)}
                              aria-label="Turunkan"
                            >
                              <ArrowDown className="size-3" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`font-medium sticky left-10 z-10 ${col.kind === "builtin" ? "bg-muted" : "bg-background"}`}
                        >
                          <span className="flex items-center gap-1.5">
                            {col.kind === "builtin" ? col.builtin.label : col.custom.label}
                            {col.kind === "builtin" && (
                              <Badge variant="outline" className="text-[10px]">Bawaan</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {col.kind === "builtin" ? col.builtin.key : col.custom.key}
                          </code>
                        </TableCell>
                        <TableCell>
                          {col.kind === "builtin" ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              {FIELD_TYPE_ICONS[col.builtin.type]}
                              {FIELD_TYPE_LABELS[col.builtin.type]}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm">
                              {FIELD_TYPE_ICONS[col.custom.type as FieldType]}
                              {FIELD_TYPE_LABELS[col.custom.type as FieldType] ?? col.custom.type}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(col.kind === "builtin" ? col.builtin.required : col.custom.required) ? (
                            <Badge variant="default" className="text-xs">Ya</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Tidak</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(col.kind === "builtin" ? true : col.custom.showInList) ? (
                            <Badge variant="secondary" className="text-xs">Ya</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Tidak</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {col.kind === "builtin" ? (
                            <span className="text-xs text-muted-foreground">HR</span>
                          ) : isMasaKerjaLabel(col.custom.label) ||
                            isUsiaLabel(col.custom.label) ? (
                            <span className="text-xs text-muted-foreground">Otomatis</span>
                          ) : col.custom.employeeEditable ? (
                            <Badge variant="default" className="text-xs">Boleh</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">HR saja</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {col.kind === "builtin" ? (
                            <span className="text-xs text-muted-foreground">Bawaan</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                className="cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => openEdit(col.custom)}
                                aria-label="Edit"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                className="cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => void handleDelete(col.custom)}
                                aria-label="Hapus"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {fields !== undefined && (
              <Button size="sm" onClick={openAdd} className="gap-1.5 cursor-pointer">
                <Plus className="size-4" />
                Tambah Field Baru
              </Button>
            )}
          </div>
        )}

        {/* Add/Edit form */}
        {(mode === "add" || mode === "edit") && (
          <div className="space-y-4">
            <div className="space-y-3">
              {/* Label */}
              <div className="space-y-1.5">
                <Label>Label (nama yang ditampilkan) <span className="text-destructive">*</span></Label>
                <Input
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="contoh: NIP, Golongan Darah, NPWP"
                />
              </div>

              {/* Key (only for add) */}
              {mode === "add" && (
                <div className="space-y-1.5">
                  <Label>Key (otomatis dari label jika kosong)</Label>
                  <Input
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="contoh: nip, golongan_darah"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Huruf kecil, angka, dan underscore. Digunakan sebagai ID internal.
                  </p>
                </div>
              )}

              {/* Type */}
              <div className="space-y-1.5">
                <Label>Tipe Field</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as FieldType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">
                      <span className="flex items-center gap-2"><Type className="size-4" /> Teks</span>
                    </SelectItem>
                    <SelectItem value="number">
                      <span className="flex items-center gap-2"><Hash className="size-4" /> Angka</span>
                    </SelectItem>
                    <SelectItem value="date">
                      <span className="flex items-center gap-2"><Calendar className="size-4" /> Tanggal</span>
                    </SelectItem>
                    <SelectItem value="select">
                      <span className="flex items-center gap-2"><ListChecks className="size-4" /> Pilihan</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Options for select type */}
              {formType === "select" && (
                <div className="space-y-1.5">
                  <Label>Pilihan (pisahkan dengan koma)</Label>
                  <Input
                    value={formOptions}
                    onChange={(e) => setFormOptions(e.target.value)}
                    placeholder="contoh: A, B, AB, O"
                  />
                  <p className="text-xs text-muted-foreground">
                    Daftar opsi yang bisa dipilih, dipisahkan koma.
                  </p>
                </div>
              )}

              {/* Toggles */}
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Wajib diisi</p>
                    <p className="text-xs text-muted-foreground">
                      Field ini harus diisi saat menambah/edit karyawan
                    </p>
                  </div>
                  <Switch checked={formRequired} onCheckedChange={setFormRequired} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Tampilkan di daftar</p>
                    <p className="text-xs text-muted-foreground">
                      Tampilkan di kartu/daftar direktori karyawan
                    </p>
                  </div>
                  <Switch checked={formShowInList} onCheckedChange={setFormShowInList} />
                </div>
                {!isMasaKerjaLabel(formLabel) && !isUsiaLabel(formLabel) && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Boleh diedit karyawan</p>
                      <p className="text-xs text-muted-foreground">
                        Karyawan dapat mengubah field ini sendiri lewat verifikasi
                        profil. Nonaktifkan untuk data sensitif (mis. gaji).
                      </p>
                    </div>
                    <Switch
                      checked={formEmployeeEditable}
                      onCheckedChange={setFormEmployeeEditable}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Add/Edit footer (fixed) */}
        {(mode === "add" || mode === "edit") && (
          <DialogFooter className="border-t pt-4">
            <Button
              variant="secondary"
              onClick={() => { resetForm(); setMode("list"); }}
              disabled={saving}
            >
              Kembali
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || !formLabel.trim()}
            >
              {saving ? "Menyimpan..." : mode === "add" ? "Tambah Field" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        )}

        {mode === "list" && (
          <DialogFooter className="border-t pt-4">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
            <Button
              onClick={() => {
                toast.success("Perubahan field berhasil disimpan");
                onOpenChange(false);
              }}
              className="gap-1.5 cursor-pointer"
            >
              Simpan
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
