/**
 * Client-side PDF generation for subscription invoices (Faktur) and payment
 * receipts (Bukti Pelunasan). Reuses the jsPDF + autoTable pattern used across
 * the app. Shared by both the super-admin invoice tab and the org billing page.
 */

import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

const COLOR_PRIMARY: [number, number, number] = [37, 99, 235];
const COLOR_HEADER: [number, number, number] = [30, 41, 59];
const COLOR_PAID: [number, number, number] = [22, 163, 74];
const COLOR_MUTED: [number, number, number] = [120, 120, 120];

export type InvoicePdfData = {
  number: string;
  orgName: string;
  planName: string | null;
  cycleMonths: number;
  amount: number;
  amountLabel: string | null;
  description: string | null;
  issuedAt: string;
  dueDate: string;
  status: "issued" | "paid" | "cancelled" | "overdue";
  paidAt: string | null;
  receiptNumber: string | null;
};

export type InvoiceBankInfo = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function cycleLabel(months: number): string {
  return `${months} bulan`;
}

const STATUS_LABELS: Record<InvoicePdfData["status"], string> = {
  issued: "BELUM DIBAYAR",
  overdue: "JATUH TEMPO",
  paid: "LUNAS",
  cancelled: "DIBATALKAN",
};

/**
 * Shared brand header. Returns the Y position below the header block so the
 * caller can continue laying out content.
 */
function drawHeader(
  doc: jsPDF,
  pageWidth: number,
  title: string,
  subtitle: string,
): void {
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Star e-Office", 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, pageWidth - 14, 12, { align: "right" });
  doc.setFontSize(9);
  doc.text(subtitle, pageWidth - 14, 19, { align: "right" });
}

/** Detail rows shared by invoice and receipt (org, plan, period, amount). */
function drawInfoAndItems(
  doc: jsPDF,
  data: InvoicePdfData,
  startY: number,
): number {
  doc.setTextColor(...COLOR_HEADER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ditagihkan kepada", 14, startY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(data.orgName, 14, startY + 6);

  const itemsBody: RowInput[] = [
    [
      data.description?.trim() ||
        (data.planName
          ? `Langganan paket ${data.planName}`
          : "Langganan Star e-Office"),
      data.planName ?? "-",
      cycleLabel(data.cycleMonths),
      {
        content: data.amountLabel ?? formatRupiah(data.amount),
        styles: { halign: "right" as const },
      },
    ],
  ];

  autoTable(doc, {
    startY: startY + 14,
    head: [["Deskripsi", "Paket", "Periode", "Jumlah"]],
    body: itemsBody,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, lineColor: [226, 232, 240] },
    headStyles: {
      fillColor: COLOR_HEADER,
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 78 },
      3: { halign: "right" },
    },
  });

  // Total row under the table.
  const docWithTable = doc as jsPDF & { lastAutoTable: { finalY: number } };
  const afterTable = docWithTable.lastAutoTable.finalY;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_HEADER);
  doc.text("Total", pageWidth - 60, afterTable + 10);
  doc.text(
    data.amountLabel ?? formatRupiah(data.amount),
    pageWidth - 14,
    afterTable + 10,
    { align: "right" },
  );
  return afterTable + 10;
}

function drawFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    "Dokumen ini dibuat otomatis oleh sistem Star e-Office.",
    14,
    pageHeight - 8,
  );
  doc.text(
    `Dicetak ${formatDate(new Date().toISOString())}`,
    pageWidth - 14,
    pageHeight - 8,
    { align: "right" },
  );
}

/** Generate and download an invoice (Faktur) PDF. */
export function generateInvoicePdf(
  data: InvoicePdfData,
  bankAccounts: InvoiceBankInfo[],
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(doc, pageWidth, "FAKTUR", `No. ${data.number}`);

  // Meta block: dates + status.
  doc.setTextColor(...COLOR_HEADER);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Tanggal terbit: ${formatDate(data.issuedAt)}`, 14, 36);
  doc.text(`Jatuh tempo: ${formatDate(data.dueDate)}`, 14, 41);

  const isPaid = data.status === "paid";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(isPaid ? COLOR_PAID : COLOR_PRIMARY));
  doc.text(STATUS_LABELS[data.status], pageWidth - 14, 36, { align: "right" });

  const afterTotal = drawInfoAndItems(doc, data, 52);

  // Destination bank accounts (only meaningful when not yet paid, but always
  // shown for reference).
  let y = afterTotal + 16;
  if (bankAccounts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_HEADER);
    doc.text("Rekening tujuan pembayaran", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Bank", "Nomor Rekening", "Atas Nama"]],
      body: bankAccounts.map((b) => [
        b.bankName,
        b.accountNumber,
        b.accountHolder,
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2.5, lineColor: [226, 232, 240] },
      headStyles: { fillColor: COLOR_HEADER, textColor: 255, fontStyle: "bold" },
    });
  }

  drawFooter(doc);
  doc.save(`faktur-${data.number}.pdf`);
}

/** Generate and download a payment receipt (Bukti Pelunasan) PDF. */
export function generateReceiptPdf(data: InvoicePdfData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const receiptNo = data.receiptNumber ?? `BP-${data.number}`;
  drawHeader(doc, pageWidth, "BUKTI PELUNASAN", `No. ${receiptNo}`);

  doc.setTextColor(...COLOR_HEADER);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Untuk Faktur: ${data.number}`, 14, 36);
  if (data.paidAt) {
    doc.text(`Tanggal pembayaran: ${formatDate(data.paidAt)}`, 14, 41);
  }

  // LUNAS badge on the right.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_PAID);
  doc.text("LUNAS", pageWidth - 14, 38, { align: "right" });

  drawInfoAndItems(doc, data, 52);

  drawFooter(doc);
  doc.save(`bukti-pelunasan-${receiptNo}.pdf`);
}
