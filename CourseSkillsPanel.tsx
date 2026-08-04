import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import { SKILL_CATEGORY_LABEL } from "../_lib/advanced-utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type Props = {
  courseId: Id<"courses">;
  isAdmin: boolean;
};

export default function CourseSkillsPanel({ courseId, isAdmin }: Props) {
  const skills = useQuery(api.training.skills.listCourseSkills, { courseId });
  const addSkill = useMutation(api.training.skills.addCourseSkill);
  const removeSkill = useMutation(api.training.skills.removeCourseSkill);
  const [skill, setSkill] = useState("");
  const [category, setCategory] = useState("technical");
  const [level, setLevel] = useState(3);

  const handleAdd = async () => {
    if (!skill.trim()) return;
    try {
      await addSkill({ courseId, skill: skill.trim(), category, level });
      toast.success("Keahlian ditambahkan");
      setSkill("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleRemove = async (id: Id<"courseSkills">) => {
    try {
      await removeSkill({ id });
      toast.success("Dihapus");
    } catch {
      toast.error("Gagal");
    }
  };

  if (skills === undefined) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Keahlian yang Didapat</h3>
        <p className="text-xs text-muted-foreground">
          Peserta mendapatkan keahlian ini setelah menyelesaikan kelas.
        </p>
      </div>
      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada keahlian dipetakan.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <li
              key={s._id}
              className="group inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs"
            >
              <BadgeCheck className="size-3 text-emerald-600" />
              <span className="font-medium">{s.skill}</span>
              <span className="text-muted-foreground">
                · {SKILL_CATEGORY_LABEL[s.category] ?? s.category} · Lv{s.level}
              </span>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleRemove(s._id)}
                  className="ml-1 cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {isAdmin ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_100px_auto]">
          <Input
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="Nama keahlian"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SKILL_CATEGORY_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(level)}
            onValueChange={(v) => setLevel(Number(v))}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Lv {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!skill.trim()}
            className="cursor-pointer gap-1"
          >
            <Plus className="size-4" /> Tambah
          </Button>
        </div>
      ) : null}
    </div>
  );
}
