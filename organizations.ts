import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { isAdminRole } from "./roles";
import { generateInviteCode } from "./lib/inviteCode";
import { resetOrgLimitAlerts } from "./lib/planLimits";
import { recomputeOrgStorageBytes, bytesToMb } from "./lib/planStorage";
import { getActiveGrant } from "./dataAccess";
import { isCountableEmployee } from "./lib/countableUsers";

/** Asserts the caller is a super_admin and returns their userId. */
async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const { userId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
  if (!isSuperAdmin) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Super admin only" });
  }
  return userId;
}

/** Generates an invite code that is unique across all organizations. */
async function generateUniqueInviteCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateInviteCode();
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", code))
      .first();
    if (!existing) return code;
  }
  // Extremely unlikely fallback: append time-based suffix
  return generateInviteCode() + Date.now().toString(36).toUpperCase().slice(-2);
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get the current user's organization.
 *  Returns null when the user has no org assigned (instead of throwing)
 *  so that frontend guards (NoOrganizationGuard) can render the appropriate screen.
 *  For super admins, honors their selected "viewing organization" so the whole
 *  UI (header, sidebar, pages) reflects the org they picked. */
export const getMyOrganization = query({
  args: {},
  handler: async (ctx): Promise<Doc<"organizations"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    // Super admins can view a chosen organization. When none is selected,
    // they see all organizations (null) instead of falling back to their own.
    if (user.role === "super_admin") {
      if (!user.viewingOrganizationId) return null;
      return await ctx.db.get(user.viewingOrganizationId);
    }

    if (!user.organizationId) return null;
    return await ctx.db.get(user.organizationId);
  },
});

/**
 * Search organizations for the super-admin organization switcher.
 * Returns at most `limit` (default 8) matches so the dropdown stays fast even
 * with thousands of organizations. When search is empty, returns the most
 * recent active organizations.
 */
export const searchForSwitcher = query({
  args: { search: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ _id: Id<"organizations">; name: string; isActive: boolean; userCount: number; isSampleOrg: boolean }>
  > => {
    await requireSuperAdmin(ctx);

    const term = (args.search ?? "").trim().toLowerCase();
    const LIMIT = 8;

    // Precompute user counts per org (bounded by total users)
    const allUsers = await ctx.db.query("users").collect();
    const counts: Record<string, number> = {};
    for (const u of allUsers) {
      if (u.organizationId) {
        counts[u.organizationId] = (counts[u.organizationId] ?? 0) + 1;
      }
    }

    const matches: Array<{
      _id: Id<"organizations">;
      name: string;
      isActive: boolean;
      userCount: number;
      isSampleOrg: boolean;
    }> = [];

    // Always include the demo/sample org so it stays available as the default
    // target even when there are many organizations (the scan below stops early).
    // Recognise it by the isSampleOrg flag OR by the "PT Contoh Uji Coba" name
    // prefix, so older demo orgs created before the flag existed still pin.
    const SAMPLE_NAME_PREFIX = "pt contoh uji coba";
    const isSample = (o: { name: string; isSampleOrg?: boolean }): boolean =>
      o.isSampleOrg === true ||
      o.name.toLowerCase().startsWith(SAMPLE_NAME_PREFIX);

    const allOrgsForSample = await ctx.db.query("organizations").collect();
    const sampleOrg =
      allOrgsForSample.find((o) => o.isSampleOrg === true) ??
      allOrgsForSample.find((o) =>
        o.name.toLowerCase().startsWith(SAMPLE_NAME_PREFIX),
      ) ??
      null;
    const includedIds = new Set<string>();
    if (
      sampleOrg &&
      (term.length === 0 || sampleOrg.name.toLowerCase().includes(term))
    ) {
      matches.push({
        _id: sampleOrg._id,
        name: sampleOrg.name,
        isActive: sampleOrg.isActive,
        userCount: counts[sampleOrg._id] ?? 0,
        isSampleOrg: true,
      });
      includedIds.add(sampleOrg._id);
    }

    for await (const org of ctx.db.query("organizations")) {
      if (includedIds.has(org._id)) continue;
      if (term.length > 0 && !org.name.toLowerCase().includes(term)) continue;
      matches.push({
        _id: org._id,
        name: org.name,
        isActive: org.isActive,
        userCount: counts[org._id] ?? 0,
        isSampleOrg: isSample(org),
      });
      if (matches.length >= LIMIT) break;
    }

    // Sort alphabetically, but always pin the sample/demo org to the very top so
    // it acts as the default demo target for super admins.
    matches.sort((a, b) => {
      if (a.isSampleOrg !== b.isSampleOrg) return a.isSampleOrg ? -1 : 1;
      return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
    });

    return matches;
  },
});

/**
 * Returns the demo/sample organization's id and name, if one exists, so the
 * super-admin switcher can show it as the default label when no organization is
 * being viewed. Recognises it by the isSampleOrg flag OR the "PT Contoh Uji
 * Coba" name prefix (for demo orgs created before the flag existed).
 * super_admin only.
 */
export const getSampleOrgForSwitcher = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ _id: Id<"organizations">; name: string } | null> => {
    await requireSuperAdmin(ctx);
    const SAMPLE_NAME_PREFIX = "pt contoh uji coba";
    const all = await ctx.db.query("organizations").collect();
    const sample =
      all.find((o) => o.isSampleOrg === true) ??
      all.find((o) => o.name.toLowerCase().startsWith(SAMPLE_NAME_PREFIX)) ??
      null;
    if (!sample) return null;
    return { _id: sample._id, name: sample.name };
  },
});

/**
 * Sets (or clears) the organization a super admin is currently viewing.
 * Pass `organizationId: null` to return to the platform-wide view.
 * super_admin only.
 */
export const setViewingOrganization = mutation({
  args: { organizationId: v.union(v.id("organizations"), v.null()) },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireSuperAdmin(ctx);
    const superAdmin = await ctx.db.get(userId);
    if (!superAdmin) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const previousOrgId = superAdmin.viewingOrganizationId ?? null;

    // Leaving a company (or going back to platform-wide view): log access_ended
    // for the company we were in.
    if (args.organizationId === null) {
      if (previousOrgId) {
        await ctx.db.insert("dataAccessAudit", {
          organizationId: previousOrgId,
          actorId: superAdmin._id,
          actorName: superAdmin.name,
          actorRole: superAdmin.role,
          action: "access_ended",
          detail: "Super admin keluar dari data organisasi.",
          occurredAt: new Date().toISOString(),
        });
      }
      await ctx.db.patch(userId, { viewingOrganizationId: undefined });
      return;
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }

    // CONSENT-FIRST GATE: a super admin may only enter a company's data when
    // that company has approved a time-boxed access grant that has not expired.
    // Without it, entry is blocked — no silent access is possible.
    const grant = await getActiveGrant(ctx, userId, args.organizationId);
    if (!grant) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Akses ke data organisasi ini belum diizinkan. Ajukan permintaan akses dan tunggu persetujuan dari perusahaan.",
      });
    }

    // Log leaving the previous org, if any, before switching.
    if (previousOrgId && previousOrgId !== args.organizationId) {
      await ctx.db.insert("dataAccessAudit", {
        organizationId: previousOrgId,
        actorId: superAdmin._id,
        actorName: superAdmin.name,
        actorRole: superAdmin.role,
        action: "access_ended",
        detail: "Super admin berpindah organisasi.",
        occurredAt: new Date().toISOString(),
      });
    }

    await ctx.db.patch(userId, { viewingOrganizationId: args.organizationId });

    // Log the start of an access session into this company's data.
    await ctx.db.insert("dataAccessAudit", {
      organizationId: args.organizationId,
      actorId: superAdmin._id,
      actorName: superAdmin.name,
      actorRole: superAdmin.role,
      action: "access_started",
      grantId: grant._id,
      detail: `Alasan: ${grant.reason}`,
      occurredAt: new Date().toISOString(),
    });
  },
});

/** List all organizations — super_admin only */
export const listAll = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Doc<"organizations">[]> => {
    await requireSuperAdmin(ctx);
    const orgs = await ctx.db.query("organizations").collect();
    if (args.includeInactive) return orgs;
    return orgs.filter((o) => o.isActive);
  },
});

/** Get organization by slug */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<Doc<"organizations"> | null> => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

/** Get organization by id */
export const getById = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<Doc<"organizations"> | null> => {
    return await ctx.db.get(args.id);
  },
});

/** Count users per organization — super_admin only */
export const getUserCounts = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    await requireSuperAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const counts: Record<string, number> = {};
    for (const u of users) {
      // Hitung hanya AKUN LOGIN ASLI. Record direktori "placeholder" (karyawan
      // yang didaftarkan admin tapi belum ditautkan ke login) dikecualikan agar
      // jumlah pengguna per organisasi tidak menggelembung.
      if ((u.tokenIdentifier ?? "").startsWith("placeholder:")) continue;
      // Akun uji coba dan super admin bukan pengguna nyata organisasi.
      if (!isCountableEmployee(u)) continue;
      if (u.organizationId) {
        counts[u.organizationId] = (counts[u.organizationId] ?? 0) + 1;
      }
    }
    return counts;
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Create a new organization — super_admin only */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    plan: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    maxSeats: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"organizations">> => {
    await requireSuperAdmin(ctx);

    // Validate slug uniqueness
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "Slug already taken" });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(args.slug)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Slug may only contain lowercase letters, numbers, and hyphens",
      });
    }

    return await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      logoUrl: args.logoUrl,
      plan: args.plan ?? "free",
      isActive: true,
      createdAt: new Date().toISOString(),
      address: args.address,
      phone: args.phone,
      website: args.website,
      maxSeats: args.maxSeats,
    });
  },
});

/** Update an organization — super_admin only */
export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    plan: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    maxSeats: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.id);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });

    // If slug is being changed, validate uniqueness
    if (args.slug && args.slug !== org.slug) {
      if (!/^[a-z0-9-]+$/.test(args.slug)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Slug may only contain lowercase letters, numbers, and hyphens",
        });
      }
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
        .unique();
      if (existing) {
        throw new ConvexError({ code: "CONFLICT", message: "Slug already taken" });
      }
    }

    const { id, ...fields } = args;
    await ctx.db.patch(id, { ...fields, updatedAt: new Date().toISOString() });
  },
});

/**
 * Change an organization's membership plan — super_admin only.
 * Updates both the membershipPlanId reference and the legacy `plan` slug so
 * usage/limits and all displays reflect the new plan immediately.
 */
export const setMembershipPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipPlanId: v.union(v.id("membershipPlans"), v.null()),
  },
  handler: async (ctx, args): Promise<void> => {
    const callerId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }

    // Clearing the plan
    if (args.membershipPlanId === null) {
      await ctx.db.patch(args.organizationId, {
        membershipPlanId: undefined,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const plan = await ctx.db.get(args.membershipPlanId);
    if (!plan) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Paket tidak ditemukan" });
    }

    await ctx.db.patch(args.organizationId, {
      membershipPlanId: plan._id,
      plan: plan.slug,
      updatedAt: new Date().toISOString(),
    });

    // Reset graduated limit alerts so warnings/blocks re-arm against the new
    // (typically larger) limits — this auto-unblocks "add" actions on upgrade.
    await resetOrgLimitAlerts(ctx, args.organizationId);

    // Notify the org admin who registered it (if any) about the plan change
    if (org.createdBy) {
      await ctx.db.insert("notifications", {
        userId: org.createdBy,
        type: "plan_changed",
        title: "Paket Diperbarui",
        message: `Paket organisasi "${org.name}" diubah menjadi ${plan.name}.`,
        actorId: callerId,
        link: "/dashboard",
        organizationId: args.organizationId,
      });
    }
  },
});

/**
 * Super admin: recompute the storage usage counter for one organization (or all
 * organizations when no id is given). Backfills the denormalized `orgStorageUsage`
 * counter by scanning file-bearing tables. Safe to run repeatedly.
 */
export const recomputeStorageUsage = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<{ organizationId: Id<"organizations">; name: string; storageMb: number }>> => {
    await requireSuperAdmin(ctx);

    const targets: Array<Id<"organizations">> = [];
    if (args.organizationId) {
      targets.push(args.organizationId);
    } else {
      const orgs = await ctx.db.query("organizations").collect();
      for (const o of orgs) targets.push(o._id);
    }

    const out: Array<{ organizationId: Id<"organizations">; name: string; storageMb: number }> = [];
    for (const orgId of targets) {
      const org = await ctx.db.get(orgId);
      if (!org) continue;
      const bytes = await recomputeOrgStorageBytes(ctx, orgId);
      out.push({ organizationId: orgId, name: org.name, storageMb: bytesToMb(bytes) });
    }
    return out;
  },
});

/** Assign a user to an organization — super_admin only */
export const assignUser = mutation({  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const org = await ctx.db.get(args.organizationId);
    if (!org || !org.isActive) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found or inactive" });
    }

    await ctx.db.patch(args.userId, { organizationId: args.organizationId });
  },
});

/** Remove a user from their organization — super_admin only */
export const removeUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch(args.userId, { organizationId: undefined });
  },
});

/** Deactivate an organization — super_admin only */
export const deactivate = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch(args.id, { isActive: false, updatedAt: new Date().toISOString() });
  },
});

/** Permanently delete an organization — super_admin only */
export const deleteOrganization = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<void> => {
    await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.id);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });

    // Detach any super admin currently "viewing" this org so they fall back to
    // the platform-wide view instead of a dangling reference.
    const viewers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("viewingOrganizationId"), args.id))
      .collect();
    for (const viewer of viewers) {
      await ctx.db.patch(viewer._id, { viewingOrganizationId: undefined });
    }

    // Permanently purge ALL of this org's data (including its users) across every
    // org-scoped table, then delete the org itself. Runs in safe background
    // batches so it never exceeds a single transaction's limits. This keeps the
    // database clean and every platform-wide count accurate.
    await ctx.scheduler.runAfter(0, internal.orgPurge.purgeOrganizationBatch, {
      organizationId: args.id,
      tableIndex: 0,
    });
  },
});

// ─── Self-service registration approval (super_admin) ─────────────────────────

/**
 * List organizations that were self-registered and are awaiting super admin
 * review (approvalStatus === "pending"). Includes the registrant's name/email
 * and the selected plan so the reviewer has full context.
 */
export const listPendingRegistrations = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<
      Doc<"organizations"> & {
        registrantName: string | null;
        registrantEmail: string | null;
        planName: string | null;
      }
    >
  > => {
    await requireSuperAdmin(ctx);

    const pending = await ctx.db
      .query("organizations")
      .withIndex("by_approval_status", (q) => q.eq("approvalStatus", "pending"))
      .collect();

    // Newest submissions first
    pending.sort((a, b) =>
      (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""),
    );

    const enriched = await Promise.all(
      pending.map(async (org) => {
        const registrant = org.createdBy ? await ctx.db.get(org.createdBy) : null;
        const plan = org.membershipPlanId
          ? await ctx.db.get(org.membershipPlanId)
          : null;
        return {
          ...org,
          registrantName: registrant?.name ?? null,
          registrantEmail: registrant?.email ?? null,
          planName: plan?.name ?? null,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Approve a pending self-service registration — super_admin only.
 * Activates the organization, marks it approved, and activates the registrant
 * (org admin) account so they gain immediate access.
 */
export const approveRegistration = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<void> => {
    const callerId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.id);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }
    if (org.approvalStatus !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pendaftaran ini sudah ditinjau sebelumnya",
      });
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.id, {
      isActive: true,
      approvalStatus: "approved",
      reviewedBy: callerId,
      reviewedAt: now,
      rejectionReason: undefined,
      updatedAt: now,
    });

    // Activate the registrant (org admin) so they can start using the app
    if (org.createdBy) {
      const registrant = await ctx.db.get(org.createdBy);
      if (registrant) {
        await ctx.db.patch(registrant._id, { accountStatus: "active" });
        await ctx.db.insert("userAuditLog", {
          targetUserId: registrant._id,
          action: "role_approved",
          detail: `Pendaftaran organisasi "${org.name}" disetujui Super Admin`,
          occurredAt: now,
        });
      }

      await ctx.db.insert("notifications", {
        userId: org.createdBy,
        type: "org_activated",
        title: "Pendaftaran Disetujui",
        message: `Organisasi "${org.name}" telah disetujui dan aktif. Selamat datang!`,
        actorId: callerId,
        link: "/dashboard",
        organizationId: args.id,
      });
    }
  },
});

/**
 * Reject a pending self-service registration — super_admin only.
 * Keeps the organization inactive, records the reason, and marks the
 * registrant's account as rejected.
 */
export const rejectRegistration = mutation({
  args: { id: v.id("organizations"), reason: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const callerId = await requireSuperAdmin(ctx);

    const reason = args.reason.trim();
    if (reason.length < 3) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Mohon cantumkan alasan penolakan",
      });
    }

    const org = await ctx.db.get(args.id);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });
    }
    if (org.approvalStatus !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pendaftaran ini sudah ditinjau sebelumnya",
      });
    }

    const now = new Date().toISOString();

    await ctx.db.patch(args.id, {
      isActive: false,
      approvalStatus: "rejected",
      reviewedBy: callerId,
      reviewedAt: now,
      rejectionReason: reason,
      updatedAt: now,
    });

    if (org.createdBy) {
      const registrant = await ctx.db.get(org.createdBy);
      if (registrant) {
        await ctx.db.patch(registrant._id, { accountStatus: "rejected" });
        await ctx.db.insert("userAuditLog", {
          targetUserId: registrant._id,
          action: "role_rejected",
          detail: `Pendaftaran organisasi "${org.name}" ditolak: ${reason}`,
          occurredAt: now,
        });
      }

      await ctx.db.insert("notifications", {
        userId: org.createdBy,
        type: "org_rejected",
        title: "Pendaftaran Ditolak",
        message: `Pendaftaran organisasi "${org.name}" ditolak. Alasan: ${reason}`,
        actorId: callerId,
        link: "/home",
        organizationId: args.id,
      });
    }
  },
});

/** Activate a pending organization — super_admin only */
export const activate = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args): Promise<void> => {
    const callerId = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.id);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });

    await ctx.db.patch(args.id, { isActive: true, updatedAt: new Date().toISOString() });

    // Notify the user who created this org (if any)
    if (org.createdBy) {
      await ctx.db.insert("notifications", {
        userId: org.createdBy,
        type: "org_activated",
        title: "Organisasi Disetujui",
        message: `Organisasi "${org.name}" telah diaktifkan oleh Super Admin.`,
        actorId: callerId,
        link: "/dashboard",
        organizationId: args.id,
      });
    }
  },
});

// ─── Invite codes (org admin self-service) ─────────────────────────────────────

/**
 * Returns the caller's organization invite code, generating one lazily if the
 * org does not have a code yet. Admins/super_admins only.
 */
export const getMyInviteCode = mutation({
  args: {},
  handler: async (ctx): Promise<{ code: string; orgName: string }> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Organisasi belum ditentukan" });
    }

    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat melihat kode undangan" });
    }

    const org = await ctx.db.get(organizationId);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organisasi tidak ditemukan" });

    let code = org.inviteCode;
    if (!code) {
      code = await generateUniqueInviteCode(ctx);
      await ctx.db.patch(organizationId, { inviteCode: code, updatedAt: new Date().toISOString() });
    }

    return { code, orgName: org.name };
  },
});

/** Regenerates the caller's organization invite code. Admins/super_admins only. */
export const regenerateInviteCode = mutation({
  args: {},
  handler: async (ctx): Promise<{ code: string }> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Organisasi belum ditentukan" });
    }

    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengubah kode undangan" });
    }

    const code = await generateUniqueInviteCode(ctx);
    await ctx.db.patch(organizationId, { inviteCode: code, updatedAt: new Date().toISOString() });
    return { code };
  },
});
