import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { isCountableEmployee } from "./lib/countableUsers";
import { resetOrgLimitAlerts } from "./lib/planLimits";
import { settleInvoiceForPayment } from "./invoices";
import {
  CYCLE_MONTHS,
  computeSubscriptionInfo,
  extendPaidUntil,
  type SubscriptionInfo,
} from "./lib/subscription";

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

// ── Types ────────────────────────────────────────────────────────────────────

type PaymentRow = {
  _id: Id<"subscriptionPayments">;
  organizationId: Id<"organizations">;
  orgName: string;
  planName: string | null;
  targetPlanId: Id<"membershipPlans"> | null;
  targetPlanName: string | null;
  cycleMonths: number;
  amount: number;
  amountLabel: string | null;
  reference: string | null;
  proofUrl: string | null;
  proofContentType: string | null;
  destinationBankLabel: string | null;
  senderBankName: string | null;
  senderAccountNumber: string | null;
  senderAccountHolder: string | null;
  paidAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  submittedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type BillingOrgRow = {
  orgId: Id<"organizations">;
  orgName: string;
  slug: string;
  isActive: boolean;
  planName: string;
  pricePerUserMonth: number;
  userCount: number;
  subscription: SubscriptionInfo;
  pendingPaymentCount: number;
};

// ── Internal shared logic ─────────────────────────────────────────────────────

/** Apply a verified payment's period to the org and return the new period. */
async function applyPaymentToOrg(
  ctx: MutationCtx,
  org: Doc<"organizations">,
  cycleMonths: number,
  nowIso: string,
): Promise<{ periodStart: string; periodEnd: string }> {
  const { periodStart, periodEnd } = extendPaidUntil(
    org.subscriptionPaidUntil,
    cycleMonths,
    nowIso,
  );
  await ctx.db.patch(org._id, {
    subscriptionStartedAt: org.subscriptionStartedAt ?? periodStart,
    subscriptionCycleMonths: cycleMonths,
    subscriptionPaidUntil: periodEnd,
    // A verified payment converts a trial org into a regular paid org.
    ...(org.isTrial ? { isTrial: false } : {}),
    updatedAt: nowIso,
  });
  return { periodStart, periodEnd };
}

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Current org's subscription status + recent payments. Used by the org admin
 * billing view and the dashboard banner. Returns null when the caller has no
 * organization (e.g. a super admin not viewing any specific org).
 */
export const getMySubscription = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    subscription: SubscriptionInfo;
    orgName: string;
    isTrial: boolean;
    planId: Id<"membershipPlans"> | null;
    planName: string | null;
    pricePerUserMonth: number;
    userCount: number;
    payments: PaymentRow[];
    pendingPaymentCount: number;
  } | null> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) return null;

    const org = await ctx.db.get(organizationId);
    if (!org) return null;

    const nowIso = new Date().toISOString();
    const subscription = computeSubscriptionInfo(org, nowIso);

    const plan = org.membershipPlanId
      ? await ctx.db.get(org.membershipPlanId)
      : null;

    const orgUsers = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    const paymentDocs = await ctx.db
      .query("subscriptionPayments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .take(50);

    const payments = await hydratePayments(ctx, paymentDocs, org.name);
    const pendingPaymentCount = paymentDocs.filter(
      (p) => p.status === "pending",
    ).length;

    return {
      subscription,
      orgName: org.name,
      isTrial: org.isTrial ?? false,
      planId: plan?._id ?? null,
      planName: plan?.name ?? null,
      pricePerUserMonth: plan?.pricePerUserMonth ?? 0,
      userCount: orgUsers.filter(isCountableEmployee).length,
      payments,
      pendingPaymentCount,
    };
  },
});

/** Super-admin: all organizations with billing status + due dates. */
export const getBillingOverview = query({
  args: {},
  handler: async (ctx): Promise<BillingOrgRow[]> => {
    await requireSuperAdmin(ctx);

    const nowIso = new Date().toISOString();
    const [orgs, plans, users, pendingPayments] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("membershipPlans").withIndex("by_order").collect(),
      ctx.db.query("users").collect(),
      ctx.db
        .query("subscriptionPayments")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
    ]);

    const planLookup: Record<string, Doc<"membershipPlans">> = {};
    for (const p of plans) planLookup[p._id] = p;

    const usersByOrg: Record<string, number> = {};
    for (const u of users) {
      if (u.organizationId && isCountableEmployee(u)) {
        usersByOrg[u.organizationId] = (usersByOrg[u.organizationId] ?? 0) + 1;
      }
    }

    const pendingByOrg: Record<string, number> = {};
    for (const p of pendingPayments) {
      pendingByOrg[p.organizationId] =
        (pendingByOrg[p.organizationId] ?? 0) + 1;
    }

    return orgs
      .map((org) => {
        const plan = org.membershipPlanId
          ? planLookup[org.membershipPlanId]
          : null;
        return {
          orgId: org._id,
          orgName: org.name,
          slug: org.slug,
          isActive: org.isActive,
          planName: plan?.name ?? "Tanpa Paket",
          pricePerUserMonth: plan?.pricePerUserMonth ?? 0,
          userCount: usersByOrg[org._id] ?? 0,
          subscription: computeSubscriptionInfo(org, nowIso),
          pendingPaymentCount: pendingByOrg[org._id] ?? 0,
        };
      })
      .sort((a, b) => {
        // Surface problems first: expired, overdue, due_soon, then the rest.
        const rank: Record<string, number> = {
          expired: 0,
          overdue: 1,
          due_soon: 2,
          no_subscription: 3,
          active: 4,
        };
        return (
          (rank[a.subscription.status] ?? 9) -
            (rank[b.subscription.status] ?? 9) ||
          a.orgName.localeCompare(b.orgName, "id", { sensitivity: "base" })
        );
      });
  },
});

/**
 * Super-admin: lightweight counts of organizations needing billing attention
 * (expired, overdue, due-soon). Used to show an alert badge on the main
 * Super Admin "Keanggotaan" tab without loading the full billing overview.
 */
export const getBillingAttentionCounts = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    expired: number;
    overdue: number;
    dueSoon: number;
    total: number;
  }> => {
    await requireSuperAdmin(ctx);
    const nowIso = new Date().toISOString();
    const orgs = await ctx.db.query("organizations").collect();

    let expired = 0;
    let overdue = 0;
    let dueSoon = 0;
    for (const org of orgs) {
      const status = computeSubscriptionInfo(org, nowIso).status;
      if (status === "expired") expired++;
      else if (status === "overdue") overdue++;
      else if (status === "due_soon") dueSoon++;
    }

    return { expired, overdue, dueSoon, total: expired + overdue + dueSoon };
  },
});

/** Super-admin: payment history for one organization. */
export const getOrgPayments = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args): Promise<PaymentRow[]> => {
    await requireSuperAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) return [];
    const docs = await ctx.db
      .query("subscriptionPayments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(100);
    return hydratePayments(ctx, docs, org.name);
  },
});

/** Super-admin: all pending payment submissions awaiting verification. */
export const getPendingPayments = query({
  args: {},
  handler: async (ctx): Promise<PaymentRow[]> => {
    await requireSuperAdmin(ctx);
    const docs = await ctx.db
      .query("subscriptionPayments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);
    return hydratePaymentsWithOrg(ctx, docs);
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Super-admin: record a verified payment directly (manual entry after
 * receiving a transfer). Immediately extends the org's paid-until.
 */
export const recordPayment = mutation({
  args: {
    organizationId: v.id("organizations"),
    cycleMonths: cycleValidator,
    amount: v.number(),
    reference: v.optional(v.string()),
    paidAt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"subscriptionPayments">> => {
    const admin = await requireSuperAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }
    if (args.amount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nominal tidak valid" });
    }

    const nowIso = new Date().toISOString();
    const paidAt = args.paidAt ?? nowIso;
    const plan = org.membershipPlanId
      ? await ctx.db.get(org.membershipPlanId)
      : null;

    const { periodStart, periodEnd } = await applyPaymentToOrg(
      ctx,
      org,
      args.cycleMonths,
      nowIso,
    );

    return await ctx.db.insert("subscriptionPayments", {
      organizationId: args.organizationId,
      membershipPlanId: org.membershipPlanId,
      planName: plan?.name,
      cycleMonths: args.cycleMonths,
      amount: args.amount,
      amountLabel: formatRupiah(args.amount),
      reference: args.reference,
      paidAt,
      periodStart,
      periodEnd,
      status: "verified",
      reviewedBy: admin._id,
      reviewedAt: nowIso,
      createdAt: nowIso,
    });
  },
});

/** Org admin: get an upload URL for a payment proof file (receipt image/PDF). */
export const generateProofUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    // Only org admins (or super admin) may submit payment proof, so gate the
    // upload URL the same way.
    await requireAdminUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Org admin: submit proof of a transfer for verification. Creates a pending
 * payment; it does NOT extend the paid-until until a super admin verifies it.
 */
export const submitPaymentProof = mutation({
  args: {
    cycleMonths: cycleValidator,
    amount: v.number(),
    reference: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    paidAt: v.optional(v.string()),
    // When set, this submission is an upgrade to a different plan. The org's
    // plan is only switched once a super admin verifies the payment.
    targetPlanId: v.optional(v.id("membershipPlans")),
    // When set, this payment settles a specific invoice (faktur).
    invoiceId: v.optional(v.id("invoices")),
    // Destination account chosen + payer (sender) bank details + terms.
    bankAccountId: v.optional(v.id("bankAccounts")),
    senderBankName: v.optional(v.string()),
    senderAccountNumber: v.optional(v.string()),
    senderAccountHolder: v.optional(v.string()),
    termsAccepted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"subscriptionPayments">> => {
    const { userId, organizationId } = await requireTenant(ctx, {
      bypassSubscriptionLock: true,
    });
    if (!organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak terhubung dengan organisasi",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin organisasi yang dapat mengajukan pembayaran",
      });
    }
    if (args.amount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nominal tidak valid" });
    }

    const org = await ctx.db.get(organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }

    // If paying a specific invoice, validate it belongs to this org and is open.
    if (args.invoiceId) {
      const invoice = await ctx.db.get(args.invoiceId);
      if (!invoice || invoice.organizationId !== organizationId) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Faktur tidak ditemukan",
        });
      }
      if (invoice.status !== "issued") {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Faktur ini tidak dapat dibayar",
        });
      }
    }

    // Resolve the target plan when this is an upgrade request. Validate it
    // exists and is active so admins can only request live plans.
    let targetPlan: Doc<"membershipPlans"> | null = null;
    if (args.targetPlanId) {
      targetPlan = await ctx.db.get(args.targetPlanId);
      if (!targetPlan || !targetPlan.isActive) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Paket tujuan tidak tersedia",
        });
      }
    }

    // Guard: only one pending submission at a time to avoid duplicate requests.
    const existingPending = await ctx.db
      .query("subscriptionPayments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      )
      .first();
    if (existingPending) {
      throw new ConvexError({
        code: "CONFLICT",
        message:
          "Masih ada pengajuan pembayaran yang menunggu verifikasi. Tunggu hingga diproses admin.",
      });
    }

    // Resolve the chosen destination account (must be active) for a snapshot.
    let destinationBankLabel: string | undefined;
    if (args.bankAccountId) {
      const account = await ctx.db.get(args.bankAccountId);
      if (!account || !account.isActive) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Rekening tujuan tidak valid",
        });
      }
      destinationBankLabel = `${account.bankName} - ${account.accountNumber} a.n. ${account.accountHolder}`;
    }

    // Snapshot the plan being paid for: the target plan for an upgrade,
    // otherwise the org's current plan.
    const currentPlan = org.membershipPlanId
      ? await ctx.db.get(org.membershipPlanId)
      : null;
    const paidPlan = targetPlan ?? currentPlan;
    const nowIso = new Date().toISOString();

    return await ctx.db.insert("subscriptionPayments", {
      organizationId,
      membershipPlanId: paidPlan?._id,
      planName: paidPlan?.name,
      targetPlanId: targetPlan?._id,
      cycleMonths: args.cycleMonths,
      amount: args.amount,
      amountLabel: formatRupiah(args.amount),
      reference: args.reference,
      proofStorageId: args.proofStorageId,
      paidAt: args.paidAt ?? nowIso,
      status: "pending",
      submittedBy: userId,
      invoiceId: args.invoiceId,
      destinationBankLabel,
      senderBankName: args.senderBankName?.trim() || undefined,
      senderAccountNumber: args.senderAccountNumber?.trim() || undefined,
      senderAccountHolder: args.senderAccountHolder?.trim() || undefined,
      termsAccepted: args.termsAccepted,
      createdAt: nowIso,
    });
  },
});

/**
 * Super-admin: verify a pending payment. Extends the org's paid-until and
 * stamps the covered period on the payment.
 */
export const verifyPayment = mutation({
  args: { paymentId: v.id("subscriptionPayments") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pembayaran tidak ditemukan" });
    }
    if (payment.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pembayaran ini sudah diproses",
      });
    }
    const org = await ctx.db.get(payment.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }

    const nowIso = new Date().toISOString();

    // If this was an upgrade request, switch the org to the target plan before
    // extending the period so limits/usage reflect the new plan immediately.
    if (payment.targetPlanId) {
      const targetPlan = await ctx.db.get(payment.targetPlanId);
      if (targetPlan) {
        await ctx.db.patch(org._id, {
          membershipPlanId: targetPlan._id,
          plan: targetPlan.slug,
          updatedAt: nowIso,
        });
        // Re-arm graduated limit alerts against the new (larger) plan limits so
        // any previously-blocked "add" actions unblock right away.
        await resetOrgLimitAlerts(ctx, org._id);
      }
    }

    const { periodStart, periodEnd } = await applyPaymentToOrg(
      ctx,
      org,
      payment.cycleMonths,
      nowIso,
    );

    await ctx.db.patch(args.paymentId, {
      status: "verified",
      periodStart,
      periodEnd,
      reviewedBy: admin._id,
      reviewedAt: nowIso,
    });

    // If this payment settled an invoice, mark it paid and issue a receipt.
    if (payment.invoiceId) {
      await settleInvoiceForPayment(ctx, payment.invoiceId, args.paymentId);
    }

    // Notify the org admin who registered the org (if any) about the outcome.
    if (org.createdBy) {
      const label = payment.targetPlanId
        ? `Paket organisasi "${org.name}" berhasil ditingkatkan dan diaktifkan.`
        : `Pembayaran langganan "${org.name}" telah diverifikasi.`;
      await ctx.db.insert("notifications", {
        userId: org.createdBy,
        type: "plan_changed",
        title: "Pembayaran Diverifikasi",
        message: label,
        actorId: admin._id,
        link: "/billing",
        organizationId: org._id,
      });
    }
  },
});

/** Super-admin: reject a pending payment submission with a reason. */
export const rejectPayment = mutation({
  args: {
    paymentId: v.id("subscriptionPayments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pembayaran tidak ditemukan" });
    }
    if (payment.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pembayaran ini sudah diproses",
      });
    }
    await ctx.db.patch(args.paymentId, {
      status: "rejected",
      reviewedBy: admin._id,
      reviewedAt: new Date().toISOString(),
      rejectionReason: args.reason,
    });
  },
});

/**
 * Super-admin: set/adjust an org's paid-until date manually (e.g. to grant a
 * grace extension or correct a mistake) without creating a payment record.
 */
export const setPaidUntil = mutation({
  args: {
    organizationId: v.id("organizations"),
    paidUntil: v.union(v.string(), v.null()),
    cycleMonths: v.optional(cycleValidator),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }
    const nowIso = new Date().toISOString();
    if (args.paidUntil === null) {
      await ctx.db.patch(args.organizationId, {
        subscriptionPaidUntil: undefined,
        updatedAt: nowIso,
      });
      return;
    }
    // Validate the incoming date is a real instant.
    const parsed = new Date(args.paidUntil);
    if (Number.isNaN(parsed.getTime())) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tanggal tidak valid" });
    }
    await ctx.db.patch(args.organizationId, {
      subscriptionPaidUntil: parsed.toISOString(),
      subscriptionStartedAt: org.subscriptionStartedAt ?? nowIso,
      subscriptionCycleMonths:
        args.cycleMonths ?? org.subscriptionCycleMonths,
      updatedAt: nowIso,
    });
  },
});

// ── Hydration helpers ──────────────────────────────────────────────────────────

async function hydratePayments(
  ctx: QueryCtx,
  docs: Doc<"subscriptionPayments">[],
  orgName: string,
): Promise<PaymentRow[]> {
  return Promise.all(
    docs.map(async (p) => {
      const [submittedBy, reviewedBy, targetPlan] = await Promise.all([
        p.submittedBy ? ctx.db.get(p.submittedBy) : null,
        p.reviewedBy ? ctx.db.get(p.reviewedBy) : null,
        p.targetPlanId ? ctx.db.get(p.targetPlanId) : null,
      ]);
      const proofUrl = p.proofStorageId
        ? await ctx.storage.getUrl(p.proofStorageId)
        : null;
      const proofMeta = p.proofStorageId
        ? await ctx.db.system.get(p.proofStorageId)
        : null;
      return {
        _id: p._id,
        organizationId: p.organizationId,
        orgName,
        planName: p.planName ?? null,
        targetPlanId: p.targetPlanId ?? null,
        targetPlanName: targetPlan?.name ?? null,
        cycleMonths: p.cycleMonths,
        amount: p.amount,
        amountLabel: p.amountLabel ?? null,
        reference: p.reference ?? null,
        proofUrl,
        proofContentType: proofMeta?.contentType ?? null,
        destinationBankLabel: p.destinationBankLabel ?? null,
        senderBankName: p.senderBankName ?? null,
        senderAccountNumber: p.senderAccountNumber ?? null,
        senderAccountHolder: p.senderAccountHolder ?? null,
        paidAt: p.paidAt,
        periodStart: p.periodStart ?? null,
        periodEnd: p.periodEnd ?? null,
        status: p.status,
        submittedByName: submittedBy?.name ?? null,
        reviewedByName: reviewedBy?.name ?? null,
        reviewedAt: p.reviewedAt ?? null,
        rejectionReason: p.rejectionReason ?? null,
        createdAt: p.createdAt,
      };
    }),
  );
}

async function hydratePaymentsWithOrg(
  ctx: QueryCtx,
  docs: Doc<"subscriptionPayments">[],
): Promise<PaymentRow[]> {
  return Promise.all(
    docs.map(async (p) => {
      const [org, submittedBy, reviewedBy, targetPlan] = await Promise.all([
        ctx.db.get(p.organizationId),
        p.submittedBy ? ctx.db.get(p.submittedBy) : null,
        p.reviewedBy ? ctx.db.get(p.reviewedBy) : null,
        p.targetPlanId ? ctx.db.get(p.targetPlanId) : null,
      ]);
      const proofUrl = p.proofStorageId
        ? await ctx.storage.getUrl(p.proofStorageId)
        : null;
      const proofMeta = p.proofStorageId
        ? await ctx.db.system.get(p.proofStorageId)
        : null;
      return {
        _id: p._id,
        organizationId: p.organizationId,
        orgName: org?.name ?? "Tidak diketahui",
        planName: p.planName ?? null,
        targetPlanId: p.targetPlanId ?? null,
        targetPlanName: targetPlan?.name ?? null,
        cycleMonths: p.cycleMonths,
        amount: p.amount,
        amountLabel: p.amountLabel ?? null,
        reference: p.reference ?? null,
        proofUrl,
        proofContentType: proofMeta?.contentType ?? null,
        destinationBankLabel: p.destinationBankLabel ?? null,
        senderBankName: p.senderBankName ?? null,
        senderAccountNumber: p.senderAccountNumber ?? null,
        senderAccountHolder: p.senderAccountHolder ?? null,
        paidAt: p.paidAt,
        periodStart: p.periodStart ?? null,
        periodEnd: p.periodEnd ?? null,
        status: p.status,
        submittedByName: submittedBy?.name ?? null,
        reviewedByName: reviewedBy?.name ?? null,
        reviewedAt: p.reviewedAt ?? null,
        rejectionReason: p.rejectionReason ?? null,
        createdAt: p.createdAt,
      };
    }),
  );
}

// Re-export cycle options for the frontend.
export const AVAILABLE_CYCLES = CYCLE_MONTHS;
