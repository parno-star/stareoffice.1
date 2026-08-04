import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { addDaysIso } from "./lib/subscription";

/**
 * Simulation / demo data helpers for the super-admin billing controls.
 *
 * These create throwaway organizations with a range of subscription due-dates
 * so a super admin can see and test the "due soon / overdue / expired" controls
 * without touching real customer data. Every simulated org is tagged with a
 * recognizable slug prefix so it can be cleaned up in one click.
 */

const SIM_SLUG_PREFIX = "sim-billing-";

async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role) || !isSuperAdminRole(user.role)) {
    throw new ConvexError({
      message: "Hanya super admin yang dapat melakukan tindakan ini",
      code: "FORBIDDEN",
    });
  }
  return user;
}

// Each simulated org: a display name and how many days from now its paid period
// ends. Negative = already past due. This spread covers every status the
// billing controls surface.
const SIM_ORGS: { name: string; daysUntilDue: number; users: number }[] = [
  { name: "PT Simulasi Aktif Sehat", daysUntilDue: 45, users: 12 },
  { name: "PT Simulasi Jatuh Tempo 5 Hari", daysUntilDue: 5, users: 8 },
  { name: "PT Simulasi Jatuh Tempo 2 Hari", daysUntilDue: 2, users: 20 },
  { name: "CV Simulasi Menunggak", daysUntilDue: -2, users: 6 },
  { name: "PT Simulasi Kedaluwarsa", daysUntilDue: -10, users: 15 },
  { name: "CV Simulasi Kedaluwarsa Lama", daysUntilDue: -40, users: 4 },
];

/** How many simulation orgs currently exist (for the UI toggle state). */
export const getSimulationStatus = query({
  args: {},
  handler: async (ctx): Promise<{ count: number }> => {
    await requireSuperAdmin(ctx);
    const orgs = await ctx.db.query("organizations").collect();
    const count = orgs.filter((o) =>
      o.slug.startsWith(SIM_SLUG_PREFIX),
    ).length;
    return { count };
  },
});

/**
 * Create the set of simulation organizations with varied due-dates. Idempotent:
 * clears any existing simulation orgs first so re-running produces a clean set
 * anchored to "now".
 */
export const seedSimulationData = mutation({
  args: {},
  handler: async (ctx): Promise<{ created: number }> => {
    const admin = await requireSuperAdmin(ctx);
    await clearSimOrgs(ctx);

    const nowIso = new Date().toISOString();

    // Prefer a real paid plan so the monthly-bill calculation is non-zero.
    const plans = await ctx.db
      .query("membershipPlans")
      .withIndex("by_order")
      .collect();
    const paidPlan =
      plans.find((p) => p.pricePerUserMonth > 0) ?? plans[0] ?? null;

    let created = 0;
    for (let i = 0; i < SIM_ORGS.length; i++) {
      const sim = SIM_ORGS[i];
      const paidUntil = addDaysIso(nowIso, sim.daysUntilDue);
      const orgId = await ctx.db.insert("organizations", {
        name: sim.name,
        slug: `${SIM_SLUG_PREFIX}${i + 1}`,
        plan: "pro",
        membershipPlanId: paidPlan?._id,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        maxSeats: sim.users + 10,
        createdBy: admin._id,
        subscriptionStartedAt: addDaysIso(nowIso, -60),
        subscriptionCycleMonths: 3,
        subscriptionPaidUntil: paidUntil,
      });

      // Create placeholder members so the per-seat billing amount is realistic.
      for (let u = 0; u < sim.users; u++) {
        await ctx.db.insert("users", {
          tokenIdentifier: `sim-user-${orgId}-${u}`,
          name: `Simulasi Karyawan ${u + 1}`,
          email: `sim${u + 1}@${SIM_SLUG_PREFIX}${i + 1}.local`,
          role: u === 0 ? "admin" : "employee",
          accountStatus: "active",
          organizationId: orgId,
        });
      }
      created++;
    }

    return { created };
  },
});

/** Remove all simulation organizations and their placeholder members. */
export const clearSimulationData = mutation({
  args: {},
  handler: async (ctx): Promise<{ removed: number }> => {
    await requireSuperAdmin(ctx);
    return { removed: await clearSimOrgs(ctx) };
  },
});

/** Delete every simulation org (matched by slug prefix) and its sim members. */
async function clearSimOrgs(ctx: MutationCtx): Promise<number> {
  const orgs = await ctx.db.query("organizations").collect();
  const simOrgs = orgs.filter((o) => o.slug.startsWith(SIM_SLUG_PREFIX));

  let removed = 0;
  for (const org of simOrgs) {
    const members = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();
    for (const m of members) {
      // Only delete the placeholder sim members we created, never real users.
      if (m.tokenIdentifier.startsWith("sim-user-")) {
        await ctx.db.delete(m._id);
      }
    }
    await ctx.db.delete(org._id);
    removed++;
  }
  return removed;
}
