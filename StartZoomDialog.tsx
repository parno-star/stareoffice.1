import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Video, Search, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type StartZoomDialogProps = {
  trigger?: React.ReactNode;
  onCreated?: () => void;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function StartZoomDialog({
  trigger,
  onCreated,
}: StartZoomDialogProps) {
  const createZoomMeeting = useMutation(api.zoomMeetings.createZoomMeeting);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<Id<"users">>>(new Set());
  const [search, setSearch] = useState("");

  const members = useQuery(
    api.calls.listOrgMembersForInvite,
    open ? {} : "skip",
  );

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.jobTitle, m.department]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [members, search]);

  const resetForm = () => {
    setTitle("");
    setJoinUrl("");
    setMeetingId("");
    setPasscode("");
    setScheduledAt("");
    setNotes("");
    setSubmitting(false);
    setSelected(new Set());
    setSearch("");
  };

  const toggleMember = (id: Id<"users">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (title.trim().length < 2) {
      toast.error("Judul meeting minimal 2 karakter");
      return;
    }
    if (joinUrl.trim().length === 0) {
      toast.error("Link Zoom wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const inviteeIds = Array.from(selected);
      await createZoomMeeting({
        title: title.trim(),
        joinUrl: joinUrl.trim(),
        meetingId: meetingId.trim() || undefined,
        passcode: passcode.trim() || undefined,
        // Convert the local datetime-local value to a UTC ISO string.
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
        notes: notes.trim() || undefined,
        inviteeIds: inviteeIds.length > 0 ? inviteeIds : undefined,
      });
      toast.success(
        inviteeIds.length > 0
          ? `Zoom meeting dibuat. ${inviteeIds.length} anggota diundang.`
          : "Zoom meeting dibuat",
      );
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membuat Zoom meeting");
      } else {
        toast.error("Gagal membuat Zoom meeting");
      }
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Buat Zoom Meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Zoom Meeting</DialogTitle>
          <DialogDescription>
            Jadwalkan Zoom meeting dan bagikan ke organisasi Anda. Tempel link
            undangan dari aplikasi Zoom Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zoom-title">Judul meeting</Label>
            <Input
              id="zoom-title"
              placeholder="Rapat Koordinasi Mingguan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoom-url">Link Zoom</Label>
            <Input
              id="zoom-url"
              placeholder="https://zoom.us/j/1234567890"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="zoom-id">
                Meeting ID{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              <Input
                id="zoom-id"
                placeholder="123 4567 8901"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoom-pass">
                Passcode{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              <Input
                id="zoom-pass"
                placeholder="abc123"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoom-time">
              Waktu mulai{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Input
              id="zoom-time"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zoom-notes">
              Catatan{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </Label>
            <Textarea
              id="zoom-notes"
              placeholder="Agenda singkat atau informasi tambahan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Member invite picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Users className="size-4" />
                Undang anggota
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </Label>
              {selected.size > 0 ? (
                <span className="text-xs font-medium text-primary">
                  {selected.size} dipilih
                </span>
              ) : null}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, jabatan, atau departemen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="rounded-xl border">
              <ScrollArea className="h-40">
                <div className="p-1.5">
                  {members === undefined ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      Memuat anggota...
                    </p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      {members.length === 0
                        ? "Belum ada anggota lain di organisasi Anda."
                        : "Tidak ada anggota yang cocok."}
                    </p>
                  ) : (
                    filteredMembers.map((m) => {
                      const checked = selected.has(m._id);
                      return (
                        <div
                          key={m._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleMember(m._id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleMember(m._id);
                            }
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                            checked ? "bg-primary/5" : "hover:bg-muted/50",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            className="pointer-events-none"
                            tabIndex={-1}
                          />
                          <Avatar className="size-8">
                            {m.avatarUrl ? (
                              <AvatarImage src={m.avatarUrl} />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {m.name ?? "Tanpa nama"}
                            </p>
                            {m.jobTitle || m.department ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {[m.jobTitle, m.department]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            <p className="text-xs text-muted-foreground">
              Anggota yang diundang akan menerima notifikasi berisi tautan ke
              daftar Zoom meeting.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            <Video className="size-4" />
            {submitting ? "Menyimpan..." : "Buat Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
