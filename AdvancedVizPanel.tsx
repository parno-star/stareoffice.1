import { useMemo, useRef, useState } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Sparkles,
  Circle,
  LayoutPanelTop,
  Rows3,
  Search,
  Download,
  Image as ImageIcon,
  FileText,
  Focus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Network,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  buildOrgTree,
  colorClasses,
  getInitials,
  type ColorToken,
  type OrgNode,
} from "../_lib/org-utils.ts";

type VizMode = "radial" | "horizontal" | "treemap";

type Props = {
  allUsers: Array<Doc<"users">>;
  departmentColors: Map<string, ColorToken>;
  onSelectUser: (id: Id<"users">) => void;
};

// ----------------- Radial layout -----------------
type RadialNodeLayout = {
  user: Doc<"users">;
  x: number;
  y: number;
  angle: number;
  level: number;
  parent: Id<"users"> | null;
  color: ColorToken;
};

function computeRadialLayout(
  roots: Array<OrgNode>,
  radiusStep: number,
  departmentColors: Map<string, ColorToken>,
  maxDepth: number,
): {
  nodes: Array<RadialNodeLayout>;
  edges: Array<{ from: string; to: string }>;
  extent: { width: number; height: number };
} {
  const nodes: Array<RadialNodeLayout> = [];
  const edges: Array<{ from: string; to: string }> = [];

  // Place a virtual center if there are multiple roots. If single root, that root is center.
  let centerUser: Doc<"users"> | null = null;
  let actualRoots: Array<OrgNode> = roots;
  if (roots.length === 1) {
    centerUser = roots[0].user;
    actualRoots = roots[0].children;
  }

  if (centerUser) {
    nodes.push({
      user: centerUser,
      x: 0,
      y: 0,
      angle: 0,
      level: 0,
      parent: null,
      color: departmentColors.get(centerUser.department ?? "") ?? "blue",
    });
  }

  // Count leaves per subtree to weight angular allocation
  const leafCount = (node: OrgNode, depth: number): number => {
    if (depth >= maxDepth || node.children.length === 0) return 1;
    let sum = 0;
    for (const c of node.children) sum += leafCount(c, depth + 1);
    return sum;
  };

  const layoutBranch = (
    node: OrgNode,
    startAngle: number,
    endAngle: number,
    level: number,
    parentId: Id<"users"> | null,
  ) => {
    const angle = (startAngle + endAngle) / 2;
    const r = radiusStep * level;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    const color: ColorToken =
      departmentColors.get(node.user.department ?? "") ?? "blue";
    nodes.push({
      user: node.user,
      x,
      y,
      angle,
      level,
      parent: parentId,
      color,
    });
    if (parentId) {
      edges.push({ from: parentId, to: node.user._id });
    }
    if (level >= maxDepth) return;
    if (node.children.length === 0) return;
    const totalLeaves = leafCount(node, level + 1);
    let cursor = startAngle;
    for (const c of node.children) {
      const leaves = leafCount(c, level + 1);
      const span = (endAngle - startAngle) * (leaves / totalLeaves);
      layoutBranch(c, cursor, cursor + span, level + 1, node.user._id);
      cursor += span;
    }
  };

  const totalTopLeaves = actualRoots.reduce((acc, r) => acc + leafCount(r, 1), 0);
  let cursor = -Math.PI / 2;
  const sweep = 2 * Math.PI;
  for (const r of actualRoots) {
    const leaves = leafCount(r, 1);
    const span = sweep * (leaves / totalTopLeaves);
    layoutBranch(r, cursor, cursor + span, centerUser ? 1 : 1, centerUser?._id ?? null);
    cursor += span;
  }

  // Compute extent
  let minX = 0,
    minY = 0,
    maxX = 0,
    maxY = 0;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  const pad = 80;
  return {
    nodes,
    edges,
    extent: {
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    },
  };
}

function RadialView({
  roots,
  departmentColors,
  maxDepth,
  onSelectUser,
  highlightUserId,
}: {
  roots: Array<OrgNode>;
  departmentColors: Map<string, ColorToken>;
  maxDepth: number;
  onSelectUser: (id: Id<"users">) => void;
  highlightUserId: Id<"users"> | null;
}) {
  const layout = useMemo(
    () => computeRadialLayout(roots, 150, departmentColors, maxDepth),
    [roots, departmentColors, maxDepth],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, RadialNodeLayout>();
    for (const n of layout.nodes) m.set(n.user._id, n);
    return m;
  }, [layout]);

  const width = Math.max(900, layout.extent.width);
  const height = Math.max(900, layout.extent.height);

  // Concentric level rings
  const maxLevel = layout.nodes.reduce((m, n) => Math.max(m, n.level), 0);

  return (
    <svg
      viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
      className="h-full w-full"
      style={{ fontFamily: "inherit" }}
    >
      <defs>
        <radialGradient id="radialBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.04" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="url(#radialBg)"
        className="text-primary"
      />
      {/* Rings */}
      {Array.from({ length: maxLevel }).map((_, i) => (
        <circle
          key={i}
          cx={0}
          cy={0}
          r={150 * (i + 1)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeDasharray="3 6"
          className="text-muted-foreground"
        />
      ))}
      {/* Edges */}
      {layout.edges.map((e, i) => {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
        );
      })}
      {/* Nodes */}
      {layout.nodes.map((n) => {
        const colors = colorClasses(n.color);
        const dotColor =
          n.color === "emerald"
            ? "#10b981"
            : n.color === "violet"
              ? "#8b5cf6"
              : n.color === "amber"
                ? "#f59e0b"
                : n.color === "rose"
                  ? "#f43f5e"
                  : n.color === "sky"
                    ? "#0ea5e9"
                    : n.color === "teal"
                      ? "#14b8a6"
                      : n.color === "orange"
                        ? "#f97316"
                        : n.color === "pink"
                          ? "#ec4899"
                          : n.color === "indigo"
                            ? "#6366f1"
                            : n.color === "lime"
                              ? "#84cc16"
                              : n.color === "fuchsia"
                                ? "#d946ef"
                                : "#3b82f6";
        const isHighlight = highlightUserId === n.user._id;
        const isRoot = n.level === 0;
        const radius = isRoot ? 38 : n.level === 1 ? 26 : 20;
        return (
          <g
            key={n.user._id}
            transform={`translate(${n.x}, ${n.y})`}
            className="cursor-pointer"
            onClick={() => onSelectUser(n.user._id)}
          >
            <circle
              r={radius + 4}
              fill={dotColor}
              fillOpacity={isHighlight ? 0.4 : 0.15}
            />
            <circle
              r={radius}
              fill={dotColor}
              className={cn("transition", colors.border)}
              stroke="white"
              strokeWidth={2}
            />
            <text
              textAnchor="middle"
              dy="0.32em"
              fill="white"
              fontSize={isRoot ? 14 : 10}
              fontWeight={700}
              style={{ pointerEvents: "none" }}
            >
              {getInitials(n.user.name)}
            </text>
            <text
              textAnchor="middle"
              y={radius + 16}
              fill="currentColor"
              fontSize={isRoot ? 13 : 10}
              fontWeight={600}
              className="text-foreground"
              style={{ pointerEvents: "none" }}
            >
              {(n.user.name ?? "").length > 18
                ? `${(n.user.name ?? "").slice(0, 18)}…`
                : n.user.name ?? "Tanpa Nama"}
            </text>
            {n.user.jobTitle ? (
              <text
                textAnchor="middle"
                y={radius + 30}
                fill="currentColor"
                fontSize={9}
                className="text-muted-foreground"
                style={{ pointerEvents: "none" }}
              >
                {n.user.jobTitle.length > 22
                  ? `${n.user.jobTitle.slice(0, 22)}…`
                  : n.user.jobTitle}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ----------------- Horizontal tree -----------------
type HNode = {
  user: Doc<"users">;
  x: number;
  y: number;
  level: number;
  parent: Id<"users"> | null;
  color: ColorToken;
};

function computeHorizontalLayout(
  roots: Array<OrgNode>,
  departmentColors: Map<string, ColorToken>,
  maxDepth: number,
): {
  nodes: Array<HNode>;
  edges: Array<{ from: Id<"users">; to: Id<"users"> }>;
  width: number;
  height: number;
} {
  const nodes: Array<HNode> = [];
  const edges: Array<{ from: Id<"users">; to: Id<"users"> }> = [];
  const xStep = 260;
  const yStep = 70;
  let cursorY = 0;

  const place = (
    node: OrgNode,
    level: number,
    parent: Id<"users"> | null,
  ): number => {
    const color: ColorToken =
      departmentColors.get(node.user.department ?? "") ?? "blue";
    if (level >= maxDepth || node.children.length === 0) {
      const y = cursorY * yStep;
      cursorY += 1;
      nodes.push({
        user: node.user,
        x: level * xStep,
        y,
        level,
        parent,
        color,
      });
      if (parent) edges.push({ from: parent, to: node.user._id });
      return y;
    }
    const childY: Array<number> = [];
    for (const c of node.children) {
      childY.push(place(c, level + 1, node.user._id));
    }
    const y = (childY[0] + childY[childY.length - 1]) / 2;
    nodes.push({
      user: node.user,
      x: level * xStep,
      y,
      level,
      parent,
      color,
    });
    if (parent) edges.push({ from: parent, to: node.user._id });
    return y;
  };

  for (const r of roots) {
    place(r, 0, null);
    cursorY += 0.5; // gap between roots
  }

  const maxX = nodes.reduce((m, n) => Math.max(m, n.x), 0) + 240;
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0) + 80;
  return { nodes, edges, width: maxX, height: maxY };
}

function HorizontalView({
  roots,
  departmentColors,
  maxDepth,
  onSelectUser,
  highlightUserId,
}: {
  roots: Array<OrgNode>;
  departmentColors: Map<string, ColorToken>;
  maxDepth: number;
  onSelectUser: (id: Id<"users">) => void;
  highlightUserId: Id<"users"> | null;
}) {
  const layout = useMemo(
    () => computeHorizontalLayout(roots, departmentColors, maxDepth),
    [roots, departmentColors, maxDepth],
  );
  const nodeById = useMemo(() => {
    const m = new Map<string, HNode>();
    for (const n of layout.nodes) m.set(n.user._id, n);
    return m;
  }, [layout]);

  return (
    <svg
      viewBox={`-20 -20 ${layout.width + 40} ${layout.height + 40}`}
      className="h-full w-full"
    >
      {/* Edges */}
      {layout.edges.map((e, i) => {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) return null;
        const mid = (from.x + to.x) / 2 + 100;
        const path = `M ${from.x + 220} ${from.y + 25} C ${mid} ${from.y + 25}, ${mid} ${to.y + 25}, ${to.x} ${to.y + 25}`;
        return (
          <path
            key={i}
            d={path}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1.5}
            className="text-muted-foreground"
          />
        );
      })}
      {/* Nodes */}
      {layout.nodes.map((n) => {
        const dotColor =
          n.color === "emerald"
            ? "#10b981"
            : n.color === "violet"
              ? "#8b5cf6"
              : n.color === "amber"
                ? "#f59e0b"
                : n.color === "rose"
                  ? "#f43f5e"
                  : n.color === "sky"
                    ? "#0ea5e9"
                    : n.color === "teal"
                      ? "#14b8a6"
                      : n.color === "orange"
                        ? "#f97316"
                        : n.color === "pink"
                          ? "#ec4899"
                          : n.color === "indigo"
                            ? "#6366f1"
                            : n.color === "lime"
                              ? "#84cc16"
                              : n.color === "fuchsia"
                                ? "#d946ef"
                                : "#3b82f6";
        const isHighlight = highlightUserId === n.user._id;
        return (
          <g
            key={n.user._id}
            transform={`translate(${n.x}, ${n.y})`}
            className="cursor-pointer"
            onClick={() => onSelectUser(n.user._id)}
          >
            <rect
              x={0}
              y={0}
              width={220}
              height={50}
              rx={10}
              className="fill-card stroke-border"
              strokeWidth={isHighlight ? 2 : 1}
              style={{ filter: isHighlight ? `drop-shadow(0 0 0 2px ${dotColor})` : undefined }}
            />
            <rect x={0} y={0} width={4} height={50} fill={dotColor} rx={2} />
            <circle cx={28} cy={25} r={14} fill={dotColor} />
            <text
              x={28}
              y={25}
              textAnchor="middle"
              dy="0.32em"
              fill="white"
              fontSize={10}
              fontWeight={700}
              style={{ pointerEvents: "none" }}
            >
              {getInitials(n.user.name)}
            </text>
            <text
              x={50}
              y={20}
              fill="currentColor"
              fontSize={11}
              fontWeight={600}
              className="text-foreground"
              style={{ pointerEvents: "none" }}
            >
              {(n.user.name ?? "").length > 22
                ? `${(n.user.name ?? "").slice(0, 22)}…`
                : n.user.name ?? "Tanpa Nama"}
            </text>
            <text
              x={50}
              y={34}
              fill="currentColor"
              fontSize={9}
              className="text-muted-foreground"
              style={{ pointerEvents: "none" }}
            >
              {(n.user.jobTitle ?? "").length > 26
                ? `${(n.user.jobTitle ?? "").slice(0, 26)}…`
                : n.user.jobTitle ?? "—"}
            </text>
            <text
              x={50}
              y={45}
              fill={dotColor}
              fontSize={8}
              fontWeight={600}
              style={{ pointerEvents: "none" }}
            >
              {(n.user.department ?? "").length > 28
                ? `${(n.user.department ?? "").slice(0, 28)}…`
                : n.user.department ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ----------------- Treemap -----------------
type TreemapBox = {
  user: Doc<"users">;
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
  color: ColorToken;
  subtreeSize: number;
};

function computeSubtreeSize(node: OrgNode): number {
  let sum = 1;
  for (const c of node.children) sum += computeSubtreeSize(c);
  return sum;
}

function squarify(
  nodes: Array<OrgNode>,
  x: number,
  y: number,
  w: number,
  h: number,
  level: number,
  departmentColors: Map<string, ColorToken>,
  maxDepth: number,
  out: Array<TreemapBox>,
) {
  if (nodes.length === 0 || level >= maxDepth) return;
  const sizes = nodes.map((n) => computeSubtreeSize(n));
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  const horizontal = w >= h;
  let cursor = 0;
  const available = horizontal ? w : h;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const size = sizes[i];
    const portion = (size / total) * available;
    const color: ColorToken =
      departmentColors.get(n.user.department ?? "") ?? "blue";
    let bx: number, by: number, bw: number, bh: number;
    if (horizontal) {
      bx = x + cursor;
      by = y;
      bw = portion;
      bh = h;
    } else {
      bx = x;
      by = y + cursor;
      bw = w;
      bh = portion;
    }
    out.push({
      user: n.user,
      x: bx,
      y: by,
      w: bw,
      h: bh,
      level,
      color,
      subtreeSize: size,
    });
    // Recurse into children within smaller padded rect
    const headerH = Math.min(22, bh / 4);
    const innerPad = 4;
    if (n.children.length > 0 && bw > 40 && bh > 40 && level + 1 < maxDepth) {
      squarify(
        n.children,
        bx + innerPad,
        by + headerH + innerPad,
        Math.max(0, bw - innerPad * 2),
        Math.max(0, bh - headerH - innerPad * 2),
        level + 1,
        departmentColors,
        maxDepth,
        out,
      );
    }
    cursor += portion;
  }
}

function TreemapView({
  roots,
  departmentColors,
  maxDepth,
  onSelectUser,
  highlightUserId,
}: {
  roots: Array<OrgNode>;
  departmentColors: Map<string, ColorToken>;
  maxDepth: number;
  onSelectUser: (id: Id<"users">) => void;
  highlightUserId: Id<"users"> | null;
}) {
  const W = 1200;
  const H = 700;
  const boxes = useMemo(() => {
    const out: Array<TreemapBox> = [];
    squarify(roots, 0, 0, W, H, 0, departmentColors, maxDepth, out);
    return out;
  }, [roots, departmentColors, maxDepth]);

  const dotColorFor = (c: ColorToken) =>
    c === "emerald"
      ? "#10b981"
      : c === "violet"
        ? "#8b5cf6"
        : c === "amber"
          ? "#f59e0b"
          : c === "rose"
            ? "#f43f5e"
            : c === "sky"
              ? "#0ea5e9"
              : c === "teal"
                ? "#14b8a6"
                : c === "orange"
                  ? "#f97316"
                  : c === "pink"
                    ? "#ec4899"
                    : c === "indigo"
                      ? "#6366f1"
                      : c === "lime"
                        ? "#84cc16"
                        : c === "fuchsia"
                          ? "#d946ef"
                          : "#3b82f6";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {boxes.map((b) => {
        const fill = dotColorFor(b.color);
        const opacity = 0.25 - b.level * 0.04;
        const isHighlight = highlightUserId === b.user._id;
        const showLabel = b.w > 60 && b.h > 30;
        return (
          <g
            key={b.user._id}
            className="cursor-pointer"
            onClick={() => onSelectUser(b.user._id)}
          >
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={fill}
              fillOpacity={Math.max(0.1, opacity)}
              stroke={isHighlight ? fill : "white"}
              strokeWidth={isHighlight ? 3 : 1}
              rx={4}
            />
            {showLabel ? (
              <g style={{ pointerEvents: "none" }}>
                <text
                  x={b.x + 8}
                  y={b.y + 14}
                  fontSize={11}
                  fontWeight={700}
                  fill="currentColor"
                  className="text-foreground"
                >
                  {(b.user.name ?? "").length > Math.floor(b.w / 7)
                    ? `${(b.user.name ?? "").slice(0, Math.floor(b.w / 7) - 1)}…`
                    : b.user.name ?? "Tanpa Nama"}
                </text>
                {b.h > 46 ? (
                  <text
                    x={b.x + 8}
                    y={b.y + 28}
                    fontSize={9}
                    fill="currentColor"
                    className="text-muted-foreground"
                  >
                    {(b.user.jobTitle ?? "").length > Math.floor(b.w / 6)
                      ? `${(b.user.jobTitle ?? "").slice(0, Math.floor(b.w / 6) - 1)}…`
                      : b.user.jobTitle ?? "—"}
                  </text>
                ) : null}
                {b.h > 64 ? (
                  <text
                    x={b.x + b.w - 8}
                    y={b.y + b.h - 8}
                    fontSize={10}
                    fontWeight={700}
                    fill={fill}
                    textAnchor="end"
                  >
                    {b.subtreeSize}
                  </text>
                ) : null}
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ----------------- Main panel -----------------
export default function AdvancedVizPanel({
  allUsers,
  departmentColors,
  onSelectUser,
}: Props) {
  const [mode, setMode] = useState<VizMode>("radial");
  const [maxDepth, setMaxDepth] = useState<number>(6);
  const [focusUserId, setFocusUserId] = useState<Id<"users"> | null>(null);
  const [focusSearch, setFocusSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const fullTree = useMemo(() => buildOrgTree(allUsers), [allUsers]);

  // Focus subtree: if a user is focused, show only their subtree (as root).
  const roots = useMemo((): Array<OrgNode> => {
    if (!focusUserId) return fullTree;
    // Find node anywhere in fullTree
    const stack: Array<OrgNode> = [...fullTree];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.user._id === focusUserId) {
        return [{ ...n, depth: 0 }];
      }
      for (const c of n.children) stack.push(c);
    }
    return fullTree;
  }, [fullTree, focusUserId]);

  const focusUser = useMemo(() => {
    if (!focusUserId) return null;
    return allUsers.find((u) => u._id === focusUserId) ?? null;
  }, [focusUserId, allUsers]);

  const searchResults = useMemo(() => {
    const q = focusSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return allUsers
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(q) ||
          (u.jobTitle ?? "").toLowerCase().includes(q) ||
          (u.department ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [allUsers, focusSearch]);

  const totalNodes = useMemo(() => {
    let count = 0;
    const walk = (n: OrgNode, depth: number) => {
      if (depth >= maxDepth) return;
      count += 1;
      for (const c of n.children) walk(c, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    return count;
  }, [roots, maxDepth]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-viz-node]")) return;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };
  const handleMouseUp = () => {
    dragStart.current = null;
  };
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.2, z - e.deltaY * 0.0015)));
  };

  const handleExport = async (format: "png" | "pdf") => {
    const node = exportRef.current;
    if (!node) return;
    try {
      const { toPng } = await import("html-to-image");
      const bg = getComputedStyle(document.body).backgroundColor;
      const dataUrl = await toPng(node, {
        backgroundColor: bg || "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `visualisasi-organisasi-${mode}-${new Date().toISOString().slice(0, 10)}.png`;
        link.click();
        toast.success("Visualisasi diunduh sebagai PNG");
      } else {
        const { jsPDF } = await import("jspdf");
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("image load failed"));
        });
        const pdf = new jsPDF({
          orientation: img.width > img.height ? "landscape" : "portrait",
          unit: "px",
          format: [img.width + 80, img.height + 80],
        });
        pdf.addImage(dataUrl, "PNG", 40, 40, img.width, img.height);
        pdf.save(
          `visualisasi-organisasi-${mode}-${new Date().toISOString().slice(0, 10)}.pdf`,
        );
        toast.success("Visualisasi diunduh sebagai PDF");
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengekspor visualisasi");
    }
  };

  const modeLabel = {
    radial: "Radial / Sunburst",
    horizontal: "Pohon Horizontal",
    treemap: "Treemap Hierarki",
  }[mode];

  const modeDescription = {
    radial:
      "Lingkaran konsentris dengan akar di pusat. Cocok untuk melihat hirarki menyeluruh dan cabang departemen.",
    horizontal:
      "Pohon kiri-ke-kanan dengan kartu karyawan. Ideal untuk melacak jalur pelaporan panjang.",
    treemap:
      "Kotak bersarang dengan ukuran proporsional terhadap jumlah total bawahan. Bagus untuk melihat ukuran tim.",
  }[mode];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Visualisasi Organisasi Lanjutan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Mode Visualisasi</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as VizMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radial">
                    <span className="flex items-center gap-2">
                      <Circle className="size-4" /> Radial / Sunburst
                    </span>
                  </SelectItem>
                  <SelectItem value="horizontal">
                    <span className="flex items-center gap-2">
                      <Rows3 className="size-4" /> Pohon Horizontal
                    </span>
                  </SelectItem>
                  <SelectItem value="treemap">
                    <span className="flex items-center gap-2">
                      <LayoutPanelTop className="size-4" /> Treemap
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kedalaman Level</Label>
              <Select
                value={String(maxDepth)}
                onValueChange={(v) => setMaxDepth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} level
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Fokus pada Karyawan</Label>
              {focusUser ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <Focus className="size-4 text-primary" />
                  <span className="flex-1 truncate text-sm">
                    <span className="font-medium">{focusUser.name}</span>
                    <span className="text-muted-foreground">
                      {focusUser.jobTitle ? ` · ${focusUser.jobTitle}` : ""}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFocusUserId(null);
                      setFocusSearch("");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={focusSearch}
                    onChange={(e) => setFocusSearch(e.target.value)}
                    placeholder="Cari karyawan lalu pilih untuk fokus subtree..."
                    className="pl-9"
                  />
                  {searchResults.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                      {searchResults.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setFocusUserId(u._id);
                            setFocusSearch("");
                            resetView();
                          }}
                        >
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {getInitials(u.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{u.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {u.jobTitle ?? "—"}
                              {u.department ? ` · ${u.department}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                {modeLabel}
              </Badge>
              <span>·</span>
              <span>{totalNodes} node ditampilkan</span>
              <span>·</span>
              <span className="hidden sm:inline">{modeDescription}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.max(0.2, z - 0.15))}
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={resetView}>
                <Maximize2 className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Download className="size-4" />
                    Ekspor
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => handleExport("png")}
                  >
                    <ImageIcon className="size-4" /> PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => handleExport("pdf")}
                  >
                    <FileText className="size-4" /> PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canvas */}
      {roots.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network />
            </EmptyMedia>
            <EmptyTitle>Belum ada data organisasi</EmptyTitle>
            <EmptyDescription>
              Tetapkan atasan pada karyawan untuk membentuk hirarki.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={cn(
            "relative h-[640px] w-full overflow-hidden rounded-xl border bg-gradient-to-br from-muted/30 via-background to-muted/20",
            dragStart.current ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, currentColor 8%, transparent) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          <div
            ref={exportRef}
            data-viz-root
            className="absolute inset-0 origin-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {mode === "radial" ? (
              <RadialView
                roots={roots}
                departmentColors={departmentColors}
                maxDepth={maxDepth}
                onSelectUser={onSelectUser}
                highlightUserId={focusUserId}
              />
            ) : mode === "horizontal" ? (
              <HorizontalView
                roots={roots}
                departmentColors={departmentColors}
                maxDepth={maxDepth}
                onSelectUser={onSelectUser}
                highlightUserId={focusUserId}
              />
            ) : (
              <TreemapView
                roots={roots}
                departmentColors={departmentColors}
                maxDepth={maxDepth}
                onSelectUser={onSelectUser}
                highlightUserId={focusUserId}
              />
            )}
          </div>
          <p className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            Seret untuk geser · Ctrl + roda mouse untuk zoom · Klik node untuk detail
          </p>
        </div>
      )}
    </div>
  );
}
