import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { generateInviteCode } from "./lib/inviteCode";
import { getTrialSettings } from "./lib/trialAccess";
import { addDaysIso } from "./lib/subscription";

/**
 * Self-service onboarding for a SaaS multi-tenant platform.
 *
 * Two paths:
 *  A) **Create a new organisation** – user becomes the org's "admin" and
 *     the org is created with isActive=true, assigned the Free plan.
 *     No super-admin approval required.
 *  B) **Join an existing organisation** – user is assigned to the org with
 *     accountStatus="pending_approval". An admin of that org must approve.
 *
 * ─── Why this file does NOT use requireTenant() ─────────────────────────────
 * requireTenant() enforces that the caller already belongs to an organization.
 * Every handler here is intentionally for users who have NO org yet — that is
 * precisely what "needs onboarding" means.  Calling requireTenant() would throw
 * FORBIDDEN ("User is not assigned to any organization") for every legitimate
 * onboarding request, even with { allowPending: true } (that flag only relaxes
 * the accountStatus check, not the missing-organizationId check).
 *
 * Therefore all handlers use ctx.auth.getUserIdentity() directly, which is the
 * correct and safe pattern for pre-onboarding mutations and queries.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── Queries ────────────────────────────────────────────────────────────────

/** Check if the current user needs onboarding */
export const needsOnboarding = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) return false;

    // User needs onboarding if no role and no accountStatus set
    return !user.role && !user.accountStatus;
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * PATH A: Register a new organisation (self-service trial).
 *
 * The organisation is created INSTANTLY ACTIVE as a free trial (no super admin
 * approval). It uses the global trial settings for its trial length; access is
 * full during the trial and automatically degrades to read-only once the trial
 * period lapses (enforced by the standard subscription lock) until a payment is
 * verified. The creator becomes its active admin immediately.
 */
export const completeWithNewOrg = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    address: v.string(),
    orgName: v.string(),
    orgAddress: v.string(),
    orgEmail: v.string(),
    orgPhone: v.optional(v.string()),
    orgWebsite: v.optional(v.string()),
    selectedPlanId: v.id("membershipPlans"),
    // "free" | "transfer"
    paymentMethod: v.string(),
    // For paid plans: bank transfer reference/proof text
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Only allow onboarding for users that haven't completed it
    if (user.role || user.accountStatus) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Onboarding sudah selesai sebelumnya",
      });
    }

    // Respect the global toggle: when new-org registration is disabled, block
    // this path entirely (the UI also hides the option, this is defense-in-depth).
    const trial = await getTrialSettings(ctx);
    if (!trial.registrationEnabled) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Pendaftaran organisasi baru sedang dinonaktifkan. Silakan hubungi administrator platform.",
      });
    }

    // Validate the selected plan exists and is active. The plan records the
    // tier the org intends to subscribe to AFTER the trial; no upfront payment
    // is required because the trial is free.
    const plan = await ctx.db.get(args.selectedPlanId);
    if (!plan || !plan.isActive) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Paket yang dipilih tidak ditemukan",
      });
    }

    const isPaidPlan = plan.pricePerUserMonth > 0;

    // Generate slug from org name
    const baseSlug = args.orgName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug || "org";
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    // Generate a unique invite code so the new admin can invite teammates
    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 20; attempt++) {
      const clash = await ctx.db
        .query("organizations")
        .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode))
        .first();
      if (!clash) break;
      inviteCode = generateInviteCode();
    }

    const now = new Date().toISOString();
    const paymentMethod = isPaidPlan ? "transfer" : "free";
    const paymentAmountLabel = `${plan.price} ${plan.priceUnit}`.trim();

    // Trial ends after the configured number of days. We reuse the standard
    // subscription "paid until" instant so the existing read-only lock and
    // status banner enforce the trial end with no extra machinery.
    const trialEndsAt = addDaysIso(now, trial.durationDays);

    // Create the new organization — INSTANTLY ACTIVE as a free trial.
    const orgId = await ctx.db.insert("organizations", {
      name: args.orgName.trim(),
      slug,
      address: args.orgAddress.trim(),
      email: args.orgEmail.trim(),
      phone: args.orgPhone?.trim(),
      website: args.orgWebsite?.trim(),
      isActive: true, // Trial orgs are active immediately (no approval)
      createdAt: now,
      createdBy: user._id,
      plan: plan.slug,
      membershipPlanId: plan._id,
      inviteCode,
      // Registration is auto-approved for trials.
      approvalStatus: "approved",
      reviewedAt: now,
      isTrial: true,
      paymentMethod,
      paymentReference: isPaidPlan ? args.paymentReference?.trim() : undefined,
      paymentAmountLabel,
      submittedAt: now,
      // Trial window drives the read-only lock when it lapses.
      subscriptionStartedAt: now,
      subscriptionPaidUntil: trialEndsAt,
    });

    // The creator becomes the ACTIVE admin of this new organisation immediately.
    await ctx.db.patch(user._id, {
      name: args.fullName.trim(),
      phone: args.phone.trim(),
      location: args.address.trim(),
      organizationId: orgId,
      role: "admin",
      accountStatus: "active",
    });

    // Audit log
    await ctx.db.insert("userAuditLog", {
      targetUserId: user._id,
      action: "role_requested",
      detail: `Organisasi trial "${args.orgName}" (paket ${plan.name}) dibuat dan langsung aktif. Trial berakhir ${trialEndsAt}.`,
      occurredAt: now,
    });

    // Notify super admins that a new trial organisation was created (for
    // visibility, not approval).
    const superAdmins = await ctx.db.query("users").collect();
    const saList = superAdmins.filter((u) => u.role === "super_admin");
    for (const sa of saList) {
      await ctx.db.insert("notifications", {
        userId: sa._id,
        type: "org_created",
        title: "Organisasi Trial Baru",
        message: `${args.fullName} membuat organisasi trial "${args.orgName}" (paket ${plan.name}). Organisasi langsung aktif.`,
        actorId: user._id,
        link: "/super-admin/organizations",
        organizationId: orgId,
      });
    }

    return user._id;
  },
});

