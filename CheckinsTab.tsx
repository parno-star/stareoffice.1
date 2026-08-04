import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import { MessageCircleHeart, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";
import type { CheckinWithUser } from "@/convex/onboarding/checkins.ts";
import {
  MOOD_CONFIG,
  formatDate,
  getInitials,
} from "../_lib/onboarding-utils.ts";
import CheckinReviewDialog from "./CheckinReviewDialog.tsx";

function CheckinRow({
  checkin,
  onOpen,
}: {
  checkin: CheckinWithUser;
  onOpen: () => void;
}) {
  const moodCfg =
    checkin.moodScore != null ? MOOD_CONFIG[checkin.moodScore] : null;

  const statusBadge =
    checkin.status === "reviewed"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
      : checkin.status === "submitted"
        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
        : "bg-muted text-muted-foreground border-border";

  const statusLabel =
    checkin.status === "reviewed"
      ? "Ditinjau"
      : checkin.status === "submitted"
        ? "Menunggu Tinjauan"
        : "Belum Dikirim";

  const canOpen = checkin.status !== "pending";

  return (
    <Card
      className={
        canOpen
          ? "cursor-pointer hover:border-primary/50 transition-colors"
          : "opacity-80"
      }
      onClick={canOpen ? onOpen : undefined}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Avatar className="size-10">
            {checkin.userAvatar ? (
              <AvatarImage src={checkin.userAvatar} />
            ) : null}
            <AvatarFallback>{getInitials(checkin.userName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {checkin.userName ?? "Karyawan"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {checkin.label}
                  {checkin.userJobTitle ? ` · ${checkin.userJobTitle}` : ""}
                </p>
              </div>
              <Badge variant="outline" className={statusBadge}>
                {statusLabel}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(checkin.scheduledDate)}
              </span>
              {moodCfg ? (
                <span className="inline-flex items-center gap-1">
                  · <span className="text-base leading-none">{moodCfg.emoji}</span>{" "}
                  {moodCfg.label}
                </span>
              ) : null}
            </div>
          </div>
          {canOpen ? (
            <Button size="icon-sm" variant="ghost" className="cursor-pointer">
              <ChevronRight className="size-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CheckinList({ status }: { status: string }) {
  const rows = useQuery(api.onboarding.checkins.listForReview, { status });
  const [selected, setSelected] = useState<CheckinWithUser | null>(null);
  const [open, setOpen] = useState(false);

  const openCheckin = (c: CheckinWithUser) => {
    setSelected(c);
    setOpen(true);
  };

  if (rows === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleHeart />
          </EmptyMedia>
          <EmptyTitle>Tidak ada check-in</EmptyTitle>
          <EmptyDescription>
            Check-in akan muncul setelah karyawan baru mengisi pertanyaan 30,
            60, atau 90 hari.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {rows.map((c) => (
          <CheckinRow key={c._id} checkin={c} onOpen={() => openCheckin(c)} />
        ))}
      </div>
      <CheckinReviewDialog
        open={open}
        onOpenChange={setOpen}
        checkin={selected}
      />
    </>
  );
}

export default function CheckinsTab() {
  return (
    <Tabs defaultValue="submitted" className="space-y-3">
      <TabsList>
        <TabsTrigger value="submitted" className="cursor-pointer">
          Menunggu Tinjauan
        </TabsTrigger>
        <TabsTrigger value="reviewed" className="cursor-pointer">
          Sudah Ditinjau
        </TabsTrigger>
        <TabsTrigger value="pending" className="cursor-pointer">
          Dijadwalkan
        </TabsTrigger>
        <TabsTrigger value="all" className="cursor-pointer">
          Semua
        </TabsTrigger>
      </TabsList>
      <TabsContent value="submitted">
        <CheckinList status="submitted" />
      </TabsContent>
      <TabsContent value="reviewed">
        <CheckinList status="reviewed" />
      </TabsContent>
      <TabsContent value="pending">
        <CheckinList status="pending" />
      </TabsContent>
      <TabsContent value="all">
        <CheckinList status="all" />
      </TabsContent>
    </Tabs>
  );
}
