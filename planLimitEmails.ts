"use node";

import escapeHtml from "escape-html";
import { Hercules } from "@usehercules/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY!,
  apiVersion: "2025-12-09",
});

/**
 * Send a plan-limit warning/block email to admins. Best-effort: if no verified
 * sender is configured, or Hercules Email throws, we log and swallow so the
 * triggering mutation is never affected. In-app notifications are the reliable
 * channel; email is a bonus.
 */
export const sendLimitAlert = internalAction({
  args: {
    to: v.array(v.string()),
    subject: v.string(),
    heading: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.to.length === 0) return;

    // Resolve the configured verified sender. Skip entirely if emails are off
    // or no sender is set (avoids guaranteed failures).
    const settings = await ctx.runQuery(
      internal.alertEmailSettings.getSenderInternal,
      {},
    );
    if (!settings.emailEnabled || !settings.senderEmail) return;

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:18px;color:#111827;margin:0 0 12px;">${escapeHtml(args.heading)}</h1>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">${escapeHtml(args.body)}</p>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">Pesan otomatis dari sistem manajemen paket langganan.</p>
      </div>
    `;

    try {
      await hercules.email.send({
        from: settings.senderName?.trim()
          ? `${settings.senderName.trim()} <${settings.senderEmail}>`
          : settings.senderEmail,
        to: args.to,
        reply_to: settings.senderEmail,
        subject: args.subject,
        html,
      });
    } catch (err) {
      console.error("Gagal mengirim email peringatan batas paket:", err);
    }
  },
});
