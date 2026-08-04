import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  CheckCircle2,
  XCircle,
  Send,
  RotateCcw,
  RefreshCw,
  Banknote,
  CircleX,
  FilePlus,
  UserCheck,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { getActionConfig, formatTimestamp } from "../_lib/audit-utils.ts";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  created: <FilePlus className="size-3.5" />,
  submitted: <Send className="size-3.5" />,
  approved: <CheckCircle2 className="size-3.5" />,
  rejected: <XCircle className="size-3.5" />,
  revision_requested: <RotateCcw className="size-3.5" />,
  resubmitted: <RefreshCw className="size-3.5" />,
  disbursed: <Banknote className="size-3.5" />,
  cancelled: <CircleX className="size-3.5" />,
  delegated: <UserCheck className="size-3.5" />,
};

type Props = {
  fundRequestId: Id<"fundRequests">;
};

export default function AuditTimeline({ fundRequestId }: Props) {
  const timeline = useQuery(api.financeAuditLog.getRequestTimeline, { fundRequestId });

  if (timeline === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Clock className="size-4" />
        <span>Belum ada riwayat aktifitas</span>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

      {timeline.map((entry, idx) => {
        const actionCfg = getActionConfig(entry.action);
        const isLast = idx === timeline.length - 1;

        return (
          <div key={entry._id} className="relative flex gap-3 pb-4">
            {/* Timeline dot */}
            <div
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                actionCfg.border,
              )}
            >
              <span className={actionCfg.color}>
                {ACTION_ICONS[entry.action] ?? <Clock className="size-3.5" />}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0", actionCfg.bg, actionCfg.color, actionCfg.border)}
                >
                  {actionCfg.label}
                </Badge>
                {entry.approvalLevel ? (
                  <span className="text-[10px] text-muted-foreground">
                    Level {entry.approvalLevel}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="size-5">
                  <AvatarImage src={entry.actorAvatar ?? undefined} />
                  <AvatarFallback className="text-[8px]">
                    {getInitials(entry.actorName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{entry.actorName}</span>
                {entry.actorRole ? (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    ({entry.actorRole})
                  </span>
                ) : null}
              </div>
              {entry.note ? (
                <p className="mt-1 text-xs text-muted-foreground italic leading-snug">
                  &ldquo;{entry.note}&rdquo;
                </p>
              ) : null}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
