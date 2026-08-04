import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowBigUp, EyeOff, Trash2, MessageSquareText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { SuggestionListItem } from "@/convex/suggestions.ts";
import {
  getCategoryConfig,
  getStatusConfig,
  getInitials,
} from "../_lib/suggestions-utils.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
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
import { useState } from "react";
import RespondSuggestionDialog from "./RespondSuggestionDialog.tsx";

type Props = {
  suggestion: SuggestionListItem;
  currentUserId: string | null;
  isAdmin: boolean;
};

export default function SuggestionCard({
  suggestion,
  currentUserId,
  isAdmin,
}: Props) {
  const categoryCfg = getCategoryConfig(suggestion.category);
  const statusCfg = getStatusConfig(suggestion.status);
  const CategoryIcon = categoryCfg.icon;
  const StatusIcon = statusCfg.icon;
  const [voting, setVoting] = useState(false);

  const toggleVote = useMutation(api.suggestions.toggleVote);
  const removeSuggestion = useMutation(api.suggestions.removeSuggestion);

  const isOwner = suggestion.authorId === currentUserId;
  const canDelete = isOwner || isAdmin;

  const createdAgo = formatDistanceToNow(new Date(suggestion._creationTime), {
    addSuffix: true,
    locale: idLocale,
  });

  const handleVote = async () => {
    if (voting) return;
    setVoting(true);
    try {
      await toggleVote({ suggestionId: suggestion._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memberikan dukungan");
      } else {
        toast.error("Gagal memberikan dukungan");
      }
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeSuggestion({ suggestionId: suggestion._id });
      toast.success("Saran dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus saran");
      } else {
        toast.error("Gagal menghapus saran");
      }
    }
  };

  // Determine display name: if anonymous & no authorName visible, show Anonymous
  const authorDisplayName =
    suggestion.isAnonymous && !suggestion.authorName
      ? "Anonim"
      : (suggestion.authorName ?? "Tidak diketahui");

  const showAnonymousBadge =
    suggestion.isAnonymous && (isOwner || isAdmin) && suggestion.authorName;

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex items-start gap-4">
        {/* Vote button */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <Button
            size="icon-sm"
            variant={suggestion.hasVoted ? "default" : "ghost"}
            onClick={handleVote}
            disabled={voting}
            className={cn(
              "size-9",
              suggestion.hasVoted && "bg-primary text-primary-foreground",
            )}
            aria-label={suggestion.hasVoted ? "Batalkan dukungan" : "Dukung"}
          >
            <ArrowBigUp
              className={cn(
                "size-5",
                suggestion.hasVoted && "fill-current",
              )}
            />
          </Button>
          <span className="text-sm font-semibold tabular-nums">
            {suggestion.upvoteCount}
          </span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 text-base font-semibold leading-snug">
              {suggestion.title}
            </h3>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("gap-1 text-xs", statusCfg.badge)}
              >
                <StatusIcon className="size-3" />
                {statusCfg.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1 text-xs", categoryCfg.badge)}
              >
                <CategoryIcon className="size-3" />
                {categoryCfg.label}
              </Badge>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {suggestion.content}
          </p>

          {/* Admin response */}
          {suggestion.adminResponse ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
                <MessageSquareText className="size-3.5" />
                Tanggapan Admin
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">
                {suggestion.adminResponse}
              </p>
              {suggestion.respondedAt ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(suggestion.respondedAt), {
                    addSuffix: true,
                    locale: idLocale,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {suggestion.isAnonymous && !suggestion.authorName ? (
                <>
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                    <EyeOff className="size-3" />
                  </div>
                  <span className="font-medium text-foreground/80">Anonim</span>
                </>
              ) : (
                <>
                  <Avatar className="size-6">
                    {suggestion.authorAvatar ? (
                      <AvatarImage
                        src={suggestion.authorAvatar}
                        alt={suggestion.authorName ?? ""}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {getInitials(suggestion.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground/80">
                    {authorDisplayName}
                  </span>
                  {showAnonymousBadge ? (
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                      <EyeOff className="size-2.5" />
                      Anonim
                    </Badge>
                  ) : null}
                </>
              )}
              <span>•</span>
              <span>{createdAgo}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin ? (
                <RespondSuggestionDialog suggestion={suggestion} />
              ) : null}
              {canDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus saran?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini tidak dapat dibatalkan. Saran dan semua
                        dukungan akan dihapus permanen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
