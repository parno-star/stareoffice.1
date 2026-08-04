import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { CheckCircle2, Lock, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

type Props = {
  courseId: Id<"courses">;
  isAdmin: boolean;
};

export default function PrereqsPanel({ courseId, isAdmin }: Props) {
  const prereqs = useQuery(api.training.prerequisites.listForCourse, {
    courseId,
  });
  const allCourses = useQuery(
    api.courses.listCourses,
    isAdmin ? { filter: "all" } : "skip",
  );
  const addPrereq = useMutation(
    api.training.prerequisites.addPrerequisite,
  );
  const removePrereq = useMutation(
    api.training.prerequisites.removePrerequisite,
  );
  const [selectedCourse, setSelectedCourse] = useState<string>("");

  const handleAdd = async () => {
    if (!selectedCourse) return;
    try {
      await addPrereq({
        courseId,
        prerequisiteId: selectedCourse as Id<"courses">,
      });
      toast.success("Prasyarat ditambahkan");
      setSelectedCourse("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleRemove = async (id: Id<"coursePrerequisites">) => {
    try {
      await removePrereq({ id });
      toast.success("Prasyarat dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  if (prereqs === undefined) {
    return <Skeleton className="h-32 w-full" />;
  }

  const existingIds = new Set(prereqs.map((p) => String(p.prerequisiteId)));

  return (
    <div className="space-y-3">
      {prereqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kelas ini tidak memiliki prasyarat.
        </p>
      ) : (
        <ul className="space-y-2">
          {prereqs.map((p) => (
            <li
              key={p._id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                p.completed
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  p.completed
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white",
                )}
              >
                {p.completed ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Lock className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.prerequisiteTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.completed
                    ? "Sudah diselesaikan"
                    : "Selesaikan kelas ini dulu"}
                </p>
              </div>
              {isAdmin ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer text-destructive"
                  onClick={() => handleRemove(p._id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : !p.completed ? (
                <XCircle className="size-4 text-amber-600" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {isAdmin ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={selectedCourse}
            onValueChange={setSelectedCourse}
          >
            <SelectTrigger className="flex-1 cursor-pointer">
              <SelectValue placeholder="Pilih kelas prasyarat..." />
            </SelectTrigger>
            <SelectContent>
              {(allCourses ?? [])
                .filter(
                  (c) =>
                    c._id !== courseId && !existingIds.has(String(c._id)),
                )
                .map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!selectedCourse}
            className="cursor-pointer gap-1"
          >
            <Plus className="size-4" /> Tambah
          </Button>
        </div>
      ) : null}
    </div>
  );
}
