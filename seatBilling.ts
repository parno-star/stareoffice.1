import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import {
  EMPLOYEE_METRIC,
  getOrgMetricLimit,
  countOrgEmployees,
  resetOrgLimitAlerts,
} from "./lib/planLimits";

// ── Constants ────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "seat_addon";
// Default price per extra seat (IDR) used before a super admin configures one.
const DEFAULT_PRICE_PER_SEAT = 15000;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireAdminUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, {
    allowSuperAdmin: true,
    bypassSubscriptionLock: true,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role)) {
    throw new ConvexError({ message: "Akses ditolak", code: "FORBIDDEN" });
  }
  return user;
}

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

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SeatPurchaseRow = {
  _id: Id<"seatPurchases">;
  organizationId: Id<"organizations">;
  orgName: string;
  seats: number;
  amount: number;
  amountLabel: string | null;
  reference: string | null;
  proofUrl: string | null;
  proofContentType: string | null;
  destinationBankLabel: string | null;
  senderBankName: string | null;
  senderAccountNumber: string | null;
  senderAccountHolder: string | null;
  status: string;
  submittedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

// ── Settings queries / mutations ─────────────────────────────────────────────

/** Public read of the current seat add-on config (any admin). */
export const getSeatSettings = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ pricePerSeat: number; isActive: boolean }> => {
    const row = await ctx.db
      .query("seatAddonSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    if (!row) {
      // Sensible default until a super admin configures it. Off by default so
      // orgs do not see the option until pricing is intentionally set.
      return { pricePerSeat: DEFAULT_PRICE_PER_SEAT, isActive: false };
    }
    return { pricePerSeat: row.pricePerSeat, isActive: row.isActive };
  },
});

/** Super admin: set the seat price and enable/disable self-serve seat buying. */
export const updateSeatSettings = mutation({
  args: {
    pricePerSeat: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    if (args.pricePerSeat < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Harga per kursi tidak valid",
      });
    }
    const nowIso = new Date().toISOString();
    const existing = await ctx.db
      .query("seatAddonSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        pricePerSeat: args.pricePerSeat,
        isActive: args.isActive,
        updatedBy: admin._id,
        updatedAt: nowIso,
      });
      return;
    }
    await ctx.db.insert("seatAddonSettings", {
      key: SETTINGS_KEY,
      pricePerSeat: args.pricePerSeat,
      isActive: args.isActive,
      updatedBy: admin._id,
      updatedAt: nowIso,
    });
  },
});

// ── Org-facing query: current seat usage + purchase history ──────────────────

/**
 * Current org's seat info: plan limit, extra seats, live usage, and recent seat
 * purchase submissions. Returns null when the caller has no organization.
 */
export const getMySeatInfo = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    planName: string | null;
    planMaxEmployees: number; // 0 = unlimited
    extraSeats: number;
    effectiveMax: number; // 0 = unlimited
    usedSeats: number;
    pricePerSeat: number;
    isActive: boolean;
    hasPending: boolean;
    purchases: SeatPurchaseRow[];
  } | null> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
      bypassSubscriptionLock: true,
    });
    if (!organizationId) return null;

    const org = await ctx.db.get(organizationId);
    if (!org) return null;

    const plan = org.membershipPlanId
      ? await ctx.db.get(org.membershipPlanId)
      : null;
    const planMaxEmployees = plan?.maxEmployees ?? 0;
    const extraSeats = org.extraSeats ?? 0;
    const { max: effectiveMax } = await getOrgMetricLimit(
      ctx,
      organizationId,
      EMPLOYEE_METRIC,
    );
    const usedSeats = await countOrgEmployees(ctx, organizationId);

    const settingsRow = await ctx.db
      .query("seatAddonSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    const pricePerSeat = settingsRow?.pricePerSeat ?? DEFAULT_PRICE_PER_SEAT;
    const isActive = settingsRow?.isActive ?? false;

    const purchaseDocs = await ctx.db
      .query("seatPurchases")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .take(50);

    const hasPending = purchaseDocs.some((p) => p.status === "pending");
    const purchases = await hydrateSeatPurchases(ctx, purchaseDocs, org.name);

    return {
      planName: plan?.name ?? null,
      planMaxEmployees,
      extraSeats,
      effectiveMax,
      usedSeats,
      pricePerSeat,
      isActive,
      hasPending,
      purchases,
    };
  },
});

// ── Org-facing mutation: submit seat purchase proof ──────────────────────────

export const submitSeatPurchase = mutation({
  args: {
    seats: v.number(),
    amount: v.number(),
    reference: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    bankAccountId: v.optional(v.id("bankAccounts")),
    senderBankName: v.string(),
    senderAccountNumber: v.string(),
    senderAccountHolder: v.string(),
    termsAccepted: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"seatPurchases">> => {
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
        message: "Hanya admin organisasi yang dapat membeli kursi tambahan",
      });
    }
    if (!Number.isInteger(args.seats) || args.seats <= 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jumlah kursi tidak valid",
      });
    }
    if (args.amount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nominal tidak valid" });
    }

    // Payment terms must be explicitly accepted.
    if (!args.termsAccepted) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda harus menyetujui syarat & ketentuan pembayaran",
      });
    }

    // Sender bank details are required so the reviewer can match the transfer.
    const senderBankName = args.senderBankName.trim();
    const senderAccountNumber = args.senderAccountNumber.trim();
    const senderAccountHolder = args.senderAccountHolder.trim();
    if (!senderBankName || !senderAccountNumber || !senderAccountHolder) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Lengkapi data rekening pengirim",
      });
    }

    // The seat add-on must be enabled by a super admin.
    const settingsRow = await ctx.db
      .query("seatAddonSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    if (!settingsRow || !settingsRow.isActive) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Pembelian kursi tambahan belum tersedia",
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

    // Extra seats only make sense for plans with a finite employee limit.
    const org = await ctx.db.get(organizationId);
    const plan = org?.membershipPlanId
      ? await ctx.db.get(org.membershipPlanId)
      : null;
    if (!plan || plan.maxEmployees <= 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Paket Anda sudah tidak dibatasi jumlah pengguna, tidak perlu kursi tambahan",
      });
    }

    // Only one pending seat purchase per org at a time.
    const existingPending = await ctx.db
      .query("seatPurchases")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      )
      .first();
    if (existingPending) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Sudah ada pengajuan kursi yang menunggu verifikasi",
      });
    }

    const nowIso = new Date().toISOString();
    return await ctx.db.insert("seatPurchases", {
      organizationId,
      seats: args.seats,
      pricePerSeat: settingsRow.pricePerSeat,
      amount: args.amount,
      amountLabel: formatRupiah(args.amount),
      reference: args.reference,
      proofStorageId: args.proofStorageId,
      destinationBankLabel,
      senderBankName,
      senderAccountNumber,
      senderAccountHolder,
      termsAccepted: true,
      status: "pending",
      submittedBy: userId,
      createdAt: nowIso,
    });
  },
});

// ── Super-admin queries ──────────────────────────────────────────────────────

/** All pending seat purchase submissions awaiting verification. */
export const getPendingSeatPurchases = query({
  args: {},
  handler: async (ctx): Promise<SeatPurchaseRow[]> => {
    await requireSuperAdmin(ctx);
    const docs = await ctx.db
      .query("seatPurchases")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);
    return hydrateSeatPurchasesWithOrg(ctx, docs);
  },
});

// ── Super-admin mutations ────────────────────────────────────────────────────

/** Verify a pending seat purchase → adds the seats to the org's extraSeats. */
export const verifySeatPurchase = mutation({
  args: { purchaseId: v.id("seatPurchases") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (purchase.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan ini sudah diproses",
      });
    }
    const org = await ctx.db.get(purchase.organizationId);
    if (!org) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Organisasi tidak ditemukan",
      });
    }
    const nowIso = new Date().toISOString();
    const newExtraSeats = (org.extraSeats ?? 0) + purchase.seats;
    await ctx.db.patch(org._id, {
      extraSeats: newExtraSeats,
      updatedAt: nowIso,
    });
    // Re-arm graduated limit alerts against the new (larger) limit so any
    // previously-blocked "add employee" actions unblock right away.
    await resetOrgLimitAlerts(ctx, org._id);
    await ctx.db.patch(args.purchaseId, {
      status: "verified",
      reviewedBy: admin._id,
      reviewedAt: nowIso,
    });
    // Notify the org's admins that their extra seats are now active so they
    // reliably learn the capacity increased (not only the original creator).
    const orgUsers = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", org._id),
      )
      .collect();
    const recipientIds = new Set<Id<"users">>();
    if (org.createdBy) recipientIds.add(org.createdBy);
    for (const u of orgUsers) {
      if (isAdminRole(u.role)) recipientIds.add(u._id);
    }
    const message = `${purchase.seats} kursi tambahan telah diverifikasi dan aktif untuk "${org.name}". Total kapasitas pengguna kini ${newExtraSeats} kursi tambahan.`;
    for (const userId of recipientIds) {
      await ctx.db.insert("notifications", {
        userId,
        type: "seat_added",
        title: "Kursi tambahan aktif",
        message,
        link: "/billing",
        organizationId: org._id,
      });
    }
  },
});

/** Reject a pending seat purchase with an optional reason. */
export const rejectSeatPurchase = mutation({
  args: {
    purchaseId: v.id("seatPurchases"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan",
      });
    }
    if (purchase.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan ini sudah diproses",
      });
    }
    await ctx.db.patch(args.purchaseId, {
      status: "rejected",
      reviewedBy: admin._id,
      reviewedAt: new Date().toISOString(),
      rejectionReason: args.reason,
    });
  },
});

// ── Upload URL ────────────────────────────────────────────────────────────────

/** Reusable upload URL for a seat purchase proof image. */
export const generateProofUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdminUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ── Hydration helpers ──────────────────────────────────────────────────────

async function hydrateSeatPurchases(
  ctx: QueryCtx,
  docs: Doc<"seatPurchases">[],
  orgName: string,
): Promise<SeatPurchaseRow[]> {
  return Promise.all(
    docs.map(async (p) => {
      const [submittedBy, reviewedBy, proofUrl, proofMeta] = await Promise.all([
        p.submittedBy ? ctx.db.get(p.submittedBy) : null,
        p.reviewedBy ? ctx.db.get(p.reviewedBy) : null,
        p.proofStorageId ? ctx.storage.getUrl(p.proofStorageId) : null,
        p.proofStorageId ? ctx.db.system.get(p.proofStorageId) : null,
      ]);
      return {
        _id: p._id,
        organizationId: p.organizationId,
        orgName,
        seats: p.seats,
        amount: p.amount,
        amountLabel: p.amountLabel ?? null,
        reference: p.reference ?? null,
        proofUrl,
        proofContentType: proofMeta?.contentType ?? null,
        destinationBankLabel: p.destinationBankLabel ?? null,
        senderBankName: p.senderBankName ?? null,
        senderAccountNumber: p.senderAccountNumber ?? null,
        senderAccountHolder: p.senderAccountHolder ?? null,
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

async function hydrateSeatPurchasesWithOrg(
  ctx: QueryCtx,
  docs: Doc<"seatPurchases">[],
): Promise<SeatPurchaseRow[]> {
  return Promise.all(
    docs.map(async (p) => {
      const [org, submittedBy, reviewedBy, proofUrl, proofMeta] =
        await Promise.all([
          ctx.db.get(p.organizationId),
          p.submittedBy ? ctx.db.get(p.submittedBy) : null,
          p.reviewedBy ? ctx.db.get(p.reviewedBy) : null,
          p.proofStorageId ? ctx.storage.getUrl(p.proofStorageId) : null,
          p.proofStorageId ? ctx.db.system.get(p.proofStorageId) : null,
        ]);
      return {
        _id: p._id,
        organizationId: p.organizationId,
        orgName: org?.name ?? "Tidak diketahui",
        seats: p.seats,
        amount: p.amount,
        amountLabel: p.amountLabel ?? null,
        reference: p.reference ?? null,
        proofUrl,
        proofContentType: proofMeta?.contentType ?? null,
        destinationBankLabel: p.destinationBankLabel ?? null,
        senderBankName: p.senderBankName ?? null,
        senderAccountNumber: p.senderAccountNumber ?? null,
        senderAccountHolder: p.senderAccountHolder ?? null,
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
