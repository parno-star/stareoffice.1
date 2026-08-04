import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Eye, Pencil } from "lucide-react";
import type { ArticlePreview } from "@/pages/wiki/_lib/types.ts";
import {
  formatRelativeTime,
  getInitials,
  getSpaceColorClasses,
} from "@/pages/wiki/_lib/wiki-utils.ts";

export default function ArticleCard({
  article,
  onClick,
  showSpace = true,
}: {
  article: ArticlePreview;
  onClick: () => void;
  showSpace?: boolean;
}) {
  const colors = getSpaceColorClasses(article.spaceColor);
  const isDraft = article.status === "draft";
  return (
    <button onClick={onClick} className="text-left">
      <Card className="h-full cursor-pointer transition-all hover:border-primary/40 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3">
          {showSpace && article.spaceName ? (
            <div className="flex items-center gap-2">
              <div
                className={`flex size-7 items-center justify-center rounded-md text-sm ${colors.tile}`}
              >
                {article.spaceIcon}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {article.spaceName}
              </span>
              {isDraft ? (
                <Badge variant="secondary" className="ml-auto gap-1 text-[10px]">
                  <Pencil className="size-3" />
                  Draft
                </Badge>
              ) : null}
            </div>
          ) : isDraft ? (
            <Badge variant="secondary" className="w-fit gap-1 text-[10px]">
              <Pencil className="size-3" />
              Draft
            </Badge>
          ) : null}

          <h3 className="line-clamp-2 text-base font-semibold leading-snug">
            {article.title}
          </h3>

          {article.summary ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {article.summary}
            </p>
          ) : null}

          {article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {article.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  #{tag}
                </Badge>
              ))}
              {article.tags.length > 4 ? (
                <span className="text-[10px] text-muted-foreground">
                  +{article.tags.length - 4}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-6 shrink-0">
                {article.authorAvatar ? (
                  <AvatarImage
                    src={article.authorAvatar}
                    alt={article.authorName ?? ""}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                  {getInitials(article.authorName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {article.authorName ?? "Anon"} ·{" "}
                {formatRelativeTime(article.lastEditedAt)}
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <Eye className="size-3" />
              {article.viewCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
