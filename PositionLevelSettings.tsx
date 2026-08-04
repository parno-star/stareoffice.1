import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Crown,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Users,
  FileCheck,
  Banknote,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

const COLOR_OPTIONS = [
  { value: "rose", label: "Rose" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "yellow", label: "Yellow" },
  { value: "lime", label: "Lime" },
  { value: "green", label: "Green" },
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "violet", label: "Violet" },
  { value: "purple", label: "Purple" },
];

const LETTER_ROLES = [
  { value: "konseptor", label: "Konseptor" },
  { value: "pemeriksa", label: "Pemeriksa" },
  { value: "penyetuju", label: "Penyetuju" },
  { value: "none", label: "Tidak Ada" },
];

function formatCurrency(amount: number): string {
  if (amount === 0) return "Tidak terbatas";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const COLOR_MAP: Record<string, string> = {
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  lime: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

type FormData = {
  code: string;
  name: string;
  rank: number;
  description: string;
  maxApprovalAmount: number;
  canSignLetters: boolean;
  canApproveLetters: boolean;
  defaultLetterRole: string;
  color: string;
};

const EMPTY_FORM: FormData = {
  code: "",
  name: "",
  rank: 1,
  description: "",
  maxApprovalAmount: 0,
  canSignLetters: false,
  canApproveLetters: false,
  defaultLetterRole: "none",
  color: "blue",
};

export default function PositionLevelSettings() {
  const levels = useQuery(api.positionLevels.list, {});
  const usersByLevel = useQuery(api.positionLevels.getUsersByLevel, {});
  const seedDefaults = useMutation(api.positionLevels.seedDefaults);
  const createLevel = useMutation(api.positionLevels.create);
  const updateLevel = useMutation(api.positionLevels.update);
  const removeLevel = useMutation(api.positionLevels.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"positionLevels"> | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    const nextRank = levels ? Math.max(...levels.map((l) => l.rank), 0) + 1 : 1;
    setForm({ ...EMPTY_FORM, rank: nextRank, code: `L${nextRank}` });
    setDialogOpen(true);
  };

  const openEdit = (level: Doc<"positionLevels">) => {
    setEditingId(level._id);
    setForm({
      code: level.code,
      name: level.name,
      rank: level.rank,
      description: level.description ?? "",
      maxApprovalAmount: level.maxApprovalAmount,
      canSignLetters: level.canSignLetters,
      canApproveLetters: level.canApproveLetters,
      defaultLetterRole: level.defaultLetterRole,
      color: level.color,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Kode dan nama wajib diisi");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateLevel({
          id: editingId,
          ...form,
          description: form.description || undefined,
        });
        toast.success("Level jabatan berhasil diperbarui");
      } else {
        await createLevel({
          ...form,
          description: form.description || undefined,
        });
        toast.success("Level jabatan berhasil ditambahkan");
      }
      setDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: Id<"positionLevels">) => {
    try {
      await removeLevel({ id });
      toast.success("Level jabatan berhasil dihapus");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus";
      toast.error(msg);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedDefaults({});
      if (result.created > 0) {
        toast.success(`${result.created} level jabatan standar BUMN berhasil dibuat`);
      } else {
        toast.info("Semua level standar sudah ada");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat level standar";
      toast.error(msg);
    } finally {
      setSeeding(false);
    }
  };

  if (levels === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const getUserCount = (levelId: string) => {
    if (!usersByLevel) return 0;
    const group = usersByLevel.find((g) => g.level._id === levelId);
    return group?.users.length ?? 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Crown className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Jenjang Kewenangan Keuangan</h2>
            <p className="text-sm text-muted-foreground">
              Kelola hierarki level jabatan standar BUMN
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {levels.length === 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSeed}
              disabled={seeding}
              className="cursor-pointer gap-1.5"
            >
              <Sparkles className="size-4" />
              {seeding ? "Memuat..." : "Buat Standar BUMN"}
            </Button>
          )}
          <Button size="sm" onClick={openCreate} className="cursor-pointer gap-1.5">
            <Plus className="size-4" />
            Tambah Level
          </Button>
        </div>
      </div>

      {/* Seed button if empty */}
      {levels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="size-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Belum ada jenjang jabatan</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Klik tombol "Buat Standar BUMN" untuk memuat 9 level jabatan standar BUMN
              (Direktur Utama s/d Staff/Pelaksana), atau tambahkan manual.
            </p>
            <Button onClick={handleSeed} disabled={seeding} className="cursor-pointer gap-1.5">
              <Sparkles className="size-4" />
              {seeding ? "Memuat..." : "Buat Standar BUMN"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Table */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              {levels.length} Level Jabatan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Kode</TableHead>
                    <TableHead>Nama Jabatan</TableHead>
                    <TableHead className="hidden md:table-cell">Batas Approval</TableHead>
                    <TableHead className="hidden lg:table-cell">Peran Surat</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Karyawan</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((level) => {
                    const colorClass = COLOR_MAP[level.color] ?? COLOR_MAP.blue;
                    const userCount = getUserCount(level._id);
                    const isExpanded = expandedLevel === level._id;

                    return (
                      <>
                        <TableRow
                          key={level._id}
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedLevel(isExpanded ? null : level._id)
                          }
                        >
                          <TableCell>
                            <Badge className={`${colorClass} text-xs font-mono`}>
                              {level.code}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{level.name}</span>
                              {isExpanded ? (
                                <ChevronUp className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              )}
                            </div>
                            {level.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {level.description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Banknote className="size-3.5 text-muted-foreground" />
                              {formatCurrency(level.maxApprovalAmount)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {level.defaultLetterRole === "none"
                                ? "-"
                                : level.defaultLetterRole}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="size-3.5 text-muted-foreground" />
                              <span className="text-sm">{userCount}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-center">
                            <Badge
                              variant={level.isActive ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {level.isActive ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-pointer size-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(level);
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="cursor-pointer size-8 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(level._id);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <TableRow key={`${level._id}-detail`}>
                            <TableCell colSpan={7} className="bg-muted/30 px-6 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs block mb-1">
                                    Rank / Urutan
                                  </span>
                                  <span className="font-medium">Level {level.rank}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block mb-1">
                                    Batas Approval Keuangan
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(level.maxApprovalAmount)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block mb-1">
                                    Wewenang Surat
                                  </span>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {level.canSignLetters && (
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <FileCheck className="size-3" /> Tanda Tangan
                                      </Badge>
                                    )}
                                    {level.canApproveLetters && (
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <Shield className="size-3" /> Persetujuan
                                      </Badge>
                                    )}
                                    {!level.canSignLetters && !level.canApproveLetters && (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block mb-1">
                                    Deskripsi
                                  </span>
                                  <span className="text-muted-foreground">
                                    {level.description || "-"}
                                  </span>
                                </div>
                              </div>
                              {/* Users at this level */}
                              {usersByLevel && (
                                <div className="mt-4">
                                  <span className="text-muted-foreground text-xs block mb-2">
                                    Karyawan di Level Ini ({userCount})
                                  </span>
                                  {userCount > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {usersByLevel
                                        .find((g) => g.level._id === level._id)
                                        ?.users.map((u) => (
                                          <Badge
                                            key={u._id}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {u.name} - {u.department}
                                          </Badge>
                                        ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Belum ada karyawan yang ditugaskan
                                    </p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Level Jabatan" : "Tambah Level Jabatan"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Perbarui informasi level jabatan"
                : "Tambahkan level jabatan baru ke hierarki organisasi"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Kode</Label>
                <Input
                  id="code"
                  placeholder="L1"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rank">Rank (Urutan)</Label>
                <Input
                  id="rank"
                  type="number"
                  min={1}
                  value={form.rank}
                  onChange={(e) =>
                    setForm({ ...form, rank: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Jabatan</Label>
              <Input
                id="name"
                placeholder="Direktur Utama"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Deskripsi</Label>
              <Textarea
                id="desc"
                placeholder="Tugas dan tanggung jawab level ini..."
                value={form.description}
                rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxApproval">Batas Approval Keuangan (IDR)</Label>
              <Input
                id="maxApproval"
                type="number"
                min={0}
                value={form.maxApprovalAmount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxApprovalAmount: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                0 = tidak terbatas
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Warna</Label>
                <Select
                  value={form.color}
                  onValueChange={(v) => setForm({ ...form, color: v })}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="cursor-pointer">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="letterRole">Peran Surat Default</Label>
                <Select
                  value={form.defaultLetterRole}
                  onValueChange={(v) =>
                    setForm({ ...form, defaultLetterRole: v })
                  }
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LETTER_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="cursor-pointer">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Boleh Tanda Tangan Surat</Label>
                  <p className="text-xs text-muted-foreground">
                    Level ini dapat menandatangani surat keluar
                  </p>
                </div>
                <Switch
                  checked={form.canSignLetters}
                  onCheckedChange={(v) =>
                    setForm({ ...form, canSignLetters: v })
                  }
                  className="cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Boleh Menyetujui Surat</Label>
                  <p className="text-xs text-muted-foreground">
                    Level ini dapat menjadi Pemeriksa atau Penyetuju
                  </p>
                </div>
                <Switch
                  checked={form.canApproveLetters}
                  onCheckedChange={(v) =>
                    setForm({ ...form, canApproveLetters: v })
                  }
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
