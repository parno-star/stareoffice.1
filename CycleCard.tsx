import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate } from "react-router-dom";
import {
  Users2,
  Calendar,
  ChevronRight,
  Compass,
  CircleDot,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import type { CycleListItem } from "@/convex/feedback360/cycles.ts";
import {
  CYCLE_STATUS_CONFIG,
  getCoverClass,
} from "@/pages/feedback360/_lib/feedback360-utils.ts";

export default function CycleCard({ cycle }: { cycle: CycleListItem }) {
  const navigate = useNavigate();
  const statusCfg =
    CYCLE_STATUS_CONFIG[cycle.status] ?? CYCLE_STATUS_CONFIG.draft;
  const completionRate =
    cycle.totalReviewerCount > 0
      ? Math.round(
          (cycle.completedReviewerCount / cycle.totalReviewerCount) * 100,
        )
      : 0;

  return (
    <Card className="overflow-hidden p-0">
      <div
        className={cn(
          "flex h-20 items-center justify-between px-4",
          getCoverClass(cycle.color),
        )}
      >
        <div className="flex items-center gap-2 text-white">
          <Compass className="size-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {cycle.periodLabel}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn("border", statusCfg.badge)}
        >
          <CircleDot className={cn("mr-1 size-2", statusCfg.dot, "rounded-full")} />
          {statusCfg.label}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 font-semibold">{cycle.title}</h3>
          {cycle.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {cycle.description}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users2 className="size-3" />
              <span>Reviewee</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold">{cycle.reviewCount}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CircleDot className="size-3" />
              <span>Selesai</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold">
              {completionRate}%
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="size-3" />
              <span>Tutup</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold">
              {format(new Date(cycle.endDate), "d MMM", { locale: idLocale })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-xs text-muted-foreground">
            {cycle.questionCount} pertanyaan
            {cycle.myPendingAsReviewer > 0 ? (
              <>
                {" · "}
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  {cycle.myPendingAsReviewer} menunggu Anda
                </span>
              </>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/feedback360/${cycle._id}`)}
            className="cursor-pointer"
          >
            Buka
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
