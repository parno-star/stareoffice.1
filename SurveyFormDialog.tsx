import { useState } from "react";
import { useMutation } from "convex/react";
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
} from "lucide-react";
import {
  SURVEY_KIND_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  COLOR_OPTIONS,
} from "@/pages/engagement/_lib/engagement-utils.ts";

type DraftQuestion = {
  id: string;
  text: string;
  type: string;
  options: string; // comma separated
  required: boolean;
  minLabel: string;
  maxLabel: string;
  category: string;
};

function emptyQuestion(): DraftQuestion {
  return {
    id: `q_${Math.random().toString(36).slice(2, 8)}`,
    text: "",
    type: "rating",
    options: "",
    required: true,
    minLabel: "",
    maxLabel: "",
    category: "",
  };
}

const TEMPLATES: Record<string, Array<DraftQuestion>> = {
  engagement: [
    {
      ...emptyQuestion(),
      text: "Saya bangga bekerja di perusahaan ini.",
      type: "rating",
      minLabel: "Sangat Tidak Setuju",
      maxLabel: "Sangat Setuju",
      category: "Pride",
    },
    {
      ...emptyQuestion(),
      text: "Pekerjaan saya memberikan arti dan tujuan.",
      type: "rating",
      minLabel: "Sangat Tidak Setuju",
      maxLabel: "Sangat Setuju",
      category: "Meaning",
    },
    {
      ...emptyQuestion(),
      text: "Atasan saya memberikan dukungan yang saya butuhkan.",
      type: "rating",
      minLabel: "Sangat Tidak Setuju",
      maxLabel: "Sangat Setuju",
      category: "Manager",
    },
    {
      ...emptyQuestion(),
      text: "Seberapa mungkin Anda merekomendasikan perusahaan ini sebagai tempat kerja?",
      type: "nps",
      minLabel: "Tidak Mungkin",
      maxLabel: "Sangat Mungkin",
      options: "",
      required: true,
      category: "eNPS",
    },
    {
      ...emptyQuestion(),
      text: "Apa yang bisa kami perbaiki untuk meningkatkan pengalaman kerja Anda?",
      type: "text",
      required: false,
    },
  ],
  wellness: [
    {
      ...emptyQuestion(),
      text: "Bagaimana mood Anda minggu ini?",
      type: "mood",
      category: "Mood",
    },
    {
      ...emptyQuestion(),
      text: "Seberapa seimbang work-life balance Anda saat ini?",
      type: "rating",
      minLabel: "Sangat Tidak Seimbang",
      maxLabel: "Sangat Seimbang",
      category: "Balance",
    },
    {
      ...emptyQuestion(),
      text: "Seberapa sering Anda merasa stres akibat pekerjaan?",
      type: "rating",
      minLabel: "Tidak Pernah",
      maxLabel: "Sangat Sering",
      category: "Stress",
    },
    {
      ...emptyQuestion(),
      text: "Apakah Anda memiliki hal yang ingin disampaikan ke HR?",
      type: "text",
      required: false,
    },
  ],
};

export default function SurveyFormDialog({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Array<string>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<string>("engagement");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [targetDepartment, setTargetDepartment] = useState<string>("all");
  const [color, setColor] = useState<string>("rose");
  const [publishNow, setPublishNow] = useState(false);
  const [questions, setQuestions] = useState<Array<DraftQuestion>>(() => [
    emptyQuestion(),
  ]);
  const [saving, setSaving] = useState(false);

  const createSurvey = useMutation(api.engagement.createSurvey);

  function reset() {
    setTitle("");
    setDescription("");
    setKind("engagement");
    setIsAnonymous(true);
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setTargetDepartment("all");
    setColor("rose");
    setPublishNow(false);
    setQuestions([emptyQuestion()]);
  }

  function applyTemplate(k: string) {
    const t = TEMPLATES[k];
    if (t) {
      setQuestions(t.map((q) => ({ ...q, id: `q_${Math.random().toString(36).slice(2, 8)}` })));
    }
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    const newArr = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
    setQuestions(newArr);
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
      toast.error("Minimal 1 pertanyaan");
      return;
    }
    for (const q of questions) {
      if (q.text.trim().length < 3) {
        toast.error("Setiap pertanyaan harus memiliki teks yang jelas");
        return;
      }
      if (
        (q.type === "single_choice" || q.type === "multi_choice") &&
        q.options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean).length < 2
      ) {
        toast.error("Pertanyaan pilihan membutuhkan minimal 2 opsi");
        return;
      }
    }
    setSaving(true);
    try {
      await createSurvey({
        title: title.trim(),
        description: description.trim() || undefined,
        kind,
        isAnonymous,
        startDate,
        endDate: endDate || undefined,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          type: q.type,
          options:
            q.type === "single_choice" || q.type === "multi_choice"
              ? q.options
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
          required: q.required,
          minLabel: q.minLabel.trim() || undefined,
          maxLabel: q.maxLabel.trim() || undefined,
          category: q.category.trim() || undefined,
        })),
        targetDepartment:
          targetDepartment === "all" ? undefined : targetDepartment,
        color,
        publishNow,
      });
      toast.success(
        publishNow ? "Survei berhasil diterbitkan" : "Draft survei tersimpan",
      );
      reset();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan survei");
      } else {
        toast.error("Gagal menyimpan survei");
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Survei Baru</DialogTitle>
          <DialogDescription>
            Rancang survei engagement, wellness, atau pulse check untuk karyawan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Judul</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="contoh: Survei Engagement Q2 2026"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Berikan konteks untuk responden..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Jenis Survei</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURVEY_KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value} className="cursor-pointer">
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Departemen</Label>
              <Select value={targetDepartment} onValueChange={setTargetDepartment}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">
                    Semua Karyawan
                  </SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d} className="cursor-pointer">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <DateField
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Berakhir (opsional)</Label>
              <DateField
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`size-8 rounded-full cursor-pointer border-2 ${c.className} ${color === c.value ? "border-foreground" : "border-transparent"}`}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Anonim</Label>
              <div className="flex items-center gap-3 h-10 px-3 rounded-md border bg-muted/30">
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                />
                <span className="text-sm text-muted-foreground">
                  {isAnonymous ? "Respons anonim" : "Nama responden dicatat"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Label>Pertanyaan</Label>
                <p className="text-xs text-muted-foreground">
                  Susun pertanyaan secara berurutan
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(TEMPLATES).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyTemplate(k)}
                    className="cursor-pointer"
                  >
                    Template {k}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setQuestions((prev) => [...prev, emptyQuestion()])
                  }
                  className="cursor-pointer"
                >
                  <Plus className="size-4" />
                  Tambah
                </Button>
              </div>
            </div>

            {questions.map((q, idx) => {
              const needsOptions =
                q.type === "single_choice" || q.type === "multi_choice";
              const needsLabels =
                q.type === "rating" ||
                q.type === "mood" ||
                q.type === "nps";
              return (
                <div
                  key={q.id}
                  className="rounded-lg border bg-card p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="size-4 mt-2.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">#{idx + 1}</Badge>
                        {q.required && (
                          <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                            Wajib
                          </Badge>
                        )}
                      </div>
                      <Textarea
                        value={q.text}
                        onChange={(e) =>
                          updateQ(idx, { text: e.target.value })
                        }
                        placeholder="Tulis pertanyaan..."
                        rows={2}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Select
                          value={q.type}
                          onValueChange={(val) =>
                            updateQ(idx, { type: val })
                          }
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
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/30">
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
                      {needsOptions && (
                        <Input
                          value={q.options}
                          onChange={(e) =>
                            updateQ(idx, { options: e.target.value })
                          }
                          placeholder="Pisahkan opsi dengan koma, contoh: Ya, Tidak, Mungkin"
                        />
                      )}
                      {needsLabels && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={q.minLabel}
                            onChange={(e) =>
                              updateQ(idx, { minLabel: e.target.value })
                            }
                            placeholder="Label minimum (opsional)"
                          />
                          <Input
                            value={q.maxLabel}
                            onChange={(e) =>
                              updateQ(idx, { maxLabel: e.target.value })
                            }
                            placeholder="Label maksimum (opsional)"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => moveQuestion(idx, -1)}
                        disabled={idx === 0}
                        className="cursor-pointer"
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => moveQuestion(idx, 1)}
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
                          setQuestions((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
            <div>
              <p className="font-medium text-sm">Terbitkan langsung</p>
              <p className="text-xs text-muted-foreground">
                Jika aktif, survei langsung tampil untuk karyawan dan notifikasi
                terkirim.
              </p>
            </div>
            <Switch
              checked={publishNow}
              onCheckedChange={setPublishNow}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving
              ? "Menyimpan..."
              : publishNow
                ? "Terbitkan Survei"
                : "Simpan Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
