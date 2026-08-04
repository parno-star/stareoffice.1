import { useCallback, useRef } from "react";
import { X, MoveVertical, MoveHorizontal } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  type BreakLine,
  type NodeBox,
  computePageRegions,
  PAGE_REGION_PAD,
} from "../_lib/page-break.ts";

type Props = {
  canvasW: number;
  canvasH: number;
  zoom: number;
  breaks: BreakLine[];
  nodeBoxes: NodeBox[];
  onMoveBreak: (id: string, pos: number) => void;
  onRemoveBreak: (id: string) => void;
};

// Renders page boundary guides, margins, and draggable manual break lines.
// Lives INSIDE the scaled canvas wrapper so it scrolls/zooms with the chart.
export default function PageBreakLayer({
  canvasW,
  canvasH,
  zoom,
  breaks,
  nodeBoxes,
  onMoveBreak,
  onRemoveBreak,
}: Props) {
  // Use the SAME region computation as the preview/PDF so the boxes drawn here
  // are exactly what each page will capture (padded node bounding box), instead
  // of the raw grid cells. This makes the on-canvas guides match the preview.
  const { regions } = computePageRegions(
    canvasW,
    canvasH,
    breaks,
    nodeBoxes,
    PAGE_REGION_PAD,
  );

  const dragState = useRef<{
    id: string;
    orientation: "vertical" | "horizontal";
    startClient: number;
    startPos: number;
  } | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      const client = st.orientation === "vertical" ? e.clientX : e.clientY;
      const deltaCanvas = (client - st.startClient) / zoom;
      const limit = st.orientation === "vertical" ? canvasW : canvasH;
      const next = Math.max(4, Math.min(limit - 4, st.startPos + deltaCanvas));
      onMoveBreak(st.id, next);
    },
    [zoom, canvasW, canvasH, onMoveBreak],
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const startDrag = useCallback(
    (e: React.PointerEvent, line: BreakLine) => {
      e.stopPropagation();
      e.preventDefault();
      dragState.current = {
        id: line.id,
        orientation: line.orientation,
        startClient: line.orientation === "vertical" ? e.clientX : e.clientY,
        startPos: line.pos,
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [handlePointerMove, handlePointerUp],
  );

  // Scale-independent handle size so grips stay usable at any zoom.
  const inv = 1 / zoom;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: canvasW, height: canvasH }}
      data-page-break-layer
    >
      {/* Page capture regions — exactly what each printed page will contain. */}
      {regions.map((region) => (
        <div
          key={`region-${region.key}`}
          className="absolute border-2 border-primary/40 bg-primary/[0.04]"
          style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
        >
          {/* Page number badge */}
          <div
            className="absolute rounded bg-primary/80 px-1.5 py-0.5 font-semibold text-primary-foreground"
            style={{
              left: 4 * inv,
              top: 4 * inv,
              fontSize: 11 * inv,
              transformOrigin: "top left",
            }}
          >
            Hal. {region.pageIndex}
          </div>
        </div>
      ))}

      {/* Manual break lines — draggable */}
      {breaks.map((line) => {
        const isV = line.orientation === "vertical";
        return (
          <div
            key={line.id}
            className="group pointer-events-auto absolute"
            data-orgchart-node="break"
            style={
              isV
                ? { left: line.pos - 6 * inv, top: 0, width: 12 * inv, height: canvasH }
                : { left: 0, top: line.pos - 6 * inv, width: canvasW, height: 12 * inv }
            }
          >
            {/* The visible line */}
            <div
              className={cn(
                "absolute bg-primary/70",
                isV ? "left-1/2 top-0 h-full -translate-x-1/2" : "left-0 top-1/2 w-full -translate-y-1/2",
              )}
              style={isV ? { width: 2 * inv } : { height: 2 * inv }}
            />
            {/* Drag grip */}
            <button
              type="button"
              onPointerDown={(e) => startDrag(e, line)}
              className={cn(
                "absolute flex items-center justify-center rounded-full border border-primary bg-background text-primary shadow-md",
                isV ? "cursor-ew-resize left-1/2 -translate-x-1/2" : "cursor-ns-resize top-1/2 -translate-y-1/2",
              )}
              style={
                isV
                  ? { top: 40 * inv, width: 22 * inv, height: 22 * inv }
                  : { left: 40 * inv, width: 22 * inv, height: 22 * inv }
              }
              aria-label="Geser batas halaman"
            >
              {isV ? (
                <MoveHorizontal style={{ width: 12 * inv, height: 12 * inv }} />
              ) : (
                <MoveVertical style={{ width: 12 * inv, height: 12 * inv }} />
              )}
            </button>
            {/* Remove button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveBreak(line.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "absolute flex items-center justify-center rounded-full border border-destructive bg-background text-destructive shadow-md",
              )}
              style={
                isV
                  ? { top: 70 * inv, left: "50%", transform: "translateX(-50%)", width: 22 * inv, height: 22 * inv }
                  : { left: 70 * inv, top: "50%", transform: "translateY(-50%)", width: 22 * inv, height: 22 * inv }
              }
              aria-label="Hapus batas halaman"
            >
              <X style={{ width: 12 * inv, height: 12 * inv }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
