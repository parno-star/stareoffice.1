import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Plus, X, Check, GraduationCap } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { formatIdr } from "../_lib/career-utils.ts";

const skillSchema = z.object({
  skill: z.string().min(1),
  level: z.number().min(1).max(5),
});

const schema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter"),
  summary: z.string().min(5, "Ringkasan minimal 5 karakter"),
  description: z.string().optional(),
  targetJobTitle: z.string().optional(),
  targetGrade: z.string().optional(),
  estimatedMonths: z.string().optional(),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  minPerformanceRating: z.string().optional(),
  minReviewPeriods: z.string().optional(),
  extraRequirements: z.string().optional(),
  requiredCourseIds: z.array(z.string()),
  requiredSkills: z.array(skillSchema),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  pathId: Id<"careerPaths">;
  level?: Doc<"careerPathLevels">;
  trigger?: React.ReactNode;
};

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function LevelFormDialog({ pathId, level, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [skillLevel, setSkillLevel] = useState(3);
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);

  const createLevel = useMutation(api.careerPath.createLevel);
  const updateLevel = useMutation(api.careerPath.updateLevel);
  const courses = useQuery(api.courses.listCourses, {
    filter: "published",
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: level?.title ?? "",
      summary: level?.summary ?? "",
      description: level?.description ?? "",
      targetJobTitle: level?.targetJobTitle ?? "",
      targetGrade: level?.targetGrade ?? "",
      estimatedMonths:
        level?.estimatedMonths !== undefined
          ? String(level.estimatedMonths)
          : "",
      salaryMin:
        level?.salaryMin !== undefined ? String(level.salaryMin) : "",
      salaryMax:
        level?.salaryMax !== undefined ? String(level.salaryMax) : "",
      minPerformanceRating:
        level?.minPerformanceRating !== undefined
          ? String(level.minPerformanceRating)
          : "",
      minReviewPeriods:
        level?.minReviewPeriods !== undefined
          ? String(level.minReviewPeriods)
          : "",
      extraRequirements: level?.extraRequirements ?? "",
      requiredCourseIds: (level?.requiredCourseIds ?? []).map((id) => id),
      requiredSkills: level?.requiredSkills ?? [],
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        title: values.title,
        summary: values.summary,
        description: values.description?.trim() || undefined,
        targetJobTitle: values.targetJobTitle?.trim() || undefined,
        targetGrade: values.targetGrade?.trim() || undefined,
        estimatedMonths: parseNumber(values.estimatedMonths),
        salaryMin: parseNumber(values.salaryMin),
        salaryMax: parseNumber(values.salaryMax),
        minPerformanceRating: parseNumber(values.minPerformanceRating),
        minReviewPeriods: parseNumber(values.minReviewPeriods),
        extraRequirements: values.extraRequirements?.trim() || undefined,
        requiredCourseIds: values.requiredCourseIds as Array<Id<"courses">>,
        requiredSkills: values.requiredSkills,
      };
      if (level) {
        await updateLevel({ levelId: level._id, ...payload });
        toast.success("Level diperbarui");
      } else {
        await createLevel({ pathId, ...payload });
        toast.success("Level ditambahkan");
      }
      setOpen(false);
      if (!level) form.reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan level");
      } else {
        toast.error("Gagal menyimpan level");
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCourseIds = form.watch("requiredCourseIds");
  const selectedSkills = form.watch("requiredSkills");

  const toggleCourse = (courseId: string) => {
    const current = form.getValues("requiredCourseIds");
    if (current.includes(courseId)) {
      form.setValue(
        "requiredCourseIds",
        current.filter((c) => c !== courseId),
      );
    } else {
      form.setValue("requiredCourseIds", [...current, courseId]);
    }
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    const current = form.getValues("requiredSkills");
    if (current.some((s) => s.skill.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Skill sudah ada");
      return;
    }
    form.setValue("requiredSkills", [
      ...current,
      { skill: trimmed, level: skillLevel },
    ]);
    setSkillInput("");
    setSkillLevel(3);
  };

  const removeSkill = (skill: string) => {
    const current = form.getValues("requiredSkills");
    form.setValue(
      "requiredSkills",
      current.filter((s) => s.skill !== skill),
    );
  };

  const selectedCoursesList = (courses ?? []).filter((c) =>
    selectedCourseIds.includes(c._id),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="size-4" />
            Level Baru
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{level ? "Edit Level" : "Tambah Level"}</DialogTitle>
          <DialogDescription>
            Tentukan persyaratan level: training wajib, KPI performa, skill, dan
            target jabatan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Judul Level</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Senior" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetJobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jabatan Target</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Software Engineer II"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ringkasan</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Deskripsi singkat peran di level ini..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detail (Opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Kompetensi, tanggung jawab, ekspektasi..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="targetGrade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade (Opsional)</FormLabel>
                    <FormControl>
                      <Input placeholder="G10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimasi (Bulan)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="12"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minPerformanceRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. Rating KPI</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        max={5}
                        placeholder="3.5"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="minReviewPeriods"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. Periode Review</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salaryMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gaji Min (IDR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="8000000"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salaryMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gaji Max (IDR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="15000000"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.watch("salaryMin") && form.watch("salaryMax") ? (
              <p className="text-xs text-muted-foreground">
                Rentang gaji:{" "}
                {formatIdr(parseNumber(form.watch("salaryMin")) ?? null)} -{" "}
                {formatIdr(parseNumber(form.watch("salaryMax")) ?? null)}
              </p>
            ) : null}

            {/* Required courses */}
            <div className="space-y-2">
              <FormLabel>Training Wajib</FormLabel>
              <Popover
                open={courseDropdownOpen}
                onOpenChange={setCourseDropdownOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-start gap-2"
                  >
                    <GraduationCap className="size-4" />
                    {selectedCourseIds.length === 0
                      ? "Pilih training..."
                      : `${selectedCourseIds.length} training dipilih`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0"
                  align="start"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <Command>
                    <CommandInput placeholder="Cari training..." />
                    <CommandList>
                      <CommandEmpty>Tidak ada training ditemukan</CommandEmpty>
                      <CommandGroup>
                        {(courses ?? []).map((c) => {
                          const selected = selectedCourseIds.includes(c._id);
                          return (
                            <CommandItem
                              key={c._id}
                              value={c.title}
                              onSelect={() => toggleCourse(c._id)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={
                                  selected
                                    ? "mr-2 size-4 opacity-100"
                                    : "mr-2 size-4 opacity-0"
                                }
                              />
                              <span className="flex-1 truncate">
                                {c.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {c.durationMinutes} menit
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedCoursesList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCoursesList.map((c) => (
                    <Badge
                      key={c._id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      <GraduationCap className="size-3" />
                      {c.title}
                      <button
                        type="button"
                        onClick={() => toggleCourse(c._id)}
                        className="ml-1 cursor-pointer rounded-sm p-0.5 hover:bg-background/50"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <FormLabel>Skill yang Dibutuhkan</FormLabel>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="Contoh: React"
                  className="flex-1 min-w-[160px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(Number(e.target.value) || 3)}
                  className="w-20"
                />
                <Button type="button" onClick={addSkill} variant="secondary">
                  Tambah
                </Button>
              </div>
              {selectedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.map((s) => (
                    <Badge
                      key={s.skill}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {s.skill} · L{s.level}
                      <button
                        type="button"
                        onClick={() => removeSkill(s.skill)}
                        className="ml-1 cursor-pointer rounded-sm p-0.5 hover:bg-background/50"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="extraRequirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persyaratan Tambahan (Opsional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Misal: 3 tahun pengalaman, sertifikasi AWS, dll."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : level ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
