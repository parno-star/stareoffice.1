import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Sparkles, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

const SKILL_CATEGORIES: Record<string, { label: string; color: string }> = {
  technical: {
    label: "Teknis",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  soft: {
    label: "Soft Skill",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  language: {
    label: "Bahasa",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  certification: {
    label: "Sertifikasi",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  tool: {
    label: "Tools",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

function LevelDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3",
            n <= level ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}

export default function SkillsDialog({
  employee,
  currentUserId,
  isAdmin,
  open,
  onOpenChange,
}: {
  employee: Doc<"users"> | null;
  currentUserId: Id<"users"> | null;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const skills = useQuery(
    api.orgAdvanced.skills.listForUser,
    employee ? { userId: employee._id } : "skip",
  );
  const addSkill = useMutation(api.orgAdvanced.skills.addSkill);
  const removeSkill = useMutation(api.orgAdvanced.skills.removeSkill);

  const [skill, setSkill] = useState("");
  const [category, setCategory] = useState<string>("technical");
  const [level, setLevel] = useState<number>(3);
  const [years, setYears] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!employee) return null;

  const canEdit = isAdmin || employee._id === currentUserId;

  const handleAdd = async () => {
    if (!skill.trim()) return;
    setSaving(true);
    try {
      await addSkill({
        userId: employee._id,
        skill: skill.trim(),
        category,
        level,
        yearsExperience: years ? Number(years) : undefined,
        note: note.trim() || undefined,
      });
      toast.success("Keahlian ditambahkan");
      setSkill("");
      setNote("");
      setYears("");
      setLevel(3);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menambahkan");
      } else {
        toast.error("Gagal menambahkan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: Id<"employeeSkills">) => {
    await removeSkill({ skillId: id });
    toast.success("Keahlian dihapus");
  };

  // Group by category
  const grouped = new Map<string, Array<Doc<"employeeSkills">>>();
  for (const s of skills ?? []) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Matriks Keahlian
          </DialogTitle>
          <DialogDescription>
            Daftar kompetensi & level untuk{" "}
            <span className="font-medium text-foreground">{employee.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {!skills ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-full rounded-lg border bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : skills.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Belum ada keahlian tercatat
            </div>
          ) : (
            Array.from(grouped.entries()).map(([cat, items]) => {
              const catMeta = SKILL_CATEGORIES[cat] ?? {
                label: cat,
                color: "bg-muted text-muted-foreground",
              };
              return (
                <div key={cat} className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {catMeta.label}
                  </p>
                  {items.map((s) => (
                    <div
                      key={s._id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-2.5"
                    >
                      <Badge className={cn("shrink-0 text-[10px]", catMeta.color)}>
                        {catMeta.label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.skill}</p>
                        {s.note ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {s.note}
                          </p>
                        ) : null}
                        {s.yearsExperience ? (
                          <p className="text-[10px] text-muted-foreground">
                            {s.yearsExperience} thn pengalaman
                          </p>
                        ) : null}
                      </div>
                      <LevelDots level={s.level} />
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => handleRemove(s._id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {canEdit ? (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium">Tambah Keahlian</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Keahlian</Label>
                <Input
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="React, Figma, Manajemen..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SKILL_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Level (1-5)</Label>
                <Select
                  value={String(level)}
                  onValueChange={(v) => setLevel(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Level {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tahun Pengalaman (opsional)</Label>
                <Input
                  type="number"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={!skill.trim() || saving}
              size="sm"
              className="w-full gap-1.5"
            >
              <Plus className="size-4" />
              Tambahkan
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
