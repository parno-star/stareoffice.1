import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Video,
  Mic,
  PhoneCall,
  Link2,
  ChevronDown,
  Radio,
} from "lucide-react";
import CallRoom from "@/pages/calls/_components/CallRoom.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

type Props = {
  bookingId: Id<"roomBookings">;
  bookingTitle: string;
  userName: string | null;
  /** Compact rendering for tight layouts (timeline blocks). */
  compact?: boolean;
};

type InCall = {
  sessionId: Id<"callSessions">;
  roomUrl: string;
  mode: string;
  title: string;
};

/**
 * Lets a user start or join the video/audio call linked to a room booking, and
 * copy a shareable invite link. One call is shared per booking.
 */
export default function BookingCallButton({
  bookingId,
  bookingTitle,
  userName,
  compact = false,
}: Props) {
  const activeCall = useQuery(api.calls.getActiveCallForBooking, { bookingId });
  const startBookingCall = useAction(api.callActions.startBookingCall);
  const getJoinInfo = useAction(api.callActions.getJoinInfo);

  const [busy, setBusy] = useState(false);
  const [inCall, setInCall] = useState<InCall | null>(null);

  const handleStart = async (mode: "audio" | "video") => {
    setBusy(true);
    try {
      const { sessionId, roomUrl } = await startBookingCall({
        bookingId,
        mode,
      });
      setInCall({ sessionId, roomUrl, mode, title: bookingTitle });
    } catch (error) {
      handleError(error, "Gagal memulai panggilan");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (sessionId: Id<"callSessions">) => {
    setBusy(true);
    try {
      const info = await getJoinInfo({ sessionId });
      setInCall({
        sessionId,
        roomUrl: info.roomUrl,
        mode: info.mode,
        title: info.title,
      });
    } catch (error) {
      handleError(error, "Gagal bergabung ke panggilan");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async (sessionId: Id<"callSessions">) => {
    const link = `${window.location.origin}/calls?join=${sessionId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Tautan panggilan disalin");
    } catch {
      toast.error("Gagal menyalin tautan");
    }
  };

  const handleError = (error: unknown, fallback: string) => {
    if (error instanceof ConvexError) {
      const data = error.data as { message?: string };
      toast.error(data.message ?? fallback);
    } else {
      toast.error(fallback);
    }
  };

  // Active call linked to this booking → show Join + Share.
  if (activeCall) {
    return (
      <>
        <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2"}>
          <Button
            size={compact ? "sm" : "sm"}
            onClick={() => handleJoin(activeCall._id)}
            disabled={busy}
            className="gap-1.5"
          >
            <Radio className="size-3.5 animate-pulse" />
            {busy ? "Membuka..." : "Gabung"}
          </Button>
          {!compact ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => handleCopyLink(activeCall._id)}
              title="Salin tautan undangan"
            >
              <Link2 className="size-4" />
            </Button>
          ) : null}
        </div>
        {inCall ? (
          <CallDialog inCall={inCall} userName={userName} onClose={() => setInCall(null)} />
        ) : null}
      </>
    );
  }

  // No active call → offer to start audio (default) or video.
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={compact ? "sm" : "sm"}
            variant="secondary"
            disabled={busy}
            className="gap-1.5"
          >
            <PhoneCall className="size-3.5" />
            {compact ? "Panggilan" : "Mulai Panggilan"}
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Mulai panggilan untuk rapat ini</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleStart("audio")} className="cursor-pointer">
            <Mic className="size-4" />
            Audio saja
            <span className="ml-auto text-[10px] text-muted-foreground">Hemat</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStart("video")} className="cursor-pointer">
            <Video className="size-4" />
            Video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {inCall ? (
        <CallDialog inCall={inCall} userName={userName} onClose={() => setInCall(null)} />
      ) : null}
    </>
  );
}

function CallDialog({
  inCall,
  userName,
  onClose,
}: {
  inCall: InCall;
  userName: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Panggilan: {inCall.title}</DialogTitle>
        </DialogHeader>
        <CallRoom
          roomUrl={inCall.roomUrl}
          mode={inCall.mode}
          title={inCall.title}
          sessionId={inCall.sessionId}
          userName={userName}
          onLeave={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
