import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

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

/**
 * Ensure an active grant exists for (org, addon). Reactivates a revoked grant
 * or inserts a new one. Idempotent.
 */
async function activateGrant(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  addonId: Id<"featureAddons">,
  source: "manual" | "purchase",
  grantedBy: Id<"users">,
  note?: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const existing = await ctx.db
    .query("orgAddons")
    .withIndex("by_org_and_addon", (q) =>
      q.eq("organizationId", organizationId).eq("addonId", addonId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "active",
      source,
      grantedBy,
      grantedAt: nowIso,
      revokedBy: undefined,
      revokedAt: undefined,
      note,
    });
    return;
  }

  await ctx.db.insert("orgAddons", {
    organizationId,
    addonId,
    status: "active",
    source,
    grantedBy,
    grantedAt: nowIso,
    note,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgAddonRow = {
  _id: Id<"orgAddons">;
  addonId: Id<"featureAddons">;
  addonName: string;
  menuKeys: string[];
  status: string;
  source: string;
  grantedAt: string;
  grantedByName: string | null;
};

type PurchaseRow = {
  _id: Id<"addonPurchases">;
  organizationId: Id<"organizations">;
  orgName: string;
  addonId: Id<"featureAddons">;
  addonName: string | null;
  amount: number;
  amountLabel: string | null;
  reference: string | null;
  status: string;
  submittedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

// ── Org-facing queries ─────────────────────────────────────────────────────

/**
 * Current org's add-ons: active grants + recent purchase submissions. Returns
 * null when the caller has no organization (e.g. super admin viewing none).
 */
export const getMyAddons = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    grants: OrgAddonRow[];
    purchases: PurchaseRow[];
    pendingAddonIds: Id<"featureAddons">[];
    activeAddonIds: Id<"featureAddons">[];
  } | null> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
      bypassSubscriptionLock: true,
    });
    if (!organizationId) return null;

    const org = await ctx.db.get(organizationId);
    if (!org) return null;

    const [grantDocs, purchaseDocs] = await Promise.all([
      ctx.db
        .query("orgAddons")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .collect(),
      ctx.db
        .query("addonPurchases")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .order("desc")
        .take(50),
    ]);

    const grants: OrgAddonRow[] = await Promise.all(
      grantDocs.map(async (g) => {
        const [addon, grantedBy] = await Promise.all([
          ctx.db.get(g.addonId),
          g.grantedBy ? ctx.db.get(g.grantedBy) : null,
        ]);
        return {
          _id: g._id,
          addonId: g.addonId,
          addonName: addon?.name ?? "Add-on",
          menuKeys: addon?.menuKeys ?? [],
          status: g.status,
          source: g.source,
          grantedAt: g.grantedAt,
          grantedByName: grantedBy?.name ?? null,
        };
      }),
    );

    const purchases = await hydratePurchases(ctx, purchaseDocs, org.name);
    const pendingAddonIds = purchaseDocs
      .filter((p) => p.status === "pending")
      .map((p) => p.addonId);
    const activeAddonIds = grantDocs.map((g) => g.addonId);

    return { grants, purchases, pendingAddonIds, activeAddonIds };
  },
});

// ── Org-facing mutation: submit purchase proof ───────────────────────────────

export const submitAddonPurchase = mutation({
  args: {
    addonId: v.id("featureAddons"),
    amount: v.number(),
    reference: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<Id<"addonPurchases">> => {
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
        message: "Hanya admin organisasi yang dapat membeli add-on",
      });
    }
    const addon = await ctx.db.get(args.addonId);
    if (!addon || !addon.isActive) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Add-on tidak tersedia" });
    }
    if (args.amount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nominal tidak valid" });
    }

    // Prevent duplicate pending submissions for the same add-on.
    const existingPending = await ctx.db
      .query("addonPurchases")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      )
      .collect();
    if (existingPending.some((p) => p.addonId === args.addonId)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Sudah ada pengajuan add-on ini yang menunggu verifikasi",
      });
    }

    const nowIso = new Date().toISOString();
    return await ctx.db.insert("addonPurchases", {
      organizationId,
      addonId: args.addonId,
      addonName: addon.name,
      menuKeys: addon.menuKeys,
      amount: args.amount,
      amountLabel: formatRupiah(args.amount),
      reference: args.reference,
      proofStorageId: args.proofStorageId,
      status: "pending",
      submittedBy: userId,
      createdAt: nowIso,
    });
  },
});

// ── Super-admin queries ──────────────────────────────────────────────────────

/** All pending add-on purchase submissions awaiting verification. */
export const getPendingPurchases = query({
  args: {},
  handler: async (ctx): Promise<PurchaseRow[]> => {
    await requireSuperAdmin(ctx);
    const docs = await ctx.db
      .query("addonPurchases")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);
    return hydratePurchasesWithOrg(ctx, docs);
  },
});

/** All organizations with their active add-ons (super admin management). */
export const getOrgAddonOverview = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      orgId: Id<"organizations">;
      orgName: string;
      slug: string;
      isActive: boolean;
      planName: string;
      activeAddons: Array<{
        addonId: Id<"featureAddons">;
        name: string;
        source: string;
      }>;
    }>
  > => {
    await requireSuperAdmin(ctx);

    const [orgs, plans, grants, addons] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("membershipPlans").withIndex("by_order").collect(),
      ctx.db.query("orgAddons").collect(),
      ctx.db.query("featureAddons").collect(),
    ]);

    const planLookup: Record<string, Doc<"membershipPlans">> = {};
    for (const p of plans) planLookup[p._id] = p;
    const addonLookup: Record<string, Doc<"featureAddons">> = {};
    for (const a of addons) addonLookup[a._id] = a;

    const grantsByOrg: Record<
      string,
      Array<{ addonId: Id<"featureAddons">; name: string; source: string }>
    > = {};
    for (const g of grants) {
      if (g.status !== "active") continue;
      const addon = addonLookup[g.addonId];
      if (!addon) continue;
      (grantsByOrg[g.organizationId] ??= []).push({
        addonId: g.addonId,
        name: addon.name,
        source: g.source,
      });
    }

    return orgs
      .map((org) => ({
        orgId: org._id,
        orgName: org.name,
        slug: org.slug,
        isActive: org.isActive,
        planName: org.membershipPlanId
          ? (planLookup[org.membershipPlanId]?.name ?? "Tanpa Paket")
          : "Tanpa Paket",
        activeAddons: grantsByOrg[org._id] ?? [],
      }))
      .sort((a, b) =>
        a.orgName.localeCompare(b.orgName, "id", { sensitivity: "base" }),
      );
  },
});

// ── Super-admin mutations ────────────────────────────────────────────────────

/** Verify a pending purchase → activates the add-on grant for the org. */
export const verifyPurchase = mutation({
  args: { purchaseId: v.id("addonPurchases") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    }
    if (purchase.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pengajuan ini sudah diproses",
      });
    }
    const nowIso = new Date().toISOString();
    await activateGrant(
      ctx,
      purchase.organizationId,
      purchase.addonId,
      "purchase",
      admin._id,
    );
    await ctx.db.patch(args.purchaseId, {
      status: "verified",
      reviewedBy: admin._id,
      reviewedAt: nowIso,
    });
  },
});

/** Reject a pending purchase with an optional reason. */
export const rejectPurchase = mutation({
  args: {
    purchaseId: v.id("addonPurchases"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
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

/** Grant an add-on to an org directly (no payment). */
export const grantAddon = mutation({
  args: {
    organizationId: v.id("organizations"),
    addonId: v.id("featureAddons"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }
    const addon = await ctx.db.get(args.addonId);
    if (!addon) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Add-on tidak ditemukan" });
    }
    await activateGrant(
      ctx,
      args.organizationId,
      args.addonId,
      "manual",
      admin._id,
      args.note?.trim() || undefined,
    );
  },
});

/** Revoke an org's add-on grant (locks its menus again). */
export const revokeAddon = mutation({
  args: {
    organizationId: v.id("organizations"),
    addonId: v.id("featureAddons"),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireSuperAdmin(ctx);
    const grant = await ctx.db
      .query("orgAddons")
      .withIndex("by_org_and_addon", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("addonId", args.addonId),
      )
      .unique();
    if (!grant || grant.status !== "active") return;
    await ctx.db.patch(grant._id, {
      status: "revoked",
      revokedBy: admin._id,
      revokedAt: new Date().toISOString(),
    });
  },
});

// ── Hydration helpers ──────────────────────────────────────────────────────

async function hydratePurchases(
  ctx: QueryCtx,
  docs: Doc<"addonPurchases">[],
  orgName: string,
): Promise<PurchaseRow[]> {
  return Promise.all(
    docs.map(async (p) => {
      const [submittedBy, reviewedBy] = await Promise.all([
        p.submittedBy ? ctx.db.get(p.submittedBy) : null,
        p.reviewedBy ? ctx.db.get(p.reviewedBy) : null,
      ]);
      return {
        _id: p._id,
        organizationId: p.organizationId,
        orgName,
        addonId: p.addonId,
        addonName: p.addonName ?? null,
        amount: p.amount,
        amountLabel: p.amountLabel ?? null,
        reference: p.reference ?? null,
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

async function hydratePurchasesWithOrg(
  ctx: QueryCtx,
  docs: Doc<"addonPurchases">[],
): Promise<PurchaseRow[]> {
  return Promise.all(
    docs.map(async (p) => {
      const [org, submittedBy, reviewedBy] = await Promise.all([
        ctx.db.get(p.organizationId),
        p.submittedBy ? ctx.db.get(p.submittedBy) : null,
        p.reviewedBy ? ctx.db.get(p.reviewedBy) : null,
      ]);
      return {
        _id: p._id,
        organizationId: p.organizationId,
        orgName: org?.name ?? "Tidak diketahui",
        addonId: p.addonId,
        addonName: p.addonName ?? null,
        amount: p.amount,
        amountLabel: p.amountLabel ?? null,
        reference: p.reference ?? null,
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

/** Reusable upload URL for a purchase proof image. */
export const generateProofUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdminUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
