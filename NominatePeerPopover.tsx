import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import { Search } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function NominatePeerPopover({
  cycleId,
}: {
  cycleId: Id<"feedback360Cycles">;
}) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const myReviewers = useQuery(
    api.feedback360.reviewers.listMyReviewers,
    { cycleId },
  );
  const nominate = useMutation(
    api.feedback360.reviewers.nominatePeerReviewer,
  );
  const [search, setSearch] = useState("");
  const [debounced] = useDebounce(search, 250);
  const employees = useQuery(api.users.listEmployees, {
    search: debounced || undefined,
  });
  const [pendingId, setPendingId] = useState<Id<"users"> | null>(null);

  const invitedIds = useMemo(() => {
    return new Set((myReviewers ?? []).map((r) => r.reviewerId));
  }, [myReviewers]);

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees.filter(
      (e) => e._id !== currentUser?._id && !invitedIds.has(e._id),
    );
  }, [employees, currentUser, invitedIds]);

  async function handleNominate(userId: Id<"users">) {
    setPendingId(userId);
    try {
      await nominate({ cycleId, reviewerId: userId });
      toast.success("Rekan berhasil dinominasikan");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menominasikan rekan");
      } else {
        toast.error("Gagal menominasikan rekan");
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Nominasikan rekan kerja</p>
        <p className="text-xs text-muted-foreground">
          Mereka akan menerima undangan untuk memberi feedback kepada Anda.
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari rekan..."
          className="pl-8"
        />
      </div>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {employees === undefined ? (
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-2 text-center text-xs text-muted-foreground">
            Tidak ada rekan yang dapat dinominasikan.
          </p>
        ) : (
          filtered.slice(0, 20).map((emp) => (
            <div
              key={emp._id}
              className="flex items-center gap-2 rounded-md p-2 hover:bg-muted"
            >
              <Avatar className="size-8 shrink-0">
                {emp.avatarUrl ? <AvatarImage src={emp.avatarUrl} /> : null}
                <AvatarFallback className="text-[10px]">
                  {initials(emp.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {emp.name ?? "Tanpa nama"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {emp.jobTitle ?? emp.department ?? "Karyawan"}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={pendingId === emp._id}
                onClick={() => handleNominate(emp._id)}
                className="cursor-pointer"
              >
                {pendingId === emp._id ? "…" : "Undang"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
