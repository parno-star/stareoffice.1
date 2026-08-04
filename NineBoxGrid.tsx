import { BOX_META, GRID_LAYOUT, type BoxCode } from "../_lib/talent-utils.ts";
import { cn } from "@/lib/utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { getInitials } from "../_lib/talent-utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { ArrowUpRight } from "lucide-react";

type Placement = {
  placement: Doc<"talentPlacements">;
  user: Doc<"users"> | null;
  manager: Doc<"users"> | null;
};

type Props = {
  placements: ReadonlyArray<Placement>;
  onSelectPlacement?: (placementId: string) => void;
  selectedCode?: BoxCode | null;
  onSelectCode?: (code: BoxCode | null) => void;
  compact?: boolean;
};

export default function NineBoxGrid({
  placements,
  onSelectPlacement,
  selectedCode,
  onSelectCode,
  compact,
}: Props) {
  // Bucket placements by box code (only those that have a finalized or
  // calibrated placement)
  const buckets = new Map<BoxCode, Array<Placement>>();
  for (const row of GRID_LAYOUT) {
    for (const code of row) buckets.set(code, []);
  }
  for (const p of placements) {
    const code = (p.placement.boxCode ?? null) as BoxCode | null;
    if (code && buckets.has(code)) {
      const list = buckets.get(code);
      if (list) list.push(p);
    }
  }

  return (
    <div className="space-y-3">
      {/* Axis labels */}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div className="w-24 shrink-0" />
        <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
          <div>Performa Rendah</div>
          <div>Performa Sedang</div>
          <div>Performa Tinggi</div>
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div className="flex flex-col justify-around py-2 pr-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="-rotate-90 whitespace-nowrap">Potensi Tinggi</div>
          <div className="-rotate-90 whitespace-nowrap">Potensi Sedang</div>
          <div className="-rotate-90 whitespace-nowrap">Potensi Rendah</div>
        </div>
        <div className="grid grid-cols-3 grid-rows-3 gap-2">
          {GRID_LAYOUT.map((row) =>
            row.map((code) => {
              const meta = BOX_META[code];
              const items = buckets.get(code) ?? [];
              const isSelected = selectedCode === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectCode?.(isSelected ? null : code)}
                  className={cn(
                    "group cursor-pointer rounded-xl border-2 p-3 text-left transition-all",
                    meta.bg,
                    meta.border,
                    isSelected && "ring-2 ring-primary ring-offset-2",
                    compact ? "min-h-[120px]" : "min-h-[170px]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={cn("text-xs font-semibold truncate", meta.text)}>
                        {meta.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 line-clamp-2">
                        {meta.description}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        meta.chip,
                      )}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.slice(0, compact ? 4 : 8).map((p) => {
                      const name = p.placement.userName ?? p.user?.name ?? "?";
                      return (
                        <button
                          key={p.placement._id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPlacement?.(p.placement._id);
                          }}
                          className="flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium shadow-sm ring-1 ring-border hover:ring-primary"
                          title={name}
                        >
                          <Avatar className="size-4">
                            <AvatarImage src={p.user?.avatarUrl} alt={name} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[80px] truncate">{name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                    {items.length > (compact ? 4 : 8) ? (
                      <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        +{items.length - (compact ? 4 : 8)}
                      </span>
                    ) : null}
                  </div>
                  {!compact && items.length > 0 ? (
                    <div className="mt-2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Lihat <ArrowUpRight className="size-3" />
                    </div>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Tindakan:</span>
        {selectedCode ? (
          <>
            <span className={cn("rounded-full px-2 py-0.5 font-medium", BOX_META[selectedCode].chip)}>
              {BOX_META[selectedCode].label}
            </span>
            <span>→ {BOX_META[selectedCode].action}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => onSelectCode?.(null)}
            >
              Reset
            </Button>
          </>
        ) : (
          <span>Klik kotak untuk melihat detail rekomendasi.</span>
        )}
      </div>
    </div>
  );
}
