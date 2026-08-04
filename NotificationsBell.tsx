import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import NotificationItem from "./NotificationItem.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const unreadCount = useQuery(api.notifications.getUnreadCount, {});
  const notifications = useQuery(
    api.notifications.listMine,
    open ? { limit: 15 } : "skip",
  );
  const markAllRead = useMutation(api.notifications.markAllRead);

  const count = unreadCount ?? 0;
  const hasUnread = count > 0;

  const handleMarkAll = async () => {
    try {
      await markAllRead({});
      toast.success("Semua notifikasi ditandai sudah dibaca");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menandai semua");
      }
    }
  };

  const handleSeeAll = () => {
    setOpen(false);
    navigate("/notifications");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          className="relative cursor-pointer"
          aria-label={
            hasUnread
              ? `Notifikasi (${count} belum dibaca)`
              : "Notifikasi"
          }
        >
          <Bell className="size-5" />
          {hasUnread && (
            <span
              className={cn(
                "absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground",
                "h-4",
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 sm:w-[400px]"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4" />
            <span className="text-sm font-semibold">Notifikasi</span>
            {hasUnread && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {count} baru
              </span>
            )}
          </div>
          {hasUnread && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 cursor-pointer text-xs"
              onClick={handleMarkAll}
            >
              <CheckCheck className="size-3.5" />
              Tandai semua
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {notifications === undefined ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-2 py-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Bell />
                  </EmptyMedia>
                  <EmptyTitle>Belum ada notifikasi</EmptyTitle>
                  <EmptyDescription>
                    Aktivitas terbaru akan muncul di sini
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n._id}
                notification={n}
                compact
                onAfterClick={() => setOpen(false)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer justify-center"
            onClick={handleSeeAll}
          >
            Lihat semua notifikasi
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
