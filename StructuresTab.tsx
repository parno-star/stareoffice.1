import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Search, Users, Pencil } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import StructureEditorDialog from "./StructureEditorDialog.tsx";
import { formatIDR } from "../_lib/payroll-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function StructuresTab() {
  const [rawSearch, setRawSearch] = useState("");
  const [search] = useDebounce(rawSearch, 300);
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const directory = useQuery(api.payroll.structures.listSalaryDirectory, {
    search,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Struktur Gaji Karyawan</h2>
          <p className="text-sm text-muted-foreground">
            Lihat dan atur nominal komponen gaji untuk setiap karyawan.
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Cari karyawan, jabatan, atau departemen"
            className="pl-9"
          />
        </div>
      </div>

      {directory === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : directory.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Tidak ada hasil</EmptyTitle>
            <EmptyDescription>
              Coba ubah kata pencarian atau pastikan karyawan telah terdaftar.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {directory.map((u) => (
            <Card key={u._id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-11">
                    <AvatarImage src={u.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      {u.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.jobTitle ?? "-"} • {u.department ?? "-"}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Gross
                        </p>
                        <p className="text-sm font-medium tabular-nums">
                          {formatIDR(u.grossSalary)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Take home
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatIDR(u.netSalary)}
                        </p>
                      </div>
                      {u.overrideCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                        >
                          {u.overrideCount} override
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={() => {
                      setEditingUserId(u._id);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    Atur
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StructureEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={editingUserId}
      />
    </div>
  );
}
