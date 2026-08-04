import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import {
  DEFAULT_ROLE_MENUS,
  MENU_ITEMS,
  MENU_KEYS,
  ROLE_VALUES,
  SUPER_ADMIN_ONLY_MENUS,
  isAdminRole,
  isSuperAdminRole,
  normalizeRole,
  type MenuKey,
  type Role,
} from "./roles";
import { filterByPlan, getBlockedMenuKeys } from "./featureGate";
import { getEffectiveScopes, requireTenant } from "./lib/tenant";
import { getUnlockedMenuKeys } from "./lib/addons";
import { applyMenuOverrides, getMenuOverrides } from "./lib/menuOverrides";
import {
  applyTrialMenuFilter,
  getTrialAllowedMenuSet,
  getTrialSettings,
} from "./lib/trialAccess";
import { scopeForMenu, type DataScope } from "./dataScopes";

// Core navigation menus that must never be hidden by a per-tenant override.
const ALWAYS_ON_MENU_SET = new Set<MenuKey>(
  MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key),
);

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  // Pakai organisasi efektif (tenant terpilih untuk super admin).
  const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { ...user, organizationId: organizationId ?? undefined };
}

async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message:
        "Hanya Administrator atau Super Admin yang dapat mengakses pengaturan ini",
    });
  }
  return user;
}

// Public: list all users in the same organization with role metadata.
export const listUsersForSettings = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<Doc<"users">>> => {
    const me = await requireAdmin(ctx);
    const search = args.search?.trim().toLowerCase() ?? "";

    const isSuperAdmin = isSuperAdminRole(me.role);

    let users: Array<Doc<"users">>;
    if (isSuperAdmin) {
      // Pengaturan Pengguna is ALWAYS scoped to a single organization, even for
      // super admins. When they have "Semua Organisasi" selected in the top
      // switcher, we fall back to their own home organization instead of showing
      // every org — this avoids conflicts with each organization's own admin.
      const scopeOrgId = me.viewingOrganizationId ?? me.organizationId ?? null;
      if (!scopeOrgId) return [];
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", scopeOrgId),
        )
        .collect();
    } else {
      // Regular admin only sees users in their own organization
      const orgId = me.organizationId;
      if (!orgId) return [];
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
      // Exclude super_admin accounts from non-super-admin view
      users = users.filter((u) => !isSuperAdminRole(u.role));
    }

    const filtered = !search
      ? users
      : users.filter(
          (u) =>
            (u.name ?? "").toLowerCase().includes(search) ||
            (u.email ?? "").toLowerCase().includes(search) ||
            (u.department ?? "").toLowerCase().includes(search) ||
            (u.jobTitle ?? "").toLowerCase().includes(search),
        );
    filtered.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "id", { sensitivity: "base" }),
    );
    return filtered;
  },
});

// Admin/Super admin updates a user's role. Admins cannot grant or revoke
// Super Admin status - only other Super Admins can do that.
// Enforces single-admin-per-org rule: only super_admin can directly assign "admin" role.
// Regular admins must use transferAdmin mutation instead.
export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const me = await requireAdmin(ctx);
    const meIsSuper = isSuperAdminRole(me.role);

    const allowed = (ROLE_VALUES as ReadonlyArray<string>).includes(args.role);
    if (!allowed) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Peran tidak valid",
      });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      });
    }

    // Tenant isolation: non-super-admin can only modify users in their own org
    if (!meIsSuper) {
      if (!me.organizationId || target.organizationId !== me.organizationId) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Anda tidak memiliki akses ke pengguna ini",
        });
      }
      // Non-super-admin cannot touch super_admin accounts
      if (isSuperAdminRole(target.role)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Anda tidak memiliki akses ke pengguna ini",
        });
      }
    }

    const currentRole = normalizeRole(target.role);

    // Block assigning super_admin role — only platform owner can have it
    if (args.role === "super_admin" && target._id !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Role Super Admin hanya dapat dimiliki oleh pemilik platform. Gunakan role Administrator sebagai gantinya.",
      });
    }

    // Only super admins may promote/demote Super Admin role
    if (
      !meIsSuper &&
      (currentRole === "super_admin" || args.role === "super_admin")
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat mengubah peran Super Admin",
      });
    }

    // Enforce single admin per organization:
    // Non-super-admin cannot directly assign "admin" role — must use transferAdmin
    if (args.role === "admin" && !meIsSuper) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Gunakan fitur 'Transfer Admin' untuk mengalihkan peran Administrator ke pengguna lain.",
      });
    }

    // Super admin assigning admin role: check no existing admin in that org
    if (args.role === "admin" && meIsSuper) {
      const orgId = target.organizationId;
      if (orgId) {
        const orgUsers = await ctx.db
          .query("users")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .collect();
        const existingAdmin = orgUsers.find(
          (u) => normalizeRole(u.role) === "admin" && u._id !== target._id,
        );
        if (existingAdmin) {
          throw new ConvexError({
            code: "CONFLICT",
            message: `Organisasi ini sudah memiliki Administrator (${existingAdmin.name ?? existingAdmin.email ?? "unknown"}). Hapus admin lama terlebih dahulu.`,
          });
        }
      }
    }

    // Prevent removing the last super admin
    if (currentRole === "super_admin" && args.role !== "super_admin") {
      const supers = (await ctx.db.query("users").collect()).filter(
        (u) => normalizeRole(u.role) === "super_admin",
      );
      if (supers.length <= 1) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message:
            "Tidak dapat menurunkan Super Admin terakhir. Tetapkan Super Admin lain terlebih dahulu.",
        });
      }
      if (target._id === me._id && supers.length <= 1) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message:
            "Tidak dapat menurunkan diri sendiri sebagai Super Admin terakhir",
        });
      }
    }

    await ctx.db.patch(args.userId, { role: args.role });
    return args.userId;
  },
});

/**
 * Transfer admin role to another user in the same organization.
 * The current admin becomes the specified `newRoleForMe` (defaults to "employee").
 * The target user becomes "admin".
 * Only the current admin of the organization can call this.
 */
export const transferAdmin = mutation({
  args: {
    targetUserId: v.id("users"),
    newRoleForMe: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ oldAdmin: Id<"users">; newAdmin: Id<"users"> }> => {
    const me = await requireAdmin(ctx);

    // Only admin (not super_admin) uses this — super_admin uses setUserRole directly
    if (normalizeRole(me.role) !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Administrator yang dapat mengalihkan peran ini.",
      });
    }

    if (!me.organizationId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Anda belum tergabung dalam organisasi.",
      });
    }

    const target = await ctx.db.get(args.targetUserId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna target tidak ditemukan.",
      });
    }

    // Must be same org
    if (target.organizationId !== me.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Pengguna target bukan anggota organisasi Anda.",
      });
    }

    // Cannot transfer to self
    if (target._id === me._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak dapat mengalihkan peran ke diri sendiri.",
      });
    }

    // Cannot transfer to super_admin
    if (isSuperAdminRole(target.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak dapat mengalihkan peran ke akun Super Admin.",
      });
    }

    // Determine the new role for the old admin
    const fallbackRole = args.newRoleForMe ?? "employee";
    if (
      !(ROLE_VALUES as ReadonlyArray<string>).includes(fallbackRole) ||
      fallbackRole === "admin" ||
      fallbackRole === "super_admin"
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Peran pengganti tidak valid. Pilih peran selain Administrator dan Super Admin.",
      });
    }

    // Execute the transfer atomically
    await ctx.db.patch(me._id, { role: fallbackRole });
    await ctx.db.patch(target._id, { role: "admin" });

    return { oldAdmin: me._id, newAdmin: target._id };
  },
});

// Shared logic: the set of menu keys a given user may see/configure in the
// "Akses Menu per Peran" screen. Super Admin gets everything; a company admin
// gets every menu except platform-owner-only ones and menus their org's
// plan/trial/add-ons/overrides do not currently grant.
async function computeConfigurableMenuKeys(
  ctx: QueryCtx | MutationCtx,
  me: Doc<"users">,
): Promise<Array<MenuKey>> {
  if (isSuperAdminRole(me.role)) {
    return [...MENU_KEYS];
  }

  const superAdminOnly = new Set<MenuKey>(SUPER_ADMIN_ONLY_MENUS);
  let available = MENU_KEYS.filter((m) => !superAdminOnly.has(m));

  const orgId = me.organizationId;
  if (!orgId) return available;

  const org = await ctx.db.get(orgId);
  if (!org) return available;

  const alwaysOn = new Set<MenuKey>(
    MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key),
  );

  // Restrict to the menus the plan actually enables (add-ons re-open some).
  if (org.membershipPlanId) {
    const plan = await ctx.db.get(org.membershipPlanId);
    if (plan && plan.disabledFeatures.length > 0) {
      const unlocked = await getUnlockedMenuKeys(ctx, orgId);
      const blocked = getBlockedMenuKeys(plan.disabledFeatures, unlocked);
      available = available.filter((m) => !blocked.has(m));
    }
  }

  // While on trial, restrict to the trial's active menu set (plus always-on).
  if (org.isTrial) {
    const trial = await getTrialSettings(ctx);
    const trialAllowed = getTrialAllowedMenuSet(trial.activeMenus);
    available = available.filter((m) => alwaysOn.has(m) || trialAllowed.has(m));
  }

  // Apply the super admin's per-tenant on/off overrides as the final gate.
  const overrides = await getMenuOverrides(ctx, orgId);
  if (overrides.on.size > 0 || overrides.off.size > 0) {
    const set = new Set<MenuKey>(available);
    for (const key of overrides.on) {
      // Never re-introduce a platform-owner-only menu via an override.
      if (!superAdminOnly.has(key)) set.add(key);
    }
    for (const key of overrides.off) {
      if (alwaysOn.has(key)) continue;
      set.delete(key);
    }
    available = MENU_KEYS.filter((m) => set.has(m));
  }

  return available;
}

// Return the set of menu keys that should appear in the "Akses Menu per Peran"
// configuration screen for the CURRENT user.
//
// - Super Admin: every menu (they manage the whole platform).
// - Company Administrator: every menu EXCEPT platform-owner-only menus
//   (Promo & Upgrade, Pengaturan Paket, Pemantauan Keanggotaan) and any menu
//   that is not currently active for their organization's plan/trial/add-ons.
//   In other words, an org admin only configures the menus their organization
//   has actually been granted.
export const getConfigurableMenuKeys = query({
  args: {},
  handler: async (ctx): Promise<Array<MenuKey>> => {
    const me = await requireAdmin(ctx);
    return await computeConfigurableMenuKeys(ctx, me);
  },
});

export type RoleMenuSetting = {
  role: Role;
  allowedMenus: Array<MenuKey>;
  isCustom: boolean; // true if there is an override row; false = using defaults
  updatedAt?: string;
  updatedByName?: string;
};

// Return menu settings for every role. Admin or Super admin.
export const getAllRoleMenus = query({
  args: {},
  handler: async (ctx): Promise<Array<RoleMenuSetting>> => {
    await requireAdmin(ctx);
    const overrides = await ctx.db.query("rolePermissions").collect();
    const overrideMap = new Map<string, Doc<"rolePermissions">>();
    for (const o of overrides) overrideMap.set(o.role, o);

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      let u = userCache.get(id);
      if (u === undefined) {
        u = await ctx.db.get(id);
        userCache.set(id, u);
      }
      return u;
    };

    const results: Array<RoleMenuSetting> = [];
    for (const role of ROLE_VALUES) {
      const override = overrideMap.get(role);
      if (override) {
        const updater = await getUser(override.updatedBy);
        // Only keep valid menu keys (in case schema shifted)
        const validMenus = override.allowedMenus.filter((m) =>
          (MENU_KEYS as ReadonlyArray<string>).includes(m),
        );
        results.push({
          role,
          allowedMenus: validMenus as Array<MenuKey>,
          isCustom: true,
          updatedAt: override.updatedAt,
          updatedByName: updater?.name,
        });
      } else {
        results.push({
          role,
          allowedMenus: [...DEFAULT_ROLE_MENUS[role]],
          isCustom: false,
        });
      }
    }
    return results;
  },
});

// Get the menus allowed for the current user. Any authenticated user can call.
// Used by the frontend to build the sidebar. Super admin always sees all.
export const getMyAllowedMenus = query({
  args: {},
  handler: async (ctx): Promise<Array<MenuKey>> => {
    let userId: Id<"users">;
    try {
      ({ userId } = await requireTenant(ctx, { allowSuperAdmin: true }));
    } catch {
      return [];
    }
    const user = await ctx.db.get(userId);
    if (!user) return [];

    const role = normalizeRole(user.role);
    if (role === "super_admin") {
      // The "Privasi & Akses Data" console is a TENANT-side consent control:
      // it lists a company's pending vendor requests and holds the approve/deny
      // buttons. The platform super admin is the vendor here, so they must never
      // see it — otherwise, while viewing a company through an active grant, they
      // could approve their own top-up requests. Always hide it for super admins.
      const hideForSuperAdmin = (menu: MenuKey) => menu !== "data_privacy";

      // A super admin viewing a company through a SCOPED grant only sees the
      // menus in the approved data categories (plus always-general menus like
      // dashboard, notifications, chatbot). Outside a scoped grant (platform view
      // or legacy full-access grant), getEffectiveScopes returns null and they
      // see everything (minus the tenant-only privacy console).
      const scopes = await getEffectiveScopes(ctx);
      if (scopes === null) {
        return MENU_KEYS.filter(hideForSuperAdmin);
      }
      const allowed = new Set<DataScope>(scopes);
      return MENU_KEYS.filter((menu) => {
        if (!hideForSuperAdmin(menu)) return false;
        const menuScope = scopeForMenu(menu);
        // General menus (no scope) stay visible so the vendor can navigate.
        if (menuScope === null) return true;
        return allowed.has(menuScope);
      });
    }

    const override = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("role", role))
      .unique();

    const roleMenus = override
      ? (override.allowedMenus.filter((m) =>
          (MENU_KEYS as ReadonlyArray<string>).includes(m),
        ) as MenuKey[])
      : ([...DEFAULT_ROLE_MENUS[role]] as MenuKey[]);

    // ── Plan-based feature gating ──
    // If the user's organisation has a membership plan, further restrict
    // menus by the plan's disabledFeatures list.
    let resolved = roleMenus;
    if (user.organizationId) {
      const org = await ctx.db.get(user.organizationId);
      if (org?.membershipPlanId) {
        const plan = await ctx.db.get(org.membershipPlanId);
        if (plan && plan.disabledFeatures.length > 0) {
          const unlocked = await getUnlockedMenuKeys(ctx, user.organizationId);
          resolved = filterByPlan(roleMenus, plan.disabledFeatures, unlocked);
        }
      }

      // ── Trial feature gating ──
      // While an org is on trial, restrict menus to the trial's active feature
      // set (plus always-on core menus), regardless of the chosen plan.
      if (org?.isTrial) {
        const trial = await getTrialSettings(ctx);
        resolved = applyTrialMenuFilter(resolved, trial.activeMenus);
      }

      // ── Per-tenant menu overrides (final gate) ──
      // Super admin can force specific menus on/off for this org only.
      const overrides = await getMenuOverrides(ctx, user.organizationId);
      if (overrides.on.size > 0 || overrides.off.size > 0) {
        resolved = applyMenuOverrides(resolved, overrides, ALWAYS_ON_MENU_SET);
      }
    }

    // ── Locked core menus (always-on) ──
    // A handful of core menus (Beranda, Dashboard, Data Profil Saya,
    // Notifikasi, Asisten AI, Manajemen Surat) must always be present for every
    // user regardless of role, plan, trial, or overrides. Guarantee inclusion.
    const withAlwaysOn = new Set<MenuKey>(resolved);
    for (const key of ALWAYS_ON_MENU_SET) withAlwaysOn.add(key);
    resolved = MENU_KEYS.filter((m) => withAlwaysOn.has(m));

    return resolved;
  },
});

// Admin or Super admin updates a role's allowed menus. Admins cannot modify
// the Super Admin role (and Super Admin always has full access anyway).
export const updateRoleMenus = mutation({
  args: {
    role: v.string(),
    allowedMenus: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (!(ROLE_VALUES as ReadonlyArray<string>).includes(args.role)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Peran tidak valid",
      });
    }
    if (args.role === "super_admin") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Super Admin memiliki akses penuh dan tidak dapat dibatasi menunya.",
      });
    }
    // Only super admins can modify the admin role's menus
    if (args.role === "admin" && !isSuperAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Hanya Super Admin yang dapat mengubah akses menu peran Administrator",
      });
    }
    // Validate menu keys and dedupe
    let clean = Array.from(
      new Set(
        args.allowedMenus.filter((m) =>
          (MENU_KEYS as ReadonlyArray<string>).includes(m),
        ),
      ),
    ) as MenuKey[];

    // A company administrator only sees a subset of menus in the UI (platform-
    // owner-only menus and plan-locked menus are hidden). Their save must NOT
    // strip menus they cannot see. Merge: keep the role's existing/ default
    // state for every menu outside the admin's configurable set, and only apply
    // the admin's choices within that set. Super admins configure everything.
    if (!isSuperAdminRole(me.role)) {
      const configurable = new Set<MenuKey>(
        await computeConfigurableMenuKeys(ctx, me),
      );
      const existingRow = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("role", args.role))
        .unique();
      const priorMenus: MenuKey[] = existingRow
        ? (existingRow.allowedMenus.filter((m) =>
            (MENU_KEYS as ReadonlyArray<string>).includes(m),
          ) as MenuKey[])
        : [...DEFAULT_ROLE_MENUS[args.role as Role]];

      const submitted = new Set<MenuKey>(clean);
      const merged = new Set<MenuKey>();
      // Preserve every prior menu that the admin is not allowed to configure.
      for (const m of priorMenus) {
        if (!configurable.has(m)) merged.add(m);
      }
      // Apply the admin's choices only within the configurable set.
      for (const m of configurable) {
        if (submitted.has(m)) merged.add(m);
      }
      clean = MENU_KEYS.filter((m) => merged.has(m));
    }

    // Always include core always-on menus so users keep essential navigation.
    for (const key of ALWAYS_ON_MENU_SET) {
      if (!clean.includes(key)) clean.push(key);
    }

    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        allowedMenus: clean,
        updatedBy: me._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("rolePermissions", {
        role: args.role,
        allowedMenus: clean,
        updatedBy: me._id,
        updatedAt: now,
      });
    }
    return null;
  },
});

// Reset a role back to its default (delete any override row).
export const resetRoleMenus = mutation({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (!(ROLE_VALUES as ReadonlyArray<string>).includes(args.role)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Peran tidak valid",
      });
    }
    if (args.role === "admin" && !isSuperAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Hanya Super Admin yang dapat mereset akses menu peran Administrator",
      });
    }
    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

export type RoleCount = { role: Role; count: number };

export const getRoleStats = query({
  args: {},
  handler: async (ctx): Promise<Array<RoleCount>> => {
    const me = await requireAdmin(ctx);

    const isSuperAdminUser = isSuperAdminRole(me.role);

    let users: Array<Doc<"users">>;
    if (isSuperAdminUser) {
      // Scoped to a single organization like listUsersForSettings: use the
      // selected viewing org, else fall back to the super admin's home org.
      const scopeOrgId = me.viewingOrganizationId ?? me.organizationId ?? null;
      if (!scopeOrgId) return [];
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", scopeOrgId),
        )
        .collect();
    } else {
      const orgId = me.organizationId;
      if (!orgId) return [];
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
      // Exclude super_admin accounts
      users = users.filter((u) => !isSuperAdminRole(u.role));
    }

    const counts: Record<Role, number> = Object.fromEntries(
      ROLE_VALUES.map((r) => [r, 0])
    ) as Record<Role, number>;
    for (const u of users) {
      const r = normalizeRole(u.role);
      counts[r] += 1;
    }
    return ROLE_VALUES.map((role) => ({ role, count: counts[role] }));
  },
});
