import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Link } from "react-router-dom";
import type { ThreadListItem } from "@/convex/forum.ts";
import { getCategoryConfig, getInitials } from "../_lib/forum-utils.ts";
import { cn } from "@/lib/utils.ts";

export default function ThreadCard({ thread }: { thread: ThreadListItem }) {
  const cfg = getCategoryConfig(thread.category);
  const CategoryIcon = cfg.icon;
  const lastActivity = formatDistanceToNow(new Date(thread.lastActivityAt), {
    addSuffix: true,
    locale: idLocale,
  });

  return (
    <Link to={`/forum/${thread._id}`} className="block">
      <Card className="group transition-all hover:border-primary/30 hover:shadow-md">
        <CardContent className="flex items-start gap-4">
          <Avatar className="size-10 shrink-0">
            {thread.authorAvatar ? (
              <AvatarImage
                src={thread.authorAvatar}
                alt={thread.authorName ?? ""}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(thread.authorName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                {thread.title}
              </h3>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 gap-1 text-xs",
                  cfg.badge,
                )}
              >
                <CategoryIcon className="size-3" />
                {cfg.label}
              </Badge>
            </div>

            <p className="line-clamp-2 text-xs text-muted-foreground">
              {thread.content}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {thread.authorName ?? "Tidak diketahui"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {thread.replyCount} balasan
              </span>
              <span>•</span>
              <span>Aktivitas {lastActivity}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
