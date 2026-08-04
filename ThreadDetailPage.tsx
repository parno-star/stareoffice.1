import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { ArrowLeft, Send, Trash2, MessageCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { getCategoryConfig, getInitials } from "./_lib/forum-utils.ts";
import { cn } from "@/lib/utils.ts";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";

function AuthorBlock({
  name,
  avatar,
  subtitle,
}: {
  name: string | null;
  avatar: string | null;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-9">
        {avatar ? <AvatarImage src={avatar} alt={name ?? ""} /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">
          {name ?? "Tidak diketahui"}
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export default function ThreadDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [replyContent, setReplyContent] = useState("");
  const [posting, setPosting] = useState(false);

  const id = threadId as Id<"forumThreads">;
  const thread = useQuery(api.forum.getThread, { threadId: id });
  const replies = useQuery(api.forum.listReplies, { threadId: id });
  const currentUser = useQuery(api.users.getCurrentUser, {});

  const createReply = useMutation(api.forum.createReply);
  const removeThread = useMutation(api.forum.removeThread);
  const removeReply = useMutation(api.forum.removeReply);

  if (thread === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (thread === null) {
    return (
      <div className="mx-auto max-w-3xl p-4 lg:p-6">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia variant="icon">
              <MessageCircle />
            </ErrorStateMedia>
            <ErrorStateTitle>Diskusi tidak ditemukan</ErrorStateTitle>
            <ErrorStateDescription>
              Diskusi ini mungkin sudah dihapus atau tidak tersedia.
            </ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button size="sm" onClick={() => navigate("/forum")}>
              Kembali ke Forum
            </Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }

  const cfg = getCategoryConfig(thread.category);
  const CategoryIcon = cfg.icon;
  const canDeleteThread =
    currentUser != null &&
    (currentUser._id === thread.authorId || currentUser.role === "admin");

  const handleReply = async () => {
    const content = replyContent.trim();
    if (content.length === 0) {
      toast.error("Balasan tidak boleh kosong");
      return;
    }
    setPosting(true);
    try {
      await createReply({ threadId: id, content });
      setReplyContent("");
      toast.success("Balasan berhasil diposting");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memposting balasan");
      } else {
        toast.error("Gagal memposting balasan");
      }
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteThread = async () => {
    try {
      await removeThread({ threadId: id });
      toast.success("Diskusi dihapus");
      navigate("/forum");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus diskusi");
      } else {
        toast.error("Gagal menghapus diskusi");
      }
    }
  };

  const handleDeleteReply = async (replyId: Id<"forumReplies">) => {
    try {
      await removeReply({ replyId });
      toast.success("Balasan dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus balasan");
      } else {
        toast.error("Gagal menghapus balasan");
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/forum")}
        className="cursor-pointer gap-2 -ml-2"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Forum
      </Button>

      {/* Main thread */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Badge
                variant="outline"
                className={cn("gap-1 text-xs", cfg.badge)}
              >
                <CategoryIcon className="size-3" />
                {cfg.label}
              </Badge>
              <h1 className="text-xl font-bold leading-snug sm:text-2xl">
                {thread.title}
              </h1>
            </div>
            {canDeleteThread ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus diskusi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Semua balasan akan ikut dihapus. Tindakan ini tidak dapat
                      dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void handleDeleteThread();
                      }}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>

          <AuthorBlock
            name={thread.authorName}
            avatar={thread.authorAvatar}
            subtitle={format(
              new Date(thread._creationTime),
              "d MMM yyyy, HH:mm",
              { locale: idLocale },
            )}
          />

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {thread.content}
          </div>

          <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <MessageCircle className="size-3.5" />
            {thread.replyCount} balasan
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Balasan
        </h2>
        {replies === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : replies.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle />
              </EmptyMedia>
              <EmptyTitle>Belum ada balasan</EmptyTitle>
              <EmptyDescription>
                Jadilah yang pertama menanggapi diskusi ini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          replies.map((reply) => {
            const canDelete =
              currentUser != null &&
              (currentUser._id === reply.authorId ||
                currentUser.role === "admin");
            const timeAgo = formatDistanceToNow(
              new Date(reply._creationTime),
              { addSuffix: true, locale: idLocale },
            );
            return (
              <Card key={reply._id}>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <AuthorBlock
                      name={reply.authorName}
                      avatar={reply.authorAvatar}
                      subtitle={timeAgo}
                    />
                    {canDelete ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="cursor-pointer text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus balasan?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.preventDefault();
                                void handleDeleteReply(reply._id);
                              }}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {reply.content}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Reply form */}
      <Card>
        <CardContent className="space-y-3">
          <label className="text-sm font-semibold">Tulis Balasan</label>
          <Textarea
            rows={4}
            placeholder="Tambahkan tanggapan atau masukan Anda..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            disabled={posting}
            maxLength={3000}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {replyContent.length}/3000
            </p>
            <Button
              onClick={handleReply}
              disabled={posting || replyContent.trim().length === 0}
              className="cursor-pointer gap-2"
            >
              <Send className="size-4" />
              {posting ? "Memposting..." : "Kirim Balasan"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
