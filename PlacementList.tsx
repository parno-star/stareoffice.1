import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  BOX_META,
  PLACEMENT_STATUS,
  getInitials,
  getBoxMeta,
} from "../_lib/talent-utils.ts";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Users, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";

type PlacementRow = {
  placement: Doc<"talentPlacements">;
  user: Doc<"users"> | null;
  manager: Doc<"users"> | null;
};

type Props = {
  rows: ReadonlyArray<PlacementRow>;
  onOpen: (placementId: string) => void;
  emptyLabel?: string;
};

const RANK: Record<string, number> = {
  risk: 1,
  enigma: 2,
  effective: 2,
  rough_diamond: 3,
  core: 3,
  solid_performer: 3,
  growth: 4,
  high_performer: 4,
  star: 5,
};

export default function PlacementList({ rows, onOpen, emptyLabel }: Props) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>Belum ada karyawan</EmptyTitle>
          <EmptyDescription>
            {emptyLabel ?? "Mulai siklus untuk mengisi daftar karyawan."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="divide-y rounded-lg border">
      {rows.map(({ placement, user, manager }) => {
        const boxMeta = getBoxMeta(placement.boxCode);
        const prevMeta = getBoxMeta(placement.previousBoxCode);
        const status = PLACEMENT_STATUS[placement.status];
        const movement = boxMeta && prevMeta
          ? (RANK[boxMeta.code] ?? 0) - (RANK[prevMeta.code] ?? 0)
          : 0;
        return (
          <div
            key={placement._id}
            className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
            onClick={() => onOpen(placement._id)}
          >
            <Avatar className="size-10">
              <AvatarImage src={user?.avatarUrl} alt={placement.userName} />
              <AvatarFallback>
                {getInitials(placement.userName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-sm truncate">
                  {placement.userName}
                </span>
                {placement.userJobTitle ? (
                  <span className="text-xs text-muted-foreground truncate">
                    · {placement.userJobTitle}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {placement.userDepartment ?? "-"}
                </span>
                {manager ? (
                  <span className="text-xs text-muted-foreground">
                    · Atasan: {manager.name}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              {boxMeta ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    boxMeta.chip,
                  )}
                >
                  {boxMeta.label}
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  Belum dinilai
                </span>
              )}
              {status ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    status.tone,
                  )}
                >
                  {status.label}
                </span>
              ) : null}
            </div>
            {movement !== 0 && boxMeta ? (
              <div
                className={cn(
                  "hidden md:flex items-center gap-0.5 text-xs font-medium",
                  movement > 0
                    ? "text-emerald-600"
                    : movement < 0
                      ? "text-rose-600"
                      : "text-muted-foreground",
                )}
              >
                {movement > 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {prevMeta?.shortLabel}
              </div>
            ) : null}
            <Button size="icon-sm" variant="ghost">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// Kept for tree-shaking friendliness: ensures BOX_META is referenced.
export { BOX_META };
