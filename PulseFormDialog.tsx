import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.js";
import type { PulseListItem } from "@/convex/pulse";
import {
  CATEGORY_OPTIONS,
  COLOR_OPTIONS,
  FREQUENCY_OPTIONS,
  QUESTION_TYPE_OPTIONS,
} from "@/pages/pulse/_lib/pulse-utils.ts";

type TemplateKey = "mood" | "enps" | "workload" | "leadership" | "custom";

const TEMPLATES: Record<
  TemplateKey,
  {
    title: string;
    question: string;
    questionType: string;
    category: string;
    commentPrompt: string;
  }
> = {
  mood: {
    title: "Mood Check Mingguan",
    question: "Bagaimana perasaan Anda di tempat kerja minggu ini?",
    questionType: "mood",
    category: "wellbeing",
    commentPrompt: "Ceritakan singkat apa yang membuat perasaan Anda seperti itu.",
  },
  enps: {
    title: "Employee NPS",
    question:
      "Seberapa besar kemungkinan Anda merekomendasikan perusahaan ini sebagai tempat bekerja kepada teman?",
    questionType: "nps",
    category: "culture",
    commentPrompt: "Apa alasan utama di balik skor Anda?",
  },
  workload: {
    title: "Beban Kerja Mingguan",
    question: "Apakah beban kerja Anda minggu ini terasa wajar?",
    questionType: "yes_no",
    category: "workload",
    commentPrompt: "Apa yang perlu diubah untuk membuatnya lebih seimbang?",
  },
  leadership: {
    title: "Dukungan Atasan",
    question: "Apakah Anda merasa atasan mendukung pertumbuhan Anda?",
    questionType: "rating",
    category: "leadership",
    commentPrompt: "Masukan konstruktif untuk atasan langsung Anda.",
  },
  custom: {
    title: "",
    question: "",
    questionType: "mood",
    category: "custom",
    commentPrompt: "",
  },
};

type FormState = {
  title: string;
  description: string;
  question: string;
  questionType: string;
  commentPrompt: string;
  category: string;
  frequency: string;
  isAnonymous: boolean;
  targetDepartment: string;
  startDate: string;
  endDate: string;
  color: string;
};

function initialState(): FormState {
  return {
    title: "",
    description: "",
    question: "",
    questionType: "mood",
    commentPrompt: "",
    category: "wellbeing",
    frequency: "weekly",
    isAnonymous: true,
    targetDepartment: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    color: "rose",
  };
}

export default function PulseFormDialog({
  open,
  onOpenChange,
  departments,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: Array<string>;
  editing?: PulseListItem | null;
}) {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>("custom");
  const createPulse = useMutation(api.pulse.createPulse);
  const updatePulse = useMutation(api.pulse.updatePulse);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        question: editing.question,
        questionType: editing.questionType,
        commentPrompt: editing.commentPrompt ?? "",
        category: editing.category,
        frequency: editing.frequency,
        isAnonymous: editing.isAnonymous,
        targetDepartment: editing.targetDepartment ?? "",
        startDate: editing.startDate,
        endDate: editing.endDate ?? "",
        color: editing.color,
      });
      setTemplate("custom");
    } else {
      setForm(initialState());
      setTemplate("custom");
    }
  }, [open, editing]);

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    if (key === "custom") return;
    const t = TEMPLATES[key];
    setForm((prev) => ({
      ...prev,
      title: t.title,
      question: t.question,
      questionType: t.questionType,
      category: t.category,
      commentPrompt: t.commentPrompt,
    }));
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.question.trim()) {
      toast.error("Judul dan pertanyaan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updatePulse({
          pulseId: editing._id as Id<"pulseSurveys">,
          title: form.title,
          description: form.description || undefined,
          question: form.question,
          questionType: form.questionType,
          commentPrompt: form.commentPrompt || undefined,
          category: form.category,
          frequency: form.frequency,
          isAnonymous: form.isAnonymous,
          targetDepartment: form.targetDepartment || undefined,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          color: form.color,
        });
        toast.success("Pulse diperbarui");
      } else {
        await createPulse({
          title: form.title,
          description: form.description || undefined,
          question: form.question,
          questionType: form.questionType,
          commentPrompt: form.commentPrompt || undefined,
          category: form.category,
          frequency: form.frequency,
          isAnonymous: form.isAnonymous,
          targetDepartment: form.targetDepartment || undefined,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          color: form.color,
        });
        toast.success("Pulse dibuat sebagai draft");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan pulse")
          : "Gagal menyimpan pulse",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Sunting Pulse" : "Buat Pulse Survey"}
          </DialogTitle>
          <DialogDescription>
            Pulse yang singkat dan fokus menghasilkan respons yang lebih
            berkualitas.
          </DialogDescription>
        </DialogHeader>

        {!editing && (
          <div className="space-y-2">
            <Label>Mulai dari template</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(["mood", "enps", "workload", "leadership", "custom"] as const).map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTemplate(key)}
                    className={cn(
                      "rounded-lg border p-2 text-xs font-medium text-left transition-colors cursor-pointer",
                      template === key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    {key === "mood" && "Mood Mingguan"}
                    {key === "enps" && "eNPS"}
                    {key === "workload" && "Beban Kerja"}
                    {key === "leadership" && "Dukungan Atasan"}
                    {key === "custom" && "Kustom"}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pulse-title">Judul</Label>
            <Input
              id="pulse-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Mood check minggu ke-42"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pulse-description">Deskripsi (opsional)</Label>
            <Textarea
              id="pulse-description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Konteks tambahan untuk karyawan"
              rows={2}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pulse-question">Pertanyaan Utama</Label>
            <Textarea
              id="pulse-question"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="Bagaimana perasaan Anda minggu ini?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipe Jawaban</Label>
            <Select
              value={form.questionType}
              onValueChange={(v) => setForm({ ...form, questionType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPE_OPTIONS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Frekuensi</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => setForm({ ...form, frequency: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Departemen Sasaran</Label>
            <Select
              value={form.targetDepartment === "" ? "all" : form.targetDepartment}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  targetDepartment: v === "all" ? "" : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Karyawan</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pulse-start">Tanggal Mulai</Label>
            <DateField
              id="pulse-start"
              value={form.startDate}
              onChange={(v) => setForm({ ...form, startDate: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pulse-end">Tanggal Tutup (opsional)</Label>
            <DateField
              id="pulse-end"
              value={form.endDate}
              onChange={(v) => setForm({ ...form, endDate: v })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pulse-comment">Ajak komentar (opsional)</Label>
            <Input
              id="pulse-comment"
              value={form.commentPrompt}
              onChange={(e) =>
                setForm({ ...form, commentPrompt: e.target.value })
              }
              placeholder="Ceritakan lebih banyak tentang jawaban Anda"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Warna Kartu</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={cn(
                    "size-8 rounded-full cursor-pointer border-2 transition-all",
                    c.className,
                    form.color === c.value
                      ? "border-foreground scale-110"
                      : "border-transparent",
                  )}
                  aria-label={c.value}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between md:col-span-2 rounded-lg border p-3">
            <div>
              <Label htmlFor="pulse-anon">Anonim</Label>
              <p className="text-xs text-muted-foreground">
                Respons tidak terkait dengan identitas responden.
              </p>
            </div>
            <Switch
              id="pulse-anon"
              checked={form.isAnonymous}
              onCheckedChange={(v) => setForm({ ...form, isAnonymous: v })}
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
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting
              ? "Menyimpan..."
              : editing
                ? "Simpan Perubahan"
                : "Simpan sebagai Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
