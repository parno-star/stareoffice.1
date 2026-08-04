import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import { Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import type { ReviewerInviteItem } from "@/convex/feedback360/reviewers.ts";
import {
  RELATIONSHIP_BADGE,
  RELATIONSHIP_ICONS,
  RELATIONSHIP_LABELS,
  INVITE_STATUS_CONFIG,
} from "@/pages/feedback360/_lib/feedback360-utils.ts";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function MyInviteCard({
  invite,
  onOpen,
  readOnly,
}: {
  invite: ReviewerInviteItem;
  onOpen?: () => void;
  readOnly?: boolean;
}) {
  const RelIcon = RELATIONSHIP_ICONS[invite.relationship];
  const statusCfg =
    INVITE_STATUS_CONFIG[invite.status] ?? INVITE_STATUS_CONFIG.pending;

  return (
    <Card
      className={cn(
        !readOnly && "cursor-pointer transition-colors hover:border-primary/40",
      )}
      onClick={() => {
        if (!readOnly) onOpen?.();
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-11 shrink-0">
            {invite.revieweeAvatar ? (
              <AvatarImage src={invite.revieweeAvatar} />
            ) : null}
            <AvatarFallback>{initials(invite.revieweeName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">
                  {invite.revieweeName}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {invite.revieweeJobTitle ?? invite.revieweeDepartment ?? "Karyawan"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Badge
                  variant="outline"
                  className={cn("border", RELATIONSHIP_BADGE[invite.relationship])}
                >
                  <RelIcon className="mr-1 size-3" />
                  {RELATIONSHIP_LABELS[invite.relationship]}
                </Badge>
                <Badge variant="outline" className={cn("border", statusCfg.badge)}>
                  {statusCfg.label}
                </Badge>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="truncate">{invite.cycleTitle}</span>
              <span>·</span>
              <span>{invite.cyclePeriodLabel}</span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Tutup{" "}
                {format(new Date(invite.cycleEndDate), "d MMM", {
                  locale: idLocale,
                })}
              </span>
            </div>
          </div>
          {!readOnly ? (
            <Button size="sm" className="shrink-0 cursor-pointer">
              Isi
              <ChevronRight className="size-4" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
