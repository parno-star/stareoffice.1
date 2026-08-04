import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
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
import { Mic, Phone, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";

type StartCallDialogProps = {
  trigger?: React.ReactNode;
  onStarted: (sessionId: Id<"callSessions">) => void;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function StartCallDialog({
  trigger,
  onStarted,
}: StartCallDialogProps) {
  const createCall = useAction(api.callActions.createCall);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"audio" | "video">("audio");
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<Id<"users">>>(new Set());
  const [search, setSearch] = useState("");

  // Only load the member list while the dialog is open to avoid a needless
  // subscription on the Calls page.
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
    setMode("audio");
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
      toast.error("Judul panggilan minimal 2 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const inviteeIds = Array.from(selected);
      const { sessionId } = await createCall({
        title: title.trim(),
        mode,
        inviteeIds: inviteeIds.length > 0 ? inviteeIds : undefined,
      });
      toast.success(
        inviteeIds.length > 0
          ? `Panggilan dimulai. ${inviteeIds.length} anggota diundang.`
          : "Panggilan dimulai",
      );
      setOpen(false);
      resetForm();
      onStarted(sessionId);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memulai panggilan");
      } else {
        toast.error("Gagal memulai panggilan");
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
            <Phone className="size-4" />
            Mulai Panggilan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mulai Panggilan Baru</DialogTitle>
          <DialogDescription>
            Buat panggilan untuk organisasi Anda. Undang anggota tertentu atau
            biarkan rekan bergabung dari daftar panggilan aktif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="call-title">Judul panggilan</Label>
            <Input
              id="call-title"
              placeholder="Rapat Koordinasi Mingguan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex cursor-default flex-col items-start gap-1 rounded-xl border border-primary bg-primary/5 p-3 ring-1 ring-primary">
              <div className="flex items-center gap-2 font-medium">
                <Mic className="size-4 text-primary" />
                Rapat suara
              </div>
              <span className="text-xs text-muted-foreground">
                Rapat berbasis suara. Fitur video dinonaktifkan untuk saat ini.
              </span>
            </div>
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
              <ScrollArea className="h-48">
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
              Anggota yang diundang akan menerima notifikasi berisi tombol untuk
              langsung bergabung.
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
            {submitting ? "Memulai..." : "Mulai Panggilan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
