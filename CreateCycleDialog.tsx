import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
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
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
} from "lucide-react";
import {
  COLOR_OPTIONS,
  suggestPeriods,
} from "@/pages/feedback360/_lib/feedback360-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type DraftQuestion = {
  id: string;
  text: string;
  type: string; // "rating" | "text"
  required: boolean;
  category: string;
};

function freshId(): string {
  return `q_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyQuestion(): DraftQuestion {
  return {
    id: freshId(),
    text: "",
    type: "rating",
    required: true,
    category: "",
  };
}

const QUESTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "rating", label: "Skala 1-5" },
  { value: "text", label: "Jawaban Bebas" },
];

export default function CreateCycleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (cycleId: Id<"feedback360Cycles">) => void;
}) {
  const template = useQuery(
    api.feedback360.cycles.getTemplateQuestions,
    open ? {} : "skip",
  );
  const createCycle = useMutation(api.feedback360.cycles.createCycle);

  const year = new Date().getFullYear();
  const periods = useMemo(() => suggestPeriods(year), [year]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState<string>(
    `${year}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
  );
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [color, setColor] = useState<string>("indigo");
  const [useTemplate, setUseTemplate] = useState(true);
  const [questions, setQuestions] = useState<Array<DraftQuestion>>([]);
  const [saving, setSaving] = useState(false);

  // Preload template questions when it arrives and user hasn't changed
  useEffect(() => {
    if (template && useTemplate) {
      setQuestions(
        template.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          required: q.required,
          category: q.category ?? "",
        })),
      );
    }
  }, [template, useTemplate]);

  function reset() {
    setTitle("");
    setDescription("");
    setPeriod(`${year}-Q${Math.floor(new Date().getMonth() / 3) + 1}`);
    setStartDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 21);
    setEndDate(d.toISOString().slice(0, 10));
    setColor("indigo");
    setUseTemplate(true);
    setQuestions([]);
  }

  function moveQ(idx: number, dir: -1 | 1) {
    const next = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setQuestions(next);
  }

  function updateQ(idx: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  }

  async function handleSubmit() {
    if (title.trim().length < 3) {
      toast.error("Judul minimal 3 karakter");
      return;
    }
    if (questions.length === 0) {
      toast.error("Tambahkan minimal satu pertanyaan");
      return;
    }
    for (const q of questions) {
      if (q.text.trim().length < 5) {
        toast.error("Setiap pertanyaan harus memiliki teks yang jelas");
        return;
      }
    }
    if (startDate > endDate) {
      toast.error("Tanggal berakhir harus setelah tanggal mulai");
      return;
    }
    setSaving(true);
    try {
      const id = await createCycle({
        title: title.trim(),
        description: description.trim() || undefined,
        period,
        startDate,
        endDate,
        color,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          type: q.type,
          required: q.required,
          category: q.category.trim() || undefined,
        })),
      });
      reset();
      onOpenChange(false);
      onCreated?.(id);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat siklus");
      } else {
        toast.error("Gagal membuat siklus");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Siklus Feedback 360°</DialogTitle>
          <DialogDescription>
            Siklus akan dibuat sebagai draf. Setelah menambahkan karyawan yang
            dinilai, Anda dapat mengaktifkannya agar reviewer dapat mulai mengisi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Judul</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="contoh: Feedback 360° Semester 1 2026"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Deskripsi (opsional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan tujuan siklus ini..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Periode</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem
                      key={p.value}
                      value={p.value}
                      className="cursor-pointer"
                    >
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`size-8 cursor-pointer rounded-full border-2 ${c.className} ${color === c.value ? "border-foreground" : "border-transparent"}`}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <DateField
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Berakhir</Label>
              <DateField
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Gunakan pertanyaan template</p>
                <p className="text-xs text-muted-foreground">
                  Aktifkan untuk memuat pertanyaan rekomendasi. Anda tetap bisa
                  menyesuaikan setelahnya.
                </p>
              </div>
            </div>
            <Switch
              checked={useTemplate}
              onCheckedChange={(v) => {
                setUseTemplate(v);
                if (!v) setQuestions([]);
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>Pertanyaan</Label>
                <p className="text-xs text-muted-foreground">
                  Susun pertanyaan yang akan dijawab oleh setiap reviewer.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setQuestions((prev) => [...prev, emptyQuestion()])
                }
                className="cursor-pointer"
              >
                <Plus className="size-4" />
                Tambah Pertanyaan
              </Button>
            </div>

            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">#{idx + 1}</Badge>
                      {q.required ? (
                        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                          Wajib
                        </Badge>
                      ) : null}
                    </div>
                    <Textarea
                      value={q.text}
                      onChange={(e) =>
                        updateQ(idx, { text: e.target.value })
                      }
                      placeholder="Tulis pertanyaan..."
                      rows={2}
                    />
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <Select
                        value={q.type}
                        onValueChange={(v) => updateQ(idx, { type: v })}
                      >
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPE_OPTIONS.map((t) => (
                            <SelectItem
                              key={t.value}
                              value={t.value}
                              className="cursor-pointer"
                            >
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={q.category}
                        onChange={(e) =>
                          updateQ(idx, { category: e.target.value })
                        }
                        placeholder="Kategori (opsional)"
                      />
                      <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3">
                        <Switch
                          checked={q.required}
                          onCheckedChange={(v) =>
                            updateQ(idx, { required: v })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          Wajib diisi
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => moveQ(idx, -1)}
                      disabled={idx === 0}
                      className="cursor-pointer"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => moveQ(idx, 1)}
                      disabled={idx === questions.length - 1}
                      className="cursor-pointer"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        setQuestions((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="cursor-pointer text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Buat Siklus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
