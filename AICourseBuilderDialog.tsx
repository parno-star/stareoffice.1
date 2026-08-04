import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2, CheckCircle2 } from "lucide-react";
import { CATEGORY_OPTIONS, LEVEL_OPTIONS } from "../_lib/training-utils.ts";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner.tsx";

type AIOutlineLesson = {
  title: string;
  summary: string;
  durationMinutes: number;
};

type AIOutline = {
  title: string;
  description: string;
  category: string;
  level: string;
  lessons: Array<AIOutlineLesson>;
};

export default function AICourseBuilderDialog({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("karyawan umum");
  const [lessonCount, setLessonCount] = useState("5");
  const [outline, setOutline] = useState<AIOutline | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<"input" | "review" | "building">("input");
  const [buildStatus, setBuildStatus] = useState("");
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [generateLessonContent, setGenerateLessonContent] = useState(true);

  const generateOutline = useAction(api.training.ai.generateCourseOutline);
  const generateLessonCall = useAction(api.training.ai.generateLessonContent);
  const generateQuizCall = useAction(api.training.ai.generateQuiz);
  const createCourse = useMutation(api.courses.createCourse);
  const addLesson = useMutation(api.courses.addLesson);
  const upsertQuiz = useMutation(api.training.quizzes.upsertQuiz);

  const navigate = useNavigate();

  const resetAll = () => {
    setTopic("");
    setAudience("karyawan umum");
    setLessonCount("5");
    setOutline(null);
    setStep("input");
    setBuildStatus("");
  };

  const handleGenerate = async () => {
    if (topic.trim().length < 3) {
      toast.error("Topik terlalu pendek");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateOutline({
        topic: topic.trim(),
        audience: audience.trim() || undefined,
        lessonCount: Number(lessonCount) || 5,
      });
      setOutline(result);
      setStep("review");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal generate")
          : err instanceof Error
            ? err.message
            : "Gagal generate";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const updateLesson = (idx: number, patch: Partial<AIOutlineLesson>) => {
    if (!outline) return;
    const next = { ...outline, lessons: [...outline.lessons] };
    next.lessons[idx] = { ...next.lessons[idx], ...patch };
    setOutline(next);
  };

  const removeLesson = (idx: number) => {
    if (!outline) return;
    setOutline({
      ...outline,
      lessons: outline.lessons.filter((_, i) => i !== idx),
    });
  };

  const handleCreate = async () => {
    if (!outline) return;
    if (outline.lessons.length === 0) {
      toast.error("Minimal 1 pelajaran dibutuhkan");
      return;
    }
    setCreating(true);
    setStep("building");
    try {
      const totalDuration = outline.lessons.reduce(
        (sum, l) => sum + (l.durationMinutes || 10),
        0,
      );
      setBuildStatus("Membuat kelas...");
      const courseId = await createCourse({
        title: outline.title.trim(),
        description: outline.description.trim(),
        category: outline.category,
        level: outline.level,
        durationMinutes: totalDuration,
        coverColor: "purple",
      });

      // Add lessons (generate content if opted in)
      const lessonTexts: Array<string> = [];
      for (let i = 0; i < outline.lessons.length; i += 1) {
        const lesson = outline.lessons[i];
        setBuildStatus(
          `Menulis pelajaran ${i + 1}/${outline.lessons.length}: ${lesson.title}`,
        );
        let content = lesson.summary || "";
        if (generateLessonContent) {
          try {
            const result = await generateLessonCall({
              courseTitle: outline.title,
              lessonTitle: lesson.title,
              summary: lesson.summary,
            });
            content = result.content || content;
          } catch {
            content = lesson.summary || `# ${lesson.title}`;
          }
        }
        lessonTexts.push(content);
        await addLesson({
          courseId,
          title: lesson.title.trim(),
          content,
          durationMinutes: lesson.durationMinutes || 10,
        });
      }

      if (includeQuiz) {
        setBuildStatus("Membuat kuis akhir...");
        try {
          const quiz = await generateQuizCall({
            courseTitle: outline.title,
            context: lessonTexts.join("\n\n"),
            questionCount: 5,
          });
          if (quiz.questions.length > 0) {
            await upsertQuiz({
              courseId,
              title: quiz.title,
              description: quiz.description,
              passingScore: 70,
              questions: quiz.questions.map((q, qi) => ({
                id: `q${qi}`,
                text: q.text,
                options: q.options.map((opt, oi) => ({
                  id: `o${qi}_${oi}`,
                  text: opt,
                })),
                correctOptionId: `o${qi}_${q.correctIndex}`,
                explanation: q.explanation || undefined,
              })),
            });
          }
        } catch {
          // non-blocking
        }
      }

      toast.success("Kelas AI berhasil dibuat. Anda dapat mempublikasikannya.");
      setOpen(false);
      resetAll();
      navigate(`/training/${courseId}`);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : err instanceof Error
            ? err.message
            : "Gagal menyimpan";
      toast.error(msg);
      setStep("review");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (generating || creating)) return;
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-purple-500" />
            AI Course Builder
          </DialogTitle>
          <DialogDescription>
            Masukkan topik, AI akan menyusun outline, isi pelajaran, dan kuis
            otomatis.
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ai-topic">Topik pelatihan</Label>
              <Input
                id="ai-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Keamanan siber untuk karyawan non-IT"
                maxLength={200}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-audience">Target peserta</Label>
                <Input
                  id="ai-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Contoh: staf keuangan"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-lessons">Jumlah pelajaran</Label>
                <Input
                  id="ai-lessons"
                  type="number"
                  min={3}
                  max={10}
                  value={lessonCount}
                  onChange={(e) => setLessonCount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={generateLessonContent}
                  onChange={(e) => setGenerateLessonContent(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="font-medium">Tulis isi materi setiap pelajaran</p>
                  <p className="text-xs text-muted-foreground">
                    AI akan menulis materi dalam format Markdown (~400-700
                    kata). Perlu beberapa detik per pelajaran.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={includeQuiz}
                  onChange={(e) => setIncludeQuiz(e.target.checked)}
                  className="mt-0.5 cursor-pointer"
                />
                <div>
                  <p className="font-medium">Buat kuis akhir otomatis</p>
                  <p className="text-xs text-muted-foreground">
                    5 soal pilihan ganda dengan nilai kelulusan 70%.
                  </p>
                </div>
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                className="cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="cursor-pointer gap-1"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyusun outline...
                  </>
                ) : (
                  <>
                    <Wand2 className="size-4" /> Generate outline
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "review" && outline ? (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Judul kelas</Label>
              <Input
                value={outline.title}
                onChange={(e) =>
                  setOutline({ ...outline, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={outline.description}
                onChange={(e) =>
                  setOutline({ ...outline, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select
                  value={outline.category}
                  onValueChange={(v) => setOutline({ ...outline, category: v })}
                >
                  <SelectTrigger className="w-full cursor-pointer">
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
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select
                  value={outline.level}
                  onValueChange={(v) => setOutline({ ...outline, level: v })}
                >
                  <SelectTrigger className="w-full cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Daftar pelajaran</Label>
              {outline.lessons.map((lesson, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <Input
                      value={lesson.title}
                      onChange={(e) =>
                        updateLesson(i, { title: e.target.value })
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={lesson.durationMinutes}
                      onChange={(e) =>
                        updateLesson(i, {
                          durationMinutes: Number(e.target.value) || 10,
                        })
                      }
                      className="w-20"
                      min={5}
                      max={120}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLesson(i)}
                      className="cursor-pointer text-destructive"
                    >
                      Hapus
                    </Button>
                  </div>
                  <Textarea
                    value={lesson.summary}
                    onChange={(e) =>
                      updateLesson(i, { summary: e.target.value })
                    }
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setStep("input")}
                className="cursor-pointer"
              >
                Kembali
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="cursor-pointer gap-1"
              >
                <CheckCircle2 className="size-4" />
                Buat kelas
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {step === "building" ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <Spinner />
            <p className="text-sm text-muted-foreground">{buildStatus}</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
