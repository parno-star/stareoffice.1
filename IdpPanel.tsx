import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  IDP_CATEGORIES,
  IDP_HORIZONS,
  IDP_ITEM_STATUS,
  formatDate,
} from "../_lib/talent-utils.ts";
import { cn } from "@/lib/utils.ts";
import {
  Plus,
  Target,
  Trash2,
  CheckCircle2,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Progress } from "@/components/ui/progress.tsx";

type Props = {
  placementId: Id<"talentPlacements">;
  idp: Doc<"talentIdps"> | null;
  items: ReadonlyArray<Doc<"talentIdpItems">>;
  readOnly?: boolean;
};

export default function IdpPanel({
  placementId,
  idp,
  items,
  readOnly,
}: Props) {
  const [summary, setSummary] = useState(idp?.summary ?? "");
  const [aspiration, setAspiration] = useState(idp?.careerAspiration ?? "");
  const [savingIdp, setSavingIdp] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const upsert = useMutation(api.talent.upsertIdp);

  async function save(publish: boolean) {
    setSavingIdp(true);
    try {
      await upsert({
        placementId,
        summary: summary || undefined,
        careerAspiration: aspiration || undefined,
        publish,
      });
      toast.success(publish ? "IDP dipublikasikan" : "Draft IDP disimpan");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message?: string })?.message ?? "Gagal menyimpan"
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSavingIdp(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <CardTitle>Individual Development Plan</CardTitle>
            </div>
            {idp ? (
              <Badge
                variant={idp.status === "published" ? "default" : "secondary"}
              >
                {idp.status === "published" ? "Dipublikasikan" : "Draft"}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            Ringkasan rencana pengembangan karyawan di siklus ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="idp-summary">Fokus Pengembangan</Label>
            <Textarea
              id="idp-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={readOnly}
              placeholder="Prioritas 3-6 bulan ke depan..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idp-aspiration">Aspirasi Karier</Label>
            <Textarea
              id="idp-aspiration"
              rows={2}
              value={aspiration}
              onChange={(e) => setAspiration(e.target.value)}
              disabled={readOnly}
              placeholder="Target karier jangka panjang..."
            />
          </div>
          {!readOnly ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => save(false)}
                disabled={savingIdp}
              >
                {savingIdp ? <Spinner /> : null}
                Simpan Draft
              </Button>
              <Button size="sm" onClick={() => save(true)} disabled={savingIdp}>
                {savingIdp ? <Spinner /> : null}
                Publikasikan
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Rencana Aksi
            </CardTitle>
            <CardDescription>
              Aktivitas konkret yang dikerjakan pada siklus ini.
            </CardDescription>
          </div>
          {!readOnly && idp ? (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Tambah Aksi
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {!idp ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target />
                </EmptyMedia>
                <EmptyTitle>Belum ada IDP</EmptyTitle>
                <EmptyDescription>
                  Simpan ringkasan IDP terlebih dahulu untuk menambah aksi.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Sparkles />
                </EmptyMedia>
                <EmptyTitle>Belum ada aksi</EmptyTitle>
                <EmptyDescription>
                  Tambahkan pelatihan, mentoring, atau stretch assignment.
                </EmptyDescription>
              </EmptyHeader>
              {!readOnly ? (
                <EmptyContent>
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    Tambah Aksi
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            items.map((item) => (
              <IdpItemRow
                key={item._id}
                item={item}
                readOnly={readOnly}
              />
            ))
          )}
        </CardContent>
      </Card>

      {idp && !readOnly ? (
        <AddItemDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          idpId={idp._id}
        />
      ) : null}
    </div>
  );
}

function IdpItemRow({
  item,
  readOnly,
}: {
  item: Doc<"talentIdpItems">;
  readOnly?: boolean;
}) {
  const update = useMutation(api.talent.updateIdpItem);
  const remove = useMutation(api.talent.removeIdpItem);
  const [progress, setProgress] = useState(item.progress ?? 0);

  const category = IDP_CATEGORIES[item.category] ?? IDP_CATEGORIES.other;
  const horizon = IDP_HORIZONS[item.horizon];
  const status = IDP_ITEM_STATUS[item.status];

  async function handleStatus(newStatus: string) {
    try {
      await update({
        itemId: item._id,
        status: newStatus,
        progress: newStatus === "done" ? 100 : item.progress,
      });
      toast.success("Status diperbarui");
    } catch {
      toast.error("Gagal memperbarui");
    }
  }

  async function handleProgress(val: number) {
    setProgress(val);
    try {
      await update({
        itemId: item._id,
        progress: val,
        status: val >= 100 ? "done" : val > 0 ? "in_progress" : "planned",
      });
    } catch {
      toast.error("Gagal menyimpan progres");
    }
  }

  async function handleDelete() {
    try {
      await remove({ itemId: item._id });
      toast.success("Item dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn("rounded-full px-2 py-0.5 text-[10px]", category.tone)}
            >
              {category.label}
            </span>
            {horizon ? (
              <span
                className={cn("rounded-full px-2 py-0.5 text-[10px]", horizon.tone)}
              >
                {horizon.label}
              </span>
            ) : null}
            {status ? (
              <span
                className={cn("rounded-full px-2 py-0.5 text-[10px]", status.tone)}
              >
                {status.label}
              </span>
            ) : null}
          </div>
          <div className="mt-1 font-medium text-sm">{item.title}</div>
          {item.description ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.description}
            </p>
          ) : null}
          {item.targetDate ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              Target: {formatDate(item.targetDate)}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              {item.status !== "in_progress" ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleStatus("in_progress")}
                  title="Mulai"
                >
                  <PlayCircle className="size-4" />
                </Button>
              ) : null}
              {item.status !== "done" ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleStatus("done")}
                  title="Selesai"
                >
                  <CheckCircle2 className="size-4" />
                </Button>
              ) : null}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleDelete}
                title="Hapus"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-2 flex-1" />
        <Input
          type="number"
          min={0}
          max={100}
          value={progress}
          disabled={readOnly}
          onChange={(e) => handleProgress(Number(e.target.value))}
          className="h-7 w-16 text-xs"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  idpId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  idpId: Id<"talentIdps">;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("training");
  const [horizon, setHorizon] = useState("short_term");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  const add = useMutation(api.talent.addIdpItem);

  async function handleAdd() {
    if (!title.trim()) {
      toast.error("Judul aksi wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await add({
        idpId,
        title: title.trim(),
        description: description || undefined,
        category,
        horizon,
        targetDate: targetDate || undefined,
      });
      toast.success("Aksi ditambahkan");
      setTitle("");
      setDescription("");
      setTargetDate("");
      onOpenChange(false);
    } catch {
      toast.error("Gagal menambahkan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Aksi Pengembangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="item-title">Judul</Label>
            <Input
              id="item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kursus kepemimpinan tingkat dasar"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Deskripsi</Label>
            <Textarea
              id="item-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IDP_CATEGORIES).map(([key, v]) => (
                    <SelectItem key={key} value={key}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Horizon</Label>
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IDP_HORIZONS).map(([key, v]) => (
                    <SelectItem key={key} value={key}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-target">Target Selesai</Label>
            <DateField
              id="item-target"
              value={targetDate}
              onChange={(v) => setTargetDate(v)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Spinner /> : null}
            Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
