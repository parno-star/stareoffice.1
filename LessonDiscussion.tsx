import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export default function LessonDiscussion({
  lessonId,
}: {
  lessonId: Id<"courseLessons">;
}) {
  const comments = useQuery(api.training.engagement.listComments, { lessonId });
  const me = useQuery(api.users.getCurrentUser, {});
  const add = useMutation(api.training.engagement.addComment);
  const remove = useMutation(api.training.engagement.removeComment);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      await add({ lessonId, content: trimmed });
      setContent("");
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

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">
        Diskusi pelajaran{" "}
        <span className="text-muted-foreground">
          ({comments?.length ?? 0})
        </span>
      </p>
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Tanyakan sesuatu atau bagikan catatan..."
        />
        <Button
          onClick={handleSubmit}
          disabled={submitting || content.trim().length === 0}
          className="cursor-pointer self-end"
        >
          <Send className="size-4" />
        </Button>
      </div>
      {comments === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
          Belum ada diskusi. Mulai percakapan!
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c._id}
              className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                {c.authorAvatar ? (
                  <img
                    src={c.authorAvatar}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  (c.authorName ?? "?").slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium">
                    {c.authorName ?? "Karyawan"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c._creationTime), {
                      addSuffix: true,
                      locale: idLocale,
                    })}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {c.content}
                </p>
              </div>
              {me?._id === c.authorId ||
              me?.role === "admin" ||
              me?.role === "super_admin" ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    remove({ id: c._id }).catch(() =>
                      toast.error("Gagal menghapus"),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
