import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { MessageCircle, UserCog } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Link } from "react-router-dom";
import type { TicketListItem } from "@/convex/tickets.ts";
import {
  getCategoryConfig,
  getPriorityConfig,
  getStatusConfig,
  getInitials,
} from "../_lib/support-utils.ts";
import { cn } from "@/lib/utils.ts";

export default function TicketCard({
  ticket,
  showAuthor,
  selectable,
  selected,
  onToggleSelect,
}: {
  ticket: TicketListItem;
  showAuthor?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: TicketListItem["_id"]) => void;
}) {
  const categoryCfg = getCategoryConfig(ticket.category);
  const priorityCfg = getPriorityConfig(ticket.priority);
  const statusCfg = getStatusConfig(ticket.status);
  const CategoryIcon = categoryCfg.icon;
  const PriorityIcon = priorityCfg.icon;
  const StatusIcon = statusCfg.icon;

  const activityAgo = formatDistanceToNow(new Date(ticket.lastActivityAt), {
    addSuffix: true,
    locale: idLocale,
  });

  const cardInner = (
    <Card
      className={cn(
        "group transition-all hover:border-primary/30 hover:shadow-md",
        selected && "border-primary ring-2 ring-primary",
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-semibold leading-snug group-hover:text-primary">
            {ticket.title}
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
              className={cn("gap-1 text-xs", priorityCfg.badge)}
            >
              <PriorityIcon className="size-3" />
              {priorityCfg.label}
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

        <p className="line-clamp-2 text-xs text-muted-foreground">
          {ticket.description}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {showAuthor ? (
            <span className="flex items-center gap-1.5">
              <Avatar className="size-5">
                {ticket.authorAvatar ? (
                  <AvatarImage
                    src={ticket.authorAvatar}
                    alt={ticket.authorName ?? ""}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                  {getInitials(ticket.authorName)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground/80">
                {ticket.authorName ?? "Tidak diketahui"}
              </span>
            </span>
          ) : null}

          {ticket.assigneeName ? (
            <>
              {showAuthor ? <span>•</span> : null}
              <span className="flex items-center gap-1.5">
                <UserCog className="size-3.5" />
                <span>{ticket.assigneeName}</span>
              </span>
            </>
          ) : null}

          {showAuthor || ticket.assigneeName ? <span>•</span> : null}
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" />
            {ticket.commentCount} komentar
          </span>
          <span>•</span>
          <span>{activityAgo}</span>
        </div>
      </CardContent>
    </Card>
  );

  // Selection mode: clicking the row toggles selection instead of navigating.
  if (selectable) {
    return (
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect?.(ticket._id)}
          className="mt-4 shrink-0 cursor-pointer"
          aria-label={`Pilih tiket ${ticket.title}`}
        />
        <button
          type="button"
          onClick={() => onToggleSelect?.(ticket._id)}
          className="min-w-0 flex-1 text-left cursor-pointer"
        >
          {cardInner}
        </button>
      </div>
    );
  }

  return (
    <Link to={`/support/${ticket._id}`} className="block">
      {cardInner}
    </Link>
  );
}
