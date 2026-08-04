import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireAdminUser(ctx: QueryCtx): Promise<Doc<"users">> {
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

// ── Types ────────────────────────────────────────────────────────────────────

type PlanSummary = {
  planId: Id<"membershipPlans"> | null;
  planName: string;
  planSlug: string;
  orgCount: number;
  totalUsers: number;
  activeOrgs: number;
  inactiveOrgs: number;
};

type OrgMembershipRow = {
  orgId: Id<"organizations">;
  orgName: string;
  slug: string;
  isActive: boolean;
  plan: string;
  planName: string;
  membershipPlanId: Id<"membershipPlans"> | null;
  userCount: number;
  maxEmployees: number;
  maxStorageMb: number;
  usagePercent: number;
  createdAt: string;
};

type UpgradeRequestRow = {
  _id: Id<"upgradeRequests">;
  orgName: string;
  requestedByName: string;
  upgradeType: string;
  targetPlanName: string | null;
  status: string;
  requestedAt: string;
  note: string | null;
};

type OverviewStats = {
  totalOrgs: number;
  activeOrgs: number;
  totalPlans: number;
  activePlans: number;
  totalUsers: number;
  pendingUpgrades: number;
  activePromos: number;
  totalRedemptions: number;
};

// ── Queries ──────────────────────────────────────────────────────────────────

/** High-level overview stats for the membership dashboard */
export const getOverviewStats = query({
  args: {},
  handler: async (ctx): Promise<OverviewStats> => {
    await requireAdminUser(ctx);

    const [orgs, plans, users, upgradeRequests, promos, redemptions] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("membershipPlans").withIndex("by_order").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("upgradeRequests").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("promos").withIndex("by_active", (q) => q.eq("isActive", true)).collect(),
      ctx.db.query("promoRedemptions").collect(),
    ]);

    return {
      totalOrgs: orgs.length,
      activeOrgs: orgs.filter((o) => o.isActive).length,
      totalPlans: plans.length,
      activePlans: plans.filter((p) => p.isActive).length,
      totalUsers: users.length,
      pendingUpgrades: upgradeRequests.length,
      activePromos: promos.length,
      totalRedemptions: redemptions.length,
    };
  },
});

/** Plan distribution: how many orgs and users per plan */
export const getPlanDistribution = query({
  args: {},
  handler: async (ctx): Promise<PlanSummary[]> => {
    await requireAdminUser(ctx);

    const [plans, orgs, users] = await Promise.all([
      ctx.db.query("membershipPlans").withIndex("by_order").collect(),
      ctx.db.query("organizations").collect(),
      ctx.db.query("users").collect(),
    ]);

    // Build a map: orgId -> user count
    const usersByOrg: Record<string, number> = {};
    for (const u of users) {
      if (u.organizationId) {
        usersByOrg[u.organizationId] = (usersByOrg[u.organizationId] ?? 0) + 1;
      }
    }

    // Group orgs by membershipPlanId
    const planMap: Record<string, { orgIds: Id<"organizations">[]; activeCount: number; inactiveCount: number }> = {};
    let noPlanOrgs: Id<"organizations">[] = [];
    let noPlanActive = 0;
    let noPlanInactive = 0;

    for (const org of orgs) {
      const key = org.membershipPlanId ?? "none";
      if (key === "none") {
        noPlanOrgs.push(org._id);
        if (org.isActive) noPlanActive++;
        else noPlanInactive++;
      } else {
        if (!planMap[key]) planMap[key] = { orgIds: [], activeCount: 0, inactiveCount: 0 };
        planMap[key].orgIds.push(org._id);
        if (org.isActive) planMap[key].activeCount++;
        else planMap[key].inactiveCount++;
      }
    }

    const result: PlanSummary[] = [];

    for (const plan of plans) {
      const data = planMap[plan._id] ?? { orgIds: [], activeCount: 0, inactiveCount: 0 };
      const totalUsers = data.orgIds.reduce((sum, id) => sum + (usersByOrg[id] ?? 0), 0);
      result.push({
        planId: plan._id,
        planName: plan.name,
        planSlug: plan.slug,
        orgCount: data.orgIds.length,
        totalUsers,
        activeOrgs: data.activeCount,
        inactiveOrgs: data.inactiveCount,
      });
    }

    // Add "no plan" bucket
    if (noPlanOrgs.length > 0) {
      const totalUsers = noPlanOrgs.reduce((sum, id) => sum + (usersByOrg[id] ?? 0), 0);
      result.push({
        planId: null,
        planName: "Tanpa Paket",
        planSlug: "none",
        orgCount: noPlanOrgs.length,
        totalUsers,
        activeOrgs: noPlanActive,
        inactiveOrgs: noPlanInactive,
      });
    }

    return result;
  },
});

/** List all organizations with their membership details */
export const getOrgMembershipList = query({
  args: {},
  handler: async (ctx): Promise<OrgMembershipRow[]> => {
    await requireAdminUser(ctx);

    const [orgs, plans, users] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("membershipPlans").withIndex("by_order").collect(),
      ctx.db.query("users").collect(),
    ]);

    const planLookup: Record<string, Doc<"membershipPlans">> = {};
    for (const p of plans) {
      planLookup[p._id] = p;
    }

    // Count users per org
    const usersByOrg: Record<string, number> = {};
    for (const u of users) {
      if (u.organizationId) {
        usersByOrg[u.organizationId] = (usersByOrg[u.organizationId] ?? 0) + 1;
      }
    }

    return orgs.map((org) => {
      const plan = org.membershipPlanId ? planLookup[org.membershipPlanId] : null;
      const userCount = usersByOrg[org._id] ?? 0;
      const planMax = plan?.maxEmployees ?? 0;
      // Include verified extra seats so the capacity bar matches real capacity.
      const maxEmployees =
        planMax > 0 && org.extraSeats && org.extraSeats > 0
          ? planMax + org.extraSeats
          : planMax;
      const usagePercent = maxEmployees > 0 ? Math.round((userCount / maxEmployees) * 100) : 0;

      return {
        orgId: org._id,
        orgName: org.name,
        slug: org.slug,
        isActive: org.isActive,
        plan: org.plan ?? "free",
        planName: plan?.name ?? "Tanpa Paket",
        membershipPlanId: plan?._id ?? null,
        userCount,
        maxEmployees,
        maxStorageMb: plan?.maxStorageMb ?? 0,
        usagePercent,
        createdAt: org.createdAt,
      };
    });
  },
});

/** List recent upgrade requests */
export const getRecentUpgradeRequests = query({
  args: {},
  handler: async (ctx): Promise<UpgradeRequestRow[]> => {
    await requireAdminUser(ctx);

    const requests = await ctx.db
      .query("upgradeRequests")
      .withIndex("by_requested_at")
      .order("desc")
      .take(20);

    return await Promise.all(
      requests.map(async (req) => {
        const [org, user, targetPlan] = await Promise.all([
          ctx.db.get(req.organizationId),
          ctx.db.get(req.requestedBy),
          req.targetPlanId ? ctx.db.get(req.targetPlanId) : null,
        ]);

        return {
          _id: req._id,
          orgName: org?.name ?? "Tidak diketahui",
          requestedByName: user?.name ?? "Tidak diketahui",
          upgradeType: req.upgradeType,
          targetPlanName: targetPlan?.name ?? null,
          status: req.status,
          requestedAt: req.requestedAt,
          note: req.note ?? null,
        };
      }),
    );
  },
});

// ── Plan recommendations ──────────────────────────────────────────────────────

type PlanRecommendation = {
  orgId: Id<"organizations">;
  orgName: string;
  slug: string;
  isActive: boolean;
  currentPlanName: string;
  currentPlanSlug: string | null;
  userCount: number;
  maxEmployees: number; // 0 = unlimited
  employeePercent: number; // 0 if unlimited
  storageMb: number; // approximate used storage
  maxStorageMb: number; // 0 = unlimited
  storagePercent: number; // 0 if unlimited
  // "upgrade" | "downgrade" | "ok" | "no_plan"
  recommendation: string;
  suggestedPlanId: Id<"membershipPlans"> | null;
  suggestedPlanName: string | null;
  reason: string;
};

/**
 * Usage-based upgrade/downgrade recommendations per organization.
 *
 * NOTE: This is guidance only — "add" actions are blocked at 100% but the
 * recommendations themselves are advisory. Storage usage comes from the
 * authoritative per-org counter (orgStorageUsage).
 */
export const getPlanRecommendations = query({
  args: {},
  handler: async (ctx): Promise<PlanRecommendation[]> => {
    await requireAdminUser(ctx);

    const [orgs, plans, users, storageRows] =
      await Promise.all([
        ctx.db.query("organizations").collect(),
        ctx.db.query("membershipPlans").withIndex("by_order").collect(),
        ctx.db.query("users").collect(),
        ctx.db.query("orgStorageUsage").collect(),
      ]);

    // Active plans sorted cheapest → most expensive for upgrade/downgrade search.
    // Treat custom-priced plans (pricePerUserMonth < 0) as the most expensive.
    const rankedPlans = plans
      .filter((p) => p.isActive)
      .slice()
      .sort((a, b) => {
        const pa = a.pricePerUserMonth < 0 ? Number.MAX_SAFE_INTEGER : a.pricePerUserMonth;
        const pb = b.pricePerUserMonth < 0 ? Number.MAX_SAFE_INTEGER : b.pricePerUserMonth;
        return pa - pb;
      });

    const planLookup: Record<string, Doc<"membershipPlans">> = {};
    for (const p of plans) planLookup[p._id] = p;

    // Users per org
    const usersByOrg: Record<string, number> = {};
    for (const u of users) {
      if (u.organizationId) {
        usersByOrg[u.organizationId] = (usersByOrg[u.organizationId] ?? 0) + 1;
      }
    }

    // Authoritative storage (bytes) per org from the denormalized counter,
    // matching the dashboard banner. Kept in sync at every file add/remove.
    const bytesByOrg: Record<string, number> = {};
    for (const row of storageRows) {
      bytesByOrg[row.organizationId] = row.bytes;
    }

    // A plan "fits" an org if both employee and storage usage are within it
    // (0 = unlimited). Used to find the cheapest fitting plan.
    const planFits = (
      plan: Doc<"membershipPlans">,
      userCount: number,
      storageMb: number,
    ): boolean => {
      const empOk = plan.maxEmployees === 0 || userCount <= plan.maxEmployees;
      const stoOk = plan.maxStorageMb === 0 || storageMb <= plan.maxStorageMb;
      return empOk && stoOk;
    };

    const result: PlanRecommendation[] = [];

    for (const org of orgs) {
      const userCount = usersByOrg[org._id] ?? 0;
      const storageMb = Math.round(((bytesByOrg[org._id] ?? 0) / (1024 * 1024)) * 10) / 10;
      const plan = org.membershipPlanId ? planLookup[org.membershipPlanId] : null;

      const maxEmployees = plan?.maxEmployees ?? 0;
      const maxStorageMb = plan?.maxStorageMb ?? 0;
      const employeePercent =
        maxEmployees > 0 ? Math.round((userCount / maxEmployees) * 100) : 0;
      const storagePercent =
        maxStorageMb > 0 ? Math.round((storageMb / maxStorageMb) * 100) : 0;

      // Org has no plan assigned
      if (!plan) {
        // Suggest the cheapest plan that fits current usage
        const fitPlan = rankedPlans.find((p) => planFits(p, userCount, storageMb));
        result.push({
          orgId: org._id,
          orgName: org.name,
          slug: org.slug,
          isActive: org.isActive,
          currentPlanName: "Tanpa Paket",
          currentPlanSlug: null,
          userCount,
          maxEmployees,
          employeePercent,
          storageMb,
          maxStorageMb,
          storagePercent,
          recommendation: "no_plan",
          suggestedPlanId: fitPlan?._id ?? null,
          suggestedPlanName: fitPlan?.name ?? null,
          reason: "Organisasi belum memiliki paket. Tetapkan paket yang sesuai.",
        });
        continue;
      }

      const overEmployees = maxEmployees > 0 && userCount > maxEmployees;
      const overStorage = maxStorageMb > 0 && storageMb > maxStorageMb;

      // OVER LIMIT → recommend upgrade to the cheapest plan that fits
      if (overEmployees || overStorage) {
        const upgradePlan = rankedPlans.find(
          (p) =>
            p._id !== plan._id &&
            planFits(p, userCount, storageMb) &&
            // must be at least as expensive as current (a real upgrade)
            (p.pricePerUserMonth < 0 ||
              p.pricePerUserMonth >= plan.pricePerUserMonth),
        );
        const parts: string[] = [];
        if (overEmployees)
          parts.push(`karyawan melebihi batas (${userCount}/${maxEmployees})`);
        if (overStorage)
          parts.push(
            `penyimpanan melebihi batas (${storageMb}/${maxStorageMb} MB)`,
          );
        result.push({
          orgId: org._id,
          orgName: org.name,
          slug: org.slug,
          isActive: org.isActive,
          currentPlanName: plan.name,
          currentPlanSlug: plan.slug,
          userCount,
          maxEmployees,
          employeePercent,
          storageMb,
          maxStorageMb,
          storagePercent,
          recommendation: "upgrade",
          suggestedPlanId: upgradePlan?._id ?? null,
          suggestedPlanName: upgradePlan?.name ?? null,
          reason: `Perlu upgrade: ${parts.join(" dan ")}.`,
        });
        continue;
      }

      // WELL UNDER → recommend downgrade if a cheaper plan still fits comfortably
      // (usage stays under 70% of the cheaper plan's limits).
      const cheaperFits = rankedPlans.find((p) => {
        if (p.pricePerUserMonth < 0) return false; // skip custom
        if (p.pricePerUserMonth >= plan.pricePerUserMonth) return false; // must be cheaper
        const empHeadroom =
          p.maxEmployees === 0 || userCount <= Math.floor(p.maxEmployees * 0.7);
        const stoHeadroom =
          p.maxStorageMb === 0 || storageMb <= Math.floor(p.maxStorageMb * 0.7);
        return empHeadroom && stoHeadroom;
      });

      if (cheaperFits) {
        result.push({
          orgId: org._id,
          orgName: org.name,
          slug: org.slug,
          isActive: org.isActive,
          currentPlanName: plan.name,
          currentPlanSlug: plan.slug,
          userCount,
          maxEmployees,
          employeePercent,
          storageMb,
          maxStorageMb,
          storagePercent,
          recommendation: "downgrade",
          suggestedPlanId: cheaperFits._id,
          suggestedPlanName: cheaperFits.name,
          reason: `Penggunaan rendah — paket ${cheaperFits.name} sudah mencukupi dan lebih hemat.`,
        });
        continue;
      }

      // Otherwise the plan is appropriate
      result.push({
        orgId: org._id,
        orgName: org.name,
        slug: org.slug,
        isActive: org.isActive,
        currentPlanName: plan.name,
        currentPlanSlug: plan.slug,
        userCount,
        maxEmployees,
        employeePercent,
        storageMb,
        maxStorageMb,
        storagePercent,
        recommendation: "ok",
        suggestedPlanId: null,
        suggestedPlanName: null,
        reason: "Paket sesuai dengan penggunaan saat ini.",
      });
    }

    // Order: upgrades first, then no_plan, then downgrades, then ok
    const order: Record<string, number> = {
      upgrade: 0,
      no_plan: 1,
      downgrade: 2,
      ok: 3,
    };
    result.sort(
      (a, b) =>
        (order[a.recommendation] ?? 9) - (order[b.recommendation] ?? 9) ||
        a.orgName.localeCompare(b.orgName, "id", { sensitivity: "base" }),
    );

    return result;
  },
});
