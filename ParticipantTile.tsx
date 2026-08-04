import { useEffect, useRef } from "react";
import type { DailyParticipant } from "@daily-co/daily-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { MicOff, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type ParticipantTileProps = {
  participant: DailyParticipant;
  fallbackAvatarUrl?: string | null;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Renders a single participant's video/audio using our own branded UI (no Daily
 * chrome). Video and audio MediaStreamTracks are attached to <video>/<audio>
 * elements directly. Remote audio plays automatically; local audio is muted to
 * avoid echo.
 */
export default function ParticipantTile({
  participant,
  fallbackAvatarUrl,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const videoTrack =
    participant.tracks.video?.state === "playable"
      ? (participant.tracks.video.persistentTrack ??
        participant.tracks.video.track ??
        null)
      : null;
  const audioTrack =
    participant.tracks.audio?.state === "playable"
      ? (participant.tracks.audio.persistentTrack ??
        participant.tracks.audio.track ??
        null)
      : null;

  // Attach the video track whenever it changes.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (videoTrack) {
      el.srcObject = new MediaStream([videoTrack]);
    } else {
      el.srcObject = null;
    }
  }, [videoTrack]);

  // Attach remote audio (skip local to avoid hearing yourself).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (audioTrack && !participant.local) {
      el.srcObject = new MediaStream([audioTrack]);
    } else {
      el.srcObject = null;
    }
  }, [audioTrack, participant.local]);

  const hasVideo = Boolean(videoTrack);
  const micOn = participant.tracks.audio?.state === "playable";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/60 to-muted/30">
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={participant.local}
        className={cn(
          "h-full w-full object-cover",
          participant.local && "-scale-x-100", // mirror own camera
          hasVideo ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Avatar fallback when camera is off */}
      {!hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar className="size-20">
            {fallbackAvatarUrl ? <AvatarImage src={fallbackAvatarUrl} /> : null}
            <AvatarFallback className="text-xl font-semibold">
              {getInitials(participant.user_name)}
            </AvatarFallback>
          </Avatar>
        </div>
      ) : null}

      {/* Remote audio element */}
      {!participant.local ? <audio ref={audioRef} autoPlay /> : null}

      {/* Name + status overlay */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <span className="truncate text-xs font-medium text-white">
          {participant.user_name || "Peserta"}
          {participant.local ? " (Anda)" : ""}
        </span>
        <div className="flex items-center gap-1.5">
          {!micOn ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-black/50 text-white">
              <MicOff className="size-3.5" />
            </span>
          ) : null}
          {!hasVideo ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-black/50 text-white">
              <VideoOff className="size-3.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
