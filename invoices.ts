import { v, ConvexError } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { internal } from "./_generated/api";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the current user, requiring an admin (org admin or super admin). */
async function requireAdminUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role)) {
    throw new ConvexError({ message: "Akses ditolak", code: "FORBIDDEN" });
  }
  return user;
}

/** Require a super admin specifically. */
async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireAdminUser(ctx);
  if (!isSuperAdminRole(user.role)) {
    throw new ConvexError({
      message: "Hanya super admin yang dapat melakukan tindakan ini",
      code: "FORBIDDEN",
    });
  }
  return user;
}

const cycleValidator = v.union(
  v.literal(1),
  v.literal(3),
  v.literal(6),
  v.literal(12),
);

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Effective, read-time status of an invoice. Stored status is
 * "issued" | "paid" | "cancelled"; when an issued invoice is past its due date
 * we surface "overdue" (Jatuh Tempo) without mutating the stored row.
 */
export type InvoiceEffectiveStatus =
  | "issued"
  | "paid"
  | "cancelled"
  | "overdue";

function effectiveStatus(
  invoice: Doc<"invoices">,
  nowIso: string,
): InvoiceEffectiveStatus {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "cancelled") return "cancelled";
  // status === "issued": overdue when past due date.
  if (new Date(invoice.dueDate).getTime() < new Date(nowIso).getTime()) {
    return "overdue";
  }
  return "issued";
}

// ── Types ────────────────────────────────────────────────────────────────────

export type InvoiceRow = {
  _id: Id<"invoices">;
  organizationId: Id<"organizations">;
  orgName: string;
  number: string;
  planName: string | null;
  cycleMonths: number;
  amount: number;
  amountLabel: string | null;
  description: string | null;
  issuedAt: string;
  dueDate: string;
  status: string;
  effectiveStatus: InvoiceEffectiveStatus;
  // True when there is a payment proof for this invoice awaiting verification.
  pendingPayment: boolean;
  paidAt: string | null;
  receiptNumber: string | null;
  createdAt: string;
};

// ── Number generation ──────────────────────────────────────────────────────────

/**
 * Generate the next per-year invoice number, e.g. "INV-2026-0001". Uses the
 * `by_year_and_seq` index to find the current max sequence for the year.
 */
async function nextInvoiceNumber(
  ctx: MutationCtx,
  year: number,
): Promise<{ number: string; seq: number }> {
  const last = await ctx.db
    .query("invoices")
    .withIndex("by_year_and_seq", (q) => q.eq("year", year))
    .order("desc")
    .first();
  const seq = (last?.seq ?? 0) + 1;
  const number = `INV-${year}-${String(seq).padStart(4, "0")}`;
  return { number, seq };
}

// ── Hydration ────────────────────────────────────────────────────────────────

async function hydrateInvoices(
  ctx: QueryCtx,
  docs: Doc<"invoices">[],
  orgNameById?: Record<string, string>,
): Promise<InvoiceRow[]> {
  const nowIso = new Date().toISOString();
  const nameCache: Record<string, string> = { ...(orgNameById ?? {}) };

  // Determine which invoices have a pending (awaiting verification) payment.
  // Only issued/overdue invoices can have one, so we only look those up.
  const pendingByInvoice = new Set<string>();
  for (const inv of docs) {
    if (inv.status !== "issued") continue;
    const pending = await ctx.db
      .query("subscriptionPayments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", inv.organizationId).eq("status", "pending"),
      )
      .collect();
    if (pending.some((p) => p.invoiceId === inv._id)) {
      pendingByInvoice.add(inv._id);
    }
  }

  const rows: InvoiceRow[] = [];
  for (const inv of docs) {
    let orgName = nameCache[inv.organizationId];
    if (orgName === undefined) {
      const org = await ctx.db.get(inv.organizationId);
      orgName = org?.name ?? "Organisasi";
      nameCache[inv.organizationId] = orgName;
    }
    rows.push({
      _id: inv._id,
      organizationId: inv.organizationId,
      orgName,
      number: inv.number,
      planName: inv.planName ?? null,
      cycleMonths: inv.cycleMonths,
      amount: inv.amount,
      amountLabel: inv.amountLabel ?? null,
      description: inv.description ?? null,
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      status: inv.status,
      effectiveStatus: effectiveStatus(inv, nowIso),
      pendingPayment: pendingByInvoice.has(inv._id),
      paidAt: inv.paidAt ?? null,
      receiptNumber: inv.receiptNumber ?? null,
      createdAt: inv.createdAt,
    });
  }
  return rows;
}

/**
 * Settle an invoice that was paid through a verified subscription payment.
 * Marks it paid, links the payment, and issues a numbered receipt (Bukti
 * Pelunasan). No-op if the invoice is already paid or was cancelled. Shared by
 * verifyPayment so the invoice reflects the outcome automatically.
 */
export async function settleInvoiceForPayment(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
  paymentId: Id<"subscriptionPayments">,
): Promise<void> {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) return;
  if (invoice.status === "paid" || invoice.status === "cancelled") return;

  const nowIso = new Date().toISOString();
  const year = new Date(nowIso).getUTCFullYear();
  const receiptNumber = `BP-${year}-${String(invoice.seq).padStart(4, "0")}`;

  await ctx.db.patch(invoiceId, {
    status: "paid",
    paidAt: nowIso,
    receiptNumber,
    paymentId,
    updatedAt: nowIso,
  });

  // Email the bukti pelunasan PDF to the org's admin (best-effort, async).
  await ctx.scheduler.runAfter(0, internal.invoiceEmails.sendReceiptEmail, {
    invoiceId,
  });
}

// ── Queries ────────────────────────────────────────────────────────────────────

/** Org admin/member: list the current organization's invoices, newest first. */
export const getMyInvoices = query({
  args: {},
  handler: async (ctx): Promise<InvoiceRow[]> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) return [];
    const org = await ctx.db.get(organizationId);
    if (!org) return [];
    const docs = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .take(200);
    return hydrateInvoices(ctx, docs, { [organizationId]: org.name });
  },
});

/** Super-admin: list all invoices, newest first. Filtering/search done client-side. */
export const listInvoices = query({
  args: {},
  handler: async (ctx): Promise<InvoiceRow[]> => {
    await requireSuperAdmin(ctx);
    const docs = await ctx.db
      .query("invoices")
      .withIndex("by_creation_time")
      .order("desc")
      .take(500);
    return hydrateInvoices(ctx, docs);
  },
});

/** Super-admin: summary counts for the invoice dashboard header. */
export const getInvoiceSummary = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    total: number;
    unpaid: number;
    overdue: number;
    paid: number;
    cancelled: number;
    outstandingAmount: number;
  }> => {
    await requireSuperAdmin(ctx);
    const nowIso = new Date().toISOString();
    const docs = await ctx.db.query("invoices").take(2000);
    let unpaid = 0;
    let overdue = 0;
    let paid = 0;
    let cancelled = 0;
    let outstandingAmount = 0;
    for (const inv of docs) {
      const status = effectiveStatus(inv, nowIso);
      if (status === "paid") paid++;
      else if (status === "cancelled") cancelled++;
      else if (status === "overdue") {
        overdue++;
        outstandingAmount += inv.amount;
      } else {
        unpaid++;
        outstandingAmount += inv.amount;
      }
    }
    return {
      total: docs.length,
      unpaid,
      overdue,
      paid,
      cancelled,
      outstandingAmount,
    };
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

/** Super-admin: issue a new invoice for an organization. */
export const issueInvoice = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipPlanId: v.optional(v.id("membershipPlans")),
    cycleMonths: cycleValidator,
    amount: v.number(),
    description: v.optional(v.string()),
    dueDate: v.string(), // ISO instant
  },
  handler: async (ctx, args): Promise<Id<"invoices">> => {
    const admin = await requireSuperAdmin(ctx);

    if (args.amount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nominal tidak valid" });
    }
    const due = new Date(args.dueDate);
    if (Number.isNaN(due.getTime())) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal jatuh tempo tidak valid",
      });
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }

    // Snapshot the plan: the one supplied, else the org's current plan.
    let plan: Doc<"membershipPlans"> | null = null;
    if (args.membershipPlanId) {
      plan = await ctx.db.get(args.membershipPlanId);
      if (!plan) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Paket tidak ditemukan" });
      }
    } else if (org.membershipPlanId) {
      plan = await ctx.db.get(org.membershipPlanId);
    }

    const nowIso = new Date().toISOString();
    const year = new Date(nowIso).getUTCFullYear();
    const { number, seq } = await nextInvoiceNumber(ctx, year);

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      number,
      year,
      seq,
      membershipPlanId: plan?._id,
      planName: plan?.name,
      cycleMonths: args.cycleMonths,
      amount: args.amount,
      amountLabel: formatRupiah(args.amount),
      description: args.description,
      issuedAt: nowIso,
      dueDate: due.toISOString(),
      status: "issued",
      issuedBy: admin._id,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Notify the org admin who registered the org (if any).
    if (org.createdBy) {
      await ctx.db.insert("notifications", {
        userId: org.createdBy,
        type: "plan_changed",
        title: "Faktur Baru",
        message: `Faktur ${number} sebesar ${formatRupiah(
          args.amount,
        )} telah diterbitkan untuk "${org.name}".`,
        actorId: admin._id,
        link: "/billing",
        organizationId: org._id,
      });
    }

    // Email the faktur PDF to the org's admin (best-effort, async).
    await ctx.scheduler.runAfter(0, internal.invoiceEmails.sendInvoiceEmail, {
      invoiceId,
    });

    return invoiceId;
  },
});

/** Super-admin: cancel an invoice that has not been paid. */
export const cancelInvoice = mutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Faktur tidak ditemukan" });
    }
    if (invoice.status === "paid") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Faktur yang sudah lunas tidak dapat dibatalkan",
      });
    }
    if (invoice.status === "cancelled") return;
    const nowIso = new Date().toISOString();
    await ctx.db.patch(args.invoiceId, {
      status: "cancelled",
      cancelledBy: admin._id,
      cancelledAt: nowIso,
      updatedAt: nowIso,
    });
  },
});

/**
 * Super-admin: mark an invoice as paid manually (e.g. payment received outside
 * the system). Does not extend the subscription; use verifyPayment for that.
 */
export const markInvoicePaidManually = mutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Faktur tidak ditemukan" });
    }
    if (invoice.status === "cancelled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Faktur yang dibatalkan tidak dapat ditandai lunas",
      });
    }
    if (invoice.status === "paid") return;

    const nowIso = new Date().toISOString();
    const year = new Date(nowIso).getUTCFullYear();
    // Issue a receipt number reusing the same yearly sequence space via a
    // dedicated prefix so receipts and invoices don't collide.
    const receiptNumber = `BP-${year}-${String(invoice.seq).padStart(4, "0")}`;

    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      paidAt: nowIso,
      receiptNumber,
      markedPaidBy: admin._id,
      updatedAt: nowIso,
    });

    // Email the bukti pelunasan PDF to the org's admin (best-effort, async).
    await ctx.scheduler.runAfter(0, internal.invoiceEmails.sendReceiptEmail, {
      invoiceId: args.invoiceId,
    });
  },
});

// ── Email delivery data ──────────────────────────────────────────────────────

export type InvoiceEmailData = {
  recipientEmail: string | null;
  number: string;
  orgName: string;
  planName: string | null;
  cycleMonths: number;
  amount: number;
  amountLabel: string | null;
  description: string | null;
  issuedAt: string;
  dueDate: string;
  status: InvoiceEffectiveStatus;
  paidAt: string | null;
  receiptNumber: string | null;
  bankAccounts: { bankName: string; accountNumber: string; accountHolder: string }[];
};

/**
 * Internal: gather everything the email action needs to build and send an
 * invoice/receipt PDF: the invoice snapshot, the recipient (the org's creating
 * admin), and the active destination bank accounts. Returns null if the invoice
 * is missing.
 */
export const getInvoiceEmailData = internalQuery({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args): Promise<InvoiceEmailData | null> => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;

    const org = await ctx.db.get(invoice.organizationId);
    const orgName = org?.name ?? "Organisasi";

    // Recipient: the admin who created the organization.
    let recipientEmail: string | null = null;
    if (org?.createdBy) {
      const creator = await ctx.db.get(org.createdBy);
      recipientEmail = creator?.email ?? null;
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return {
      recipientEmail,
      number: invoice.number,
      orgName,
      planName: invoice.planName ?? null,
      cycleMonths: invoice.cycleMonths,
      amount: invoice.amount,
      amountLabel: invoice.amountLabel ?? null,
      description: invoice.description ?? null,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      status: effectiveStatus(invoice, new Date().toISOString()),
      paidAt: invoice.paidAt ?? null,
      receiptNumber: invoice.receiptNumber ?? null,
      bankAccounts: accounts.map((b) => ({
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountHolder: b.accountHolder,
      })),
    };
  },
});
