import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog.tsx";
import { Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function CourseReviewsSection({
  courseId,
  isEnrolled,
}: {
  courseId: Id<"courses">;
  isEnrolled: boolean;
}) {
  const reviews = useQuery(api.training.engagement.listReviews, { courseId });
  const myReview = useQuery(api.training.engagement.getMyReview, { courseId });
  const upsert = useMutation(api.training.engagement.upsertReview);
  const remove = useMutation(api.training.engagement.removeReview);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (myReview && !initialized) {
    setRating(myReview.rating);
    setComment(myReview.comment ?? "");
    setInitialized(true);
  }

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error("Pilih bintang terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      await upsert({ courseId, rating, comment: comment.trim() || undefined });
      toast.success("Ulasan disimpan");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    try {
      await remove({ id: myReview._id });
      setRating(0);
      setComment("");
      setInitialized(false);
      toast.success("Ulasan dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="space-y-4">
      {isEnrolled ? (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold">
            {myReview ? "Ulasan Anda" : "Tulis ulasan"}
          </p>
          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const active = (hover || rating) > i;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHover(i + 1)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(i + 1)}
                  className="cursor-pointer"
                >
                  <Star
                    className={cn(
                      "size-6 transition-colors",
                      active
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              );
            })}
          </div>
          <Textarea
            className="mt-3"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Bagikan pengalaman Anda mengikuti kelas ini..."
          />
          <div className="mt-3 flex justify-end gap-2">
            {myReview ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="cursor-pointer text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" /> Hapus
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus ulasan Anda?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ulasan akan dihapus permanen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">
                      Batal
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? "Menyimpan..." : "Kirim ulasan"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-semibold">
          Ulasan peserta{" "}
          <span className="text-muted-foreground">
            ({reviews?.length ?? 0})
          </span>
        </p>
        {reviews === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : reviews.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Belum ada ulasan. Jadilah yang pertama.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li
                key={r._id}
                className="rounded-lg border bg-card p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                      {r.authorAvatar ? (
                        <img
                          src={r.authorAvatar}
                          alt=""
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        (r.authorName ?? "?").slice(0, 1)
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {r.authorName ?? "Karyawan"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r._creationTime), {
                          addSuffix: true,
                          locale: idLocale,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3.5",
                          i < r.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30",
                        )}
                      />
                    ))}
                  </div>
                </div>
                {r.comment ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {r.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
