import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Crown, Search, UserPlus, X } from "lucide-react";
import { getInitials } from "@/pages/organization/_lib/org-utils.ts";
import { cn } from "@/lib/utils.ts";

export default function TeamMembersDialog({
  team,
  open,
  onOpenChange,
  allUsers,
  isAdmin,
}: {
  team: Doc<"teams"> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allUsers: Array<Doc<"users">>;
  isAdmin: boolean;
}) {
  const data = useQuery(
    api.organization.getTeam,
    team ? { teamId: team._id } : "skip",
  );
  const addMember = useMutation(api.organization.addTeamMember);
  const removeMember = useMutation(api.organization.removeTeamMember);

  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!team) return null;

  const currentMemberIds = new Set(
    (data?.members ?? []).map((m) => m.user._id),
  );

  const candidates = allUsers
    .filter((u) => !currentMemberIds.has(u._id))
    .filter((u) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.jobTitle ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
    })
    .slice(0, 30);

  const handleAdd = async (userId: Id<"users">) => {
    setBusyId(userId);
    try {
      await addMember({ teamId: team._id, userId, role: "member" });
      toast.success("Anggota ditambahkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal menambahkan");
      } else {
        toast.error("Gagal menambahkan anggota");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (userId: Id<"users">) => {
    setBusyId(userId);
    try {
      await removeMember({ teamId: team._id, userId });
      toast.success("Anggota dikeluarkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const d = error.data as { message?: string };
        toast.error(d.message ?? "Gagal mengeluarkan");
      } else {
        toast.error("Gagal mengeluarkan anggota");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anggota Tim · {team.name}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Tambah atau keluarkan anggota dari tim."
              : "Daftar seluruh anggota tim."}
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anggota Saat Ini ({data.members.length})
              </p>
              {data.members.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Belum ada anggota
                </p>
              ) : (
                <div className="space-y-1">
                  {data.members.map((m) => (
                    <div
                      key={m.user._id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-2",
                        m.role === "lead" && "border-primary/40 bg-primary/5",
                      )}
                    >
                      <Avatar className="size-9">
                        {m.user.avatarUrl ? (
                          <AvatarImage
                            src={m.user.avatarUrl}
                            alt={m.user.name ?? ""}
                          />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {getInitials(m.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">
                            {m.user.name ?? "Tanpa Nama"}
                          </p>
                          {m.role === "lead" ? (
                            <Badge className="gap-1 text-[9px]" variant="secondary">
                              <Crown className="size-3" />
                              Lead
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {m.user.jobTitle ?? "—"}
                          {m.user.department ? ` • ${m.user.department}` : ""}
                        </p>
                      </div>
                      {isAdmin && m.role !== "lead" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === m.user._id}
                          onClick={() => handleRemove(m.user._id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isAdmin ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tambah Anggota
                </p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari karyawan..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {candidates.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Tidak ada kandidat yang cocok
                    </p>
                  ) : (
                    candidates.map((u) => (
                      <div
                        key={u._id}
                        className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-primary/30 hover:bg-muted/50"
                      >
                        <Avatar className="size-8">
                          {u.avatarUrl ? (
                            <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                          ) : null}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {u.name ?? "Tanpa Nama"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {u.jobTitle ?? "—"}
                            {u.department ? ` • ${u.department}` : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          disabled={busyId === u._id}
                          onClick={() => handleAdd(u._id)}
                        >
                          <UserPlus className="size-3.5" />
                          Tambah
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
