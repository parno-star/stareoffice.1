import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import type { CompletenessResult } from "../_lib/directory-completeness.ts";

/**
 * A small "Belum lengkap" badge shown for employees whose data is incomplete.
 * Hovering (or tapping) reveals the list of missing fields. Renders nothing
 * when the record is already complete.
 */
export function IncompleteBadge({
  result,
  className,
}: {
  result: CompletenessResult;
  className?: string;
}) {
  if (result.isComplete) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className={cn(
            "cursor-default gap-1 border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="size-3" />
          Belum lengkap
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">
        <p className="mb-1 font-semibold">
          {result.missing.length} data belum diisi:
        </p>
        <p>{result.missing.join(", ")}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A compact circular percentage ring showing data completeness. Color shifts
 * from red (low) through amber to green (complete).
 */
export function CompletenessRing({
  percent,
  size = 36,
}: {
  percent: number;
  size?: number;
}) {
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color =
    percent >= 100
      ? "text-emerald-500"
      : percent >= 60
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Kelengkapan data ${percent}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all", color)}
          stroke="currentColor"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
        {percent}%
      </span>
    </div>
  );
}
