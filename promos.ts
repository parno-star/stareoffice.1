import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { resetOrgLimitAlerts } from "./lib/planLimits";

// ---- Helpers ----------------------------------------------------------------

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user || !isAdminRole(user.role)) {
    throw new ConvexError({ message: "Akses ditolak. Hanya admin.", code: "FORBIDDEN" });
  }
  return user;
}

async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ message: "Pengguna tidak ditemukan", code: "NOT_FOUND" });
  }
  return user;
}

// ---- Queries ----------------------------------------------------------------

/** List all promos (admin) */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("promos")
      .collect();
  },
});

/** List only active promos */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("promos")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const now = new Date().toISOString();
    return all.filter((p) => p.validFrom <= now && p.validUntil >= now);
  },
});

/** Get a single promo by ID */
export const getById = query({
  args: { promoId: v.id("promos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.promoId);
  },
});

/** Validate a promo code - check if it exists and is valid */
export const validateCode = query({
  args: { code: v.string(), planSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const promo = await ctx.db
      .query("promos")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!promo) {
      return { valid: false, error: "Kode promo tidak ditemukan" } as const;
    }
    if (!promo.isActive) {
      return { valid: false, error: "Promo sudah tidak aktif" } as const;
    }
    const now = new Date().toISOString();
    if (promo.validFrom > now) {
      return { valid: false, error: "Promo belum dimulai" } as const;
    }
    if (promo.validUntil < now) {
      return { valid: false, error: "Promo sudah berakhir" } as const;
    }
    if (promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions) {
      return { valid: false, error: "Kuota promo sudah habis" } as const;
    }
    // Check plan scope
    if (args.planSlug && promo.applicablePlanSlugs.length > 0) {
      if (!promo.applicablePlanSlugs.includes(args.planSlug)) {
        return { valid: false, error: "Promo tidak berlaku untuk paket ini" } as const;
      }
    }
    return { valid: true, promo } as const;
  },
});

/** List redemptions for an organization */
export const listRedemptions = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    if (!args.organizationId) return [];
    return await ctx.db
      .query("promoRedemptions")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId!))
      .collect();
  },
});

/** List all redemptions (admin) */
export const listAllRedemptions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("promoRedemptions")
      .collect();
  },
});

// ---- Upgrade Requests Queries -----------------------------------------------

/** List all upgrade requests (admin) */
export const listUpgradeRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("upgradeRequests")
      .withIndex("by_requested_at")
      .order("desc")
      .collect();
  },
});

/** List upgrade requests for an organization */
export const listOrgUpgradeRequests = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    if (!args.organizationId) return [];
    return await ctx.db
      .query("upgradeRequests")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId!))
      .collect();
  },
});

// ---- Mutations --------------------------------------------------------------

/** Create a new promo */
export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    discountPercent: v.number(),
    discountFlat: v.number(),
    extraUsers: v.number(),
    extraStorageMb: v.number(),
    applicablePlanSlugs: v.array(v.string()),
    validFrom: v.string(),
    validUntil: v.string(),
    maxRedemptions: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const upperCode = args.code.toUpperCase();
    // Check uniqueness
    const existing = await ctx.db
      .query("promos")
      .withIndex("by_code", (q) => q.eq("code", upperCode))
      .first();
    if (existing) {
      throw new ConvexError({ message: `Kode "${upperCode}" sudah digunakan`, code: "CONFLICT" });
    }

    return await ctx.db.insert("promos", {
      ...args,
      code: upperCode,
      redemptionCount: 0,
      createdBy: user._id,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Update a promo */
export const update = mutation({
  args: {
    promoId: v.id("promos"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(v.string()),
    discountPercent: v.optional(v.number()),
    discountFlat: v.optional(v.number()),
    extraUsers: v.optional(v.number()),
    extraStorageMb: v.optional(v.number()),
    applicablePlanSlugs: v.optional(v.array(v.string())),
    validFrom: v.optional(v.string()),
    validUntil: v.optional(v.string()),
    maxRedemptions: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const promo = await ctx.db.get(args.promoId);
    if (!promo) {
      throw new ConvexError({ message: "Promo tidak ditemukan", code: "NOT_FOUND" });
    }

    const { promoId, ...updates } = args;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(promoId, patch);
  },
});

/** Delete a promo */
export const remove = mutation({
  args: { promoId: v.id("promos") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const promo = await ctx.db.get(args.promoId);
    if (!promo) {
      throw new ConvexError({ message: "Promo tidak ditemukan", code: "NOT_FOUND" });
    }
    await ctx.db.delete(args.promoId);
  },
});

/** Redeem a promo code for an organization */
export const redeemCode = mutation({
  args: {
    code: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const promo = await ctx.db
      .query("promos")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!promo) {
      throw new ConvexError({ message: "Kode promo tidak ditemukan", code: "NOT_FOUND" });
    }
    if (!promo.isActive) {
      throw new ConvexError({ message: "Promo sudah tidak aktif", code: "BAD_REQUEST" });
    }
    const now = new Date().toISOString();
    if (promo.validFrom > now || promo.validUntil < now) {
      throw new ConvexError({ message: "Promo di luar periode berlaku", code: "BAD_REQUEST" });
    }
    if (promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions) {
      throw new ConvexError({ message: "Kuota promo sudah habis", code: "BAD_REQUEST" });
    }

    // Check if org already redeemed this promo
    const existingRedemption = await ctx.db
      .query("promoRedemptions")
      .withIndex("by_promo_and_org", (q) =>
        q.eq("promoId", promo._id).eq("organizationId", args.organizationId))
      .first();
    if (existingRedemption) {
      throw new ConvexError({ message: "Organisasi sudah pernah menggunakan promo ini", code: "CONFLICT" });
    }

    // Create redemption
    await ctx.db.insert("promoRedemptions", {
      promoId: promo._id,
      organizationId: args.organizationId,
      redeemedBy: user._id,
      redeemedAt: now,
      grantedType: promo.type,
      grantedDiscountPercent: promo.discountPercent,
      grantedDiscountFlat: promo.discountFlat,
      grantedExtraUsers: promo.extraUsers,
      grantedExtraStorageMb: promo.extraStorageMb,
      status: "active",
      expiresAt: promo.validUntil,
    });

    // Increment redemption count
    await ctx.db.patch(promo._id, {
      redemptionCount: promo.redemptionCount + 1,
    });

    return { type: promo.type, name: promo.name };
  },
});

/** Submit an upgrade request */
export const submitUpgradeRequest = mutation({
  args: {
    organizationId: v.id("organizations"),
    upgradeType: v.string(),
    targetPlanId: v.optional(v.id("membershipPlans")),
    additionalUsers: v.optional(v.number()),
    additionalStorageMb: v.optional(v.number()),
    promoId: v.optional(v.id("promos")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    return await ctx.db.insert("upgradeRequests", {
      organizationId: args.organizationId,
      requestedBy: user._id,
      upgradeType: args.upgradeType,
      targetPlanId: args.targetPlanId,
      additionalUsers: args.additionalUsers,
      additionalStorageMb: args.additionalStorageMb,
      promoId: args.promoId,
      note: args.note,
      status: "pending",
      requestedAt: new Date().toISOString(),
    });
  },
});

/** Review an upgrade request (admin) */
export const reviewUpgradeRequest = mutation({
  args: {
    requestId: v.id("upgradeRequests"),
    status: v.string(),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({ message: "Permintaan tidak ditemukan", code: "NOT_FOUND" });
    }

    await ctx.db.patch(args.requestId, {
      status: args.status,
      reviewedBy: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.reviewNote,
    });

    // When an admin approves/completes a plan-type upgrade, apply the plan change
    // to the organization so limits & displays reflect the new plan immediately.
    const isApproved = args.status === "approved" || args.status === "completed";
    if (isApproved && request.upgradeType === "plan" && request.targetPlanId) {
      const plan = await ctx.db.get(request.targetPlanId);
      const org = await ctx.db.get(request.organizationId);
      if (plan && org) {
        await ctx.db.patch(org._id, {
          membershipPlanId: plan._id,
          plan: plan.slug,
          updatedAt: new Date().toISOString(),
        });
        // Re-arm graduated alerts against the new limits (auto-unblock on upgrade).
        await resetOrgLimitAlerts(ctx, org._id);
        await ctx.db.insert("notifications", {
          userId: request.requestedBy,
          type: "plan_changed",
          title: "Paket Diperbarui",
          message: `Paket organisasi "${org.name}" telah diubah menjadi ${plan.name}.`,
          actorId: user._id,
          link: "/dashboard",
          organizationId: org._id,
        });
      }
    }
  },
});
