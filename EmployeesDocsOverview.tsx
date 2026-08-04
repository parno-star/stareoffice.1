import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  AlertTriangle,
  CalendarClock,
  FileStack,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export default function EmployeesDocsOverview({
  onSelectEmployee,
  selectedId,
}: {
  onSelectEmployee: (userId: Id<"users">) => void;
  selectedId: Id<"users"> | null;
}) {
  const overview = useQuery(api.employeeDocuments.listEmployeesOverview, {});
  const [search, setSearch] = useState("");

  if (overview === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? overview.filter(
        (row) =>
          (row.user.name ?? "").toLowerCase().includes(q) ||
          (row.user.email ?? "").toLowerCase().includes(q) ||
          (row.user.department ?? "").toLowerCase().includes(q),
      )
    : overview;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari karyawan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Tidak ada karyawan</EmptyTitle>
            <EmptyDescription>
              {q
                ? "Coba ubah kata kunci pencarian."
                : "Belum ada karyawan yang terdaftar."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const isSelected = row.user._id === selectedId;
            return (
              <Card
                key={row.user._id}
                onClick={() => onSelectEmployee(row.user._id)}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:border-primary/40"
                }`}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar className="size-11">
                    {row.user.avatarUrl ? (
                      <AvatarImage src={row.user.avatarUrl} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                      {getInitials(row.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {row.user.name ?? "Tanpa nama"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.user.department ?? row.user.email ?? "-"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="secondary" className="gap-1">
                      <FileStack className="size-3" />
                      {row.documentCount}
                    </Badge>
                    {row.expired > 0 ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-red-500/10 text-red-700 dark:text-red-300"
                      >
                        <AlertTriangle className="size-3" />
                        {row.expired}
                      </Badge>
                    ) : row.expiringSoon > 0 ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      >
                        <CalendarClock className="size-3" />
                        {row.expiringSoon}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
