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
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Plus, Users, Users2 } from "lucide-react";
import { useState } from "react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  CATEGORY_OPTIONS,
  getColorConfig,
} from "@/pages/training/_lib/training-utils.ts";
import PeerGroupFormDialog from "./PeerGroupFormDialog.tsx";

export default function PeerGroupsTab() {
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [joinedOnly, setJoinedOnly] = useState(false);

  const groups = useQuery(api.training.peerGroups.listGroups, {
    status: statusFilter,
    category: categoryFilter,
    joinedOnly,
  });

  const join = useMutation(api.training.peerGroups.joinGroup);

  const handleJoin = async (groupId: Id<"peerGroups">) => {
    try {
      await join({ groupId });
      toast.success("Berhasil bergabung");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full cursor-pointer sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="archived">Arsip</SelectItem>
              <SelectItem value="all">Semua</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full cursor-pointer sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={joinedOnly ? "default" : "secondary"}
            size="sm"
            className="cursor-pointer"
            onClick={() => setJoinedOnly((v) => !v)}
          >
            Hanya grup saya
          </Button>
        </div>
        <PeerGroupFormDialog
          trigger={
            <Button size="sm" className="cursor-pointer gap-1">
              <Plus className="size-4" /> Grup baru
            </Button>
          }
        />
      </div>

      {groups === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users2 />
            </EmptyMedia>
            <EmptyTitle>Belum ada grup belajar</EmptyTitle>
            <EmptyDescription>
              Buat grup pertama untuk belajar bareng rekan kerja Anda.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <PeerGroupFormDialog
              trigger={
                <Button size="sm" className="cursor-pointer gap-1">
                  <Plus className="size-4" /> Buat grup
                </Button>
              }
            />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const color = getColorConfig(g.coverColor);
            const full = g.capacity > 0 && g.memberCount >= g.capacity;
            return (
              <Card
                key={g._id}
                className="flex h-full flex-col overflow-hidden pt-0"
              >
                <div className={cn("p-4 text-white", color.cover)}>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{g.icon ?? "🤝"}</span>
                    <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px]">
                      {g.joinPolicy === "open" ? "Terbuka" : "Undangan"}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-lg font-bold">
                    {g.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-white/85">
                    {g.description}
                  </p>
                </div>
                <CardContent className="flex flex-1 flex-col gap-2 p-4 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {g.memberCount}
                      {g.capacity > 0 ? ` / ${g.capacity}` : ""} anggota
                    </span>
                    <span>{g.postCount} diskusi</span>
                  </div>
                  {g.cadence ? (
                    <p className="text-muted-foreground">
                      Jadwal: {g.cadence}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    {g.iAmMember ? (
                      <Button
                        size="sm"
                        className="flex-1 cursor-pointer"
                        asChild
                      >
                        <Link to={`/mentorship/group/${g._id}`}>Buka</Link>
                      </Button>
                    ) : g.joinPolicy === "open" && !full ? (
                      <Button
                        size="sm"
                        className="flex-1 cursor-pointer"
                        onClick={() => handleJoin(g._id)}
                      >
                        Gabung
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled>
                        {full ? "Penuh" : "Undangan saja"}
                      </Button>
                    )}
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
