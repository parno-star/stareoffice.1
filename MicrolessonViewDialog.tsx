import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import MarkdownContent from "@/pages/wiki/_components/MarkdownContent.tsx";
import { CheckCircle2, Circle, Clock, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MicrolessonViewDialog({
  id,
  open,
  onOpenChange,
}: {
  id: Id<"microlessons"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const lesson = useQuery(
    api.training.microlessons.getMicrolesson,
    id ? { id } : "skip",
  );
  const markViewed = useMutation(api.training.microlessons.markViewed);
  const toggleCompleted = useMutation(
    api.training.microlessons.toggleCompleted,
  );
  const [toggling, setToggling] = useState(false);
  // Track if we've recorded a view in this dialog open cycle so we don't
  // inflate the counter every re-render.
  const [recordedViewFor, setRecordedViewFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRecordedViewFor(null);
      return;
    }
    if (id && recordedViewFor !== id) {
      setRecordedViewFor(id);
      void markViewed({ id }).catch(() => {
        // Non-blocking: view count is best-effort
      });
    }
  }, [open, id, markViewed, recordedViewFor]);

  const handleToggle = async () => {
    if (!id) return;
    setToggling(true);
    try {
      const res = await toggleCompleted({ id });
      toast.success(
        res.completed
          ? "Microlesson ditandai selesai"
          : "Tanda selesai dibatalkan",
      );
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menyimpan")
          : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setToggling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{lesson?.icon ?? "💡"}</span>
            <span>{lesson?.title ?? "Microlesson"}</span>
          </DialogTitle>
          <DialogDescription>
            {lesson?.summary ?? "Pelajaran singkat"}
          </DialogDescription>
        </DialogHeader>
        {lesson === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : lesson === null ? (
          <p className="text-sm text-muted-foreground">
            Microlesson tidak ditemukan.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {lesson.durationMinutes} menit
              </span>
              {lesson.deck ? (
                <span className="inline-flex items-center gap-1">
                  <Layers className="size-3.5" />
                  Deck: {lesson.deck.title}
                </span>
              ) : null}
            </div>
            {lesson.content.trim().length > 0 ? (
              <MarkdownContent content={lesson.content} />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                (Konten belum diisi)
              </p>
            )}
          </div>
        )}
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row">
          {lesson?.deck ? (
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => {
                onOpenChange(false);
                navigate(`/training/flashcards/${lesson.deck!._id}`);
              }}
            >
              <Layers className="size-4" /> Latihan flashcard
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleToggle}
            disabled={toggling || !lesson}
            className="cursor-pointer gap-1"
          >
            {lesson?.completedByMe ? (
              <>
                <CheckCircle2 className="size-4" /> Batalkan tanda selesai
              </>
            ) : (
              <>
                <Circle className="size-4" /> Tandai selesai
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
