import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { getInitials } from "@/pages/messages/_lib/messages-utils.ts";
import { toast } from "sonner";

export default function NewConversationDialog({
  trigger,
  onStarted,
}: {
  trigger: React.ReactNode;
  onStarted: (conversationId: Id<"conversations">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const employees = useQuery(
    api.users.listEmployees,
    open ? { search: search.trim() } : "skip",
  );
  const currentUser = useQuery(api.users.getCurrentUser, open ? {} : "skip");
  const startConversation = useMutation(api.messages.startConversation);
  const [startingId, setStartingId] = useState<Id<"users"> | null>(null);

  const list = useMemo(() => {
    if (!employees) return employees;
    return employees.filter((u) => u._id !== currentUser?._id);
  }, [employees, currentUser]);

  const handleStart = async (userId: Id<"users">) => {
    setStartingId(userId);
    try {
      const conversationId = await startConversation({ otherUserId: userId });
      setOpen(false);
      setSearch("");
      onStarted(conversationId);
    } catch {
      toast.error("Gagal memulai percakapan");
    } finally {
      setStartingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mulai percakapan baru</DialogTitle>
          <DialogDescription>
            Cari rekan kerja untuk memulai obrolan langsung.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {list === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada rekan kerja ditemukan.
            </p>
          ) : (
            list.map((u) => (
              <button
                key={u._id}
                onClick={() => {
                  void handleStart(u._id);
                }}
                disabled={startingId === u._id}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <Avatar className="size-10">
                  {u.avatarUrl ? (
                    <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.name ?? "Tanpa nama"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.jobTitle
                      ? `${u.jobTitle}${u.department ? ` · ${u.department}` : ""}`
                      : (u.department ?? u.email ?? "")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  tabIndex={-1}
                  disabled={startingId === u._id}
                >
                  {startingId === u._id ? "..." : "Obrolan"}
                </Button>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
