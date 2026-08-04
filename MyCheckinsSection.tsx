import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { MessageCircleHeart, CalendarClock } from "lucide-react";
import { useState } from "react";
import type { CheckinWithUser } from "@/convex/onboarding/checkins.ts";
import { MOOD_CONFIG, formatDate, todayIso } from "../_lib/onboarding-utils.ts";
import CheckinSubmitDialog from "./CheckinSubmitDialog.tsx";
import { cn } from "@/lib/utils.ts";

export default function MyCheckinsSection() {
  const checkins = useQuery(api.onboarding.checkins.listMine, {});
  const [selected, setSelected] = useState<CheckinWithUser | null>(null);
  const [open, setOpen] = useState(false);

  if (checkins === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Belum ada check-in terjadwal.
      </p>
    );
  }

  const today = todayIso();

  const openCheckin = (c: CheckinWithUser) => {
    setSelected(c);
    setOpen(true);
  };

  return (
    <>
      <div className="space-y-2">
        {checkins.map((c) => {
          const isAvailable = c.scheduledDate <= today;
          const isPending = c.status === "pending";
          const moodCfg =
            c.moodScore != null ? MOOD_CONFIG[c.moodScore] : null;

          const statusBadge =
            c.status === "reviewed"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              : c.status === "submitted"
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
                : isAvailable
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                  : "bg-muted text-muted-foreground border-border";

          const statusLabel =
            c.status === "reviewed"
              ? "Ditinjau"
              : c.status === "submitted"
                ? "Terkirim"
                : isAvailable
                  ? "Siap Diisi"
                  : "Dijadwalkan";

          return (
            <Card
              key={c._id}
              className={cn(
                isPending && !isAvailable ? "opacity-80" : "",
                "transition-colors hover:border-primary/40",
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageCircleHeart className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {c.label}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3" />
                          {formatDate(c.scheduledDate)}
                        </p>
                      </div>
                      <Badge variant="outline" className={statusBadge}>
                        {statusLabel}
                      </Badge>
                    </div>
                    {moodCfg ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Mood saya:{" "}
                        <span className="text-base">{moodCfg.emoji}</span>{" "}
                        {moodCfg.label}
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      {isPending && isAvailable ? (
                        <Button
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => openCheckin(c)}
                        >
                          Isi Check-in
                        </Button>
                      ) : c.status === "submitted" ||
                        c.status === "reviewed" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => openCheckin(c)}
                        >
                          Lihat Check-in
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled
                          className="cursor-not-allowed"
                        >
                          Belum Tersedia
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CheckinSubmitDialog
        open={open}
        onOpenChange={setOpen}
        checkin={selected}
      />
    </>
  );
}
