import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  ArrowLeft,
  Clock,
  Eye,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import { isAdminRole } from "@/convex/roles.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import MarkdownContent from "@/pages/wiki/_components/MarkdownContent.tsx";
import ArticleFormDialog from "@/pages/wiki/_components/ArticleFormDialog.tsx";
import {
  formatFullDate,
  formatRelativeTime,
  getInitials,
  getSpaceColorClasses,
} from "@/pages/wiki/_lib/wiki-utils.ts";
import { toast } from "sonner";

export default function ArticleDetailPage() {
  const params = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const articleId = params.articleId as Id<"wikiArticles">;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const viewedRef = useRef<string | null>(null);

  const article = useQuery(api.wiki.getArticle, { articleId });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const incrementView = useMutation(api.wiki.incrementViewCount);
  const deleteArticle = useMutation(api.wiki.deleteArticle);

  // Track a view only once per article per session
  useEffect(() => {
    if (!article || viewedRef.current === article._id) return;
    viewedRef.current = article._id;
    void incrementView({ articleId: article._id }).catch(() => {
      /* ignore */
    });
  }, [article, incrementView]);

  if (article === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Artikel tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Artikel ini mungkin sudah dihapus.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate("/wiki")}>Kembali ke Wiki</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const canManage =
    currentUser &&
    (currentUser._id === article.authorId || isAdminRole(currentUser.role));
  const colors = getSpaceColorClasses(article.space?.color);
  const isDraft = article.status === "draft";

  const handleDelete = async () => {
    try {
      await deleteArticle({ articleId });
      toast.success("Artikel dihapus");
      navigate(article.space ? `/wiki/space/${article.space._id}` : "/wiki");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal menghapus")
          : "Gagal menghapus";
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(article.space ? `/wiki/space/${article.space._id}` : "/wiki")
          }
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          {article.space ? article.space.name : "Wiki"}
        </Button>
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Opsi artikel">
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ArticleFormDialog
                mode="edit"
                initialValues={{
                  articleId: article._id,
                  spaceId: article.spaceId,
                  title: article.title,
                  summary: article.summary ?? "",
                  content: article.content,
                  tags: article.tags,
                  status: article.status,
                }}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="size-4" />
                    Ubah artikel
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="space-y-4">
        {article.space ? (
          <button
            onClick={() => navigate(`/wiki/space/${article.space!._id}`)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
          >
            <span
              className={`flex size-5 items-center justify-center rounded-md text-xs ${colors.tile}`}
            >
              {article.space.icon}
            </span>
            {article.space.name}
          </button>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
            {article.title}
          </h1>
          {isDraft ? (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Pencil className="size-3" />
              Draft
            </Badge>
          ) : null}
        </div>

        {article.summary ? (
          <p className="text-lg text-muted-foreground">{article.summary}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {article.author ? (
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                {article.author.avatarUrl ? (
                  <AvatarImage
                    src={article.author.avatarUrl}
                    alt={article.author.name ?? ""}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {getInitials(article.author.name)}
                </AvatarFallback>
              </Avatar>
              <span>
                <span className="font-medium text-foreground">
                  {article.author.name ?? "Anon"}
                </span>
                {article.author.jobTitle
                  ? ` · ${article.author.jobTitle}`
                  : ""}
              </span>
            </div>
          ) : null}
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {article.lastEditor && article.lastEditor._id !== article.authorId
              ? `Diedit ${formatRelativeTime(article.lastEditedAt)} oleh ${article.lastEditor.name ?? "Anon"}`
              : `Diperbarui ${formatRelativeTime(article.lastEditedAt)}`}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" />
            {article.viewCount} {article.viewCount === 1 ? "dibaca" : "dibaca"}
          </span>
        </div>

        {article.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {article.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px]">
                #{t}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <Separator />

      <MarkdownContent content={article.content} />

      <Separator />

      <p className="text-xs text-muted-foreground">
        Dipublikasikan {formatFullDate(new Date(article._creationTime).toISOString())}
      </p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus artikel?</AlertDialogTitle>
            <AlertDialogDescription>
              Artikel ini akan dihapus permanen dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void handleDelete();
              }}
            >
              Hapus permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
