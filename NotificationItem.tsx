import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { NotificationWithActor } from "@/convex/notifications";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Trash2 } from "lucide-react";
import {
  getNotificationMeta,
  formatRelative,
} from "../_lib/notifications-utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  notification: NotificationWithActor;
  onAfterClick?: () => void;
  compact?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: Id<"notifications">) => void;
};

export default function NotificationItem({
  notification,
  onAfterClick,
  compact = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const navigate = useNavigate();
  const markRead = useMutation(api.notifications.markRead);
  const remove = useMutation(api.notifications.remove);

  const meta = getNotificationMeta(notification.type);
  const Icon = meta.icon;
  const isUnread = !notification.readAt;

  const handleClick = async () => {
    if (isUnread) {
      try {
        await markRead({ id: notification._id });
      } catch {
        // no-op; reading should be best-effort
      }
    }
    if (notification.link) {
      navigate(notification.link);
    }
    onAfterClick?.();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await remove({ id: notification._id });
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menghapus notifikasi");
      }
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-1 rounded-lg",
        selected && "bg-primary/10",
      )}
    >
      {selectable ? (
        <div className="pt-4 pl-2">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(notification._id)}
            aria-label="Pilih notifikasi"
            className="cursor-pointer"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "group relative flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
          "hover:bg-accent/60",
          isUnread && "bg-primary/5",
        )}
      >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          meta.bg,
        )}
      >
        <Icon className={cn("size-4.5", meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              "line-clamp-1 text-sm",
              isUnread ? "font-semibold" : "font-medium",
            )}
          >
            {notification.title}
          </p>
          {isUnread && (
            <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p
          className={cn(
            "text-muted-foreground mt-0.5 text-sm",
            compact ? "line-clamp-2" : "line-clamp-3",
          )}
        >
          {notification.message}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {formatRelative(notification._creationTime)}
          </span>
          {notification.actorName && (
            <span className="text-muted-foreground max-w-[60%] truncate text-xs">
              oleh {notification.actorName}
            </span>
          )}
        </div>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={handleDelete}
        aria-label="Hapus notifikasi"
        className="opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </Button>
      </button>
    </div>
  );
}
