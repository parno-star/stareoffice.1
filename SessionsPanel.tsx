import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Calendar,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import SessionEditorDialog from "./SessionEditorDialog.tsx";
import {
  formatIdDateTime,
  SESSION_FORMAT_LABEL,
  SESSION_STATUS_LABEL,
} from "../_lib/advanced-utils.ts";
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

type Props = {
  courseId: Id<"courses">;
  isAdmin: boolean;
};

export default function SessionsPanel({ courseId, isAdmin }: Props) {
  const sessions = useQuery(api.training.sessions.listSessions, { courseId });
  const register = useMutation(api.training.sessions.registerForSession);
  const cancel = useMutation(api.training.sessions.cancelRegistration);
  const removeSession = useMutation(api.training.sessions.removeSession);

  const handleRegister = async (sessionId: Id<"trainingSessions">) => {
    try {
      await register({ sessionId });
      toast.success("Berhasil daftar sesi");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleCancel = async (sessionId: Id<"trainingSessions">) => {
    try {
      await cancel({ sessionId });
      toast.success("Pendaftaran dibatalkan");
    } catch {
      toast.error("Gagal membatalkan");
    }
  };

  const handleRemove = async (id: Id<"trainingSessions">) => {
    try {
      await removeSession({ id });
      toast.success("Sesi dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  if (sessions === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Calendar />
          </EmptyMedia>
          <EmptyTitle>Belum ada sesi terjadwal</EmptyTitle>
          <EmptyDescription>
            {isAdmin
              ? "Buat sesi live training untuk peserta kelas ini."
              : "Sesi live training akan muncul di sini setelah dijadwalkan."}
          </EmptyDescription>
        </EmptyHeader>
        {isAdmin ? (
          <EmptyContent>
            <SessionEditorDialog
              courseId={courseId}
              trigger={
                <Button size="sm" className="cursor-pointer gap-1">
                  <CalendarPlus className="size-4" /> Buat sesi
                </Button>
              }
            />
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.endAt >= now);
  const past = sessions.filter((s) => s.endAt < now);

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="flex justify-end">
          <SessionEditorDialog
            courseId={courseId}
            trigger={
              <Button size="sm" className="cursor-pointer gap-1">
                <CalendarPlus className="size-4" /> Buat sesi
              </Button>
            }
          />
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Akan Datang
          </p>
          <div className="space-y-3">
            {upcoming.map((s) => (
              <SessionItem
                key={s._id}
                session={s}
                isAdmin={isAdmin}
                onRegister={() => handleRegister(s._id)}
                onCancel={() => handleCancel(s._id)}
                onRemove={() => handleRemove(s._id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sudah Lewat
          </p>
          <div className="space-y-3">
            {past.map((s) => (
              <SessionItem
                key={s._id}
                session={s}
                isAdmin={isAdmin}
                onRegister={() => handleRegister(s._id)}
                onCancel={() => handleCancel(s._id)}
                onRemove={() => handleRemove(s._id)}
                past
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type SessionRow = NonNullable<
  ReturnType<typeof useQuery<typeof api.training.sessions.listSessions>>
>[number];

function SessionItem({
  session,
  isAdmin,
  onRegister,
  onCancel,
  onRemove,
  past,
}: {
  session: SessionRow;
  isAdmin: boolean;
  onRegister: () => void;
  onCancel: () => void;
  onRemove: () => void;
  past?: boolean;
}) {
  const registered =
    session.registration !== null &&
    session.registration.status !== "cancelled";
  return (
    <Card className={cn(past && "opacity-75")}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold">{session.title}</h4>
              <Badge variant="secondary">
                {SESSION_FORMAT_LABEL[session.format] ?? session.format}
              </Badge>
              <Badge variant="outline">
                {SESSION_STATUS_LABEL[session.status] ?? session.status}
              </Badge>
            </div>
            {session.description ? (
              <p className="text-sm text-muted-foreground">
                {session.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                {formatIdDateTime(session.startAt)} -{" "}
                {new Date(session.endAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {session.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {session.location}
                </span>
              ) : null}
              {session.capacity ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {session.registeredCount}/{session.capacity}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {session.registeredCount} terdaftar
                </span>
              )}
              {session.trainerName ? (
                <span>Trainer: {session.trainerName}</span>
              ) : null}
            </div>
            {registered && session.meetingUrl && !past ? (
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Video className="size-3.5" /> Buka link meeting
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!past ? (
              registered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCancel}
                  className="cursor-pointer gap-1"
                >
                  <UserX className="size-4" /> Batal daftar
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onRegister}
                  disabled={!session.canJoin}
                  className="cursor-pointer gap-1"
                >
                  <UserCheck className="size-4" /> Daftar
                </Button>
              )
            ) : null}
            {isAdmin ? (
              <>
                <SessionEditorDialog
                  courseId={session.courseId}
                  initialValues={{
                    sessionId: session._id,
                    title: session.title,
                    description: session.description,
                    startAt: session.startAt,
                    endAt: session.endAt,
                    format: session.format,
                    location: session.location,
                    meetingUrl: session.meetingUrl,
                    capacity: session.capacity,
                    trainerName: session.trainerName,
                  }}
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus sesi ini?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Semua pendaftaran untuk sesi ini akan terhapus.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="cursor-pointer">
                        Batal
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onRemove}
                        className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
