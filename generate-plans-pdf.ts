/**
 * Generates a marketing-friendly PDF listing every feature across all
 * membership plans as a comparison matrix. Runs entirely client-side.
 */

import jsPDF from "jspdf";
import autoTable, { type RowInput, type CellHookData } from "jspdf-autotable";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { buildFeatureMatrix, type FeatureStatus } from "./feature-matrix.ts";

// Brand-ish palette (RGB) for the PDF.
const COLOR_PRIMARY: [number, number, number] = [37, 99, 235];
const COLOR_HEADER: [number, number, number] = [30, 41, 59];
const COLOR_CATEGORY: [number, number, number] = [226, 232, 240];
const COLOR_INCLUDED: [number, number, number] = [22, 163, 74];
const COLOR_EXCLUDED: [number, number, number] = [148, 163, 184];

function formatEmployees(max: number): string {
  return max === 0 ? "Unlimited" : `${max} karyawan`;
}

function formatStorage(mb: number): string {
  if (mb === 0) return "Unlimited";
  if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
  return `${mb} MB`;
}

const SUPPORT_LABELS: Record<string, string> = {
  community: "Komunitas",
  email: "Email",
  priority: "Prioritas",
  dedicated: "Dedicated AM",
};

function statusSymbol(status: FeatureStatus): string {
  if (status === "included") return "\u2713"; // check
  if (status === "excluded") return "\u2717"; // cross
  return "\u2013"; // en dash for N/A
}

export function generatePlansFeaturePdf(plans: Doc<"membershipPlans">[]): void {
  const matrix = buildFeatureMatrix(plans);
  const sorted = [...plans].sort((a, b) => a.order - b.order);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Daftar Lengkap Fitur per Paket", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(`Dokumen perbandingan untuk tim marketing \u00b7 ${today}`, 14, 18);

  // ── Plan summary rows (price, limits) ──────────────────────────────────────
  const planCols = matrix.planNames;
  const head: RowInput[] = [["Fitur", ...planCols]];

  const priceRow: RowInput = [
    { content: "Harga", styles: { fontStyle: "bold" } },
    ...sorted.map((p) => ({
      content: `${p.price}\n${p.priceUnit}`,
      styles: { fontStyle: "bold" as const, halign: "center" as const },
    })),
  ];
  const employeesRow: RowInput = [
    "Batas Karyawan",
    ...sorted.map((p) => ({
      content: formatEmployees(p.maxEmployees),
      styles: { halign: "center" as const },
    })),
  ];
  const storageRow: RowInput = [
    "Penyimpanan",
    ...sorted.map((p) => ({
      content: formatStorage(p.maxStorageMb),
      styles: { halign: "center" as const },
    })),
  ];
  const supportRow: RowInput = [
    "Dukungan",
    ...sorted.map((p) => ({
      content: SUPPORT_LABELS[p.supportLevel] ?? p.supportLevel,
      styles: { halign: "center" as const },
    })),
  ];

  const body: RowInput[] = [priceRow, employeesRow, storageRow, supportRow];

  // Track which cells are status symbols so we can colour them in didParseCell.
  const statusCells = new Map<string, FeatureStatus>();

  for (const cat of matrix.categories) {
    // Category separator row spanning all columns.
    body.push([
      {
        content: cat.category,
        colSpan: planCols.length + 1,
        styles: {
          fillColor: COLOR_CATEGORY,
          textColor: COLOR_HEADER,
          fontStyle: "bold",
          halign: "left",
        },
      },
    ]);

    for (const feature of cat.features) {
      const rowIndex = body.length; // index within body
      const cells: RowInput = [feature.label];
      sorted.forEach((p, colIdx) => {
        const status = feature.statuses[p.name] ?? "na";
        statusCells.set(`${rowIndex}:${colIdx + 1}`, status);
        cells.push({
          content: statusSymbol(status),
          styles: { halign: "center" as const, fontStyle: "bold" as const },
        });
      });
      body.push(cells);
    }
  }

  autoTable(doc, {
    startY: 27,
    head,
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", lineColor: [226, 232, 240] },
    headStyles: {
      fillColor: COLOR_HEADER,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: { 0: { cellWidth: 70, halign: "left" } },
    didParseCell: (data: CellHookData) => {
      if (data.section !== "body") return;
      const key = `${data.row.index}:${data.column.index}`;
      const status = statusCells.get(key);
      if (status === "included") data.cell.styles.textColor = COLOR_INCLUDED;
      else if (status === "excluded") data.cell.styles.textColor = COLOR_EXCLUDED;
      else if (status === "na") data.cell.styles.textColor = COLOR_EXCLUDED;
    },
  });

  // ── Footer with legend on every page ───────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "\u2713 Termasuk    \u2717 Tidak tersedia    \u2013 Tidak berlaku",
      14,
      pageHeight - 6,
    );
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 6, {
      align: "right",
    });
  }

  doc.save(`daftar-fitur-paket-${new Date().toISOString().slice(0, 10)}.pdf`);
}
