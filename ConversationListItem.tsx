import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import {
  formatPreviewTime,
  getInitials,
} from "@/pages/messages/_lib/messages-utils.ts";
import type { ConversationPreview } from "@/pages/messages/_lib/types.ts";

export default function ConversationListItem({
  item,
  active,
  isMine,
  onClick,
}: {
  item: ConversationPreview;
  active: boolean;
  isMine: boolean;
  onClick: () => void;
}) {
  const { otherUser, lastMessagePreview, lastMessageAt, unreadCount } = item;
  const hasMessages = Boolean(lastMessagePreview);
  const preview = hasMessages
    ? `${isMine ? "Anda: " : ""}${lastMessagePreview}`
    : "Belum ada pesan";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted",
      )}
    >
      <Avatar className="size-11 shrink-0">
        {otherUser.avatarUrl ? (
          <AvatarImage src={otherUser.avatarUrl} alt={otherUser.name ?? ""} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
          {getInitials(otherUser.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm",
              unreadCount > 0 ? "font-semibold" : "font-medium",
            )}
          >
            {otherUser.name ?? "Tanpa nama"}
          </p>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            {hasMessages ? formatPreviewTime(lastMessageAt) : ""}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={cn(
              "truncate text-xs",
              unreadCount > 0
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {preview}
          </p>
          {unreadCount > 0 ? (
            <Badge className="ml-auto h-5 shrink-0 px-1.5 text-[10px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}
