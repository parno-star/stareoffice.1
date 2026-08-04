import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Heart, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { RecognitionListItem } from "@/convex/recognitions.ts";
import {
  getCategoryConfig,
  getInitials,
} from "../_lib/recognitions-utils.ts";
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

type Props = {
  recognition: RecognitionListItem;
  currentUserId: string | null;
  isAdmin: boolean;
};

export default function RecognitionCard({
  recognition,
  currentUserId,
  isAdmin,
}: Props) {
  const cfg = getCategoryConfig(recognition.category);
  const Icon = cfg.icon;
  const [reacting, setReacting] = useState(false);

  const toggleReaction = useMutation(api.recognitions.toggleReaction);
  const removeRecognition = useMutation(api.recognitions.removeRecognition);

  const isAuthor = recognition.fromUserId === currentUserId;
  const canDelete = isAuthor || isAdmin;

  const createdAgo = formatDistanceToNow(new Date(recognition._creationTime), {
    addSuffix: true,
    locale: idLocale,
  });

  const handleReact = async () => {
    if (reacting) return;
    setReacting(true);
    try {
      await toggleReaction({ recognitionId: recognition._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memberikan reaksi");
      } else {
        toast.error("Gagal memberikan reaksi");
      }
    } finally {
      setReacting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeRecognition({ recognitionId: recognition._id });
      toast.success("Apresiasi dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus apresiasi");
      } else {
        toast.error("Gagal menghapus apresiasi");
      }
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden bg-gradient-to-br transition-all hover:shadow-md",
        cfg.gradient,
      )}
    >
      <CardContent className="space-y-3">
        {/* Header: from -> to */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Avatar className="size-8 ring-2 ring-background">
              {recognition.fromUserAvatar ? (
                <AvatarImage src={recognition.fromUserAvatar} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold">
                {getInitials(recognition.fromUserName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold">
              {recognition.fromUserName ?? "Seseorang"}
            </span>
          </div>
          <span className="text-muted-foreground">mengapresiasi</span>
          <div className="flex items-center gap-2">
            <Avatar className="size-8 ring-2 ring-background">
              {recognition.toUserAvatar ? (
                <AvatarImage src={recognition.toUserAvatar} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold">
                {getInitials(recognition.toUserName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold">
              {recognition.toUserName ?? "Rekan"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="outline" className={cn("gap-1", cfg.badge)}>
              <Icon className="size-3" />
              {cfg.label}
            </Badge>
          </div>
        </div>

        {/* Message */}
        <div className="relative rounded-lg border bg-card/70 p-3 backdrop-blur-sm">
          <Icon
            className={cn(
              "absolute -top-2 -left-2 size-5 rounded-full bg-background p-0.5 ring-1 ring-border",
              cfg.iconColor,
            )}
          />
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {recognition.message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{createdAgo}</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={recognition.hasReacted ? "default" : "ghost"}
              onClick={handleReact}
              disabled={reacting}
              className={cn(
                "h-8 gap-1.5 px-2.5",
                recognition.hasReacted &&
                  "bg-rose-500 text-white hover:bg-rose-600",
              )}
            >
              <Heart
                className={cn(
                  "size-3.5",
                  recognition.hasReacted && "fill-current",
                )}
              />
              <span className="tabular-nums">{recognition.reactionCount}</span>
            </Button>
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
                    <AlertDialogTitle>Hapus apresiasi?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini tidak dapat dibatalkan.
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
      </CardContent>
    </Card>
  );
}
