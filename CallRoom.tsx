import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, {
  type DailyCall,
  type DailyParticipant,
} from "@daily-co/daily-js";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import {
  PhoneOff,
  AlertTriangle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorX,
} from "lucide-react";
import ParticipantTile from "./ParticipantTile.tsx";

type CallRoomProps = {
  roomUrl: string;
  mode: string;
  title: string;
  userName?: string | null;
  avatarUrl?: string | null;
  /** When provided, leaving attempts to end the session (records used minutes). */
  sessionId?: Id<"callSessions">;
  onLeave: () => void;
};

/**
 * A fully custom, Star e-Office-branded call room built on Daily's "call object"
 * mode. Video, audio and controls are rendered by our own UI — there is no Daily
 * iframe or Daily branding. The camera/mic run in-page via WebRTC.
 */
export default function CallRoom({
  roomUrl,
  mode,
  title,
  userName,
  avatarUrl,
  sessionId,
  onLeave,
}: CallRoomProps) {
  const callRef = useRef<DailyCall | null>(null);
  const endCall = useMutation(api.calls.endCall);
  const [status, setStatus] = useState<"loading" | "joined" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(mode === "video");
  const [sharing, setSharing] = useState(false);

  // End the session (records quota minutes) when leaving. Errors are ignored —
  // e.g. a non-host participant is not allowed to end and simply leaves.
  const endIfPossible = useCallback(() => {
    if (!sessionId) return;
    void endCall({ sessionId }).catch(() => {
      /* ignore: only creator/admin may end */
    });
  }, [endCall, sessionId]);

  useEffect(() => {
    let cancelled = false;

    const refreshParticipants = (call: DailyCall) => {
      const map = call.participants();
      setParticipants(Object.values(map));
    };

    const call = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: mode === "video",
    });
    callRef.current = call;

    const onParticipantChange = () => {
      if (!cancelled) refreshParticipants(call);
    };

    call.on("participant-joined", onParticipantChange);
    call.on("participant-updated", onParticipantChange);
    call.on("participant-left", onParticipantChange);
    call.on("track-started", onParticipantChange);
    call.on("track-stopped", onParticipantChange);
    call.on("left-meeting", () => {
      endIfPossible();
      onLeave();
    });
    call.on("error", (ev) => {
      if (cancelled) return;
      setStatus("error");
      setErrorMsg(
        (ev && "errorMsg" in ev && typeof ev.errorMsg === "string"
          ? ev.errorMsg
          : null) ?? "Terjadi kesalahan saat menyambungkan panggilan.",
      );
    });

    call
      .join({
        url: roomUrl,
        userName: userName ?? undefined,
        startVideoOff: mode !== "video",
        startAudioOff: false,
      })
      .then(() => {
        if (cancelled) return;
        setStatus("joined");
        setMicOn(call.localAudio());
        setCamOn(call.localVideo());
        refreshParticipants(call);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            "Gagal bergabung ke panggilan. Pastikan izin kamera & mikrofon diizinkan.",
          );
        }
      });

    return () => {
      cancelled = true;
      call.destroy();
      callRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl]);

  const toggleMic = () => {
    const call = callRef.current;
    if (!call) return;
    const next = !micOn;
    call.setLocalAudio(next);
    setMicOn(next);
  };

  const toggleCam = () => {
    const call = callRef.current;
    if (!call) return;
    const next = !camOn;
    call.setLocalVideo(next);
    setCamOn(next);
  };

  const toggleShare = () => {
    const call = callRef.current;
    if (!call) return;
    if (sharing) {
      call.stopScreenShare();
      setSharing(false);
    } else {
      call.startScreenShare();
      setSharing(true);
    }
  };

  const handleLeave = () => {
    const call = callRef.current;
    if (call) {
      call.leave().catch(() => {
        /* ignore */
      });
    }
    endIfPossible();
    onLeave();
  };

  // Grid columns adapt to participant count.
  const count = participants.length;
  const gridCols =
    count <= 1
      ? "grid-cols-1"
      : count <= 4
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            {mode === "video" ? "Mode video" : "Mode audio"} · {count}{" "}
            peserta
          </p>
        </div>
      </div>

      {/* Stage */}
      <div className="relative min-h-[320px] w-full overflow-hidden rounded-2xl border bg-muted/30 p-3">
        {status === "joined" && participants.length > 0 ? (
          <div className={cn("grid gap-3", gridCols)}>
            {participants.map((p) => (
              <ParticipantTile
                key={p.session_id}
                participant={p}
                fallbackAvatarUrl={p.local ? avatarUrl : null}
              />
            ))}
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 p-6 text-center">
            <Spinner className="size-6" />
            <p className="text-sm text-muted-foreground">
              Menyambungkan panggilan...
            </p>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <p className="text-sm font-medium">Panggilan gagal disambungkan</p>
            <p className="max-w-sm text-xs text-muted-foreground">{errorMsg}</p>
            <Button size="sm" variant="secondary" onClick={handleLeave}>
              Tutup
            </Button>
          </div>
        ) : null}
      </div>

      {/* Control bar */}
      {status === "joined" ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-3">
          <Button
            variant={micOn ? "secondary" : "destructive"}
            size="icon"
            onClick={toggleMic}
            aria-label={micOn ? "Matikan mikrofon" : "Nyalakan mikrofon"}
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </Button>
          <Button
            variant={camOn ? "secondary" : "destructive"}
            size="icon"
            onClick={toggleCam}
            aria-label={camOn ? "Matikan kamera" : "Nyalakan kamera"}
          >
            {camOn ? (
              <Video className="size-5" />
            ) : (
              <VideoOff className="size-5" />
            )}
          </Button>
          <Button
            variant={sharing ? "default" : "secondary"}
            size="icon"
            onClick={toggleShare}
            aria-label={sharing ? "Hentikan berbagi layar" : "Bagikan layar"}
            className="hidden sm:inline-flex"
          >
            {sharing ? (
              <MonitorX className="size-5" />
            ) : (
              <MonitorUp className="size-5" />
            )}
          </Button>
          <Button variant="destructive" onClick={handleLeave} className="ml-2">
            <PhoneOff className="size-5" />
            Keluar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
