"use node";

import escapeHtml from "escape-html";
import { Hercules } from "@usehercules/sdk";
import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { InviteContext } from "./userInvitesInternal";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY!,
  apiVersion: "2025-12-09",
});

/**
 * Sends an organization invite email to one or more employees who already exist
 * in the directory. Recipients MUST be directory employees (their email is
 * pre-registered), so on first login they are auto-linked and activated with no
 * re-registration and no admin approval. Manually typed / external addresses are
 * rejected. Admins only. Requires a verified sender configured in system email
 * settings.
 */
export const sendInvites = action({
  args: {
    recipients: v.array(v.string()),
    personalMessage: v.optional(v.string()),
    appUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: number }> => {
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
        message: "Pilih minimal satu karyawan dari direktori",
      });
    }

    // Basic email shape validation to fail early with a clear message.
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter((e) => !emailRe.test(e));
    if (invalid.length > 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Alamat email tidak valid: ${invalid.join(", ")}`,
      });
    }

    const context: InviteContext = await ctx.runQuery(
      internal.userInvitesInternal.getInviteContext,
      { recipients: emails },
    );

    if (!context.senderEmail) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Pengirim email belum dikonfigurasi. Minta Super Admin mengatur dan memverifikasi alamat pengirim di pengaturan email.",
      });
    }

    // Only invite people who are already in the employee directory. Any address
    // that is not a directory employee is rejected — invitations cannot be sent
    // to manually typed / external emails.
    const allowed = new Set(context.validEmails);
    const notInDirectory = emails.filter((e) => !allowed.has(e));
    if (notInDirectory.length > 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Hanya karyawan dari direktori yang dapat diundang. Alamat berikut belum terdaftar sebagai karyawan: ${notInDirectory.join(", ")}. Tambahkan mereka lebih dulu di Direktori Karyawan.`,
      });
    }

    const targetEmails = context.validEmails;

    const safeOrg = escapeHtml(context.orgName);
    const safeSender = escapeHtml(context.senderName);
    const registerUrl = args.appUrl ? `${args.appUrl.replace(/\/$/, "")}/` : null;
    const safeUrl = registerUrl ? escapeHtml(registerUrl) : null;
    const personal =
      args.personalMessage && args.personalMessage.trim().length > 0
        ? args.personalMessage.trim()
        : null;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;color:#111827;margin:0 0 8px;">Undangan bergabung ke ${safeOrg}</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">
          ${safeSender} mengundang Anda untuk bergabung ke organisasi
          <strong>${safeOrg}</strong> di platform Star e-Office. Data Anda sudah
          terdaftar, jadi Anda tidak perlu mendaftar ulang.
        </p>
        ${
          personal
            ? `<div style="border-left:3px solid #6366f1;background:#eef2ff;padding:12px 16px;border-radius:8px;margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(
                personal,
              )}</div>`
            : ""
        }
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">
          Cukup masuk menggunakan alamat email ini, dan akun Anda langsung aktif —
          tanpa kode undangan dan tanpa menunggu persetujuan.
        </p>
        ${
          safeUrl
            ? `<p style="margin:0 0 20px;"><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;">Masuk ke Star e-Office</a></p>`
            : ""
        }
        <ol style="font-size:13px;color:#4b5563;line-height:1.8;margin:0 0 16px;padding-left:20px;">
          <li>Buka aplikasi Star e-Office.</li>
          <li>Masuk menggunakan alamat email ini (${escapeHtml(safeOrg)} sudah mengenali Anda).</li>
          <li>Akun langsung aktif — Anda bisa mengakses sistem seketika.</li>
        </ol>
        <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">
          Jika Anda tidak mengenali undangan ini, abaikan email ini.
        </p>
      </div>
    `;

    // Show the admin's name as the sender, while the technical address stays
    // the verified system sender. Replies route back to the admin directly.
    const fromName = context.senderName
      ? `${context.senderName}${context.orgName ? ` - ${context.orgName}` : ""}`
      : context.orgName || "Star e-Office";
    // Strip characters that would break the "Name <email>" header.
    const safeFromName = fromName.replace(/["<>\r\n]/g, "").trim();
    const from = `${safeFromName} <${context.senderEmail}>`;
    const replyTo =
      context.adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(context.adminEmail)
        ? context.adminEmail
        : undefined;

    let sent = 0;
    // Send individually so one bad address does not block the rest.
    for (const to of targetEmails) {
      try {
        await hercules.email.send({
          from,
          to,
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: `Undangan bergabung ke ${context.orgName}`,
          html,
        });
        sent += 1;
      } catch (err) {
        console.error(`Gagal mengirim undangan ke ${to}:`, err);
      }
    }

    if (sent === 0) {
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message:
          "Tidak ada undangan yang berhasil dikirim. Periksa alamat pengirim terverifikasi dan coba lagi.",
      });
    }

    return { sent };
  },
});
