"use node";

import escapeHtml from "escape-html";
import { Hercules } from "@usehercules/sdk";
import { ConvexError, v } from "convex/values";
import { jsPDF } from "jspdf";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";
import type { LetterEmailContext } from "./lettersEmailInternal";
import { formatJobTitle, formatJobTitleSentence } from "./lib/formatJobTitle";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY!,
  apiVersion: "2025-12-09",
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CLASS_LABEL: Record<string, string> = {
  biasa: "Biasa",
  rahasia: "Rahasia",
  sangat_rahasia: "Sangat Rahasia",
  penting: "Penting",
  segera: "Segera",
};

// Converts the letter's HTML body to reasonably clean plain text for the PDF.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatDateId(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Builds an official-looking A4 PDF of the letter, returning a base64 string
// (without the data-url prefix) suitable for the email attachment API.
function buildLetterPdfBase64(ctxData: LetterEmailContext): string {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginL = 25;
  const marginR = 20;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  // KOP SURAT
  if (ctxData.orgName) {
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.text(ctxData.orgName, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    if (ctxData.orgAddress) {
      const addr = doc.splitTextToSize(ctxData.orgAddress, contentWidth);
      doc.text(addr, pageWidth / 2, y, { align: "center" });
      y += addr.length * 4;
    }
    const contactBits: string[] = [];
    if (ctxData.orgPhone) contactBits.push(`Telp: ${ctxData.orgPhone}`);
    if (ctxData.orgEmail) contactBits.push(`Email: ${ctxData.orgEmail}`);
    if (contactBits.length > 0) {
      doc.text(contactBits.join("  ·  "), pageWidth / 2, y, { align: "center" });
      y += 4;
    }
    y += 2;
    doc.setLineWidth(0.8);
    doc.line(marginL, y, pageWidth - marginR, y);
    y += 8;
  }

  // Metadata block (Nomor / Sifat / Perihal)
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const meta: Array<[string, string]> = [];
  if (ctxData.letterNumber) meta.push(["Nomor", ctxData.letterNumber]);
  if (ctxData.classification && ctxData.classification !== "biasa") {
    meta.push(["Sifat", CLASS_LABEL[ctxData.classification] ?? ctxData.classification]);
  }
  meta.push(["Perihal", ctxData.subject]);
  // Baris No. selalu tampil; kosong sebelum nomor terbentuk, terisi setelahnya.
  meta.push(["No.", ctxData.letterNumber ?? ""]);
  for (const [label, value] of meta) {
    const line = `${label.padEnd(10, " ")}: ${value}`;
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, marginL, y);
    y += wrapped.length * 5;
  }
  y += 4;

  // Tanggal (kanan) — didahului tempat bila ada: "Jakarta, 14 Juli 2026"
  const dateLine = [ctxData.place, formatDateId(ctxData.letterDate)].filter(Boolean).join(", ");
  doc.text(dateLine, pageWidth - marginR, y, { align: "right" });
  y += 8;

  // Kepada — urutan: Nama, Jabatan, Departemen
  doc.text("Kepada Yth.", marginL, y);
  y += 5;
  doc.setFont("times", "bold");
  doc.text(ctxData.toName, marginL, y);
  y += 5;
  doc.setFont("times", "normal");
  if (ctxData.toJobTitle) {
    doc.text(formatJobTitleSentence(ctxData.toJobTitle), marginL, y);
    y += 5;
  }
  if (ctxData.toOrganization) {
    doc.text(ctxData.toOrganization, marginL, y);
    y += 5;
  }
  y += 4;

  // Body. Catatan: sapaan "Dengan hormat," sudah termasuk dalam isi surat
  // (template body), jadi tidak ditulis ulang di sini agar tidak dobel.
  const bodyText = htmlToPlainText(ctxData.content);
  const bodyLines = doc.splitTextToSize(bodyText, contentWidth);
  const pageHeight = 297;
  const bottomMargin = 30;
  for (const ln of bodyLines) {
    if (y > pageHeight - bottomMargin) {
      doc.addPage();
      y = 20;
    }
    doc.text(ln, marginL, y);
    y += 5.5;
  }
  y += 10;

  // Signature block
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }
  const sigX = pageWidth - marginR - 60;
  // Urutan: Hormat kami, Jabatan, Departemen, (tanda tangan), Nama, NIP
  doc.setFont("times", "normal");
  doc.text("Hormat kami,", sigX, y);
  y += 5;
  if (ctxData.authorJobTitle) {
    doc.text(formatJobTitle(ctxData.authorJobTitle), sigX, y);
    y += 5;
  }
  if (ctxData.authorDepartment) {
    doc.text(ctxData.authorDepartment, sigX, y);
    y += 5;
  }
  // Tanda tangan gambar (bila pengirim menyimpannya), diletakkan di ruang tanda
  // tangan sebelum nama. Bila tidak ada, sisakan ruang kosong seperti biasa.
  if (ctxData.signatureImage && ctxData.signatureImage.startsWith("data:image/")) {
    try {
      const fmt = ctxData.signatureImage.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(ctxData.signatureImage, fmt, sigX, y, 40, 18);
      y += 20;
    } catch {
      // Jika gambar gagal dirender, jatuh kembali ke ruang kosong.
      y += 20;
    }
  } else {
    y += 20; // ruang tanda tangan
  }
  doc.setFont("times", "bold");
  doc.text(ctxData.authorName, sigX, y);
  doc.setLineWidth(0.3);
  const nameWidth = doc.getTextWidth(ctxData.authorName);
  doc.line(sigX, y + 1, sigX + nameWidth, y + 1);
  y += 5;
  doc.setFont("times", "normal");
  if (ctxData.authorNip) {
    doc.text(`NIP. ${ctxData.authorNip}`, sigX, y);
    y += 5;
  }

  // Verification footer
  if (ctxData.verificationCode) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Kode verifikasi keaslian: ${ctxData.verificationCode}`,
      marginL,
      pageHeight - 12,
    );
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
  }

  // Nomor halaman otomatis — hanya bila lampiran lebih dari satu halaman.
  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth / 2, pageHeight - 6, {
        align: "center",
      });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
  }

  // jsPDF outputs "datauristring" with a prefix; strip it for the API.
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.substring(dataUri.indexOf(",") + 1);
  return base64;
}

// Renders the HTML email body: greeting/message + full letter content + note.
function buildEmailHtml(
  ctxData: LetterEmailContext,
  message: string,
): string {
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");
  const headerTitle = ctxData.orgName ?? ctxData.fromOrganization ?? "Star e-Office";
  const metaRows: string[] = [];
  if (ctxData.letterNumber)
    metaRows.push(
      `<tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Nomor</td><td style="padding:2px 0;color:#111827;">${escapeHtml(ctxData.letterNumber)}</td></tr>`,
    );
  metaRows.push(
    `<tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Perihal</td><td style="padding:2px 0;color:#111827;">${escapeHtml(ctxData.subject)}</td></tr>`,
  );
  if (ctxData.letterNumber)
    metaRows.push(
      `<tr><td style="padding:2px 8px 2px 0;color:#6b7280;">No.</td><td style="padding:2px 0;color:#111827;">${escapeHtml(ctxData.letterNumber)}</td></tr>`,
    );
  else
    metaRows.push(
      `<tr><td style="padding:2px 8px 2px 0;color:#6b7280;">No.</td><td style="padding:2px 0;color:#111827;">&nbsp;</td></tr>`,
    );
  metaRows.push(
    `<tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Tanggal</td><td style="padding:2px 0;color:#111827;">${escapeHtml([ctxData.place, formatDateId(ctxData.letterDate)].filter(Boolean).join(", "))}</td></tr>`,
  );

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;">
      <div style="border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:16px;">
        <p style="font-size:18px;font-weight:700;margin:0;color:#111827;">${escapeHtml(headerTitle)}</p>
        <p style="font-size:12px;color:#6b7280;margin:2px 0 0;">Surat Resmi · Star e-Office</p>
      </div>

      <div style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 16px;">${safeMessage}</div>

      <table style="font-size:13px;border-collapse:collapse;margin:0 0 16px;">${metaRows.join("")}</table>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;background:#ffffff;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin:0 0 10px;">Isi Surat</p>
        <div style="font-size:14px;line-height:1.7;color:#111827;">${ctxData.content}</div>
      </div>

      <div style="margin:16px 0 0;font-size:13px;color:#374151;">
        <p style="margin:0;">Hormat kami,</p>
        ${ctxData.authorJobTitle ? `<p style="margin:4px 0 0;color:#6b7280;">${escapeHtml(formatJobTitle(ctxData.authorJobTitle))}</p>` : ""}
        ${ctxData.authorDepartment ? `<p style="margin:0;color:#6b7280;">${escapeHtml(ctxData.authorDepartment)}</p>` : ""}
        <p style="margin:16px 0 0;font-weight:700;">${escapeHtml(ctxData.authorName)}</p>
        ${ctxData.authorNip ? `<p style="margin:0;color:#6b7280;">NIP. ${escapeHtml(ctxData.authorNip)}</p>` : ""}
      </div>

      <p style="font-size:12px;color:#6b7280;margin:20px 0 0;border-top:1px solid #e5e7eb;padding-top:12px;">
        Versi PDF resmi surat ini terlampir pada email.
        ${ctxData.verificationCode ? `Kode verifikasi keaslian: <span style="font-family:ui-monospace,monospace;">${escapeHtml(ctxData.verificationCode)}</span>.` : ""}
      </p>
    </div>
  `;
}

/**
 * Sends a letter as an email (with the letter body in the message and an
 * official PDF attachment) to one or more recipients. Recipients may be
 * internal staff emails or external addresses. Requires a verified system
 * sender. The sender name shows the current user; the technical address is the
 * verified sender and reply-to routes back to the user.
 */
export const sendLetterEmail = action({
  args: {
    letterId: v.id("letters"),
    recipients: v.array(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ sent: number }> => {
    const emails = Array.from(
      new Set(
        args.recipients
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0),
      ),
    );
    if (emails.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih minimal satu penerima",
      });
    }
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Alamat email tidak valid: ${invalid.join(", ")}`,
      });
    }

    const context: LetterEmailContext = await ctx.runQuery(
      internal.lettersEmailInternal.getLetterEmailContext,
      { letterId: args.letterId },
    );

    if (!context.senderEmail) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Pengirim email belum dikonfigurasi. Minta Super Admin mengatur dan memverifikasi alamat pengirim di pengaturan email.",
      });
    }

    // Build the PDF attachment once and reuse for all recipients.
    const pdfBase64 = buildLetterPdfBase64(context);
    const numberSlug = (context.letterNumber ?? context.subject)
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const fileName = `Surat-${numberSlug || "resmi"}.pdf`;

    const html = buildEmailHtml(context, args.message);
    const subject = `${context.letterNumber ? `[${context.letterNumber}] ` : ""}${context.subject}`;

    // Fixed, recognizable sender display name for all outgoing letter emails.
    const safeFromName = "surat - star e-Office";
    const from = `${safeFromName} <${context.senderEmail}>`;
    const replyTo =
      context.senderReplyTo && EMAIL_RE.test(context.senderReplyTo)
        ? context.senderReplyTo
        : undefined;

    let sent = 0;
    const succeeded: string[] = [];
    // Send individually so one bad address does not block the rest.
    for (const to of emails) {
      try {
        await hercules.email.send({
          from,
          to,
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          html,
          attachments: [
            {
              content: pdfBase64,
              filename: fileName,
              content_type: "application/pdf",
            },
          ],
        });
        sent += 1;
        succeeded.push(to);
      } catch (err) {
        console.error(`Gagal mengirim surat ke ${to}:`, err);
      }
    }

    if (sent === 0) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message:
          "Tidak ada email yang berhasil dikirim. Periksa alamat pengirim terverifikasi dan coba lagi.",
      });
    }

    // Record the send in the letter's history timeline.
    await ctx.runMutation(internal.lettersEmailInternal.recordEmailSent, {
      letterId: args.letterId,
      recipients: succeeded,
    });

    return { sent };
  },
});

// ---------------------------------------------------------------------------
// Pengiriman email massal bertahap
// ---------------------------------------------------------------------------

// Jumlah alamat yang diproses per batch. Cukup kecil agar setiap batch selesai
// jauh di bawah batas waktu satu action, cukup besar agar keseluruhan cepat.
const EMAIL_BATCH_SIZE = 20;

/** Normalises + validates recipient emails, throwing on the first hard error. */
function normalizeEmails(recipients: string[]): string[] {
  const emails = Array.from(
    new Set(recipients.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)),
  );
  if (emails.length === 0) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Pilih minimal satu penerima" });
  }
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length > 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Alamat email tidak valid: ${invalid.join(", ")}`,
    });
  }
  return emails;
}

/**
 * Starts a background bulk email send. Builds the PDF + email once, stores the
 * attachment, creates a job with one queue row per recipient, then kicks off
 * batch processing. Returns the jobId so the UI can poll live progress.
 */
export const startLetterEmailJob = action({
  args: {
    letterId: v.id("letters"),
    recipients: v.array(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ jobId: Id<"letterEmailJobs">; total: number }> => {
    const emails = normalizeEmails(args.recipients);

    const context: LetterEmailContext = await ctx.runQuery(
      internal.lettersEmailInternal.getLetterEmailContext,
      { letterId: args.letterId },
    );
    if (!context.senderEmail) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Pengirim email belum dikonfigurasi. Minta Super Admin mengatur dan memverifikasi alamat pengirim di pengaturan email.",
      });
    }

    // Build the PDF once and store it so every batch can reuse it.
    const pdfBase64 = buildLetterPdfBase64(context);
    const pdfBytes = Buffer.from(pdfBase64, "base64");
    const pdfStorageId = await ctx.storage.store(
      new Blob([pdfBytes], { type: "application/pdf" }),
    );

    const numberSlug = (context.letterNumber ?? context.subject)
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const fileName = `Surat-${numberSlug || "resmi"}.pdf`;
    const html = buildEmailHtml(context, args.message);
    const emailSubject = `${context.letterNumber ? `[${context.letterNumber}] ` : ""}${context.subject}`;
    const fromLine = `surat - star e-Office <${context.senderEmail}>`;
    const replyTo =
      context.senderReplyTo && EMAIL_RE.test(context.senderReplyTo)
        ? context.senderReplyTo
        : undefined;

    const jobId: Id<"letterEmailJobs"> = await ctx.runMutation(
      internal.lettersEmailInternal.createLetterEmailJob,
      {
        letterId: args.letterId,
        message: args.message,
        emails,
        pdfStorageId,
        fromLine,
        replyTo,
        emailSubject,
        emailHtml: html,
        fileName,
      },
    );

    // Kick off processing in the background so this call returns immediately.
    await ctx.scheduler.runAfter(0, internal.lettersEmail.processLetterEmailBatch, {
      jobId,
    });

    return { jobId, total: emails.length };
  },
});

/**
 * Processes a single batch of a bulk email job, then schedules the next batch
 * until the queue is drained. Runs in the background (scheduled), so failures
 * of individual addresses never block the rest.
 */
export const processLetterEmailBatch = internalAction({
  args: { jobId: v.id("letterEmailJobs") },
  handler: async (ctx, args): Promise<void> => {
    const batch = await ctx.runQuery(
      internal.lettersEmailInternal.getNextEmailBatch,
      { jobId: args.jobId, limit: EMAIL_BATCH_SIZE },
    );
    // Job vanished (deleted) — nothing to do.
    if (!batch) return;

    // No more pending recipients: finalize and stop.
    if (batch.items.length === 0) {
      await ctx.runMutation(internal.lettersEmailInternal.finalizeEmailJob, {
        jobId: args.jobId,
      });
      return;
    }

    // Load the shared PDF attachment once for this batch.
    const blob = await ctx.storage.get(batch.pdfStorageId);
    const pdfBase64 = blob
      ? Buffer.from(await blob.arrayBuffer()).toString("base64")
      : null;

    const results: Array<{ queueId: Id<"letterEmailQueue">; email: string; ok: boolean }> = [];
    for (const item of batch.items) {
      if (!pdfBase64) {
        results.push({ queueId: item.queueId, email: item.email, ok: false });
        continue;
      }
      try {
        await hercules.email.send({
          from: batch.fromLine,
          to: item.email,
          ...(batch.replyTo ? { reply_to: batch.replyTo } : {}),
          subject: batch.emailSubject,
          html: batch.emailHtml,
          attachments: [
            {
              content: pdfBase64,
              filename: batch.fileName,
              content_type: "application/pdf",
            },
          ],
        });
        results.push({ queueId: item.queueId, email: item.email, ok: true });
      } catch (err) {
        console.error(`Gagal mengirim surat ke ${item.email}:`, err);
        results.push({ queueId: item.queueId, email: item.email, ok: false });
      }
    }

    const { remaining } = await ctx.runMutation(
      internal.lettersEmailInternal.applyEmailBatchResults,
      { jobId: args.jobId, results },
    );

    if (remaining > 0) {
      // Small delay between batches to be gentle on the email provider.
      await ctx.scheduler.runAfter(
        500,
        internal.lettersEmail.processLetterEmailBatch,
        { jobId: args.jobId },
      );
    } else {
      await ctx.runMutation(internal.lettersEmailInternal.finalizeEmailJob, {
        jobId: args.jobId,
      });
    }
  },
});
