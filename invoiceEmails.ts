"use node";

import escapeHtml from "escape-html";
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { Hercules } from "@usehercules/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { InvoiceEmailData } from "./invoices";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY!,
  apiVersion: "2025-12-09",
});

/** Build the RFC5322 "from" line with a friendly display name. */
function fromLine(senderEmail: string, senderName: string): string {
  const name = senderName.trim() || "Star e-Office";
  return `${name} <${senderEmail}>`;
}

// ── PDF building (server-side, returns base64) ──────────────────────────────
// Mirrors src/lib/invoice-pdf.ts but outputs bytes for email attachments
// instead of triggering a browser download.

const COLOR_PRIMARY: [number, number, number] = [37, 99, 235];
const COLOR_HEADER: [number, number, number] = [30, 41, 59];
const COLOR_PAID: [number, number, number] = [22, 163, 74];
const COLOR_MUTED: [number, number, number] = [120, 120, 120];

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

const STATUS_LABELS: Record<InvoiceEmailData["status"], string> = {
  issued: "BELUM DIBAYAR",
  overdue: "JATUH TEMPO",
  paid: "LUNAS",
  cancelled: "DIBATALKAN",
};

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

function drawInfoAndItems(
  doc: jsPDF,
  data: InvoiceEmailData,
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
    headStyles: { fillColor: COLOR_HEADER, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 78 }, 3: { halign: "right" } },
  });

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

function buildInvoicePdfBase64(data: InvoiceEmailData): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(doc, pageWidth, "FAKTUR", `No. ${data.number}`);

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

  let y = afterTotal + 16;
  if (data.bankAccounts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_HEADER);
    doc.text("Rekening tujuan pembayaran", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Bank", "Nomor Rekening", "Atas Nama"]],
      body: data.bankAccounts.map((b) => [
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
  return doc.output("datauristring").split(",")[1];
}

function buildReceiptPdfBase64(data: InvoiceEmailData): string {
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_PAID);
  doc.text("LUNAS", pageWidth - 14, 38, { align: "right" });

  drawInfoAndItems(doc, data, 52);

  drawFooter(doc);
  return doc.output("datauristring").split(",")[1];
}

// ── Email actions ────────────────────────────────────────────────────────────
// Best-effort: if no verified sender is configured, no recipient email exists,
// or Hercules Email throws, we log and swallow so the triggering mutation is
// never affected. In-app notifications remain the reliable channel.

/** Send the invoice (Faktur) PDF to the org's admin when a new invoice is issued. */
export const sendInvoiceEmail = internalAction({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args): Promise<void> => {
    const data = await ctx.runQuery(internal.invoices.getInvoiceEmailData, {
      invoiceId: args.invoiceId,
    });
    if (!data || !data.recipientEmail) return;

    const settings = await ctx.runQuery(
      internal.alertEmailSettings.getSenderInternal,
      {},
    );
    if (!settings.emailEnabled || !settings.senderEmail) return;

    const amountLabel = data.amountLabel ?? formatRupiah(data.amount);
    const text = [
      `Halo Admin ${data.orgName},`,
      "",
      "Faktur langganan telah diterbitkan untuk organisasi Anda.",
      "",
      `Nomor Faktur : ${data.number}`,
      `Jumlah       : ${amountLabel}`,
      `Jatuh tempo  : ${formatDate(data.dueDate)}`,
      "",
      "Faktur dalam bentuk PDF terlampir pada email ini. Silakan lakukan pembayaran sebelum tanggal jatuh tempo dan unggah bukti pembayaran melalui halaman Tagihan & Langganan.",
      "",
      "Pesan otomatis dari sistem Star e-Office.",
    ].join("\n");
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:18px;color:#111827;margin:0 0 12px;">Faktur ${escapeHtml(data.number)}</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">
          Halo Admin ${escapeHtml(data.orgName)},<br/>
          Faktur langganan telah diterbitkan untuk organisasi Anda.
        </p>
        <table style="font-size:14px;color:#374151;border-collapse:collapse;margin:0 0 16px;">
          <tr><td style="padding:2px 12px 2px 0;">Nomor Faktur</td><td style="font-weight:600;">${escapeHtml(data.number)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;">Jumlah</td><td style="font-weight:600;">${escapeHtml(amountLabel)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;">Jatuh tempo</td><td style="font-weight:600;">${escapeHtml(formatDate(data.dueDate))}</td></tr>
        </table>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">
          Faktur dalam bentuk PDF terlampir pada email ini. Silakan lakukan pembayaran sebelum tanggal jatuh tempo dan unggah bukti pembayaran melalui halaman Tagihan &amp; Langganan.
        </p>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">Pesan otomatis dari sistem Star e-Office.</p>
      </div>
    `;

    try {
      await hercules.email.send({
        from: fromLine(settings.senderEmail, settings.senderName),
        to: data.recipientEmail,
        reply_to: settings.senderEmail,
        subject: `Faktur ${data.number} - ${data.orgName}`,
        html,
        text,
        attachments: [
          {
            filename: `faktur-${data.number}.pdf`,
            content: buildInvoicePdfBase64(data),
            content_type: "application/pdf",
          },
        ],
      });
    } catch (err) {
      console.error("Gagal mengirim email faktur:", err);
    }
  },
});

/** Send the receipt (Bukti Pelunasan) PDF to the org's admin once an invoice is paid. */
export const sendReceiptEmail = internalAction({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args): Promise<void> => {
    const data = await ctx.runQuery(internal.invoices.getInvoiceEmailData, {
      invoiceId: args.invoiceId,
    });
    if (!data || !data.recipientEmail) return;
    // Only send when the invoice is actually paid (receipt exists).
    if (data.status !== "paid") return;

    const settings = await ctx.runQuery(
      internal.alertEmailSettings.getSenderInternal,
      {},
    );
    if (!settings.emailEnabled || !settings.senderEmail) return;

    const receiptNo = data.receiptNumber ?? `BP-${data.number}`;
    const amountLabel = data.amountLabel ?? formatRupiah(data.amount);
    const text = [
      `Halo Admin ${data.orgName},`,
      "",
      `Pembayaran untuk Faktur ${data.number} telah kami terima dan verifikasi. Terima kasih.`,
      "",
      `No. Bukti Pelunasan : ${receiptNo}`,
      `Untuk Faktur        : ${data.number}`,
      `Jumlah              : ${amountLabel}`,
      ...(data.paidAt
        ? [`Tanggal pembayaran  : ${formatDate(data.paidAt)}`]
        : []),
      "",
      "Bukti pelunasan dalam bentuk PDF terlampir pada email ini untuk arsip Anda.",
      "",
      "Pesan otomatis dari sistem Star e-Office.",
    ].join("\n");
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:18px;color:#111827;margin:0 0 12px;">Bukti Pelunasan ${escapeHtml(receiptNo)}</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">
          Halo Admin ${escapeHtml(data.orgName)},<br/>
          Pembayaran untuk Faktur ${escapeHtml(data.number)} telah kami terima dan verifikasi. Terima kasih.
        </p>
        <table style="font-size:14px;color:#374151;border-collapse:collapse;margin:0 0 16px;">
          <tr><td style="padding:2px 12px 2px 0;">No. Bukti Pelunasan</td><td style="font-weight:600;">${escapeHtml(receiptNo)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;">Untuk Faktur</td><td style="font-weight:600;">${escapeHtml(data.number)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;">Jumlah</td><td style="font-weight:600;">${escapeHtml(amountLabel)}</td></tr>
          ${data.paidAt ? `<tr><td style="padding:2px 12px 2px 0;">Tanggal pembayaran</td><td style="font-weight:600;">${escapeHtml(formatDate(data.paidAt))}</td></tr>` : ""}
        </table>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">
          Bukti pelunasan dalam bentuk PDF terlampir pada email ini untuk arsip Anda.
        </p>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">Pesan otomatis dari sistem Star e-Office.</p>
      </div>
    `;

    try {
      await hercules.email.send({
        from: fromLine(settings.senderEmail, settings.senderName),
        to: data.recipientEmail,
        reply_to: settings.senderEmail,
        subject: `Bukti Pelunasan ${receiptNo} - ${data.orgName}`,
        html,
        text,
        attachments: [
          {
            filename: `bukti-pelunasan-${receiptNo}.pdf`,
            content: buildReceiptPdfBase64(data),
            content_type: "application/pdf",
          },
        ],
      });
    } catch (err) {
      console.error("Gagal mengirim email bukti pelunasan:", err);
    }
  },
});
