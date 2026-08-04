import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { useState } from "react";
import { HeartHandshake, Calendar, Play, X, CheckCircle2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ScheduleSessionDialog from "./ScheduleSessionDialog.tsx";
import CompleteMentorshipDialog from "./CompleteMentorshipDialog.tsx";

export default function MyMentorshipsTab() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const items = useQuery(api.training.mentorships.listMyMentorships, {
    role: roleFilter,
    status: statusFilter,
  });

  return (
    <div className="space-y-4">
      <Tabs
        value={roleFilter}
        onValueChange={setRoleFilter}
        className="space-y-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="cursor-pointer">
            <TabsTrigger value="all" className="cursor-pointer">
              Semua
            </TabsTrigger>
            <TabsTrigger value="mentee" className="cursor-pointer">
              Sebagai mentee
            </TabsTrigger>
            <TabsTrigger value="mentor" className="cursor-pointer">
              Sebagai mentor
            </TabsTrigger>
          </TabsList>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full cursor-pointer sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TabsContent value={roleFilter} className="space-y-3">
          {items === undefined ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HeartHandshake />
                </EmptyMedia>
                <EmptyTitle>Belum ada mentorship</EmptyTitle>
                <EmptyDescription>
                  Minta mentor di tab Direktori atau buat profil mentor Anda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            items.map((m) => (
              <MentorshipRow key={m._id} m={m} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Menunggu",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  active: {
    label: "Aktif",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  completed: {
    label: "Selesai",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-muted text-foreground",
  },
};

type MentorshipRowItem = {
  _id: Id<"mentorships">;
  mentorId: Id<"users">;
  menteeId: Id<"users">;
  status: string;
  goal: string;
  topics: Array<string>;
  cadence?: string;
  startDate?: string;
  targetEndDate?: string;
  sessionCount: number;
  upcomingSessionAt: string | null;
  mentor: { _id: Id<"users">; name?: string; avatarUrl?: string } | null;
  mentee: { _id: Id<"users">; name?: string; avatarUrl?: string } | null;
  requestedAt: string;
  declineReason?: string;
};

function MentorshipRow({ m }: { m: MentorshipRowItem }) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const cancel = useMutation(api.training.mentorships.cancelMentorship);
  const isMentor = currentUser?._id === m.mentorId;
  const counterpart = isMentor ? m.mentee : m.mentor;
  const status = STATUS_LABEL[m.status] ?? STATUS_LABEL.pending;

  const handleCancel = async () => {
    if (!window.confirm("Batalkan mentorship ini?")) return;
    try {
      await cancel({ mentorshipId: m._id });
      toast.success("Mentorship dibatalkan");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
      <Avatar className="size-12">
        <AvatarImage src={counterpart?.avatarUrl} />
        <AvatarFallback>
          {(counterpart?.name ?? "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">
            {counterpart?.name ?? "Karyawan"}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}
          >
            {status.label}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
            {isMentor ? "Mentee" : "Mentor"}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{m.goal}</p>
        {m.topics.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {m.topics.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {m.cadence ? <span>Frekuensi: {m.cadence}</span> : null}
          {m.startDate ? (
            <span>Mulai: {new Date(m.startDate).toLocaleDateString("id-ID")}</span>
          ) : null}
          {m.targetEndDate ? (
            <span>
              Target: {new Date(m.targetEndDate).toLocaleDateString("id-ID")}
            </span>
          ) : null}
          <span>{m.sessionCount} sesi</span>
          {m.upcomingSessionAt ? (
            <span className="text-primary">
              Sesi berikutnya:{" "}
              {new Date(m.upcomingSessionAt).toLocaleString("id-ID")}
            </span>
          ) : null}
        </div>
        {m.status === "rejected" && m.declineReason ? (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Alasan: {m.declineReason}
          </p>
        ) : null}
        {m.status === "active" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <ScheduleSessionDialog
              mentorshipId={m._id}
              trigger={
                <Button size="sm" className="cursor-pointer gap-1">
                  <Calendar className="size-4" /> Jadwalkan sesi
                </Button>
              }
            />
            <CompleteMentorshipDialog
              mentorshipId={m._id}
              isMentee={!isMentor}
              trigger={
                <Button
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer gap-1"
                >
                  <CheckCircle2 className="size-4" /> Selesaikan
                </Button>
              }
            />
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={handleCancel}
            >
              <X className="size-4" /> Batalkan
            </Button>
          </div>
        ) : m.status === "pending" && !isMentor ? (
          <Button
            size="sm"
            variant="secondary"
            className="cursor-pointer gap-1"
            onClick={handleCancel}
          >
            <X className="size-4" /> Batalkan permintaan
          </Button>
        ) : null}
        {m.status === "active" ? (
          <div className="pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer gap-1 px-2"
              asChild
            >
              <a href={`/mentorship/${m._id}`}>
                <Play className="size-4" /> Buka detail
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
