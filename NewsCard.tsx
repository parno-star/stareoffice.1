import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Pin,
  Heart,
  MessageSquare,
  Pencil,
  Trash2,
  MoreVertical,
  FileEdit,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu.tsx";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { EnrichedAnnouncement } from "@/convex/announcements";
import { getCategoryMeta, getPriorityMeta } from "../_lib/news-utils.ts";

type Props = {
  news: EnrichedAnnouncement;
  canManage: boolean;
  canEditOwn: boolean;
  onEdit: (n: EnrichedAnnouncement) => void;
  featured?: boolean;
};

export default function NewsCard({
  news,
  canManage,
  canEditOwn,
  onEdit,
  featured = false,
}: Props) {
  const navigate = useNavigate();
  const toggleLike = useMutation(api.announcements.toggleLike);
  const togglePin = useMutation(api.announcements.togglePin);
  const remove = useMutation(api.announcements.remove);

  const categoryMeta = getCategoryMeta(news.category);
  const priorityMeta = getPriorityMeta(news.priority);
  const CategoryIcon = categoryMeta.icon;
  const PriorityIcon = priorityMeta.icon;

  const isDraft = (news.status ?? "published") === "draft";

  const initial = (news.authorName || "?").trim().charAt(0).toUpperCase();
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(news.publishedAt), {
        addSuffix: true,
        locale: idLocale,
      });
    } catch {
      return "";
    }
  })();

  const handleCardClick = () => {
    navigate(`/news/${news._id}`);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleLike({ id: news._id });
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message?: string };
        toast.error(message ?? "Gagal menyukai berita");
      } else {
        toast.error("Gagal menyukai berita");
      }
    }
  };

  const handlePin = async (e: Event) => {
    e.stopPropagation();
    try {
      await togglePin({ id: news._id });
      toast.success(news.isPinned ? "Sematan dilepas" : "Berita disematkan");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message?: string };
        toast.error(message ?? "Gagal menyematkan");
      }
    }
  };

  const handleEdit = (e: Event) => {
    e.stopPropagation();
    onEdit(news);
  };

  const handleDelete = async (e: Event) => {
    e.stopPropagation();
    if (!window.confirm("Hapus pengumuman ini? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }
    try {
      await remove({ id: news._id });
      toast.success("Pengumuman dihapus");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message?: string };
        toast.error(message ?? "Gagal menghapus");
      }
    }
  };

  const showMenu = canManage || canEditOwn;

  const preview =
    news.summary?.trim() ||
    news.content.slice(0, 220) + (news.content.length > 220 ? "..." : "");

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden pt-0 transition-all hover:shadow-lg",
        featured && "lg:col-span-2",
        news.isPinned && "ring-2 ring-primary/40",
      )}
    >
      {/* Cover */}
      {news.coverImageUrl ? (
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
          <img
            src={news.coverImageUrl}
            alt={news.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
            <Badge className={cn("gap-1 border-0", categoryMeta.chipClass)}>
              <CategoryIcon className="size-3" />
              {categoryMeta.label}
            </Badge>
            {news.priority !== "normal" ? (
              <Badge
                className={cn("gap-1 border-0", priorityMeta.className)}
              >
                <PriorityIcon className="size-3" />
                {priorityMeta.label}
              </Badge>
            ) : null}
            {news.isPinned ? (
              <Badge className="gap-1 border-0 bg-primary/90 text-primary-foreground">
                <Pin className="size-3" />
                Disematkan
              </Badge>
            ) : null}
            {isDraft ? (
              <Badge className="gap-1 border-0 bg-zinc-900/80 text-white">
                <FileEdit className="size-3" />
                Draf
              </Badge>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex h-28 w-full items-center justify-center bg-gradient-to-br px-6",
            categoryMeta.gradient,
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("gap-1 border-0", categoryMeta.chipClass)}>
              <CategoryIcon className="size-3" />
              {categoryMeta.label}
            </Badge>
            {news.priority !== "normal" ? (
              <Badge
                className={cn("gap-1 border-0", priorityMeta.className)}
              >
                <PriorityIcon className="size-3" />
                {priorityMeta.label}
              </Badge>
            ) : null}
            {news.isPinned ? (
              <Badge className="gap-1 border-0 bg-primary/90 text-primary-foreground">
                <Pin className="size-3" />
                Disematkan
              </Badge>
            ) : null}
            {isDraft ? (
              <Badge className="gap-1 border-0 bg-zinc-900/80 text-white">
                <FileEdit className="size-3" />
                Draf
              </Badge>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-3 px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug text-balance">
            {news.title}
          </h3>
          {showMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => e.stopPropagation()}
                  className="-mt-1 shrink-0"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onSelect={handleEdit}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                {canManage ? (
                  <DropdownMenuItem onSelect={handlePin}>
                    <Pin className="mr-2 size-4" />
                    {news.isPinned ? "Lepas sematan" : "Sematkan"}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-line">
          {preview}
        </p>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="size-7">
              {news.authorAvatarUrl ? (
                <AvatarImage src={news.authorAvatarUrl} alt={news.authorName} />
              ) : null}
              <AvatarFallback className="text-xs">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-xs">
              <div className="truncate font-medium text-foreground">
                {news.authorName}
              </div>
              <div className="truncate text-muted-foreground">{timeAgo}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleLike}
              className={cn(
                "h-8 gap-1.5 px-2",
                news.isLikedByMe && "text-red-600 dark:text-red-400",
              )}
            >
              <Heart
                className={cn(
                  "size-4",
                  news.isLikedByMe && "fill-current",
                )}
              />
              <span className="text-xs tabular-nums">{news.likeCount ?? 0}</span>
            </Button>
            <div className="flex items-center gap-1 px-2 text-xs tabular-nums">
              <MessageSquare className="size-4" />
              {news.commentCount ?? 0}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
