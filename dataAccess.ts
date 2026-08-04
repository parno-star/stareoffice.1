import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  internalQuery,
  action,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { internal, api } from "./_generated/api";
import { requireTenant, getEffectiveScopes } from "./lib/tenant";
import { isAdminRole, isCompanyAdmin } from "./roles";
import { isDataScope, scopeLabels } from "./dataScopes";
import { notifyUser } from "./notifications";

/**
 * Jaminan Kerahasiaan Data — consent-first vendor access.
 *
 * A platform super_admin (the app vendor/owner) can NEVER see a company's data
 * unless that company has approved a time-boxed access grant. This module owns
 * the grant lifecycle and the immutable audit trail. Enforcement lives here and
 * in convex/lib/tenant.ts (requireTenant) + convex/organizations.ts
 * (setViewingOrganization).
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (user.role !== "super_admin") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Super admin only" });
  }
  return user;
}

/**
 * Returns the current ACTIVE grant for a super admin into an organization, or
 * null. Active = status "approved" and not yet expired. Also lazily flips a
 * just-expired grant to "expired" is NOT done here (queries can't write);
 * callers in mutations should use `resolveActiveGrant` to persist expiry.
 */
export async function getActiveGrant(
  ctx: QueryCtx | MutationCtx,
  superAdminId: Id<"users">,
  organizationId: Id<"organizations">,
  now: string = new Date().toISOString(),
): Promise<Doc<"dataAccessGrants"> | null> {
  const grants = await ctx.db
    .query("dataAccessGrants")
    .withIndex("by_superadmin_and_org", (q) =>
      q.eq("superAdminId", superAdminId).eq("organizationId", organizationId),
    )
    .collect();

  for (const g of grants) {
    if (g.status !== "approved") continue;
    if (!g.expiresAt) continue;
    if (g.expiresAt > now) return g;
  }
  return null;
}

/** Write an immutable audit row. */
async function logAudit(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    actor: Doc<"users">;
    action: string;
    grantId?: Id<"dataAccessGrants">;
    detail?: string;
  },
): Promise<void> {
  await ctx.db.insert("dataAccessAudit", {
    organizationId: args.organizationId,
    actorId: args.actor._id,
    actorName: args.actor.name,
    actorRole: args.actor.role,
    action: args.action,
    grantId: args.grantId,
    detail: args.detail,
    occurredAt: new Date().toISOString(),
  });
}

/** Notify every active company admin of the target org. */
async function notifyCompanyAdmins(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    type: string;
    title: string;
    message: string;
    link?: string;
    actorId?: Id<"users">;
  },
): Promise<void> {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", args.organizationId),
    )
    .collect();

  for (const u of admins) {
    if (!isAdminRole(u.role)) continue;
    if (u.role === "super_admin") continue; // never the vendor
    if (u.accountStatus && u.accountStatus !== "active") continue;
    await notifyUser(ctx, {
      userId: u._id,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      actorId: args.actorId,
    });
  }
}

// ─── Super admin (vendor) side ────────────────────────────────────────────────

/**
 * Super admin requests time-boxed access to a company's data. Creates a pending
 * grant and notifies the company's admins. Does NOT grant access.
 */
export const requestAccess = mutation({
  args: {
    organizationId: v.id("organizations"),
    reason: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ grantId: Id<"dataAccessGrants"> }> => {
    const superAdmin = await requireSuperAdmin(ctx);

    const reason = args.reason.trim();
    if (reason.length < 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Alasan akses wajib diisi (minimal 5 karakter).",
      });
    }

    // Validate & de-duplicate the requested data scopes.
    const scopes = Array.from(new Set(args.scopes)).filter(isDataScope);
    if (scopes.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih minimal satu kategori data yang ingin diakses.",
      });
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Organisasi tidak ditemukan",
      });
    }

    // Prevent stacking multiple pending requests for the same org
    const existing = await ctx.db
      .query("dataAccessGrants")
      .withIndex("by_superadmin_and_org", (q) =>
        q
          .eq("superAdminId", superAdmin._id)
          .eq("organizationId", args.organizationId),
      )
      .collect();
    const now = new Date().toISOString();
    const pending = existing.find((g) => g.status === "pending");
    if (pending) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Sudah ada permintaan akses yang menunggu persetujuan.",
      });
    }
    const active = existing.find(
      (g) => g.status === "approved" && g.expiresAt && g.expiresAt > now,
    );
    // A super admin may top up with ADDITIONAL categories while a grant is
    // active. We only reject when every requested category is already covered
    // by an active grant (nothing new to approve).
    if (active) {
      const alreadyGranted = new Set<string>();
      for (const g of existing) {
        if (g.status === "approved" && g.expiresAt && g.expiresAt > now) {
          for (const s of g.scopes ?? []) alreadyGranted.add(s);
        }
      }
      const newScopes = scopes.filter((s) => !alreadyGranted.has(s));
      if (newScopes.length === 0) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Kategori yang dipilih sudah termasuk dalam akses aktif Anda.",
        });
      }
    }

    const grantId = await ctx.db.insert("dataAccessGrants", {
      superAdminId: superAdmin._id,
      superAdminName: superAdmin.name,
      organizationId: args.organizationId,
      reason,
      scopes,
      status: "pending",
      requestedAt: now,
    });

    const scopeText = scopeLabels(scopes);

    await logAudit(ctx, {
      organizationId: args.organizationId,
      actor: superAdmin,
      action: "requested",
      grantId,
      detail: `Kategori data: ${scopeText}. Alasan: ${reason}`,
    });

    await notifyCompanyAdmins(ctx, {
      organizationId: args.organizationId,
      type: "system",
      title: "Permintaan akses data oleh penyedia aplikasi",
      message: `${superAdmin.name ?? "Super Admin"} meminta izin mengakses data perusahaan Anda (${scopeText}). Alasan: ${reason}`,
      link: "/data-privacy",
      actorId: superAdmin._id,
    });

    return { grantId };
  },
});

/**
 * The super admin's own view of their access status for a given org: any
 * pending request and any currently active grant (with expiry).
 */
export const getMyAccessStatus = query({
  args: { organizationId: v.id("organizations") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    pending: Doc<"dataAccessGrants"> | null;
    active: Doc<"dataAccessGrants"> | null;
  }> => {
    const superAdmin = await requireSuperAdmin(ctx);
    const now = new Date().toISOString();

    const grants = await ctx.db
      .query("dataAccessGrants")
      .withIndex("by_superadmin_and_org", (q) =>
        q
          .eq("superAdminId", superAdmin._id)
          .eq("organizationId", args.organizationId),
      )
      .collect();

    const pending = grants.find((g) => g.status === "pending") ?? null;
    const active =
      grants.find(
        (g) => g.status === "approved" && g.expiresAt && g.expiresAt > now,
      ) ?? null;

    return { pending, active };
  },
});

// ─── Company (tenant) side ────────────────────────────────────────────────────

type GrantWithMeta = Doc<"dataAccessGrants"> & { isActive: boolean };

/** Pending access requests awaiting this company's decision. */
export const listPendingRequests = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"dataAccessGrants">>> => {
    const { organizationId, userId } = await requireTenant(ctx);
    if (!organizationId) return [];
    // Consent console is tenant-only: hide from the vendor (super admin) even
    // while they view this org through a grant.
    const me = await ctx.db.get(userId);
    if (!me || !isCompanyAdmin(me.role)) return [];

    return await ctx.db
      .query("dataAccessGrants")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});

/** Currently active (approved, non-expired) vendor access grants. */
export const listActiveGrants = query({
  args: {},
  handler: async (ctx): Promise<Array<GrantWithMeta>> => {
    const { organizationId, userId } = await requireTenant(ctx);
    if (!organizationId) return [];
    const me = await ctx.db.get(userId);
    if (!me || !isCompanyAdmin(me.role)) return [];
    const now = new Date().toISOString();

    const approved = await ctx.db
      .query("dataAccessGrants")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "approved"),
      )
      .order("desc")
      .collect();

    return approved
      .filter((g) => g.expiresAt && g.expiresAt > now)
      .map((g) => ({ ...g, isActive: true }));
  },
});

type AuditRow = Doc<"dataAccessAudit">;

/**
 * Full immutable audit trail of vendor access for this company. Admin-only.
 *
 * Cursor-paginated (best practice for an ever-growing, time-ordered log).
 * Optional server-side filters: date range (indexed) + action type.
 */
export const listAudit = query({
  args: {
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireTenant(ctx);
    if (!organizationId) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const me = await ctx.db.get(userId);
    if (!me || !isCompanyAdmin(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat melihat jejak audit ini.",
      });
    }

    const hasDateRange = Boolean(args.startDate || args.endDate);

    // Use the time-ordered index when a date range is provided (efficient
    // range scan); otherwise fall back to the plain org index.
    const base = hasDateRange
      ? ctx.db
          .query("dataAccessAudit")
          .withIndex("by_org_and_time", (q) => {
            const withOrg = q.eq("organizationId", organizationId);
            if (args.startDate && args.endDate) {
              return withOrg
                .gte("occurredAt", args.startDate)
                .lte("occurredAt", args.endDate);
            }
            if (args.startDate) return withOrg.gte("occurredAt", args.startDate);
            if (args.endDate) return withOrg.lte("occurredAt", args.endDate);
            return withOrg;
          })
      : ctx.db
          .query("dataAccessAudit")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          );

    const filtered = args.action
      ? base.filter((q) => q.eq(q.field("action"), args.action))
      : base;

    const result = await filtered.order("desc").paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page as Array<AuditRow>,
    };
  },
});

/** Company admin approves a pending request with a time limit (hours). */
export const approveRequest = mutation({
  args: {
    grantId: v.id("dataAccessGrants"),
    durationHours: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId, userId } = await requireTenant(ctx);
    const me = await ctx.db.get(userId);
    // Only a genuine company admin may approve — never the platform super admin
    // (the vendor). A super admin viewing this org through an active grant is
    // treated as admin elsewhere, so we must exclude their role explicitly to
    // stop them approving their OWN access request (self-approval).
    if (!organizationId || !me || !isCompanyAdmin(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin perusahaan yang dapat menyetujui akses.",
      });
    }

    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.organizationId !== organizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Permintaan akses tidak ditemukan.",
      });
    }
    if (grant.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan ini sudah tidak menunggu persetujuan.",
      });
    }
    // Belt-and-suspenders: a vendor can never approve their own request.
    if (grant.superAdminId === me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak dapat menyetujui permintaan akses Anda sendiri.",
      });
    }

    const hours = Math.max(1, Math.min(168, Math.round(args.durationHours)));
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + hours * 60 * 60 * 1000,
    ).toISOString();

    await ctx.db.patch(args.grantId, {
      status: "approved",
      decidedAt: now.toISOString(),
      decidedByUserId: me._id,
      decidedByName: me.name,
      durationHours: hours,
      expiresAt,
    });

    await logAudit(ctx, {
      organizationId,
      actor: me,
      action: "approved",
      grantId: args.grantId,
      detail: `Akses disetujui selama ${hours} jam (berakhir ${expiresAt}).`,
    });

    await notifyUser(ctx, {
      userId: grant.superAdminId,
      type: "system",
      title: "Permintaan akses disetujui",
      message: `Akses ke data organisasi disetujui selama ${hours} jam.`,
      actorId: me._id,
    });
  },
});

/** Company admin denies a pending request. */
export const denyRequest = mutation({
  args: {
    grantId: v.id("dataAccessGrants"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId, userId } = await requireTenant(ctx);
    const me = await ctx.db.get(userId);
    if (!organizationId || !me || !isCompanyAdmin(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin perusahaan yang dapat menolak akses.",
      });
    }

    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.organizationId !== organizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Permintaan akses tidak ditemukan.",
      });
    }
    if (grant.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan ini sudah tidak menunggu persetujuan.",
      });
    }

    await ctx.db.patch(args.grantId, {
      status: "denied",
      decidedAt: new Date().toISOString(),
      decidedByUserId: me._id,
      decidedByName: me.name,
    });

    await logAudit(ctx, {
      organizationId,
      actor: me,
      action: "denied",
      grantId: args.grantId,
      detail: args.note?.trim() || undefined,
    });

    await notifyUser(ctx, {
      userId: grant.superAdminId,
      type: "system",
      title: "Permintaan akses ditolak",
      message: "Permintaan akses ke data organisasi ditolak.",
      actorId: me._id,
    });
  },
});

/**
 * The CURRENT viewer's scope restriction, for the frontend banner. Returns
 * `restricted: false` for normal users and unrestricted super admins. When a
 * super admin views a company through a scoped grant, returns the approved
 * scope ids so the UI can tell them exactly what they may access.
 */
export const getMyEffectiveScopes = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ restricted: boolean; scopes: Array<string> }> => {
    const scopes = await getEffectiveScopes(ctx);
    if (scopes === null) return { restricted: false, scopes: [] };
    return { restricted: true, scopes: [...scopes] };
  },
});

/**
 * Tells the frontend whether the current super admin has SELECTED a company to
 * view but does NOT yet have an active access grant for it. In that state the
 * app scopes to empty (no tenant data), so affected pages should show the
 * "Menunggu izin akses dari organisasi ini" notice instead of an empty list.
 *
 * Returns `pendingGrant: false` for normal users, and for super admins who are
 * either viewing platform-wide (no org selected) or already have a live grant.
 */
export const getMyViewingAccessState = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    pendingGrant: boolean;
    organizationId: Id<"organizations"> | null;
    organizationName: string | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { pendingGrant: false, organizationId: null, organizationName: null };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user || user.role !== "super_admin") {
      return { pendingGrant: false, organizationId: null, organizationName: null };
    }

    const viewingId = user.viewingOrganizationId ?? null;
    // No company selected → platform-wide view, nothing pending.
    if (viewingId === null) {
      return { pendingGrant: false, organizationId: null, organizationName: null };
    }

    // A live grant means data is visible; not pending.
    const grant = await getActiveGrant(ctx, user._id, viewingId);
    if (grant) {
      return { pendingGrant: false, organizationId: null, organizationName: null };
    }

    const org = await ctx.db.get(viewingId);
    return {
      pendingGrant: true,
      organizationId: viewingId,
      organizationName: org?.name ?? null,
    };
  },
});

/** Company admin revokes an active grant early. */
export const revokeGrant = mutation({
  args: { grantId: v.id("dataAccessGrants") },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId, userId } = await requireTenant(ctx);
    const me = await ctx.db.get(userId);
    if (!organizationId || !me || !isCompanyAdmin(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin perusahaan yang dapat mencabut akses.",
      });
    }

    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.organizationId !== organizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Akses tidak ditemukan.",
      });
    }
    if (grant.status !== "approved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Akses ini sudah tidak aktif.",
      });
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.grantId, {
      status: "revoked",
      revokedAt: now,
      revokedByUserId: me._id,
    });

    // If the vendor is currently viewing this org, kick them out immediately.
    const vendor = await ctx.db.get(grant.superAdminId);
    if (vendor && vendor.viewingOrganizationId === organizationId) {
      await ctx.db.patch(vendor._id, { viewingOrganizationId: undefined });
    }

    await logAudit(ctx, {
      organizationId,
      actor: me,
      action: "revoked",
      grantId: args.grantId,
      detail: "Akses dicabut oleh perusahaan.",
    });

    await notifyUser(ctx, {
      userId: grant.superAdminId,
      type: "system",
      title: "Akses dicabut",
      message: "Akses Anda ke data organisasi telah dicabut oleh perusahaan.",
      actorId: me._id,
    });
  },
});

// ─── Audit export (CSV) ────────────────────────────────────────────────────

const AUDIT_ACTION_LABELS: Record<string, string> = {
  requested: "Mengajukan permintaan akses",
  approved: "Menyetujui akses",
  denied: "Menolak permintaan akses",
  revoked: "Mencabut akses",
  expired: "Akses berakhir",
  access_started: "Mulai mengakses data",
  access_ended: "Selesai mengakses data",
};

/**
 * Internal: collect all audit rows for the current company matching filters.
 * Used by the CSV export action. Bounded by the export cap.
 */
export const collectAuditForExport = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<AuditRow>> => {
    const base = ctx.db
      .query("dataAccessAudit")
      .withIndex("by_org_and_time", (q) => {
        const withOrg = q.eq("organizationId", args.organizationId);
        if (args.startDate && args.endDate) {
          return withOrg
            .gte("occurredAt", args.startDate)
            .lte("occurredAt", args.endDate);
        }
        if (args.startDate) return withOrg.gte("occurredAt", args.startDate);
        if (args.endDate) return withOrg.lte("occurredAt", args.endDate);
        return withOrg;
      });
    const filtered = args.action
      ? base.filter((q) => q.eq(q.field("action"), args.action))
      : base;
    // Cap export size to stay within function read limits.
    return await filtered.order("desc").take(5000);
  },
});

/**
 * Build a downloadable CSV of the audit trail (admin-only). Applies the same
 * optional filters as the on-screen list.
 */
export const exportAuditCsv = action({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ url: string | null; filename: string; rowCount: number }> => {
    // Reuse the guarded query to enforce admin-only access + tenant scoping,
    // and to derive the org id from a matching row.
    const first = await ctx.runQuery(api.dataAccess.listAudit, {
      paginationOpts: { numItems: 1, cursor: null },
      startDate: args.startDate,
      endDate: args.endDate,
      action: args.action,
    });
    const orgId = first.page[0]?.organizationId;
    // No matching rows (for this filter) means an empty export.
    const rows =
      orgId !== undefined
        ? await ctx.runQuery(internal.dataAccess.collectAuditForExport, {
            organizationId: orgId,
            startDate: args.startDate,
            endDate: args.endDate,
            action: args.action,
          })
        : [];

    const Papa = (await import("papaparse")).default;
    const formatted = rows.map((row) => ({
      Waktu: row.occurredAt,
      Pengguna: row.actorName ?? "Pengguna",
      Peran: row.actorRole ?? "",
      Aktivitas: AUDIT_ACTION_LABELS[row.action] ?? row.action,
      Keterangan: row.detail ?? "",
    }));
    const csv = "\ufeff" + Papa.unparse(formatted, { header: true });

    const storageId = await ctx.storage.store(
      new Blob([csv], { type: "text/csv" }),
    );
    const url = await ctx.storage.getUrl(storageId);
    return {
      url,
      filename: `jejak-audit-akses-data-${new Date().toISOString().slice(0, 10)}.csv`,
      rowCount: rows.length,
    };
  },
});
