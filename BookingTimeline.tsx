import type { BookingListItem } from "@/convex/rooms";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Clock, Trash2, Users } from "lucide-react";
import BookingCallButton from "./BookingCallButton.tsx";
import {
  BUSINESS_HOURS,
  formatTime,
  getInitials,
  minutesFromMidnight,
} from "../_lib/rooms-utils.ts";
import { cn } from "@/lib/utils.ts";

type Props = {
  bookings: Array<BookingListItem>;
  currentUserId: Id<"users"> | null;
  currentUserName: string | null;
  isAdmin: boolean;
};

const HOUR_HEIGHT = 48; // px per hour
const TOTAL_HOURS = BUSINESS_HOURS.end - BUSINESS_HOURS.start;

export default function BookingTimeline({
  bookings,
  currentUserId,
  currentUserName,
  isAdmin,
}: Props) {
  const cancelBooking = useMutation(api.rooms.cancelBooking);

  const handleCancel = async (bookingId: Id<"roomBookings">) => {
    try {
      await cancelBooking({ bookingId });
      toast.success("Pemesanan dibatalkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membatalkan pemesanan");
      } else {
        toast.error("Gagal membatalkan pemesanan");
      }
    }
  };

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => ({
    hour: BUSINESS_HOURS.start + i,
    label: `${String(BUSINESS_HOURS.start + i).padStart(2, "0")}:00`,
  }));

  const startMinutes = BUSINESS_HOURS.start * 60;
  const totalMinutes = TOTAL_HOURS * 60;

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative rounded-lg border bg-muted/20">
        <div
          className="relative"
          style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
        >
          {/* Hour grid */}
          {hours.map((h, i) => (
            <div
              key={h.hour}
              className={cn(
                "absolute left-0 right-0 flex items-center gap-2 border-t border-dashed border-muted-foreground/20 text-[10px] text-muted-foreground",
                i === 0 && "border-t-0",
              )}
              style={{ top: `${i * HOUR_HEIGHT}px` }}
            >
              <span className="w-11 shrink-0 pl-2 font-mono tabular-nums">
                {h.label}
              </span>
            </div>
          ))}

          {/* Booking blocks */}
          {bookings.map((b) => {
            const bStart = minutesFromMidnight(b.startTime);
            const bEnd = minutesFromMidnight(b.endTime);
            const top = Math.max(0, bStart - startMinutes);
            const bottomClip = Math.min(totalMinutes, bEnd - startMinutes);
            const height = Math.max(20, bottomClip - top);
            const isOwn = currentUserId !== null && b.userId === currentUserId;
            const canCancel = isOwn || isAdmin;

            return (
              <div
                key={b._id}
                className={cn(
                  "absolute left-14 right-2 overflow-hidden rounded-md border p-2 text-xs shadow-sm",
                  isOwn
                    ? "border-primary/50 bg-primary/10"
                    : "border-sky-500/30 bg-sky-500/10",
                )}
                style={{
                  top: `${(top / 60) * HOUR_HEIGHT + 2}px`,
                  height: `${(height / 60) * HOUR_HEIGHT - 4}px`,
                }}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {formatTime(b.startTime)} - {formatTime(b.endTime)} ·{" "}
                      {b.userName ?? "Karyawan"}
                    </p>
                  </div>
                  {canCancel ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="size-6 shrink-0"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Batalkan pemesanan?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Pemesanan "{b.title}" akan dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Tidak</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancel(b._id)}
                          >
                            Batalkan
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* List summary */}
      {bookings.length > 0 ? (
        <div className="space-y-2">
          {bookings.map((b) => {
            const isOwn = currentUserId !== null && b.userId === currentUserId;
            return (
              <div
                key={b._id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  isOwn ? "border-primary/40 bg-primary/5" : "bg-card",
                )}
              >
                <Avatar className="size-8">
                  {b.userAvatar ? <AvatarImage src={b.userAvatar} /> : null}
                  <AvatarFallback className="bg-primary/10 text-[11px]">
                    {getInitials(b.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatTime(b.startTime)} - {formatTime(b.endTime)}
                    </span>
                    <span>{b.userName ?? "Karyawan"}</span>
                    {b.attendeeCount ? (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {b.attendeeCount}
                      </span>
                    ) : null}
                  </div>
                  {b.purpose ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.purpose}
                    </p>
                  ) : null}
                </div>
                <BookingCallButton
                  bookingId={b._id}
                  bookingTitle={b.title}
                  userName={currentUserName}
                  compact
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
