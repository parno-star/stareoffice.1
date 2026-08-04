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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Inbox } from "lucide-react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function MentorshipRequestsTab() {
  const requests = useQuery(api.training.mentorships.listMyMentorships, {
    role: "mentor",
    status: "pending",
  });
  const respond = useMutation(api.training.mentorships.respondToRequest);
  const [declineOpen, setDeclineOpen] = useState<Id<"mentorships"> | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");

  const accept = async (id: Id<"mentorships">) => {
    try {
      await respond({ mentorshipId: id, accept: true });
      toast.success("Permintaan diterima");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const decline = async () => {
    if (!declineOpen) return;
    try {
      await respond({
        mentorshipId: declineOpen,
        accept: false,
        declineReason: declineReason || undefined,
      });
      toast.success("Permintaan ditolak");
      setDeclineOpen(null);
      setDeclineReason("");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  if (requests === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>Tidak ada permintaan</EmptyTitle>
          <EmptyDescription>
            Permintaan dari mentee Anda akan muncul di sini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((r) => {
          const mentee = r.mentee;
          return (
            <div
              key={r._id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start"
            >
              <Avatar className="size-12">
                <AvatarImage src={mentee?.avatarUrl} />
                <AvatarFallback>
                  {(mentee?.name ?? "M").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {mentee?.name ?? "Karyawan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mentee?.jobTitle ?? ""}
                      {mentee?.department ? ` · ${mentee.department}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.goal}</p>
                {r.topics.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {r.topics.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => accept(r._id)}
                  >
                    Terima
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setDeclineOpen(r._id)}
                  >
                    Tolak
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={declineOpen !== null}
        onOpenChange={(v) => {
          if (!v) {
            setDeclineOpen(null);
            setDeclineReason("");
          }
        }}
      >
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak permintaan mentorship</DialogTitle>
            <DialogDescription>
              Berikan alasan singkat agar mentee dapat memahami dan mencari
              mentor lain.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={4}
            placeholder="Contoh: Kapasitas saya sedang penuh bulan ini."
          />
          <DialogFooter>
            <Button
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setDeclineOpen(null)}
            >
              Batal
            </Button>
            <Button className="cursor-pointer" onClick={decline}>
              Tolak permintaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
