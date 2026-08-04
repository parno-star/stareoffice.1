import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrgNode, ColorToken, PositionLevelInfo } from "../_lib/org-utils.ts";
import { colorClasses, getInitials } from "../_lib/org-utils.ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Users as UsersIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GripVertical,
  Minus,
  Eye,
  X,
  Shield,
  SquareDashedBottom,
  Plus,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Move,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import PageBreakLayer from "./PageBreakLayer.tsx";
import {
  type BreakLine,
  type PageConfig,
  type PaperSizeKey,
  type PageOrientation,
  DEFAULT_PAGE_CONFIG,
  PAPER_OPTIONS,
  CUSTOM_PAPER_MIN_MM,
  CUSTOM_PAPER_MAX_MM,
  DEFAULT_CUSTOM_W_MM,
  DEFAULT_CUSTOM_H_MM,
  makeBreakId,
  computePageRegions,
  PAGE_REGION_PAD,
  getPageContentSizePx,
} from "../_lib/page-break.ts";
import { isAdminRole } from "@/convex/roles.ts";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

// ─── Layout constants ─────────────────────────────────────────────────────────
const NODE_W = 240;
const NODE_H = 82;  // slightly taller for position level badge
const H_GAP = 48;   // horizontal gap between sibling subtrees
const V_GAP = 64;   // vertical gap between parent bottom and child top

// ─── Types ────────────────────────────────────────────────────────────────────
type DepartmentColorMap = Map<string, ColorToken>;

type Props = {
  nodes: Array<OrgNode>;
  onSelectUser: (id: Id<"users">) => void;
  highlightUserId?: Id<"users"> | null;
  departmentColors: DepartmentColorMap;
  allowDragDrop?: boolean;
  dottedLineEdges?: Array<{ from: Id<"users">; to: Id<"users">; type: string }>;
  orgName?: string;
  // When true, an admin can freely drag cards to any position and save the layout.
  allowFreeLayout?: boolean;
};

// A single rendered print page: the cropped chart slice plus where it sits on
// the paper. The exact same objects drive both the on-screen preview and the
// exported PDF, guaranteeing they match pixel-for-pixel.
type PreviewPage = {
  key: string;
  pageIndex: number;
  totalPages: number;
  row: number;
  col: number;
  pageW: number;
  pageH: number;
  marginPx: number;
  drawW: number;
  drawH: number;
  offsetX: number;
  offsetY: number;
  cropUrl: string;
};

type LayoutNode = {
  user: Doc<"users">;
  x: number; // left edge
  y: number; // top edge
  cx: number; // center x
  cy: number; // center y
  children: LayoutNode[];
  positionLevel?: PositionLevelInfo;
};

// ─── Layout engine ────────────────────────────────────────────────────────────
function subtreeWidth(node: OrgNode): number {
  if (node.children.length === 0) return NODE_W;
  const childrenTotal =
    node.children.reduce((sum, c) => sum + subtreeWidth(c), 0) +
    H_GAP * (node.children.length - 1);
  return Math.max(NODE_W, childrenTotal);
}

function positionNode(node: OrgNode, cx: number, y: number): LayoutNode {
  const laid: LayoutNode = {
    user: node.user,
    x: cx - NODE_W / 2,
    y,
    cx,
    cy: y + NODE_H / 2,
    children: [],
    positionLevel: node.positionLevel,
  };

  if (node.children.length > 0) {
    const totalW =
      node.children.reduce((sum, c) => sum + subtreeWidth(c), 0) +
      H_GAP * (node.children.length - 1);
    let startX = cx - totalW / 2;
    for (const child of node.children) {
      const sw = subtreeWidth(child);
      const childCx = startX + sw / 2;
      laid.children.push(positionNode(child, childCx, y + NODE_H + V_GAP));
      startX += sw + H_GAP;
    }
  }

  return laid;
}

function buildLayout(
  roots: Array<OrgNode>,
  overrides?: Record<string, { x: number; y: number }>,
): {
  nodes: LayoutNode[];
  canvasW: number;
  canvasH: number;
} {
  if (roots.length === 0) return { nodes: [], canvasW: 0, canvasH: 0 };

  const totalW =
    roots.reduce((sum, r) => sum + subtreeWidth(r), 0) +
    H_GAP * 2 * (roots.length - 1);

  const PADDING = 60;
  let startX = PADDING + NODE_W / 2;
  const laid: LayoutNode[] = [];
  for (const root of roots) {
    const sw = subtreeWidth(root);
    laid.push(positionNode(root, startX + sw / 2 - NODE_W / 2, PADDING));
    startX += sw + H_GAP * 2;
  }

  // Apply manual position overrides (free-layout mode). A card with a saved
  // position is placed at those exact canvas coordinates; command lines still
  // connect automatically because they are derived from these final positions.
  if (overrides) {
    const applyOverride = (n: LayoutNode) => {
      const o = overrides[n.user._id];
      if (o) {
        n.x = o.x;
        n.y = o.y;
        n.cx = o.x + NODE_W / 2;
        n.cy = o.y + NODE_H / 2;
      }
      for (const c of n.children) applyOverride(c);
    };
    for (const n of laid) applyOverride(n);
  }

  // Calculate total canvas size
  let maxX = 0;
  let maxY = 0;
  const traverse = (n: LayoutNode) => {
    maxX = Math.max(maxX, n.x + NODE_W + PADDING);
    maxY = Math.max(maxY, n.y + NODE_H + PADDING);
    for (const c of n.children) traverse(c);
  };
  for (const n of laid) traverse(n);

  return {
    nodes: laid,
    canvasW: Math.max(maxX, totalW + PADDING * 2),
    canvasH: maxY,
  };
}

// ─── Collect all layout nodes flat ───────────────────────────────────────────
function flattenLayout(roots: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  const visit = (n: LayoutNode) => {
    result.push(n);
    for (const c of n.children) visit(c);
  };
  for (const r of roots) visit(r);
  return result;
}

// ─── Collect command edges ────────────────────────────────────────────────────
type Edge = {
  x1: number; y1: number;
  x2: number; y2: number;
};

function collectCommandEdges(roots: LayoutNode[]): Edge[] {
  const edges: Edge[] = [];
  const visit = (n: LayoutNode) => {
    for (const c of n.children) {
      edges.push({
        x1: n.cx,
        y1: n.y + NODE_H,   // exact bottom center of parent card
        x2: c.cx,
        y2: c.y,            // exact top center of child card
      });
      visit(c);
    }
  };
  for (const r of roots) visit(r);
  return edges;
}

// ─── Person card ──────────────────────────────────────────────────────────────
function PersonCard({
  layoutNode,
  onSelect,
  highlight,
  color,
  allowDragDrop,
  freeMove,
  zoom,
  onFreeMove,
  onFreeMoveEnd,
  dottedBadgeCount,
}: {
  layoutNode: LayoutNode;
  onSelect: () => void;
  highlight: boolean;
  color: ColorToken;
  allowDragDrop: boolean;
  freeMove: boolean;
  zoom: number;
  onFreeMove: (userId: Id<"users">, x: number, y: number) => void;
  onFreeMoveEnd: (userId: Id<"users">, x: number, y: number) => void;
  dottedBadgeCount: number;
}) {
  const { user, positionLevel } = layoutNode;
  const c = colorClasses(color);
  const plColor = positionLevel ? colorClasses(positionLevel.color) : null;

  // Whole-card draggable ref (manager-rearrange mode only)
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${user._id}`,
    data: { userId: user._id },
    disabled: !allowDragDrop,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${user._id}`,
    data: { userId: user._id },
    disabled: !allowDragDrop,
  });

  // Merge both refs onto the card div
  const mergedRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  // ── Free-move pointer dragging (custom, so it doesn't clash with dnd-kit) ──
  const freeDrag = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);

  const handleFreePointerMove = useCallback(
    (e: PointerEvent) => {
      const st = freeDrag.current;
      if (!st) return;
      const dx = (e.clientX - st.startClientX) / zoom;
      const dy = (e.clientY - st.startClientY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) st.moved = true;
      const nx = Math.max(0, st.startX + dx);
      const ny = Math.max(0, st.startY + dy);
      st.lastX = nx;
      st.lastY = ny;
      onFreeMove(user._id, nx, ny);
    },
    [zoom, onFreeMove, user._id],
  );

  const handleFreePointerUp = useCallback(() => {
    const st = freeDrag.current;
    window.removeEventListener("pointermove", handleFreePointerMove);
    window.removeEventListener("pointerup", handleFreePointerUp);
    if (st && st.moved) {
      onFreeMoveEnd(user._id, st.lastX, st.lastY);
    }
    freeDrag.current = null;
  }, [handleFreePointerMove, onFreeMoveEnd, user._id]);

  const handleFreePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!freeMove) return;
      e.stopPropagation();
      e.preventDefault();
      freeDrag.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: layoutNode.x,
        startY: layoutNode.y,
        moved: false,
        lastX: layoutNode.x,
        lastY: layoutNode.y,
      };
      window.addEventListener("pointermove", handleFreePointerMove);
      window.addEventListener("pointerup", handleFreePointerUp);
    },
    [freeMove, layoutNode.x, layoutNode.y, handleFreePointerMove, handleFreePointerUp],
  );

  return (
    <div
      ref={mergedRef}
      {...(allowDragDrop ? attributes : {})}
      {...(allowDragDrop ? listeners : {})}
      // IMPORTANT: only attach our own onPointerDown in free-move mode. In
      // manager-rearrange mode the drag listeners above provide onPointerDown,
      // so we must NOT pass onPointerDown here (even undefined) or it would
      // override dnd-kit's handler and the card would never start dragging.
      {...(freeMove ? { onPointerDown: handleFreePointerDown } : {})}
      style={{
        left: layoutNode.x,
        top: layoutNode.y,
        width: NODE_W,
        height: NODE_H,
        // Prevents the browser from hijacking the gesture for scrolling on
        // touch/trackpad devices so drags register reliably.
        touchAction: allowDragDrop || freeMove ? "none" : undefined,
      }}
      className={cn(
        "absolute flex items-center gap-2 rounded-xl border bg-card px-3 shadow-sm transition-shadow select-none",
        allowDragDrop ? "cursor-grab active:cursor-grabbing" : "",
        freeMove ? "cursor-move ring-1 ring-primary/20" : "",
        "hover:shadow-md",
        highlight && "ring-2",
        highlight && c.ring,
        c.border,
        isOver && allowDragDrop && "ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.03]",
        isDragging && "opacity-20 scale-95",
      )}
      data-orgchart-node="card"
    >
      {/* Color accent bar */}
      <div className={cn("absolute left-0 top-0 h-full w-1 rounded-l-xl", c.bgSolid)} />

      {/* Drag indicator when mode active */}
      {allowDragDrop ? (
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground ml-1" />
      ) : null}

      {/* Card content — stopPropagation so click doesn't conflict with drag */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          // In free-move mode the parent handles pointer dragging; a click here
          // still opens the profile only when the card wasn't dragged.
          if (freeMove && freeDrag.current) return;
          onSelect();
        }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSelect(); } }}
        // In rearrange mode, do NOT swallow pointerdown — let it bubble to the
        // draggable so pressing anywhere on the card starts a drag immediately.
        // In free-move mode, let it bubble to the card's own pointer handler.
        // Otherwise stop it so it doesn't trigger canvas panning.
        onPointerDown={allowDragDrop || freeMove ? undefined : (e) => e.stopPropagation()}
        className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
      >
        <Avatar className="size-9 shrink-0">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} />
          ) : null}
          <AvatarFallback className={cn(c.bg, c.text, "text-[10px] font-bold")}>
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pl-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[12px] font-semibold leading-tight text-foreground">
              {user.name ?? "Tanpa Nama"}
            </p>
            {isAdminRole(user.role) ? (
              <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[8px]">
                Admin
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-[10px] text-muted-foreground leading-snug">
            {user.jobTitle ?? "—"}
          </p>
          <div className="flex items-center gap-1">
            {user.department ? (
              <p className={cn("truncate text-[9px] leading-snug", c.text)}>
                {user.department}
              </p>
            ) : null}
            {positionLevel && plColor ? (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 gap-0.5 px-1 py-0 text-[8px]",
                  plColor.border,
                  plColor.bg,
                  plColor.text,
                )}
              >
                <Shield className="size-2" />
                {positionLevel.code}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Direct reports badge */}
      {layoutNode.children.length > 0 ? (
        <Badge
          variant="outline"
          className={cn(
            "absolute bottom-1 right-2 gap-0.5 border text-[9px] px-1.5",
            c.border,
            c.bg,
            c.text,
          )}
        >
          <UsersIcon className="size-2.5" />
          {layoutNode.children.length}
        </Badge>
      ) : null}

      {/* Dotted lines badge */}
      {dottedBadgeCount > 0 ? (
        <Badge
          variant="outline"
          className="absolute top-1 right-2 gap-0.5 border-amber-500/50 bg-amber-500/10 px-1.5 text-[9px] text-amber-600 dark:text-amber-400"
        >
          <Minus className="size-2.5" />
          {dottedBadgeCount}
        </Badge>
      ) : null}
    </div>
  );
}

// ─── SVG Lines ────────────────────────────────────────────────────────────────
// NOTE: We use inline styles (not Tailwind classes) so that html-to-image /
// jsPDF canvas export captures the correct colours.
const CMD_COLOR = "#94a3b8";   // slate-400 – works on both light & dark
const COORD_COLOR = "#fbbf24"; // amber-400

function OrgLines({
  commandEdges,
  coordEdges,
  canvasW,
  canvasH,
}: {
  commandEdges: Edge[];
  coordEdges: Edge[];
  canvasW: number;
  canvasH: number;
}) {
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={canvasW}
      height={canvasH}
      style={{ overflow: "visible" }}
    >
      {/* Command lines – solid elbow routing */}
      {commandEdges.map((e, i) => {
        const midY = e.y1 + (e.y2 - e.y1) / 2;
        const path =
          Math.abs(e.x1 - e.x2) < 1
            ? `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`
            : `M ${e.x1} ${e.y1} L ${e.x1} ${midY} L ${e.x2} ${midY} L ${e.x2} ${e.y2}`;
        return (
          <g key={`cmd-${i}`}>
            <path
              d={path}
              fill="none"
              stroke={CMD_COLOR}
              strokeWidth={1.5}
            />
            <circle cx={e.x1} cy={e.y1} r={3} fill={CMD_COLOR} />
            <circle cx={e.x2} cy={e.y2} r={3} fill={CMD_COLOR} />
          </g>
        );
      })}

      {/* Coordination lines – dashed amber, side-to-side */}
      {coordEdges.map((e, i) => {
        const goRight = e.x2 > e.x1;
        const startX = goRight ? e.x1 + NODE_W / 2 : e.x1 - NODE_W / 2;
        const endX   = goRight ? e.x2 - NODE_W / 2 : e.x2 + NODE_W / 2;
        const midX = (startX + endX) / 2;
        const path = `M ${startX} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${endX} ${e.y2}`;
        return (
          <g key={`coord-${i}`}>
            <path
              d={path}
              fill="none"
              stroke={COORD_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <circle cx={startX} cy={e.y1} r={3} fill={COORD_COLOR} />
            <circle cx={endX}   cy={e.y2} r={3} fill={COORD_COLOR} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <svg width="32" height="10" className="shrink-0">
          <line x1="0" y1="5" x2="28" y2="5" strokeWidth="1.5" className="stroke-border" />
          <path d="M26,2 L26,8 L32,5 Z" className="fill-border" />
        </svg>
        <span>Garis Komando</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="32" height="10" className="shrink-0">
          <line
            x1="0" y1="5" x2="28" y2="5"
            strokeWidth="1.5"
            strokeDasharray="5 3"
            className="stroke-amber-400"
          />
          <path d="M26,2 L26,8 L32,5 Z" className="fill-amber-400" />
        </svg>
        <span>Garis Koordinasi</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OrgChartView({
  nodes,
  onSelectUser,
  highlightUserId,
  departmentColors,
  allowDragDrop = false,
  dottedLineEdges = [],
  orgName,
  allowFreeLayout = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panStart = useRef<{
    x: number; y: number; scrollLeft: number; scrollTop: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingId, setDraggingId] = useState<Id<"users"> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPages, setPreviewPages] = useState<PreviewPage[] | null>(null);
  const [isBuildingPreview, setIsBuildingPreview] = useState(false);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(0);
  // Measured size of the preview area so a page always fits fully (no clipping).
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const [previewArea, setPreviewArea] = useState({ w: 0, h: 0 });

  // ── Free layout mode ──────────────────────────────────────────────────────
  // Manual card positions loaded from the backend, merged with any in-progress
  // (unsaved) drags held in local state. Command lines follow automatically.
  const savedPositions = useQuery(
    api.orgChartPositions.getPositions,
    allowFreeLayout ? {} : "skip",
  );
  const savePosition = useMutation(api.orgChartPositions.savePosition);
  const clearPositionsMut = useMutation(api.orgChartPositions.clearPositions);
  const [freeMoveMode, setFreeMoveMode] = useState(false);
  // Free-move must never run at the same time as manager-rearrange mode.
  const freeMoveActive = freeMoveMode && !allowDragDrop;
  // Local overrides applied on top of savedPositions (keyed by userId).
  const [localPositions, setLocalPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Page-break (print layout) mode
  const [pageBreakMode, setPageBreakMode] = useState(false);
  const [pageConfig, setPageConfig] = useState<PageConfig>(DEFAULT_PAGE_CONFIG);
  const [breaks, setBreaks] = useState<BreakLine[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const setManager = useMutation(api.organization.setManager);

  // Scale modifier: corrects drag coordinates for CSS zoom transform
  const scaleModifier: Modifier = useCallback(({ transform }) => {
    const s = zoomRef.current;
    return {
      ...transform,
      x: transform.x / s,
      y: transform.y / s,
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
  );

  // Merged position overrides: saved (backend) + local (in-progress) drags.
  // IMPORTANT: In manager-rearrange mode (allowDragDrop) we intentionally ignore
  // the saved free-layout positions and use the automatic tree layout. Otherwise
  // cards stay pinned at their old free-position coordinates and the command
  // lines appear to still connect to the previous manager even after the data
  // has been updated. The saved free layout still applies in normal viewing and
  // in the dedicated free-move mode.
  const mergedPositions = useMemo(() => {
    if (!allowFreeLayout) return undefined;
    if (allowDragDrop) return undefined;
    return { ...(savedPositions ?? {}), ...localPositions };
  }, [allowFreeLayout, allowDragDrop, savedPositions, localPositions]);

  const hasCustomLayout = useMemo(() => {
    return (
      Object.keys(savedPositions ?? {}).length > 0 ||
      Object.keys(localPositions).length > 0
    );
  }, [savedPositions, localPositions]);

  // Build layout
  const { nodes: laid, canvasW, canvasH } = useMemo(
    () => buildLayout(nodes, mergedPositions),
    [nodes, mergedPositions],
  );

  const flatNodes = useMemo(() => flattenLayout(laid), [laid]);

  // Auto-center the canvas on load. For PT Pusaka Nusantara the requested focal
  // point is Hari Sukoco's card; we center the viewport on that card if present,
  // otherwise fall back to centering horizontally on the whole chart. Runs once
  // per layout so it never fights the user's manual panning afterwards.
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (hasCenteredRef.current) return;
    if (canvasW <= 0) return;
    // Wait until the scroll container has been measured.
    if (el.clientWidth <= 0) return;

    const focal = flatNodes.find((ln) =>
      (ln.user.name ?? "").trim().toLowerCase() === "hari sukoco",
    );

    if (focal) {
      // Inner canvas wrapper is offset by a 24px margin and scaled by `zoom`.
      const centerX = 24 + focal.cx * zoom;
      const centerY = 24 + (focal.y + NODE_H / 2) * zoom;
      el.scrollLeft = Math.max(0, centerX - el.clientWidth / 2);
      el.scrollTop = Math.max(0, centerY - el.clientHeight / 2);
    } else {
      const scaledW = canvasW * zoom + 48;
      el.scrollLeft = Math.max(0, (scaledW - el.clientWidth) / 2);
      el.scrollTop = 0;
    }
    hasCenteredRef.current = true;
  }, [canvasW, zoom, flatNodes]);

  // ── Free-move handlers ────────────────────────────────────────────────────
  // Live update while dragging (local only, no backend write).
  const handleFreeMove = useCallback((userId: Id<"users">, x: number, y: number) => {
    setLocalPositions((prev) => ({ ...prev, [userId]: { x, y } }));
  }, []);

  // Persist on drop.
  const handleFreeMoveEnd = useCallback(
    (userId: Id<"users">, x: number, y: number) => {
      setLocalPositions((prev) => ({ ...prev, [userId]: { x, y } }));
      savePosition({ userId, x, y }).catch((error) => {
        console.error(error);
        toast.error("Gagal menyimpan posisi kartu");
      });
    },
    [savePosition],
  );

  const handleResetLayout = useCallback(async () => {
    try {
      await clearPositionsMut({});
      setLocalPositions({});
      toast.success("Tata letak dikembalikan ke otomatis");
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengatur ulang tata letak");
    }
  }, [clearPositionsMut]);

  // ── Page-break controls (need canvasW/H) ─────────────────────────────────
  const addBreak = useCallback(
    (orientation: "vertical" | "horizontal") => {
      setBreaks((prev) => {
        // Place each new line at the estimated page boundary near the
        // top-left: the 1st line at one page-size from the edge, then step
        // out one page per additional line so they follow reading order.
        const { contentW, contentH } = getPageContentSizePx(pageConfig);
        const sameCount = prev.filter((b) => b.orientation === orientation).length;
        const span = orientation === "vertical" ? canvasW : canvasH;
        const step = orientation === "vertical" ? contentW : contentH;
        const pos = Math.max(20, Math.min(span - 20, step * (sameCount + 1)));
        return [...prev, { id: makeBreakId(), orientation, pos }];
      });
    },
    [canvasW, canvasH, pageConfig],
  );

  const moveBreak = useCallback((id: string, pos: number) => {
    setBreaks((prev) => prev.map((b) => (b.id === id ? { ...b, pos } : b)));
  }, []);

  const removeBreak = useCallback((id: string) => {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearBreaks = useCallback(() => setBreaks([]), []);

  // ── Shared page pipeline ──────────────────────────────────────────────────
  // Captures the chart once and slices it into print pages according to the
  // manual break lines + paper config. The returned pages are used by BOTH the
  // preview and the PDF export so the two always match exactly.
  const buildPreviewPages = useCallback(async (
    overrideBreaks?: BreakLine[],
  ): Promise<PreviewPage[]> => {
    const effectiveBreaks = overrideBreaks ?? breaks;
    const node = containerRef.current?.querySelector(
      "[data-orgchart-export-root]",
    ) as HTMLElement | null;
    if (!node) throw new Error("Kanvas bagan tidak ditemukan");

    // Strip pan/zoom so html-to-image captures the chart at true 1:1 pixels.
    const prevTransform = node.style.transform;
    node.style.transform = "none";

    // Hide the on-canvas page-break overlay so guide lines/badges don't render.
    const overlay = node.querySelector<HTMLElement>("[data-page-break-layer]");
    const prevOverlayDisplay = overlay?.style.display ?? "";
    if (overlay) overlay.style.display = "none";

    try {
      const PIXEL_RATIO = 2; // capture at 2× for crisp print output
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        pixelRatio: PIXEL_RATIO,
        cacheBust: true,
        width: canvasW,
        height: canvasH,
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
      });

      const { pageW, pageH, contentW, contentH, marginPx } =
        getPageContentSizePx(pageConfig);

      // Shared region computation — identical to the on-canvas guides, so the
      // preview/PDF match the page boxes shown on the chart precisely.
      const nodeBoxes = flatNodes.map((ln) => ({
        x: ln.x,
        y: ln.y,
        w: NODE_W,
        h: NODE_H,
      }));
      const { regions } = computePageRegions(
        canvasW,
        canvasH,
        effectiveBreaks,
        nodeBoxes,
        PAGE_REGION_PAD,
      );

      const pages: PreviewPage[] = [];

      for (const region of regions) {
        const regionW = region.w;
        const regionH = region.h;

        // Auto-scale the whole region to fit inside the printable (margin) area.
        // Never enlarge past 100% so cards keep a natural size when they fit.
        const scale = Math.min(contentW / regionW, contentH / regionH, 1);
        const drawW = regionW * scale;
        const drawH = regionH * scale;
        const offsetX = marginPx + (contentW - drawW) / 2;
        const offsetY = marginPx + (contentH - drawH) / 2;

        // Crop the matching region from the high-res capture onto a temp canvas,
        // but CLIP the drawn content to (this page's grid cell) ∪ (this page's own
        // card boxes). This guarantees that anything belonging to a neighbouring
        // page — foreign cards AND connector-line stubs that cross a break line —
        // is left white, while a card that straddles a break line stays whole
        // because its own box is part of the clip.
        const crop = document.createElement("canvas");
        crop.width = Math.max(1, Math.round(regionW * PIXEL_RATIO));
        crop.height = Math.max(1, Math.round(regionH * PIXEL_RATIO));
        const cctx = crop.getContext("2d");
        if (!cctx) throw new Error("canvas context unavailable");
        cctx.fillStyle = "#ffffff";
        cctx.fillRect(0, 0, crop.width, crop.height);

        // Convert a canvas-space rect to this crop's pixel space.
        const toCrop = (rx: number, ry: number, rw: number, rh: number) => ({
          x: (rx - region.x) * PIXEL_RATIO,
          y: (ry - region.y) * PIXEL_RATIO,
          w: rw * PIXEL_RATIO,
          h: rh * PIXEL_RATIO,
        });

        cctx.save();
        cctx.beginPath();
        // Allowed area 1: the page's grid cell (bounded by break lines).
        const cellRect = toCrop(region.cellX, region.cellY, region.cellW, region.cellH);
        cctx.rect(cellRect.x, cellRect.y, cellRect.w, cellRect.h);
        // Allowed area 2: each of this page's own cards (small pad for border/shadow),
        // so a card straddling a break line is not clipped.
        const CARD_PAD = 8;
        for (const n of region.nodes) {
          const r = toCrop(n.x - CARD_PAD, n.y - CARD_PAD, n.w + CARD_PAD * 2, n.h + CARD_PAD * 2);
          cctx.rect(r.x, r.y, r.w, r.h);
        }
        cctx.clip();
        cctx.drawImage(
          img,
          region.x * PIXEL_RATIO,
          region.y * PIXEL_RATIO,
          regionW * PIXEL_RATIO,
          regionH * PIXEL_RATIO,
          0,
          0,
          crop.width,
          crop.height,
        );
        cctx.restore();

        // Even after clipping to the cell, a NEIGHBOURING card can poke across the
        // break line into this cell and show up as a sliver. Paint white over every
        // card that does NOT belong to this page so only this page's own (whole)
        // cards remain. This is what fully removes the "neighbour juts in" overlap.
        const own = new Set(region.nodes);
        const MASK_PAD = 6;
        cctx.fillStyle = "#ffffff";
        for (const n of nodeBoxes) {
          if (own.has(n)) continue;
          const m = toCrop(n.x - MASK_PAD, n.y - MASK_PAD, n.w + MASK_PAD * 2, n.h + MASK_PAD * 2);
          if (m.x + m.w <= 0 || m.y + m.h <= 0 || m.x >= crop.width || m.y >= crop.height) {
            continue;
          }
          cctx.fillRect(m.x, m.y, m.w, m.h);
        }

        pages.push({
          key: region.key,
          pageIndex: region.pageIndex,
          totalPages: region.totalPages,
          row: region.row,
          col: region.col,
          pageW,
          pageH,
          marginPx,
          drawW,
          drawH,
          offsetX,
          offsetY,
          cropUrl: crop.toDataURL("image/png"),
        });
      }

      return pages;
    } finally {
      node.style.transform = prevTransform;
      if (overlay) overlay.style.display = prevOverlayDisplay;
    }
  }, [breaks, canvasW, canvasH, pageConfig, flatNodes]);

  // ── Preview: render the exact print pages on screen ───────────────────────
  const openPreview = useCallback(async (overrideBreaks?: BreakLine[]) => {
    setPreviewOpen(true);
    setIsBuildingPreview(true);
    setPreviewPages(null);
    setCurrentPreviewPage(0);
    try {
      const pages = await buildPreviewPages(overrideBreaks);
      setPreviewPages(pages);
    } catch (error) {
      console.error(error);
      toast.error("Gagal membuat pratinjau halaman");
      setPreviewPages([]);
    } finally {
      setIsBuildingPreview(false);
    }
  }, [buildPreviewPages]);

  // Track the preview area size so each page can be scaled to fit fully.
  useEffect(() => {
    if (!previewOpen) return;
    const el = previewAreaRef.current;
    if (!el) return;
    const update = () =>
      setPreviewArea({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewOpen, isBuildingPreview, previewPages]);

  // ── Multi-page PDF export following the manual break lines ────────────────
  const exportMultiPagePdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const pages = await buildPreviewPages();
      if (pages.length === 0) {
        toast.error("Tidak ada halaman untuk diekspor");
        return;
      }

      const { jsPDF } = await import("jspdf");
      const first = pages[0];
      const pdf = new jsPDF({
        orientation: first.pageW > first.pageH ? "landscape" : "portrait",
        unit: "px",
        format: [first.pageW, first.pageH],
      });

      pages.forEach((p, i) => {
        if (i > 0) {
          pdf.addPage(
            [p.pageW, p.pageH],
            p.pageW > p.pageH ? "landscape" : "portrait",
          );
        }
        pdf.addImage(p.cropUrl, "PNG", p.offsetX, p.offsetY, p.drawW, p.drawH);

        // Page footer: org name (left) + page position for assembly (right).
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        const footerY = p.pageH - p.marginPx / 2 - 2;
        if (orgName) {
          pdf.text(orgName, p.marginPx, footerY, { baseline: "bottom" });
        }
        const label = `Hal. ${p.pageIndex}/${p.totalPages}  ·  Baris ${p.row}, Kolom ${p.col}`;
        pdf.text(label, p.pageW - p.marginPx, footerY, {
          align: "right",
          baseline: "bottom",
        });
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`struktur-organisasi-${dateStr}.pdf`);
      toast.success(`Bagan diekspor ke ${pages.length} halaman PDF`);
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengekspor PDF multi-halaman");
    } finally {
      setIsExportingPdf(false);
    }
  }, [buildPreviewPages, orgName]);

  // Build lookup map: userId -> LayoutNode
  const nodeMap = useMemo(() => {
    const m = new Map<Id<"users">, LayoutNode>();
    for (const n of flatNodes) m.set(n.user._id, n);
    return m;
  }, [flatNodes]);

  // Command edges (hierarchy)
  const commandEdges = useMemo(() => collectCommandEdges(laid), [laid]);

  // Coordination / dotted-line edges — connect side-to-side at card midpoint
  const coordEdges = useMemo((): Edge[] => {
    return dottedLineEdges.flatMap(({ from, to }) => {
      const fromNode = nodeMap.get(from);
      const toNode = nodeMap.get(to);
      if (!fromNode || !toNode) return [];
      // cy = vertical center of card
      const fromCy = fromNode.y + NODE_H / 2;
      const toCy   = toNode.y   + NODE_H / 2;
      return [{ x1: fromNode.cx, y1: fromCy, x2: toNode.cx, y2: toCy }];
    });
  }, [dottedLineEdges, nodeMap]);

  // Dotted badge count per node
  const dottedCounts = useMemo(() => {
    const m = new Map<Id<"users">, number>();
    for (const e of dottedLineEdges) {
      m.set(e.to, (m.get(e.to) ?? 0) + 1);
    }
    return m;
  }, [dottedLineEdges]);

  // Pan handling — drives native scroll of the container
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-orgchart-node]")) return;
    if (e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsPanning(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panStart.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
    el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
  }, []);

  const handleMouseUp = useCallback(() => {
    panStart.current = null;
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.25, z - e.deltaY * 0.001)));
  }, []);

  const resetView = () => {
    setZoom(1);
    const el = scrollRef.current;
    if (el) {
      // Re-center on Hari Sukoco's card at zoom 1 (fall back to chart center).
      const focal = flatNodes.find((ln) =>
        (ln.user.name ?? "").trim().toLowerCase() === "hari sukoco",
      );
      if (focal) {
        el.scrollLeft = Math.max(0, 24 + focal.cx - el.clientWidth / 2);
        el.scrollTop = Math.max(0, 24 + (focal.y + NODE_H / 2) - el.clientHeight / 2);
      } else {
        const scaledW = canvasW + 48;
        el.scrollLeft = Math.max(0, (scaledW - el.clientWidth) / 2);
        el.scrollTop = 0;
      }
    }
  };

  // Drag end
  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.data.current?.userId as Id<"users"> | undefined;
    if (id) setDraggingId(id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const fromId = active.data.current?.userId as Id<"users"> | undefined;
    const toId = over.data.current?.userId as Id<"users"> | undefined;
    if (!fromId || !toId || fromId === toId) return;
    try {
      await setManager({ userId: fromId, managerId: toId });
      toast.success("Atasan diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui atasan");
      } else {
        toast.error("Gagal memperbarui atasan");
      }
    }
  };

  const draggingNode = draggingId ? flatNodes.find((n) => n.user._id === draggingId) ?? null : null;


  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChartLegend />
        <div className="flex items-center gap-1">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetView}>
            <Maximize2 className="size-4" />
            Reset
          </Button>
          {allowFreeLayout && !allowDragDrop ? (
            <Button
              type="button"
              variant={freeMoveMode ? "default" : "secondary"}
              size="sm"
              className="gap-1.5"
              onClick={() => setFreeMoveMode((v) => !v)}
            >
              <Move className="size-4" />
              Atur Posisi Bebas
            </Button>
          ) : null}
          <Button
            type="button"
            variant={pageBreakMode ? "default" : "secondary"}
            size="sm"
            className="gap-1.5"
            onClick={() => setPageBreakMode((v) => !v)}
          >
            <SquareDashedBottom className="size-4" />
            Batas Halaman
          </Button>
          <Button
            type="button" variant="secondary" size="sm"
            className="gap-1.5"
            onClick={() => openPreview()}
          >
            <Eye className="size-4" />
            Preview
          </Button>
        </div>
      </div>

      {/* Page-break controls */}
      {pageBreakMode ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Kertas</span>
            <Select
              value={pageConfig.paper}
              onValueChange={(v) => setPageConfig((c) => ({ ...c, paper: v as PaperSizeKey }))}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input ukuran custom (mm) — muncul hanya saat memilih "Ukuran Custom" */}
          {pageConfig.paper === "custom" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Ukuran (mm)</span>
              <input
                type="number"
                min={CUSTOM_PAPER_MIN_MM}
                max={CUSTOM_PAPER_MAX_MM}
                value={pageConfig.customWmm ?? DEFAULT_CUSTOM_W_MM}
                onChange={(e) =>
                  setPageConfig((c) => ({ ...c, customWmm: Number(e.target.value) }))
                }
                onBlur={(e) => {
                  const clamped = Math.min(
                    CUSTOM_PAPER_MAX_MM,
                    Math.max(CUSTOM_PAPER_MIN_MM, Number(e.target.value) || DEFAULT_CUSTOM_W_MM),
                  );
                  setPageConfig((c) => ({ ...c, customWmm: clamped }));
                }}
                className="h-8 w-20 rounded-md border bg-background px-2 text-xs tabular-nums"
                aria-label="Lebar kertas (mm)"
              />
              <span className="text-xs text-muted-foreground">×</span>
              <input
                type="number"
                min={CUSTOM_PAPER_MIN_MM}
                max={CUSTOM_PAPER_MAX_MM}
                value={pageConfig.customHmm ?? DEFAULT_CUSTOM_H_MM}
                onChange={(e) =>
                  setPageConfig((c) => ({ ...c, customHmm: Number(e.target.value) }))
                }
                onBlur={(e) => {
                  const clamped = Math.min(
                    CUSTOM_PAPER_MAX_MM,
                    Math.max(CUSTOM_PAPER_MIN_MM, Number(e.target.value) || DEFAULT_CUSTOM_H_MM),
                  );
                  setPageConfig((c) => ({ ...c, customHmm: clamped }));
                }}
                className="h-8 w-20 rounded-md border bg-background px-2 text-xs tabular-nums"
                aria-label="Tinggi kertas (mm)"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Orientasi</span>
            <Select
              value={pageConfig.orientation}
              onValueChange={(v) => setPageConfig((c) => ({ ...c, orientation: v as PageOrientation }))}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape" className="text-xs">Landscape</SelectItem>
                <SelectItem value="portrait" className="text-xs">Portrait</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Margin</span>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={pageConfig.marginMm}
                onChange={(e) => setPageConfig((c) => ({ ...c, marginMm: Number(e.target.value) }))}
                className="w-24 accent-primary"
              />
              <span className="w-10 text-xs tabular-nums text-muted-foreground">
                {pageConfig.marginMm} mm
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => addBreak("vertical")}>
              <Plus className="size-3.5" />
              Pemisah Halaman Vertikal
            </Button>
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => addBreak("horizontal")}>
              <Plus className="size-3.5" />
              Pemisah Halaman Horizontal
            </Button>
            {breaks.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearBreaks}>
                Hapus Semua
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={exportMultiPagePdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <FileDown className="size-3.5" />
              )}
              {isExportingPdf ? "Mengekspor…" : "Ekspor PDF"}
            </Button>
          </div>

          <p className="w-full text-[11px] text-muted-foreground">
            Klik <span className="font-medium text-foreground">Muat 1 Halaman</span> agar seluruh bagan otomatis diskalakan pas dalam satu halaman sesuai ukuran &amp; arah kertas. Atau tambahkan garis lalu seret gagangnya untuk membagi bagan ke beberapa halaman. Kotak putus-putus adalah area cetak (dalam margin) tiap halaman. Klik <span className="font-medium text-foreground">Ekspor PDF</span> untuk mengunduh sebagai PDF siap cetak.
          </p>
        </div>
      ) : null}

      {/* Free-move controls */}
      {freeMoveActive ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex-1 text-[11px] text-muted-foreground">
            Seret kartu mana pun ke posisi bebas — misalnya menaikkan Direktur
            Keuangan ke baris di atas Manajer. Garis komando otomatis mengikuti.
            Posisi tersimpan otomatis.
          </p>
          {hasCustomLayout ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={handleResetLayout}
            >
              <Maximize2 className="size-3.5" />
              Kembalikan Otomatis
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Drag-drop mode hint */}
      {allowDragDrop ? (
        <p className="text-[11px] text-muted-foreground">
          Seret ikon <span className="font-semibold">⋮⋮</span> ke kartu lain untuk mengubah atasan · Seret kanvas atau gunakan scrollbar untuk menggeser · Ctrl+scroll untuk zoom
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Seret kanvas atau gunakan scrollbar untuk menggeser · Ctrl+scroll untuk zoom
        </p>
      )}

      <DndContext
        sensors={sensors}
        modifiers={allowDragDrop ? [scaleModifier] : []}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div
          ref={scrollRef}
          onMouseDown={freeMoveActive ? undefined : handleMouseDown}
          onMouseMove={freeMoveActive ? undefined : handleMouseMove}
          onMouseUp={freeMoveActive ? undefined : handleMouseUp}
          onMouseLeave={freeMoveActive ? undefined : handleMouseUp}
          onWheel={handleWheel}
          className={cn(
            "relative h-[640px] w-full overflow-auto rounded-xl border bg-gradient-to-br from-muted/30 via-background to-muted/20",
            freeMoveActive ? "cursor-default" : isPanning ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, currentColor 7%, transparent) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        >
          {/* Scroll sizer — expands to the scaled canvas so scrollbars appear */}
          <div
            ref={containerRef}
            style={{
              width: canvasW * zoom + 48,
              height: canvasH * zoom + 48,
            }}
          >
            {/* Viewport transform wrapper */}
            <div
              data-orgchart-export-root
              className="origin-top-left select-none"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: canvasW,
                height: canvasH,
                marginLeft: 24,
                marginTop: 24,
              }}
            >
              {/* SVG lines layer */}
              <OrgLines
                commandEdges={commandEdges}
                coordEdges={coordEdges}
                canvasW={canvasW}
                canvasH={canvasH}
              />

              {/* Node cards layer */}
              {flatNodes.map((ln) => {
                const color: ColorToken =
                  departmentColors.get(ln.user.department ?? "") ?? "blue";
                return (
                  <PersonCard
                    key={ln.user._id}
                    layoutNode={ln}
                    onSelect={() => onSelectUser(ln.user._id)}
                    highlight={highlightUserId === ln.user._id}
                    color={color}
                    allowDragDrop={allowDragDrop}
                    freeMove={freeMoveActive}
                    zoom={zoom}
                    onFreeMove={handleFreeMove}
                    onFreeMoveEnd={handleFreeMoveEnd}
                    dottedBadgeCount={dottedCounts.get(ln.user._id) ?? 0}
                  />
                );
              })}

              {/* Page-break overlay */}
              {pageBreakMode ? (
                <PageBreakLayer
                  canvasW={canvasW}
                  canvasH={canvasH}
                  zoom={zoom}
                  breaks={breaks}
                  nodeBoxes={flatNodes.map((ln) => ({ x: ln.x, y: ln.y, w: NODE_W, h: NODE_H }))}
                  onMoveBreak={moveBreak}
                  onRemoveBreak={removeBreak}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* DragOverlay — renders the ghost card outside the transform, at correct screen coords */}
        <DragOverlay dropAnimation={null}>
          {draggingNode ? (
            <div
              style={{ width: NODE_W }}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 border-primary bg-card p-3 shadow-2xl opacity-90 cursor-grabbing",
              )}
            >
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground ml-1" />
              <Avatar className="size-9 shrink-0">
                {draggingNode.user.avatarUrl ? (
                  <AvatarImage src={draggingNode.user.avatarUrl} alt={draggingNode.user.name ?? ""} />
                ) : null}
                <AvatarFallback className="text-[10px] font-bold">
                  {getInitials(draggingNode.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 pl-1">
                <p className="truncate text-[12px] font-semibold">{draggingNode.user.name ?? "Tanpa Nama"}</p>
                <p className="truncate text-[10px] text-muted-foreground">{draggingNode.user.jobTitle ?? "—"}</p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ─── Preview Modal ─────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-base font-semibold">
                Preview Cetak per Halaman
              </DialogTitle>
              {previewPages && previewPages.length > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {previewPages.length} halaman · {PAPER_OPTIONS.find((o) => o.value === pageConfig.paper)?.label.split(" ")[0]} {pageConfig.orientation === "landscape" ? "Landscape" : "Portrait"}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={exportMultiPagePdf}
                disabled={isExportingPdf || isBuildingPreview || !previewPages || previewPages.length === 0}
              >
                {isExportingPdf ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <FileDown className="size-3.5" />
                )}
                Ekspor PDF
              </Button>
              <Button
                type="button" variant="ghost" size="icon"
                className="size-7"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Single-page preview with navigation — each page is auto-scaled so
              no card is ever cut, and it matches the PDF exactly. */}
          <div ref={previewAreaRef} className="flex-1 overflow-auto bg-muted/30 p-6">
            {isBuildingPreview ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <span className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <p className="text-sm">Menyiapkan pratinjau halaman…</p>
              </div>
            ) : !previewPages || previewPages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <SquareDashedBottom className="size-8" />
                <p className="text-sm font-medium">Belum ada halaman untuk ditampilkan</p>
                <p className="max-w-md text-xs">
                  Aktifkan mode "Batas Halaman" lalu tambahkan pemisah halaman untuk membagi bagan. Setiap halaman diskalakan otomatis agar semua kotak masuk penuh tanpa terpotong.
                </p>
              </div>
            ) : (() => {
              const idx = Math.min(currentPreviewPage, previewPages.length - 1);
              const p = previewPages[idx];
              // Fit the page inside the measured preview area, honoring BOTH width
              // and height so the paper is never clipped by the dialog. Reserve
              // room for padding (48) and the navigation row (~72).
              const availW = Math.max(120, previewArea.w - 48);
              const availH = Math.max(120, previewArea.h - 48 - 72);
              const fit = Math.min(availW / p.pageW, availH / p.pageH);
              const displayScale = fit > 0 ? fit : availW / p.pageW;
              const DISPLAY_W = p.pageW * displayScale;
              const displayH = p.pageH * displayScale;
              return (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <div
                    className="relative overflow-hidden rounded-sm border bg-white shadow-xl"
                    style={{ width: DISPLAY_W, height: displayH }}
                  >
                    {/* Printable-area guide (margin box) */}
                    <div
                      className="pointer-events-none absolute border border-dashed border-slate-200"
                      style={{
                        left: p.marginPx * displayScale,
                        top: p.marginPx * displayScale,
                        width: (p.pageW - p.marginPx * 2) * displayScale,
                        height: (p.pageH - p.marginPx * 2) * displayScale,
                      }}
                    />
                    {/* Chart slice, positioned exactly as in the PDF */}
                    <img
                      src={p.cropUrl}
                      alt={`Halaman ${p.pageIndex}`}
                      style={{
                        position: "absolute",
                        left: p.offsetX * displayScale,
                        top: p.offsetY * displayScale,
                        width: p.drawW * displayScale,
                        height: p.drawH * displayScale,
                      }}
                    />
                    {/* Footer — same text as the printed page */}
                    <div
                      className="pointer-events-none absolute flex items-end justify-between text-slate-400"
                      style={{
                        left: p.marginPx * displayScale,
                        right: p.marginPx * displayScale,
                        bottom: (p.marginPx / 2) * displayScale,
                        fontSize: Math.max(7, 9 * displayScale),
                      }}
                    >
                      <span className="truncate">{orgName ?? ""}</span>
                      <span className="shrink-0 pl-2">
                        Hal. {p.pageIndex}/{p.totalPages} · Baris {p.row}, Kolom {p.col}
                      </span>
                    </div>
                  </div>

                  {/* Page navigation */}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button" variant="secondary" size="sm" className="gap-1.5"
                      onClick={() => setCurrentPreviewPage((i) => Math.max(0, i - 1))}
                      disabled={idx === 0}
                    >
                      <ChevronLeft className="size-4" />
                      Sebelumnya
                    </Button>
                    <span className="min-w-[110px] text-center text-sm font-medium tabular-nums">
                      Halaman {p.pageIndex} / {p.totalPages}
                    </span>
                    <Button
                      type="button" variant="secondary" size="sm" className="gap-1.5"
                      onClick={() => setCurrentPreviewPage((i) => Math.min(previewPages.length - 1, i + 1))}
                      disabled={idx >= previewPages.length - 1}
                    >
                      Berikutnya
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="shrink-0 px-4 py-2 border-t flex items-center justify-between gap-2">
            <ChartLegend />
            <p className="hidden text-xs text-muted-foreground sm:block">
              Setiap halaman diskalakan otomatis · Tampilan ini sama persis dengan hasil cetak PDF.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
