import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  HEALTH_CONFIG,
  formatMetricValue,
} from "../_lib/okr-utils.ts";
import { cn } from "@/lib/utils.ts";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Clock, TrendingDown, TrendingUp, Minus } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyResult: Doc<"keyResults"> | null;
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function CheckInHistoryDialog({
  open,
  onOpenChange,
  keyResult,
}: Props) {
  const checkins = useQuery(
    api.okr.keyResults.listCheckins,
    open && keyResult ? { keyResultId: keyResult._id } : "skip",
  );

  if (!keyResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4" />
            Riwayat Check-in
          </DialogTitle>
          <DialogDescription>{keyResult.title}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {checkins === undefined ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Memuat riwayat...
            </p>
          ) : checkins.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
              Belum ada check-in. Ayo mulai update progress!
            </p>
          ) : (
            checkins.map((c) => {
              const health = HEALTH_CONFIG[c.status] ?? HEALTH_CONFIG.on_track;
              const delta = c.newValue - c.previousValue;
              const Icon =
                delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
              return (
                <div
                  key={c._id}
                  className="rounded-lg border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="size-7">
                        <AvatarImage src={c.user?.avatarUrl} />
                        <AvatarFallback className="text-xs">
                          {initials(c.user?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {c.user?.name ?? "Pengguna"}
                        </p>
                        <p
                          className="text-xs text-muted-foreground"
                          title={format(
                            new Date(c.checkedInAt),
                            "d MMM yyyy, HH:mm",
                            { locale: idLocale },
                          )}
                        >
                          {formatDistanceToNow(new Date(c.checkedInAt), {
                            addSuffix: true,
                            locale: idLocale,
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn("border", health.badge)}>
                      {health.label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Icon
                      className={cn(
                        "size-4",
                        delta > 0
                          ? "text-emerald-600"
                          : delta < 0
                            ? "text-rose-600"
                            : "text-muted-foreground",
                      )}
                    />
                    <span className="text-muted-foreground">
                      {formatMetricValue(
                        c.previousValue,
                        keyResult.metricType,
                        keyResult.unit,
                      )}
                    </span>
                    <span>→</span>
                    <span className="font-semibold">
                      {formatMetricValue(
                        c.newValue,
                        keyResult.metricType,
                        keyResult.unit,
                      )}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Keyakinan {c.confidence}%
                    </span>
                  </div>
                  {c.note ? (
                    <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm whitespace-pre-wrap">
                      {c.note}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
