import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Video,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ScheduleSessionDialog from "./_components/ScheduleSessionDialog.tsx";

function MentorshipDetailInner() {
  const params = useParams<{ mentorshipId: string }>();
  const navigate = useNavigate();
  const mentorshipId = params.mentorshipId as Id<"mentorships">;
  const data = useQuery(api.training.mentorships.getMentorship, {
    mentorshipId,
  });
  const cancelSession = useMutation(api.training.mentorships.cancelSession);
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (data === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <X />
            </EmptyMedia>
            <EmptyTitle>Tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Mentorship tidak ditemukan atau sudah dihapus.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  const isMentor = currentUser?._id === data.mentorId;
  const counterpart = isMentor ? data.mentee : data.mentor;

  const handleCancelSession = async (sessionId: Id<"mentorshipSessions">) => {
    if (!window.confirm("Batalkan sesi ini?")) return;
    try {
      await cancelSession({ sessionId });
      toast.success("Sesi dibatalkan");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer"
          onClick={() => navigate("/mentorship?tab=my")}
        >
          <ArrowLeft className="mr-1 size-4" /> Kembali
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar className="size-16">
              <AvatarImage src={counterpart?.avatarUrl} />
              <AvatarFallback>
                {(counterpart?.name ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {isMentor ? "Mentee" : "Mentor"}
              </p>
              <h1 className="text-xl font-bold">{counterpart?.name}</h1>
              <p className="text-sm text-muted-foreground">
                {counterpart?.jobTitle}
                {counterpart?.department ? ` · ${counterpart.department}` : ""}
              </p>
            </div>
            {data.status === "active" ? (
              <ScheduleSessionDialog
                mentorshipId={data._id}
                trigger={
                  <Button size="sm" className="cursor-pointer gap-1">
                    <Calendar className="size-4" /> Jadwalkan sesi
                  </Button>
                }
              />
            ) : null}
          </div>
          <div className="mt-4 rounded-lg bg-muted p-4 text-sm">
            <p className="font-semibold">Tujuan</p>
            <p className="mt-1 whitespace-pre-wrap">{data.goal}</p>
          </div>
          {data.topics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Sesi mentorship</h2>
        {data.sessions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calendar />
              </EmptyMedia>
              <EmptyTitle>Belum ada sesi</EmptyTitle>
              <EmptyDescription>
                Jadwalkan sesi pertama untuk mulai mentorship.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {data.sessions.map((s) => (
              <SessionRow
                key={s._id}
                session={s}
                canManage={true}
                onCancel={() => handleCancelSession(s._id)}
                isMentor={isMentor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type SessionItem = {
  _id: Id<"mentorshipSessions">;
  title: string;
  agenda?: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl?: string;
  location?: string;
  status: string;
  mentorNotes?: string;
  menteeNotes?: string;
  actionItems?: string;
};

function SessionRow({
  session,
  canManage,
  onCancel,
  isMentor,
}: {
  session: SessionItem;
  canManage: boolean;
  onCancel: () => void;
  isMentor: boolean;
}) {
  const complete = useMutation(api.training.mentorships.completeSession);
  const [notes, setNotes] = useState("");
  const [actionItems, setActionItems] = useState(session.actionItems ?? "");
  const [open, setOpen] = useState(false);
  const statusColor =
    session.status === "completed"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : session.status === "cancelled"
        ? "bg-muted text-foreground"
        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  const handleComplete = async () => {
    try {
      await complete({
        sessionId: session._id,
        mentorNotes: isMentor ? notes : undefined,
        menteeNotes: !isMentor ? notes : undefined,
        actionItems: actionItems || undefined,
      });
      toast.success("Sesi ditandai selesai");
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{session.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}
            >
              {session.status === "scheduled"
                ? "Terjadwal"
                : session.status === "completed"
                  ? "Selesai"
                  : "Dibatalkan"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3.5" />
              {new Date(session.scheduledAt).toLocaleString("id-ID")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {session.durationMinutes} menit
            </span>
            {session.meetingUrl ? (
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Video className="size-3.5" /> Join
              </a>
            ) : null}
            {session.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {session.location}
              </span>
            ) : null}
          </div>
          {session.agenda ? (
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">
              {session.agenda}
            </p>
          ) : null}
          {session.actionItems ? (
            <div className="mt-2 rounded-md border border-dashed p-2 text-xs">
              <p className="font-medium">Action items</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {session.actionItems}
              </p>
            </div>
          ) : null}
        </div>
        {canManage && session.status === "scheduled" ? (
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="cursor-pointer gap-1">
                  <CheckCircle2 className="size-4" /> Selesai
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rangkuman sesi</DialogTitle>
                  <DialogDescription>
                    Catat insight dan langkah tindak lanjut.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>
                      Catatan {isMentor ? "mentor" : "mentee"} (opsional)
                    </Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Action items (opsional)</Label>
                    <Textarea
                      value={actionItems}
                      onChange={(e) => setActionItems(e.target.value)}
                      rows={3}
                      placeholder="Langkah konkret yang harus dilakukan..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button className="cursor-pointer" onClick={handleComplete}>
                    Simpan & tutup
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer"
              onClick={onCancel}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
      {(session.mentorNotes || session.menteeNotes) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {session.mentorNotes ? (
            <div className="rounded-md bg-muted p-2 text-xs">
              <p className="font-medium">Catatan mentor</p>
              <p className="mt-1 whitespace-pre-wrap">{session.mentorNotes}</p>
            </div>
          ) : null}
          {session.menteeNotes ? (
            <div className="rounded-md bg-muted p-2 text-xs">
              <p className="font-medium">Catatan mentee</p>
              <p className="mt-1 whitespace-pre-wrap">{session.menteeNotes}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function MentorshipDetailPage() {
  return (
    <>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-10 w-64" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-full flex-col items-center justify-center p-10">
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <MentorshipDetailInner />
      </Authenticated>
    </>
  );
}
