import { Card, CardContent } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ChevronRight, Calendar } from "lucide-react";
import type { OnboardingWithUser } from "@/convex/onboarding.ts";
import {
  getInitials,
  formatDate,
  daysUntilStart,
} from "../_lib/onboarding-utils.ts";

type Props = {
  onboarding: OnboardingWithUser;
  onOpen: () => void;
};

export default function OnboardingCard({ onboarding, onOpen }: Props) {
  const days = daysUntilStart(onboarding.startDate);
  const startLabel =
    onboarding.status === "completed"
      ? "Selesai"
      : days > 0
        ? `${days} hari lagi`
        : days === 0
          ? "Mulai hari ini"
          : `${Math.abs(days)} hari berjalan`;

  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onOpen}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-11">
            {onboarding.userAvatar ? (
              <AvatarImage src={onboarding.userAvatar} />
            ) : null}
            <AvatarFallback>
              {getInitials(onboarding.userName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {onboarding.userName ?? "Karyawan"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {onboarding.userJobTitle ?? "Tanpa jabatan"}
                  {onboarding.userDepartment
                    ? ` · ${onboarding.userDepartment}`
                    : ""}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  onboarding.status === "completed"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : onboarding.status === "paused"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20"
                }
              >
                {onboarding.status === "completed"
                  ? "Selesai"
                  : onboarding.status === "paused"
                    ? "Ditunda"
                    : "Aktif"}
              </Badge>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {onboarding.progress.done}/{onboarding.progress.total} tugas
                </span>
                <span className="font-semibold tabular-nums">
                  {onboarding.progress.percent}%
                </span>
              </div>
              <Progress
                value={onboarding.progress.percent}
                className="mt-1 h-1.5"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(onboarding.startDate)}
              </span>
              <span>· {startLabel}</span>
              {onboarding.buddyName ? (
                <span>· Buddy: {onboarding.buddyName}</span>
              ) : null}
            </div>
          </div>

          <Button size="icon-sm" variant="ghost" className="cursor-pointer">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
