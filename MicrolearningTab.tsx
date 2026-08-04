import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Clock,
  Layers,
  Lightbulb,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_OPTIONS,
  getColorConfig,
} from "../_lib/training-utils.ts";
import { cn } from "@/lib/utils.ts";
import MicrolessonFormDialog from "./MicrolessonFormDialog.tsx";
import MicrolessonViewDialog from "./MicrolessonViewDialog.tsx";

export default function MicrolearningTab({ isAdmin }: { isAdmin: boolean }) {
  const [category, setCategory] = useState("all");
  const [viewingId, setViewingId] = useState<Id<"microlessons"> | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const lessons = useQuery(api.training.microlessons.listMicrolessons, {
    category,
    onlyPublished: !isAdmin,
  });
  const stats = useQuery(api.training.microlessons.getMicrolearningStats, {});
  const deleteLesson = useMutation(
    api.training.microlessons.deleteMicrolesson,
  );

  const openLesson = (id: Id<"microlessons">) => {
    setViewingId(id);
    setViewOpen(true);
  };

  const handleDelete = async (id: Id<"microlessons">) => {
    if (!window.confirm("Hapus microlesson ini?")) return;
    try {
      await deleteLesson({ id });
      toast.success("Microlesson dihapus");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menghapus")
          : "Gagal menghapus";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total microlesson
            </p>
            <p className="mt-0.5 text-2xl font-bold">
              {stats?.totalLessons ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Sudah Anda selesaikan
            </p>
            <p className="mt-0.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats?.myCompletions ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Menit dipelajari
            </p>
            <p className="mt-0.5 text-2xl font-bold">{stats?.myMinutes ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Total menit tersedia
            </p>
            <p className="mt-0.5 text-2xl font-bold">
              {stats?.totalMinutes ?? "-"}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full cursor-pointer sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin ? (
          <MicrolessonFormDialog
            trigger={
              <Button size="sm" className="cursor-pointer gap-1">
                <Plus className="size-4" /> Microlesson baru
              </Button>
            }
          />
        ) : null}
      </div>

      {lessons === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lightbulb />
            </EmptyMedia>
            <EmptyTitle>Belum ada microlesson</EmptyTitle>
            <EmptyDescription>
              Microlesson adalah pelajaran singkat 1-15 menit yang mudah
              dikonsumsi.
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin ? (
            <EmptyContent>
              <MicrolessonFormDialog
                trigger={
                  <Button size="sm" className="cursor-pointer gap-1">
                    <Plus className="size-4" /> Buat microlesson
                  </Button>
                }
              />
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((m) => (
            <div
              key={m._id}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => openLesson(m._id)}
                className={cn(
                  "relative flex items-center gap-3 p-4 text-left text-white",
                  getColorConfig(m.coverColor).cover,
                )}
              >
                <span className="text-3xl">{m.icon ?? "💡"}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold">{m.title}</p>
                  <p className="mt-0.5 text-xs text-white/85">
                    {m.durationMinutes} menit
                  </p>
                </div>
                {m.completedByMe ? (
                  <CheckCircle2 className="size-5 shrink-0 text-white" />
                ) : null}
                {!m.isPublished ? (
                  <span className="absolute right-2 top-2 rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium">
                    Draft
                  </span>
                ) : null}
              </button>
              <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
                <p className="line-clamp-2 text-muted-foreground">
                  {m.summary}
                </p>
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {m.durationMinutes}m
                  </span>
                  <div className="flex items-center gap-1">
                    {m.deckId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        <Layers className="size-3" /> deck
                      </span>
                    ) : null}
                    {isAdmin ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <MicrolessonFormDialog
                            mode="edit"
                            initialValues={{
                              id: m._id,
                              title: m.title,
                              summary: m.summary,
                              content: m.content,
                              category: m.category,
                              durationMinutes: m.durationMinutes,
                              coverColor: m.coverColor,
                              icon: m.icon,
                              deckId: m.deckId,
                              isPublished: m.isPublished,
                            }}
                            trigger={
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="cursor-pointer gap-2"
                              >
                                <Pencil className="size-4" /> Ubah
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem
                            onClick={() => {
                              void handleDelete(m._id);
                            }}
                            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <MicrolessonViewDialog
        id={viewingId}
        open={viewOpen}
        onOpenChange={(next) => {
          setViewOpen(next);
          if (!next) setViewingId(null);
        }}
      />
    </div>
  );
}
