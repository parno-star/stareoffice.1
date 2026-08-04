import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Authenticated, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Bell, CheckCheck, Trash2, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import NotificationItem from "./_components/NotificationItem.tsx";
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
import BulkActionBar from "@/components/BulkActionBar.tsx";
import { useBulkSelection } from "@/hooks/use-bulk-selection.ts";

function NotificationsPageInner() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const navigate = useNavigate();

  const notifications = useQuery(api.notifications.listMine, {
    filter: tab,
    limit: 100,
  });
  const unreadCount = useQuery(api.notifications.getUnreadCount, {});
  const markAllRead = useMutation(api.notifications.markAllRead);
  const clearAll = useMutation(api.notifications.clearAll);
  const bulkMarkRead = useMutation(api.notifications.bulkMarkRead);
  const bulkRemove = useMutation(api.notifications.bulkRemove);

  const selectableIds = useMemo(
    () => (notifications ?? []).map((n) => n._id),
    [notifications],
  );
  const selection = useBulkSelection(selectableIds);

  const handleMarkAll = async () => {
    try {
      const res = await markAllRead({});
      if (res.count === 0) {
        toast.info("Tidak ada notifikasi yang belum dibaca");
      } else {
        toast.success(`${res.count} notifikasi ditandai sudah dibaca`);
      }
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menandai semua");
      }
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await clearAll({});
      toast.success(`${res.count} notifikasi dihapus`);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menghapus semua");
      }
    }
  };

  const handleBulkMarkRead = async () => {
    try {
      const res = await bulkMarkRead({ ids: selection.selectedIds });
      toast.success(`${res.count} notifikasi ditandai sudah dibaca`);
      selection.clear();
    } catch {
      toast.error("Gagal menandai notifikasi");
    }
  };

  const handleBulkRemove = async () => {
    try {
      const res = await bulkRemove({ ids: selection.selectedIds });
      toast.success(`${res.count} notifikasi dihapus`);
      selection.clear();
    } catch {
      toast.error("Gagal menghapus notifikasi");
    }
  };

  const hasUnread = (unreadCount ?? 0) > 0;
  const hasAny = notifications !== undefined && notifications.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="size-5.5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Pusat Notifikasi
            </h1>
            <p className="text-muted-foreground text-sm">
              Semua aktivitas penting untuk Anda
              {unreadCount !== undefined && unreadCount > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-primary">
                    {unreadCount} belum dibaca
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            onClick={() => navigate("/notification-settings")}
          >
            <Settings className="size-4" />
            Pengaturan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            disabled={!hasUnread}
            onClick={handleMarkAll}
          >
            <CheckCheck className="size-4" />
            Tandai semua dibaca
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer text-destructive hover:text-destructive"
                disabled={!hasAny}
              >
                <Trash2 className="size-4" />
                Hapus semua
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus semua notifikasi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ini akan menghapus semua notifikasi Anda secara permanen.
                  Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">
                  Batal
                </AlertDialogCancel>
                <AlertDialogAction
                  className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
                  onClick={handleClearAll}
                >
                  Hapus semua
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "all" | "unread");
          selection.clear();
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="all" className="cursor-pointer">
            Semua
          </TabsTrigger>
          <TabsTrigger value="unread" className="cursor-pointer">
            Belum dibaca
            {hasUnread && (
              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {hasAny ? (
            <div className="mb-3">
              <BulkActionBar
                allSelected={selection.allSelected}
                onToggleAll={selection.toggleAll}
                selectedCount={selection.count}
                totalCount={selectableIds.length}
                onClear={selection.clear}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkMarkRead}
                  className="gap-1 cursor-pointer"
                >
                  <CheckCheck className="size-4" />
                  Tandai dibaca
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkRemove}
                  className="gap-1 cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  Hapus
                </Button>
              </BulkActionBar>
            </div>
          ) : null}
          <div className="rounded-xl border bg-card">
            {notifications === undefined ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bell />
                    </EmptyMedia>
                    <EmptyTitle>
                      {tab === "unread"
                        ? "Tidak ada notifikasi baru"
                        : "Belum ada notifikasi"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {tab === "unread"
                        ? "Anda sudah membaca semua notifikasi. Bagus!"
                        : "Aktivitas penting yang berkaitan dengan Anda akan muncul di sini."}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent />
                </Empty>
              </div>
            ) : (
              <div className="p-1.5">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n._id}
                    notification={n}
                    selectable
                    selected={selection.isSelected(n._id)}
                    onToggleSelect={selection.toggle}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Authenticated>
      <NotificationsPageInner />
    </Authenticated>
  );
}
