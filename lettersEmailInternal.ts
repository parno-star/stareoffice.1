import { ConvexError, v } from "convex/values";
import { internalQuery, internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

const LETTER_EMAIL_KEY = "letter_email";

export type LetterEmailContext = {
  // Letter fields needed to render the email + PDF
  subject: string;
  content: string; // HTML body
  letterNumber: string | null;
  agendaNumber: string | null;
  letterDate: string; // ISO
  place: string | null;
  classification: string;
  fromName: string;
  fromOrganization: string | null;
  toName: string;
  toJobTitle: string | null;
  toOrganization: string | null;
  verificationCode: string | null;
  // Author (konseptor / penandatangan)
  authorName: string;
  authorJobTitle: string | null;
  authorDepartment: string | null;
  authorNip: string | null;
  // Sender's digital signature image (base64 data URL) to stamp above the name.
  signatureImage: string | null;
  // Letterhead (kop surat) — optional
  orgName: string | null;
  orgAddress: string | null;
  orgPhone: string | null;
  orgEmail: string | null;
  logoUrl: string | null;
  // Sender configuration
  senderEmail: string; // verified system sender ("" = not configured)
  senderName: string; // current user's display name
  senderReplyTo: string; // current user's email (reply-to)
};

/**
 * Internal: resolves everything the "kirim via email" action needs — the letter
 * content, author, letterhead (kop surat), and the verified system sender. The
 * caller must belong to the same organization as the letter (super admins may
 * access any). Throws loudly so the action fails with a clear message.
 */
export const getLetterEmailContext = internalQuery({
  args: { letterId: v.id("letters") },
  handler: async (ctx, args): Promise<LetterEmailContext> => {
    const { userId, organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const me = await ctx.db.get(userId);
    if (!me) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
    }

    const letter = await ctx.db.get(args.letterId);
    if (!letter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Surat tidak ditemukan" });
    }

    // Tenant isolation: non-super-admins may only email letters in their org.
    if (!isSuperAdmin && letter.organizationId && letter.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki akses ke surat ini",
      });
    }

    // Hanya surat final yang boleh dikirim via email: surat keluar/internal yang
    // sudah "sent", atau surat masuk yang sudah "received". Ini mencegah
    // pengiriman surat yang masih konsep atau dalam proses persetujuan.
    const isFinalForEmail =
      letter.status === "sent" ||
      (letter.type === "masuk" && letter.status === "received");
    if (!isFinalForEmail) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Surat hanya dapat dikirim via email setelah final (sudah dikirim/diterima).",
      });
    }

    const author = letter.authorId ? await ctx.db.get(letter.authorId) : null;
    // Penandatangan surat resmi selalu PENGIRIM (bukan pembuat/konseptor), agar
    // versi email & PDF sinkron dengan tampilan detail. Nama diambil dari data
    // pengirim; jabatan dari profil pengirim bila ada.
    const fromUser = letter.fromUserId ? await ctx.db.get(letter.fromUserId) : null;

    const letterhead = letter.letterheadId
      ? await ctx.db.get(letter.letterheadId)
      : null;
    const logoUrl =
      letterhead?.logoStorageId != null
        ? await ctx.storage.getUrl(letterhead.logoStorageId)
        : null;

    // Verified sender configured specifically for the letter-email feature.
    const settings = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", LETTER_EMAIL_KEY))
      .unique();
    const senderEmail =
      settings?.emailEnabled && settings.senderEmail ? settings.senderEmail : "";

    // Resolve the sender's signature the same way the on-screen document does:
    // a signature saved specifically for this letter, then the sender's saved
    // default signature.
    const signerUserId = letter.fromUserId ?? letter.authorId;
    let signatureImage: string | null = null;
    if (signerUserId) {
      const sig = await ctx.db
        .query("letterSignatures")
        .withIndex("by_letter_and_user", (q) =>
          q.eq("letterId", args.letterId).eq("userId", signerUserId),
        )
        .first();
      signatureImage = sig?.signatureData ?? fromUser?.defaultSignature ?? null;
    }

    return {
      subject: letter.subject,
      content: letter.content,
      letterNumber: letter.letterNumber ?? null,
      agendaNumber: letter.agendaNumber ?? null,
      letterDate: letter.letterDate,
      place: letter.place ?? null,
      classification: letter.classification,
      fromName: letter.fromName,
      fromOrganization: letter.fromOrganization ?? null,
      toName: letter.toName,
      toJobTitle: letter.toJobTitle ?? null,
      toOrganization: letter.toOrganization ?? null,
      verificationCode: letter.verificationCode ?? null,
      authorName: letter.fromName || fromUser?.name || author?.name || "",
      authorJobTitle: fromUser?.jobTitle ?? null,
      authorDepartment: fromUser?.department ?? null,
      authorNip: fromUser?.nip ?? null,
      signatureImage,
      orgName: letterhead?.organizationName ?? null,
      orgAddress: letterhead?.organizationAddress ?? null,
      orgPhone: letterhead?.organizationPhone ?? null,
      orgEmail: letterhead?.organizationEmail ?? null,
      logoUrl,
      senderEmail,
      senderName: me.name ?? "Pengguna Star e-Office",
      senderReplyTo: me.email ?? "",
    };
  },
});

/**
 * Internal: records an "email_sent" entry in the letter history timeline after
 * a successful send. Kept separate from the Node action so it runs in the fast
 * Convex runtime.
 */
export const recordEmailSent = internalMutation({
  args: {
    letterId: v.id("letters"),
    recipients: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const detail =
      args.recipients.length <= 3
        ? args.recipients.join(", ")
        : `${args.recipients.slice(0, 3).join(", ")} +${args.recipients.length - 3} lainnya`;
    await ctx.db.insert("letterHistory", {
      letterId: args.letterId,
      actorId: userId,
      action: "email_sent",
      detail: `Dikirim via email ke ${args.recipients.length} penerima: ${detail}`,
      occurredAt: new Date().toISOString(),
    });
  },
});

// ---------------------------------------------------------------------------
// Pengiriman email massal bertahap (background job)
// ---------------------------------------------------------------------------

const BATCH_SAMPLE_LIMIT = 8;

/**
 * Internal: creates a bulk email job plus one queue row per recipient. The
 * PDF attachment and rendered email are built once by the action and stored on
 * the job so every batch reuses them.
 */
export const createLetterEmailJob = internalMutation({
  args: {
    letterId: v.id("letters"),
    message: v.string(),
    emails: v.array(v.string()),
    pdfStorageId: v.id("_storage"),
    fromLine: v.string(),
    replyTo: v.optional(v.string()),
    emailSubject: v.string(),
    emailHtml: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"letterEmailJobs">> => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    // Prefer the letter's own organization for access scoping; fall back to the
    // caller's org (a super admin viewing an org).
    const letter = await ctx.db.get(args.letterId);
    const jobOrgId = letter?.organizationId ?? organizationId ?? undefined;

    const now = new Date().toISOString();
    const jobId = await ctx.db.insert("letterEmailJobs", {
      letterId: args.letterId,
      organizationId: jobOrgId,
      createdBy: userId,
      message: args.message,
      total: args.emails.length,
      sentCount: 0,
      failedCount: 0,
      status: "processing",
      failedSample: [],
      pdfStorageId: args.pdfStorageId,
      fromLine: args.fromLine,
      replyTo: args.replyTo,
      emailSubject: args.emailSubject,
      emailHtml: args.emailHtml,
      fileName: args.fileName,
      createdAt: now,
      updatedAt: now,
    });
    for (const email of args.emails) {
      await ctx.db.insert("letterEmailQueue", {
        jobId,
        email,
        status: "pending",
      });
    }
    return jobId;
  },
});

export type LetterEmailBatch = {
  pdfStorageId: Id<"_storage">;
  fromLine: string;
  replyTo: string | null;
  emailSubject: string;
  emailHtml: string;
  fileName: string;
  items: Array<{ queueId: Id<"letterEmailQueue">; email: string }>;
};

/**
 * Internal: returns the next chunk of pending recipients for a job together
 * with the shared send parameters. Returns null when the job no longer exists.
 */
export const getNextEmailBatch = internalQuery({
  args: { jobId: v.id("letterEmailJobs"), limit: v.number() },
  handler: async (ctx, args): Promise<LetterEmailBatch | null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const pending = await ctx.db
      .query("letterEmailQueue")
      .withIndex("by_job_and_status", (q) =>
        q.eq("jobId", args.jobId).eq("status", "pending"),
      )
      .take(args.limit);
    return {
      pdfStorageId: job.pdfStorageId,
      fromLine: job.fromLine,
      replyTo: job.replyTo ?? null,
      emailSubject: job.emailSubject,
      emailHtml: job.emailHtml,
      fileName: job.fileName,
      items: pending.map((p) => ({ queueId: p._id, email: p.email })),
    };
  },
});

/**
 * Internal: records the outcome of a processed batch — marks each queue row and
 * updates the job's running counters. Returns how many recipients remain.
 */
export const applyEmailBatchResults = internalMutation({
  args: {
    jobId: v.id("letterEmailJobs"),
    results: v.array(
      v.object({
        queueId: v.id("letterEmailQueue"),
        email: v.string(),
        ok: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ remaining: number }> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return { remaining: 0 };

    let sent = job.sentCount;
    let failed = job.failedCount;
    const failedSample = [...(job.failedSample ?? [])];

    for (const r of args.results) {
      await ctx.db.patch(r.queueId, { status: r.ok ? "sent" : "failed" });
      if (r.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (failedSample.length < BATCH_SAMPLE_LIMIT) failedSample.push(r.email);
      }
    }

    await ctx.db.patch(args.jobId, {
      sentCount: sent,
      failedCount: failed,
      failedSample,
      updatedAt: new Date().toISOString(),
    });

    const remaining = await ctx.db
      .query("letterEmailQueue")
      .withIndex("by_job_and_status", (q) =>
        q.eq("jobId", args.jobId).eq("status", "pending"),
      )
      .take(1);

    return { remaining: remaining.length };
  },
});

/**
 * Internal: closes out a finished job — sets the final status, cleans up the
 * stored PDF, and writes a history entry summarizing the send.
 */
export const finalizeEmailJob = internalMutation({
  args: { jobId: v.id("letterEmailJobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const status = job.sentCount > 0 ? "completed" : "failed";
    await ctx.db.patch(args.jobId, {
      status,
      updatedAt: new Date().toISOString(),
    });

    // The reusable attachment is no longer needed once the job is done.
    try {
      await ctx.storage.delete(job.pdfStorageId);
    } catch {
      // Best-effort cleanup; ignore if already gone.
    }

    if (job.sentCount > 0) {
      const failedNote =
        job.failedCount > 0 ? ` (${job.failedCount} gagal)` : "";
      await ctx.db.insert("letterHistory", {
        letterId: job.letterId,
        actorId: job.createdBy,
        action: "email_sent",
        detail: `Dikirim via email ke ${job.sentCount} dari ${job.total} penerima${failedNote}`,
        occurredAt: new Date().toISOString(),
      });
    }
  },
});

export type LetterEmailJobProgress = {
  total: number;
  sentCount: number;
  failedCount: number;
  status: string;
  failedSample: string[];
};

/**
 * Public: lets the sender poll the live progress of a bulk email job. Access is
 * limited to the job's creator, same-org members, or super admins.
 */
export const getLetterEmailJob = query({
  args: { jobId: v.id("letterEmailJobs") },
  handler: async (ctx, args): Promise<LetterEmailJobProgress | null> => {
    const { userId, organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const allowed =
      isSuperAdmin ||
      job.createdBy === userId ||
      (job.organizationId != null && job.organizationId === organizationId);
    if (!allowed) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki akses ke pengiriman ini",
      });
    }

    return {
      total: job.total,
      sentCount: job.sentCount,
      failedCount: job.failedCount,
      status: job.status,
      failedSample: job.failedSample ?? [],
    };
  },
});
