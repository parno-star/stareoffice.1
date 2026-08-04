import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Calendar } from "lucide-react";
import StarRating from "./StarRating.tsx";
import type { ReviewWithUsers } from "@/convex/performance.ts";
import {
  STATUS_BADGES,
  STATUS_LABELS,
  type ReviewStatus,
} from "../_lib/performance-utils.ts";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";

type Props = {
  review: ReviewWithUsers;
  // Which person to highlight: "reviewee" when viewing as manager, "reviewer"
  // when viewing as employee.
  perspective: "reviewee" | "reviewer";
  // Optional multi-select controls. When `selectable` is true a checkbox is
  // shown and clicking the card toggles selection instead of navigating.
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ReviewCard({
  review,
  perspective,
  selectable,
  selected,
  onToggleSelect,
}: Props) {
  const navigate = useNavigate();
  const status = review.status as ReviewStatus;
  const displayName =
    perspective === "reviewee"
      ? review.revieweeName ?? "Karyawan"
      : review.reviewerName ?? "Reviewer";
  const displayAvatar =
    perspective === "reviewee" ? review.revieweeAvatar : review.reviewerAvatar;
  const displaySub =
    perspective === "reviewee"
      ? review.revieweeJobTitle ?? review.revieweeDepartment ?? ""
      : "Reviewer";

  const timestamp = review.submittedAt ?? review.acknowledgedAt;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:border-primary/40",
        selectable && selected && "ring-2 ring-primary",
      )}
      onClick={() => {
        if (selectable) {
          onToggleSelect?.();
          return;
        }
        navigate(`/performance/${review._id}`);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {selectable ? (
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect?.()}
                aria-label="Pilih penilaian"
                className="cursor-pointer"
              />
            </div>
          ) : null}
          <Avatar className="size-11 shrink-0">
            {displayAvatar ? <AvatarImage src={displayAvatar} /> : null}
            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{displayName}</h3>
                {displaySub ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {displaySub}
                  </p>
                ) : null}
              </div>
              <Badge
                variant="outline"
                className={cn("shrink-0", STATUS_BADGES[status])}
              >
                {STATUS_LABELS[status]}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                {review.periodLabel}
              </div>
              {timestamp ? (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(timestamp), "dd MMM yyyy", {
                    locale: idLocale,
                  })}
                </span>
              ) : null}
            </div>

            {review.overallRating !== undefined ? (
              <div className="mt-3 flex items-center gap-2">
                <StarRating value={review.overallRating} readOnly size="sm" />
                <span className="text-xs text-muted-foreground">
                  skor keseluruhan
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Belum ada rating keseluruhan
              </p>
            )}

            {review.reviewerComments ? (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                "{review.reviewerComments}"
              </p>
            ) : null}
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
