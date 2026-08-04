import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Building2,
  UserCircle2,
} from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

const STATUS_META: Record<
  string,
  { label: string; color: string }
> = {
  planned: {
    label: "Direncanakan",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  approved: {
    label: "Disetujui",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  posted: {
    label: "Dibuka",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
  },
  filled: {
    label: "Terisi",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  cancelled: {
    label: "Dibatalkan",
    color: "bg-muted text-muted-foreground border-border",
  },
};

const LEVELS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function PositionEditor({
  open,
  onOpenChange,
  editing,
  allUsers,
  departments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Doc<"headcountPositions"> | null;
  allUsers: Array<Doc<"users">>;
  departments: Array<string>;
}) {
  const createPosition = useMutation(
    api.orgAdvanced.headcount.createPosition,
  );
  const updatePosition = useMutation(
    api.orgAdvanced.headcount.updatePosition,
  );

  const [title, setTitle] = useState(editing?.title ?? "");
  const [department, setDepartment] = useState(editing?.department ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [reportsToId, setReportsToId] = useState<string>(
    editing?.reportsToId ?? "none",
  );
  const [level, setLevel] = useState(editing?.level ?? "mid");
  const [status, setStatus] = useState(editing?.status ?? "planned");
  const [targetStartDate, setTargetStartDate] = useState(
    editing?.targetStartDate ?? "",
  );
  const [budgetMin, setBudgetMin] = useState(
    editing?.budgetMin ? String(editing.budgetMin) : "",
  );
  const [budgetMax, setBudgetMax] = useState(
    editing?.budgetMax ? String(editing.budgetMax) : "",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !department.trim()) {
      toast.error("Judul dan departemen wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const base = {
        title: title.trim(),
        department: department.trim(),
        description: description.trim() || undefined,
        reportsToId:
          reportsToId && reportsToId !== "none"
            ? (reportsToId as Id<"users">)
            : undefined,
        level,
        status,
        targetStartDate: targetStartDate || undefined,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        note: note.trim() || undefined,
      };
      if (editing) {
        await updatePosition({
          positionId: editing._id,
          ...base,
          reportsToId: base.reportsToId ?? null,
          targetStartDate: base.targetStartDate ?? null,
          budgetMin: base.budgetMin ?? null,
          budgetMax: base.budgetMax ?? null,
        });
        toast.success("Posisi diperbarui");
      } else {
        await createPosition(base);
        toast.success("Posisi dibuat");
      }
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Posisi" : "Posisi Baru"}</DialogTitle>
          <DialogDescription>
            Rencanakan posisi yang akan dibuka di masa depan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Judul Posisi</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Departemen</Label>
            <Input
              list="dept-list"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <datalist id="dept-list">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lapor ke</Label>
            <Select value={reportsToId} onValueChange={setReportsToId}>
              <SelectTrigger>
                <SelectValue placeholder="Tidak ada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? "Tanpa Nama"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target Mulai (opsional)</Label>
            <DateField
              value={targetStartDate}
              onChange={(v) => setTargetStartDate(v)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Budget Min (IDR)</Label>
            <Input
              type="number"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Budget Max (IDR)</Label>
            <Input
              type="number"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Deskripsi</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Catatan Internal</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HeadcountPanel({
  allUsers,
  isAdmin,
}: {
  allUsers: Array<Doc<"users">>;
  isAdmin: boolean;
}) {
  const positions = useQuery(api.orgAdvanced.headcount.listPositions, {});
  const summary = useQuery(api.orgAdvanced.headcount.summary, {});
  const removePosition = useMutation(api.orgAdvanced.headcount.removePosition);
  const fillPosition = useMutation(api.orgAdvanced.headcount.fillPosition);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"headcountPositions"> | null>(null);
  const [fillingId, setFillingId] = useState<Id<"headcountPositions"> | null>(
    null,
  );
  const [fillUserId, setFillUserId] = useState<string>("");

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of allUsers) {
      if (u.department && u.department.trim()) set.add(u.department);
    }
    for (const p of positions ?? []) set.add(p.position.department);
    return Array.from(set).sort();
  }, [allUsers, positions]);

  const handleDelete = async (id: Id<"headcountPositions">) => {
    await removePosition({ positionId: id });
    toast.success("Posisi dihapus");
  };

  const handleFill = async () => {
    if (!fillingId || !fillUserId) return;
    await fillPosition({
      positionId: fillingId,
      userId: fillUserId as Id<"users">,
    });
    toast.success("Posisi ditandai terisi");
    setFillingId(null);
    setFillUserId("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : (
          <>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Briefcase className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terbuka</p>
                  <p className="text-xl font-bold">{summary.totals.open}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Direncanakan</p>
                  <p className="text-xl font-bold">{summary.totals.planned}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Terisi</p>
                  <p className="text-xl font-bold">{summary.totals.filled}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <UserCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dibatalkan</p>
                  <p className="text-xl font-bold">{summary.totals.cancelled}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Daftar Posisi</CardTitle>
          {isAdmin ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="size-4" />
              Posisi Baru
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!positions ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Briefcase />
                </EmptyMedia>
                <EmptyTitle>Belum ada posisi</EmptyTitle>
                <EmptyDescription>
                  Rencanakan posisi baru untuk masa depan.
                </EmptyDescription>
              </EmptyHeader>
              {isAdmin ? (
                <EmptyContent>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setEditorOpen(true);
                    }}
                  >
                    Buat Posisi
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <div className="space-y-2">
              {positions.map((p) => {
                const meta = STATUS_META[p.position.status] ?? {
                  label: p.position.status,
                  color: "",
                };
                return (
                  <div
                    key={p.position._id}
                    className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">
                          {p.position.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", meta.color)}
                        >
                          {meta.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {p.position.level}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.position.department}
                        {p.reportsTo ? ` · Lapor ke ${p.reportsTo.name ?? "—"}` : ""}
                        {p.position.targetStartDate
                          ? ` · Mulai ${p.position.targetStartDate}`
                          : ""}
                      </p>
                      {p.position.budgetMin || p.position.budgetMax ? (
                        <p className="text-[11px] text-muted-foreground">
                          {p.position.budgetMin
                            ? formatCurrency(p.position.budgetMin)
                            : "—"}
                          {" – "}
                          {p.position.budgetMax
                            ? formatCurrency(p.position.budgetMax)
                            : "—"}
                        </p>
                      ) : null}
                      {p.filledBy ? (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Terisi oleh {p.filledBy.name}
                        </p>
                      ) : null}
                    </div>
                    {isAdmin ? (
                      <div className="flex shrink-0 items-center gap-1">
                        {p.position.status !== "filled" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              setFillingId(p.position._id);
                              setFillUserId("");
                            }}
                          >
                            <CheckCircle2 className="size-4" />
                            Isi
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(p.position);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => handleDelete(p.position._id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {editorOpen ? (
        <PositionEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          editing={editing}
          allUsers={allUsers}
          departments={departments}
        />
      ) : null}

      <Dialog
        open={fillingId !== null}
        onOpenChange={(v) => !v && setFillingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Isi Posisi</DialogTitle>
            <DialogDescription>
              Pilih karyawan yang mengisi posisi ini.
            </DialogDescription>
          </DialogHeader>
          <Select value={fillUserId} onValueChange={setFillUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih karyawan..." />
            </SelectTrigger>
            <SelectContent>
              {allUsers.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name ?? "Tanpa Nama"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFillingId(null)}>
              Batal
            </Button>
            <Button onClick={handleFill} disabled={!fillUserId}>
              Tandai Terisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
