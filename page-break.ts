// ─── Page break / print layout helpers ─────────────────────────────────────
// The org chart canvas uses CSS pixels as its coordinate system (1 unit = 1px
// at 100% zoom). To draw realistic page boundaries we convert paper sizes from
// millimetres to pixels at 96dpi.

export type PaperSizeKey = "a4" | "a3" | "a2" | "a1" | "a0" | "letter" | "legal" | "custom";
export type PageOrientation = "portrait" | "landscape";

export const MM_TO_PX = 3.7795; // 96dpi

// Paper dimensions in millimetres (portrait: width < height).
export const PAPER_DIMS: Record<
  PaperSizeKey,
  { label: string; w: number; h: number }
> = {
  a4: { label: "A4 (210 × 297 mm)", w: 210, h: 297 },
  a3: { label: "A3 (297 × 420 mm)", w: 297, h: 420 },
  a2: { label: "A2 (420 × 594 mm)", w: 420, h: 594 },
  a1: { label: "A1 (594 × 841 mm)", w: 594, h: 841 },
  a0: { label: "A0 (841 × 1189 mm)", w: 841, h: 1189 },
  letter: { label: "Letter (216 × 279 mm)", w: 216, h: 279 },
  legal: { label: "Legal (216 × 356 mm)", w: 216, h: 356 },
  // Placeholder dims; actual size comes from cfg.customWmm / cfg.customHmm.
  custom: { label: "Ukuran Custom…", w: 210, h: 297 },
};

export const PAPER_OPTIONS: Array<{ value: PaperSizeKey; label: string }> = (
  Object.keys(PAPER_DIMS) as PaperSizeKey[]
).map((k) => ({ value: k, label: PAPER_DIMS[k].label }));

// Batas ukuran custom (mm). Batas atas menjaga kapasitas kanvas/PDF tetap wajar.
export const CUSTOM_PAPER_MIN_MM = 50;
export const CUSTOM_PAPER_MAX_MM = 2000;
export const DEFAULT_CUSTOM_W_MM = 594; // A1
export const DEFAULT_CUSTOM_H_MM = 841;

// Default margin around the paper edge, in millimetres.
export const DEFAULT_MARGIN_MM = 10;

// Breathing room (canvas px) added around a page's node bounding box before it
// is captured/scaled. Shared by the on-canvas guides and the preview/PDF.
export const PAGE_REGION_PAD = 24;

export type PageConfig = {
  paper: PaperSizeKey;
  orientation: PageOrientation;
  marginMm: number;
  // Dipakai hanya bila paper === "custom" (dalam mm, sisi terpanjang bebas).
  customWmm?: number;
  customHmm?: number;
};

export const DEFAULT_PAGE_CONFIG: PageConfig = {
  paper: "a4",
  orientation: "landscape",
  marginMm: DEFAULT_MARGIN_MM,
  customWmm: DEFAULT_CUSTOM_W_MM,
  customHmm: DEFAULT_CUSTOM_H_MM,
};

// Returns the printable area size (inside margins) of a single page, in canvas
// pixels. This is the size a chart slice must fit into per page.
export function getPageContentSizePx(cfg: PageConfig): {
  pageW: number;
  pageH: number;
  contentW: number;
  contentH: number;
  marginPx: number;
} {
  const dims = PAPER_DIMS[cfg.paper];
  // Untuk ukuran custom, pakai nilai mm yang diisi pengguna (dengan fallback).
  const baseW = cfg.paper === "custom" ? (cfg.customWmm ?? DEFAULT_CUSTOM_W_MM) : dims.w;
  const baseH = cfg.paper === "custom" ? (cfg.customHmm ?? DEFAULT_CUSTOM_H_MM) : dims.h;
  const isLand = cfg.orientation === "landscape";
  const wMm = isLand ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
  const hMm = isLand ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
  const marginPx = cfg.marginMm * MM_TO_PX;
  const pageW = wMm * MM_TO_PX;
  const pageH = hMm * MM_TO_PX;
  return {
    pageW,
    pageH,
    contentW: Math.max(1, pageW - marginPx * 2),
    contentH: Math.max(1, pageH - marginPx * 2),
    marginPx,
  };
}

// A manual page-break line placed on the canvas. `pos` is the canvas coordinate
// (x for vertical lines, y for horizontal lines).
export type BreakLine = {
  id: string;
  orientation: "vertical" | "horizontal";
  pos: number;
};

let breakIdCounter = 0;
export function makeBreakId(): string {
  breakIdCounter += 1;
  return `brk-${Date.now()}-${breakIdCounter}`;
}

// Given the canvas size and manual break lines, compute the sorted cut
// positions and the resulting page boundaries (columns × rows). Positions are
// clamped to the canvas and de-duplicated.
export function computePageGrid(
  canvasW: number,
  canvasH: number,
  breaks: BreakLine[],
): { xs: number[]; ys: number[]; cols: number; rows: number } {
  const vx = breaks
    .filter((b) => b.orientation === "vertical")
    .map((b) => b.pos)
    .filter((p) => p > 1 && p < canvasW - 1);
  const hy = breaks
    .filter((b) => b.orientation === "horizontal")
    .map((b) => b.pos)
    .filter((p) => p > 1 && p < canvasH - 1);

  const xs = Array.from(new Set([0, ...vx, canvasW])).sort((a, b) => a - b);
  const ys = Array.from(new Set([0, ...hy, canvasH])).sort((a, b) => a - b);

  return { xs, ys, cols: xs.length - 1, rows: ys.length - 1 };
}

// A node's bounding box on the canvas (in CSS pixels).
export type NodeBox = { x: number; y: number; w: number; h: number };

// One printed page's capture region on the canvas. This is the padded bounding
// box of the nodes that belong to the page, so a break line never cuts a card.
export type PageRegion = {
  key: string;
  pageIndex: number;
  totalPages: number;
  row: number; // 1-based
  col: number; // 1-based
  x: number;
  y: number;
  w: number;
  h: number;
  // The grid cell rectangle (bounded by the break lines / canvas edges) that
  // this page occupies. Pages never overlap here, so cropping to this rect
  // removes any neighbouring-page content.
  cellX: number;
  cellY: number;
  cellW: number;
  cellH: number;
  // The node boxes that belong to (are printed on) this page. A card that
  // straddles a break line is kept whole by also including its box in the crop.
  nodes: NodeBox[];
};

// Find the cell index (0-based) whose [edge, nextEdge) range holds `center`.
function cellIndexFor(edges: number[], center: number): number {
  for (let i = 0; i < edges.length - 1; i++) {
    if (center >= edges[i] && center < edges[i + 1]) return i;
  }
  return edges.length - 2; // last cell (covers the right/bottom edge)
}

// Assigns every node to exactly one page cell (by its center). Each page's
// capture region is EXACTLY its grid cell rectangle (bounded by the break lines
// / canvas edges), so pages are always disjoint — they can never overlap. Both
// the on-canvas guides and the preview/PDF use this identical geometry, so what
// you see on the canvas matches the preview and the exported PDF pixel-for-pixel.
// A card whose center falls in a cell belongs to that page; if it happens to
// straddle a break line it is cut at the line (predictable — nudge the line into
// the gap between cards to avoid it). Empty cells are dropped and pages are
// numbered in reading order (top-to-bottom, left-to-right).
//
// `pad` is accepted for signature compatibility but intentionally unused: growing
// regions past their cell is what caused neighboring pages to overlap.
export function computePageRegions(
  canvasW: number,
  canvasH: number,
  breaks: BreakLine[],
  nodes: NodeBox[],
  _pad: number,
): { regions: PageRegion[]; cols: number; rows: number } {
  const { xs, ys, cols, rows } = computePageGrid(canvasW, canvasH, breaks);

  // Collect the nodes that belong to each cell (assigned by their center point).
  const cellNodes: NodeBox[][][] = [];
  for (let r = 0; r < rows; r++) {
    cellNodes.push([]);
    for (let c = 0; c < cols; c++) cellNodes[r].push([]);
  }

  for (const n of nodes) {
    const c = cellIndexFor(xs, n.x + n.w / 2);
    const r = cellIndexFor(ys, n.y + n.h / 2);
    cellNodes[r][c].push(n);
  }

  const nonEmpty: { r: number; c: number; nodes: NodeBox[] }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cellNodes[r][c].length > 0) {
        nonEmpty.push({ r, c, nodes: cellNodes[r][c] });
      }
    }
  }

  const totalPages = nonEmpty.length;
  const regions: PageRegion[] = nonEmpty.map(({ r, c, nodes: pageNodes }, i) => {
    // Grid cell rectangle (bounded strictly by the break lines / canvas edges).
    // This IS the capture region — no growing past the cell, so pages never overlap.
    const cellX = xs[c];
    const cellY = ys[r];
    const cellW = Math.max(1, xs[c + 1] - xs[c]);
    const cellH = Math.max(1, ys[r + 1] - ys[r]);

    return {
      key: `${r}-${c}`,
      pageIndex: i + 1,
      totalPages,
      row: r + 1,
      col: c + 1,
      x: cellX,
      y: cellY,
      w: cellW,
      h: cellH,
      cellX,
      cellY,
      cellW,
      cellH,
      nodes: pageNodes,
    };
  });

  return { regions, cols, rows };
}
