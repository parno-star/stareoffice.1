import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { format, isPast } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Video, Clock, ExternalLink, Trash2, KeyRound } from "lucide-react";
import StartZoomDialog from "./StartZoomDialog.tsx";

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function ZoomMeetingsTab() {
  const meetings = useQuery(api.zoomMeetings.listZoomMeetings, {});
  const cancelMeeting = useMutation(api.zoomMeetings.cancelZoomMeeting);
  const [cancelId, setCancelId] = useState<Id<"zoomMeetings"> | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await cancelMeeting({ meetingId: cancelId });
      toast.success("Zoom meeting dibatalkan");
      setCancelId(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membatalkan meeting");
      } else {
        toast.error("Gagal membatalkan meeting");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Zoom Meeting</h2>
          <p className="text-xs text-muted-foreground">
            Jadwalkan dan bagikan tautan Zoom ke rekan Anda.
          </p>
        </div>
        <StartZoomDialog />
      </div>

      {meetings === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <Empty className="bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Video />
            </EmptyMedia>
            <EmptyTitle>Belum ada Zoom meeting</EmptyTitle>
            <EmptyDescription>
              Buat Zoom meeting dan bagikan tautannya agar rekan dapat
              bergabung.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <StartZoomDialog
              trigger={
                <Button size="sm">
                  <Video className="size-4" />
                  Buat Zoom Meeting
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => {
            const started = m.scheduledAt
              ? isPast(new Date(m.scheduledAt))
              : false;
            return (
              <Card key={m._id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Video className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {m.title}
                      </p>
                      {m.scheduledAt ? (
                        <Badge
                          variant={started ? "outline" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          {started ? "Berlangsung/lewat" : "Terjadwal"}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Avatar className="size-4">
                          {m.createdByAvatar ? (
                            <AvatarImage src={m.createdByAvatar} />
                          ) : null}
                          <AvatarFallback className="text-[8px]">
                            {getInitials(m.createdByName)}
                          </AvatarFallback>
                        </Avatar>
                        {m.createdByName ?? "Seseorang"}
                      </span>
                      {m.scheduledAt ? (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {format(new Date(m.scheduledAt), "d MMM yyyy, HH:mm", {
                            locale: idLocale,
                          })}
                        </span>
                      ) : null}
                      {m.meetingId ? (
                        <span>ID: {m.meetingId}</span>
                      ) : null}
                      {m.passcode ? (
                        <span className="flex items-center gap-1">
                          <KeyRound className="size-3.5" />
                          {m.passcode}
                        </span>
                      ) : null}
                    </div>
                    {m.notes ? (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {m.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" asChild>
                      <a
                        href={m.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-4" />
                        Gabung
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCancelId(m._id)}
                      aria-label="Batalkan meeting"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={cancelId !== null}
        onOpenChange={(o) => {
          if (!o) setCancelId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Zoom meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              Meeting akan dihapus dari daftar dan tidak lagi terlihat oleh
              rekan Anda. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleCancel();
              }}
              disabled={cancelling}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {cancelling ? "Membatalkan..." : "Ya, batalkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
