import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ChevronDown, Crown, Users as UsersIcon } from "lucide-react";
import { getInitials } from "../_lib/org-utils.ts";

export default function ReportingLineDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: Id<"users"> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const chain = useQuery(
    api.organization.getReportingLine,
    userId ? { userId } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Jalur Pelaporan</DialogTitle>
          <DialogDescription>
            Rantai atasan dari pimpinan tertinggi hingga karyawan ini.
          </DialogDescription>
        </DialogHeader>

        {!chain ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : chain.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada jalur pelaporan
          </p>
        ) : (
          <div className="space-y-2">
            {chain.map((u, idx) => {
              const isTop = idx === 0;
              const isLast = idx === chain.length - 1;
              return (
                <div key={u._id}>
                  <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <Avatar className="size-10">
                      {u.avatarUrl ? (
                        <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">
                          {u.name ?? "Tanpa Nama"}
                        </p>
                        {isTop ? (
                          <Badge className="gap-1 text-[10px]" variant="secondary">
                            <Crown className="size-3" /> Pimpinan
                          </Badge>
                        ) : null}
                        {isLast ? (
                          <Badge className="gap-1 text-[10px]">
                            <UsersIcon className="size-3" /> Karyawan
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.jobTitle ?? "—"}
                        {u.department ? ` • ${u.department}` : ""}
                      </p>
                    </div>
                  </div>
                  {!isLast ? (
                    <div className="flex justify-center py-1 text-muted-foreground/60">
                      <ChevronDown className="size-4" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
