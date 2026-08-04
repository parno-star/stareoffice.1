import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, isRole } from "./roles";
import { requireTenant, getGrantedOrgIds } from "./lib/tenant";
import { assertEmailIsUnique, normalizeEmail } from "./lib/email";
import { notifyProfileReviewers } from "./notifications";
import {
  EMPLOYEE_METRIC,
  countOrgEmployees,
  getOrgMetricLimit,
  wouldExceedLimit,
  evaluateAndAlert,
} from "./lib/planLimits";

/**
 * Normalize a variety of common date inputs into ISO `YYYY-MM-DD`.
 * Accepts:
 *  - `YYYY-MM-DD` (returned as-is)
 *  - `DD/MM/YYYY` and `DD-MM-YYYY` (day-first, the Indonesian standard)
 *  - `YYYY/MM/DD`
 * Returns `null` when the value cannot be confidently parsed, so the caller
 * can surface a clear validation error.
 */
function normalizeIsoDate(input: string): string | null {
  const str = input.trim();
  if (!str) return null;

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // YYYY/MM/DD -> YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (day-first)
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = Number(d);
    const month = Number(m);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
    }
  }

  return null;
}

/** Derive a year-agnostic birthday (MM-DD) from an ISO YYYY-MM-DD date. */
function birthdayFromIso(iso: string): string | undefined {
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
  return undefined;
}

// Roles that must never be auto-assigned when a jabatan changes. These are
// platform/tenant-owner roles that always require a deliberate, manual action.
const NON_AUTO_ASSIGNABLE_ROLES = new Set<string>(["super_admin", "admin"]);

/**
 * Resolve the "default role" configured on the matching active position
 * directory entry (Nama Jabatan) for a given job title, scoped to an org.
 *
 * Returns the role key only when it is a valid, auto-assignable role. Returns
 * `undefined` when there is no match, the position has no default role, or the
 * default role is one that must never be auto-assigned (super_admin/admin).
 */
async function resolveDefaultRoleForJobTitle(
  ctx: MutationCtx,
  jobTitle: string | undefined,
  organizationId: Id<"organizations"> | undefined,
): Promise<string | undefined> {
  const title = jobTitle?.trim();
  if (!title || !organizationId) return undefined;

  const entries = await ctx.db.query("positionDirectory").collect();
  const match = entries.find(
    (p) =>
      p.organizationId === organizationId &&
      p.isActive &&
      p.fullName.trim().toLowerCase() === title.toLowerCase(),
  );
  const role = match?.defaultRole?.trim();
  if (!role) return undefined;
  if (!isRole(role) || NON_AUTO_ASSIGNABLE_ROLES.has(role)) return undefined;
  return role;
}

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      // Sync latest name/email from auth provider on each login
      const updates: Record<string, string> = {};
      if (identity.name && identity.name !== user.name) {
        updates.name = identity.name;
      }
      if (identity.email) {
        const normalizedEmail = normalizeEmail(identity.email);
        if (normalizedEmail !== user.email) {
          updates.email = normalizedEmail;
        }
      }
      // Record login time and, if this account was flagged as an abandoned
      // onboarding stub, revive it now that the user has returned.
      const patch: Record<string, string | undefined> = { ...updates };
      patch.lastLoginAt = new Date().toISOString();
      if (user.onboardingAbandonedAt) {
        patch.onboardingAbandonedAt = undefined;
      }
      // Any account already linked to an organization is allowed straight in.
      // If it has no role/status yet (e.g. added to the directory by an admin
      // but never assigned a role), default it to an active "employee" (Karyawan)
      // so the person can enter the workspace. An admin can change the role later.
      if (user.organizationId) {
        if (!user.accountStatus) patch.accountStatus = "active";
        if (!user.role) patch.role = "employee";
      }
      await ctx.db.patch(user._id, patch);
      return user._id;
    }

    // If no users exist yet, make this first user an admin so they can
    // manage the workspace. Only cipkai2017@gmail.com should be super_admin.
    const anyUser = await ctx.db.query("users").first();
    const isFirstUser = anyUser === null;

    // Prevent duplicate email accounts: if an existing profile (e.g. a
    // placeholder created by an admin, or any prior account) already uses this
    // email, claim/link it to this login instead of creating a second row.
    if (identity.email) {
      const normalizedEmail = normalizeEmail(identity.email);
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
      if (existingByEmail) {
        const claimPatch: Record<string, string | undefined> = {
          tokenIdentifier: identity.tokenIdentifier,
          email: normalizedEmail,
          lastLoginAt: new Date().toISOString(),
        };
        // Preserve admin-entered data: only fill the name from the login
        // provider when the record has no name yet. Never overwrite the name
        // an admin typed in the directory.
        if (identity.name && !existingByEmail.name) {
          claimPatch.name = identity.name;
        }
        // Auto-activate pre-registered employees. If an admin already assigned
        // a role (record was "invited"), the person is granted their access
        // immediately on first login — no onboarding wizard, no re-approval.
        if (existingByEmail.role) {
          claimPatch.accountStatus = "active";
        }
        // Any email already linked to an organization is allowed straight in.
        // If it has no role/status yet, default it to an active "employee"
        // (Karyawan) so the person can enter the workspace. An admin can change
        // the role later.
        if (existingByEmail.organizationId) {
          if (!existingByEmail.accountStatus) claimPatch.accountStatus = "active";
          if (!existingByEmail.role) claimPatch.role = "employee";
        }
        // Clear any abandoned-onboarding flag now that they've returned.
        if (existingByEmail.onboardingAbandonedAt) {
          claimPatch.onboardingAbandonedAt = undefined;
        }
        await ctx.db.patch(existingByEmail._id, claimPatch);
        return existingByEmail._id;
      }
    }

    // If it's a new identity, create a new User.
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email ? normalizeEmail(identity.email) : undefined,
      tokenIdentifier: identity.tokenIdentifier,
      ...(isFirstUser ? { role: "admin" as const } : {}),
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Called getCurrentUser without authentication present",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user;
  },
});

// Save or clear the current user's default digital signature. Passing an empty
// string or omitting `signatureData` clears it. The signature is a base64 image
// data URL and is auto-stamped on official letters where this user is the
// SENDER (pengirim).
export const updateMySignature = mutation({
  args: { signatureData: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
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

    const data = args.signatureData?.trim();
    if (data && !data.startsWith("data:image/")) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format tanda tangan tidak valid",
      });
    }

    await ctx.db.patch(user._id, {
      defaultSignature: data && data.length > 0 ? data : undefined,
    });
    return user._id;
  },
});

export const listEmployees = query({
  args: {
    search: v.optional(v.string()),
    department: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<Doc<"users">>> => {
    const { userId, organizationId } = await requireTenant(ctx);

    const searchTerm = args.search?.trim();
    const department = args.department?.trim();

    let results: Array<Doc<"users">>;

    if (searchTerm && searchTerm.length > 0) {
      results = await ctx.db
        .query("users")
        .withSearchIndex("search_name", (q) => {
          const base = q.search("name", searchTerm);
          if (department && department !== "all") {
            return base.eq("department", department);
          }
          return base;
        })
        .take(100);
    } else {
      // No search - return all and optionally filter by department
      const all = await ctx.db.query("users").collect();
      results = all;
      if (department && department !== "all") {
        results = results.filter((u) => u.department === department);
      }
      // Sort alphabetically by name
      results.sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "id", {
          sensitivity: "base",
        }),
      );
    }

    // Tenant isolation: always scope to the caller's org. A super admin without
    // an active grant has organizationId === null and sees no employees.
    results = results.filter((u) => u.organizationId === organizationId);

    // Exclude test/simulation accounts (and super admins) so employee listings
    // reflect the real workforce only.
    //
    // Exception: when the caller is itself a test account, keep other test
    // accounts visible. This lets the platform owner fully test workflows
    // (e.g. sending a letter from one test account to another) without ever
    // exposing test accounts to real employees or inflating headcount stats.
    const caller = await ctx.db.get(userId);
    const callerIsTestAccount = caller?.isTestAccount === true;
    results = results.filter((u) => {
      if (u.role === "super_admin") return false;
      if (u.isTestAccount === true) return callerIsTestAccount;
      return true;
    });

    return results;
  },
});

export const listDepartments = query({
  args: {},
  handler: async (ctx): Promise<Array<string>> => {
    const { organizationId } = await requireTenant(ctx);
    const users = await ctx.db.query("users").collect();
    // Scope to caller's org before building the department name set. A super
    // admin without an active grant has organizationId === null → no departments.
    const scopedUsers = users.filter(
      (u) => u.organizationId === organizationId,
    );

    const set = new Set<string>();
    for (const user of scopedUsers) {
      if (user.department && user.department.trim().length > 0) {
        set.add(user.department);
      }
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "id", { sensitivity: "base" }),
    );
  },
});

export const getEmployeeById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Doc<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const target = await ctx.db.get(args.userId);
    if (!target) return null;

    // Determine viewer privilege. Admins (and super admins) see all columns;
    // regular employees see general columns only, and never sensitive data
    // (NIP, dates of birth/start, custom fields) for anyone but themselves.
    const viewer = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const isAdminViewer = isAdminRole(viewer?.role);
    const isSelf = viewer?._id === target._id;
    if (isAdminViewer || isSelf) return target;

    return {
      ...target,
      nip: undefined,
      dateOfBirth: undefined,
      startDate: undefined,
      customFields: undefined,
    };
  },
});

export const updateMyProfile = mutation({
  args: {
    name: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
    birthday: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    startDate: v.optional(v.string()),
    // Custom directory field values keyed by directoryFields._id. Only fields
    // marked employeeEditable by HR are accepted; others are rejected.
    customFields: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Validate birthday (MM-DD) and startDate (YYYY-MM-DD) if provided
    if (args.birthday !== undefined && args.birthday !== "") {
      if (!/^\d{2}-\d{2}$/.test(args.birthday)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal ulang tahun tidak valid (MM-DD)",
        });
      }
    }
    if (args.startDate !== undefined && args.startDate !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal mulai kerja tidak valid (YYYY-MM-DD)",
        });
      }
    }
    if (args.dateOfBirth !== undefined && args.dateOfBirth !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dateOfBirth)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal lahir tidak valid (YYYY-MM-DD)",
        });
      }
    }

    // Validate & collect employee-editable custom field changes. Only fields
    // that HR marked `employeeEditable` may be changed here; MASA KERJA / USIA
    // are computed and can never be edited. Changes are namespaced as
    // "custom:<fieldId>" so they can be stored alongside built-in changes.
    const customChanges: Record<string, string> = {};
    if (args.customFields !== undefined) {
      const existingCustom = user.customFields ?? {};
      for (const [fieldId, rawValue] of Object.entries(args.customFields)) {
        const def = await ctx.db.get(fieldId as Id<"directoryFields">);
        if (!def || def.organizationId !== user.organizationId) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Field kustom tidak ditemukan",
          });
        }
        const normalizedLabel = def.label.trim().toLowerCase().replace(/\s+/g, " ");
        const isComputed =
          normalizedLabel === "masa kerja" ||
          normalizedLabel === "usia" ||
          normalizedLabel === "umur";
        if (isComputed) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: `Kolom "${def.label}" dihitung otomatis dan tidak dapat diubah`,
          });
        }
        if (!def.employeeEditable) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: `Kolom "${def.label}" hanya dapat diubah oleh HR`,
          });
        }
        const value = rawValue.trim();
        if (value !== (existingCustom[fieldId] ?? "")) {
          customChanges[`custom:${fieldId}`] = value;
        }
      }
    }

    // Build changes object (only include fields that actually differ from current)
    const changes: Record<string, string> = {};
    if (args.name !== undefined && args.name !== (user.name ?? ""))
      changes.name = args.name;
    if (args.department !== undefined && args.department !== (user.department ?? ""))
      changes.department = args.department;
    if (args.jobTitle !== undefined && args.jobTitle !== (user.jobTitle ?? ""))
      changes.jobTitle = args.jobTitle;
    if (args.phone !== undefined && args.phone !== (user.phone ?? ""))
      changes.phone = args.phone;
    if (args.location !== undefined && args.location !== (user.location ?? ""))
      changes.location = args.location;
    if (args.bio !== undefined && args.bio !== (user.bio ?? ""))
      changes.bio = args.bio;
    if (args.birthday !== undefined && args.birthday !== (user.birthday ?? ""))
      changes.birthday = args.birthday;
    if (args.dateOfBirth !== undefined && args.dateOfBirth !== (user.dateOfBirth ?? ""))
      changes.dateOfBirth = args.dateOfBirth;
    if (args.startDate !== undefined && args.startDate !== (user.startDate ?? ""))
      changes.startDate = args.startDate;

    // HR-managed fields: only HR managers, admins, and super admins may change
    // these. Regular employees cannot edit them (directly or via request).
    const HR_ONLY_FIELDS = ["jobTitle", "department", "startDate"] as const;
    const HR_ONLY_LABELS: Record<string, string> = {
      jobTitle: "Jabatan",
      department: "Departemen",
      startDate: "Mulai Bekerja",
    };
    const canEditHrFields =
      !!user.role &&
      ["super_admin", "admin", "hr_manager"].includes(user.role);
    if (!canEditHrFields) {
      for (const key of HR_ONLY_FIELDS) {
        if (changes[key] !== undefined) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: `Kolom "${HR_ONLY_LABELS[key]}" hanya dapat diubah oleh HR.`,
          });
        }
      }
    }

    // Merge in the validated custom field changes (namespaced "custom:<id>").
    for (const [k, val] of Object.entries(customChanges)) {
      changes[k] = val;
    }

    // If nothing changed, return early
    if (Object.keys(changes).length === 0) {
      return user._id;
    }

    // HR managers, admins, and super admins can edit directly without approval
    const directEditRoles = ["super_admin", "admin", "hr_manager"];
    if (user.role && directEditRoles.includes(user.role)) {
      const patch: Partial<Doc<"users">> = {};
      if (changes.name !== undefined) patch.name = changes.name;
      if (changes.department !== undefined)
        patch.department = changes.department === "" ? undefined : changes.department;
      if (changes.jobTitle !== undefined)
        patch.jobTitle = changes.jobTitle === "" ? undefined : changes.jobTitle;
      if (changes.phone !== undefined)
        patch.phone = changes.phone === "" ? undefined : changes.phone;
      if (changes.location !== undefined)
        patch.location = changes.location === "" ? undefined : changes.location;
      if (changes.bio !== undefined)
        patch.bio = changes.bio === "" ? undefined : changes.bio;
      if (changes.birthday !== undefined)
        patch.birthday = changes.birthday === "" ? undefined : changes.birthday;
      if (changes.dateOfBirth !== undefined)
        patch.dateOfBirth = changes.dateOfBirth === "" ? undefined : changes.dateOfBirth;
      if (changes.startDate !== undefined)
        patch.startDate = changes.startDate === "" ? undefined : changes.startDate;
      // Apply custom field changes into the user's customFields record.
      if (Object.keys(customChanges).length > 0) {
        const merged: Record<string, string> = { ...(user.customFields ?? {}) };
        for (const [k, val] of Object.entries(customChanges)) {
          const fieldId = k.slice("custom:".length);
          if (val === "") delete merged[fieldId];
          else merged[fieldId] = val;
        }
        patch.customFields = merged;
      }
      await ctx.db.patch(user._id, patch);
      return user._id;
    }

    // For regular employees: create a pending change request
    // Cancel any existing pending requests for this user
    const existingPending = await ctx.db
      .query("profileChangeRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const req of existingPending) {
      if (req.status === "pending") {
        await ctx.db.patch(req._id, { status: "cancelled" });
      }
    }

    // Require organizationId for the request
    if (!user.organizationId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Organisasi pengguna tidak ditemukan",
      });
    }

    await ctx.db.insert("profileChangeRequests", {
      userId: user._id,
      organizationId: user.organizationId,
      changes: JSON.stringify(changes),
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Alert HR managers & admins in the org so they can review the request
    const fieldLabels: Record<string, string> = {
      name: "Nama",
      department: "Departemen",
      jobTitle: "Jabatan",
      phone: "Telepon",
      location: "Lokasi",
      bio: "Tentang Saya",
      birthday: "Ulang Tahun",
      dateOfBirth: "Tanggal Lahir",
      startDate: "Mulai Bekerja",
    };
    // Resolve labels for both built-in and custom ("custom:<id>") changed fields.
    const changedLabelList: Array<string> = [];
    for (const k of Object.keys(changes)) {
      if (k.startsWith("custom:")) {
        const def = await ctx.db.get(k.slice("custom:".length) as Id<"directoryFields">);
        changedLabelList.push(def?.label ?? "Data kustom");
      } else {
        changedLabelList.push(fieldLabels[k] ?? k);
      }
    }
    const changedFieldLabels = changedLabelList.join(", ");
    await notifyProfileReviewers(ctx, {
      organizationId: user.organizationId,
      type: "profile_change_request",
      title: "Permintaan perubahan profil",
      message: `${user.name ?? "Seorang karyawan"} mengajukan perubahan data: ${changedFieldLabels}.`,
      link: "/profile-verification",
      actorId: user._id,
    });

    return user._id;
  },
});

// Get pending profile change requests for the current user
export const getMyPendingProfileChange = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const requests = await ctx.db
      .query("profileChangeRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(5);

    // Build a label map for any custom ("custom:<id>") fields referenced so the
    // UI can display human-readable field names instead of raw ids.
    const resolveLabels = async (
      changes: Record<string, string>,
    ): Promise<Record<string, string>> => {
      const labels: Record<string, string> = {};
      for (const k of Object.keys(changes)) {
        if (k.startsWith("custom:")) {
          const def = await ctx.db.get(
            k.slice("custom:".length) as Id<"directoryFields">,
          );
          if (def) labels[k] = def.label;
        }
      }
      return labels;
    };

    // Return the most recent pending or the latest request
    const pending = requests.find((r) => r.status === "pending");
    if (pending) {
      const changes = JSON.parse(pending.changes) as Record<string, string>;
      return { ...pending, changes, fieldLabels: await resolveLabels(changes) };
    }

    // Return latest non-cancelled for status display
    const latest = requests.find((r) => r.status !== "cancelled");
    if (latest) {
      const changes = JSON.parse(latest.changes) as Record<string, string>;
      return { ...latest, changes, fieldLabels: await resolveLabels(changes) };
    }
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateMyAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new ConvexError({ code: "NOT_FOUND", message: "File not found" });
    }
    await ctx.db.patch(user._id, { avatarUrl: url });
    return url;
  },
});

export const removeMyAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    await ctx.db.patch(user._id, { avatarUrl: undefined });
  },
});

// Admins & Super Admins can update any employee's avatar photo.
export const updateEmployeeAvatarByAdmin = mutation({
  args: {
    userId: v.id("users"),
    storageId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const current = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!current) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      });
    }
    if (!isAdminRole(current.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Hanya Administrator atau Super Admin yang dapat mengubah foto karyawan",
      });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }

    // Tenant isolation: non-super-admins may only edit users in their own org
    const isSuperAdmin = current.role === "super_admin";
    if (!isSuperAdmin && target.organizationId !== current.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Karyawan tidak ditemukan di organisasi Anda",
      });
    }

    if (args.storageId === null) {
      await ctx.db.patch(args.userId, { avatarUrl: undefined });
      return null;
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new ConvexError({ code: "NOT_FOUND", message: "File tidak ditemukan" });
    }
    await ctx.db.patch(args.userId, { avatarUrl: url });
    return url;
  },
});

// Admins & Super Admins can update any employee's profile data.
export const updateEmployeeByAdmin = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    nip: v.optional(v.string()),
    email: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
    birthday: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    startDate: v.optional(v.string()),
    managerId: v.optional(v.union(v.id("users"), v.null())),
    customFields: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Belum masuk",
      });
    }
    const current = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!current) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      });
    }
    if (!isAdminRole(current.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Hanya Administrator atau Super Admin yang dapat mengedit data karyawan",
      });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }

    // Tenant isolation: non-super-admins may only edit users in their own org
    const isSuperAdmin = current.role === "super_admin";
    if (
      !isSuperAdmin &&
      target.organizationId !== current.organizationId
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Karyawan tidak ditemukan di organisasi Anda",
      });
    }

    // Validate birthday (MM-DD) and startDate (YYYY-MM-DD) if provided
    if (args.birthday !== undefined && args.birthday !== "") {
      if (!/^\d{2}-\d{2}$/.test(args.birthday)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal ulang tahun tidak valid (MM-DD)",
        });
      }
    }
    if (args.startDate !== undefined && args.startDate !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal mulai kerja tidak valid (YYYY-MM-DD)",
        });
      }
    }
    if (args.dateOfBirth !== undefined && args.dateOfBirth !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dateOfBirth)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal lahir tidak valid (YYYY-MM-DD)",
        });
      }
    }

    // Manager cannot be the employee themselves (prevent self-loop)
    if (args.managerId && args.managerId === args.userId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Atasan tidak boleh diri sendiri",
      });
    }

    const patch: Partial<Doc<"users">> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.nip !== undefined)
      patch.nip = args.nip.trim() === "" ? undefined : args.nip.trim();
    if (args.email !== undefined) {
      const normalizedEmail =
        args.email.trim() === "" ? undefined : normalizeEmail(args.email);
      // Reject if another account already uses this email
      if (normalizedEmail) {
        await assertEmailIsUnique(ctx, normalizedEmail, args.userId);
      }
      patch.email = normalizedEmail;
    }
    if (args.department !== undefined)
      patch.department =
        args.department.trim() === "" ? undefined : args.department.trim();
    if (args.jobTitle !== undefined)
      patch.jobTitle =
        args.jobTitle.trim() === "" ? undefined : args.jobTitle.trim();
    if (args.phone !== undefined)
      patch.phone = args.phone.trim() === "" ? undefined : args.phone.trim();
    if (args.location !== undefined)
      patch.location =
        args.location.trim() === "" ? undefined : args.location.trim();
    if (args.bio !== undefined)
      patch.bio = args.bio.trim() === "" ? undefined : args.bio.trim();
    if (args.birthday !== undefined)
      patch.birthday = args.birthday === "" ? undefined : args.birthday;
    if (args.dateOfBirth !== undefined)
      patch.dateOfBirth = args.dateOfBirth === "" ? undefined : args.dateOfBirth;
    if (args.startDate !== undefined)
      patch.startDate = args.startDate === "" ? undefined : args.startDate;
    if (args.managerId !== undefined)
      patch.managerId = args.managerId === null ? undefined : args.managerId;
    if (args.customFields !== undefined) {
      // Merge incoming custom field values with existing ones, dropping empties
      const merged: Record<string, string> = { ...(target.customFields ?? {}) };
      for (const [key, value] of Object.entries(args.customFields)) {
        if (value.trim() === "") {
          delete merged[key];
        } else {
          merged[key] = value.trim();
        }
      }
      patch.customFields = merged;
    }

    // Position-based access control: when the admin changes the employee's
    // jabatan (Nama Jabatan), auto-fill the role from that position's configured
    // "default role". This is only a convenience shortcut — the admin can still
    // override the role manually afterwards from the Pengguna & Peran tab.
    // Guardrails:
    //  - Never touch a target that is currently an Administrator/Super Admin.
    //  - Only apply when the jabatan actually changed to a new value.
    //  - Only apply when the matching position has an auto-assignable default role.
    const newJobTitle = patch.jobTitle as string | undefined;
    const jobTitleChanged =
      args.jobTitle !== undefined && newJobTitle !== target.jobTitle;
    if (jobTitleChanged && !isAdminRole(target.role)) {
      const defaultRole = await resolveDefaultRoleForJobTitle(
        ctx,
        newJobTitle,
        target.organizationId ?? undefined,
      );
      if (defaultRole && defaultRole !== target.role) {
        patch.role = defaultRole;
      }
    }

    await ctx.db.patch(args.userId, patch);
    return args.userId;
  },
});

// Admins & Super Admins can delete an employee. Direct reports have their
// managerId cleared to avoid dangling references. Other related records
// (documents, leave requests, etc.) remain intact for audit purposes.
export const deleteEmployeeByAdmin = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Belum masuk",
      });
    }
    const current = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!current) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      });
    }
    if (!isAdminRole(current.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Hanya Administrator atau Super Admin yang dapat menghapus karyawan",
      });
    }
    if (current._id === args.userId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak dapat menghapus akun Anda sendiri",
      });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      // Already deleted - treat as success
      return null;
    }

    // Tenant isolation: non-super-admins may only delete users in their own org
    const isSuperAdmin = current.role === "super_admin";
    if (
      !isSuperAdmin &&
      target.organizationId !== current.organizationId
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Karyawan tidak ditemukan di organisasi Anda",
      });
    }

    // Consent-first for super admins: deleting a user that belongs to a company
    // requires an active approved access grant from that company. Accounts with
    // no organization remain manageable for platform administration.
    if (isSuperAdmin && target.organizationId) {
      const grantedOrgIds = await getGrantedOrgIds(ctx, current._id);
      if (!grantedOrgIds.has(target.organizationId)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "Anda belum memiliki izin akses yang aktif dari organisasi pengguna ini. Ajukan permintaan akses terlebih dahulu.",
        });
      }
    }

    // Protection: if the last super admin is about to be removed, block it
    if (target.role === "super_admin") {
      const superAdmins = await ctx.db.query("users").collect();
      const remaining = superAdmins.filter(
        (u) => u.role === "super_admin" && u._id !== args.userId,
      );
      if (remaining.length === 0) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "Tidak dapat menghapus Super Admin terakhir di sistem",
        });
      }
    }

    // Clear managerId on any direct reports pointing to this user
    const directReports = await ctx.db
      .query("users")
      .withIndex("by_manager", (q) => q.eq("managerId", args.userId))
      .collect();
    for (const report of directReports) {
      await ctx.db.patch(report._id, { managerId: undefined });
    }

    // Remove this user's role requests so their email is fully freed up and
    // no orphaned pending requests linger in the approval queue.
    const roleRequests = await ctx.db
      .query("roleRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const req of roleRequests) {
      await ctx.db.delete(req._id);
    }

    await ctx.db.delete(args.userId);
    return null;
  },
});

export const createEmployeeByAdmin = mutation({
  args: {
    name: v.string(),
    nip: v.optional(v.string()),
    email: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    department: v.optional(v.string()),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    managerId: v.optional(v.id("users")),
    // Optional access role assigned by the admin at creation time. When set, the
    // new record is a pre-registered employee awaiting their first login
    // (accountStatus "invited"). When omitted, defaults to "employee".
    role: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const current = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!current || !isAdminRole(current.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat menambah karyawan",
      });
    }

    // Resolve the requested access role. Admins may assign any standard role
    // EXCEPT super_admin (platform owner only) and admin (single admin per org,
    // managed via Transfer Admin). Fall back to "employee" when unset/invalid.
    const requestedRole = args.role?.trim();
    if (
      requestedRole &&
      (requestedRole === "super_admin" || requestedRole === "admin")
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Peran Super Admin / Administrator tidak dapat diberikan di sini. Gunakan pengaturan pengguna.",
      });
    }
    const resolvedRole: string =
      requestedRole && isRole(requestedRole) ? requestedRole : "employee";

    // Resolve the email and detect any existing account using it.
    const normalizedEmail =
      args.email && args.email.trim() !== ""
        ? normalizeEmail(args.email)
        : undefined;

    // When the email already belongs to an account, decide whether we can adopt
    // it. A person who logged in AFTER their directory record was deleted gets a
    // brand-new "stub" account (a real login, but no role and no organization).
    // Adding them to the directory again should re-link that stub — filling in
    // the data and granting access — instead of erroring out. Any account that
    // already has a role or belongs to an organization is a genuine clash.
    let adoptableStub: Doc<"users"> | null = null;
    if (normalizedEmail) {
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
      if (existingByEmail) {
        const isEmptyStub =
          !existingByEmail.role && !existingByEmail.organizationId;
        if (isEmptyStub) {
          adoptableStub = existingByEmail;
        } else {
          throw new ConvexError({
            code: "CONFLICT",
            message: `Email "${normalizedEmail}" sudah digunakan oleh akun lain. Gunakan email yang berbeda.`,
          });
        }
      }
    }

    // Enforce plan employee limit: block adding when already at/over the cap.
    // This applies whether we insert a new record or adopt a login stub, since
    // both add one active employee to the organization.
    if (current.organizationId) {
      const { max, planName } = await getOrgMetricLimit(
        ctx,
        current.organizationId,
        EMPLOYEE_METRIC,
      );
      const currentCount = await countOrgEmployees(ctx, current.organizationId);
      if (wouldExceedLimit(currentCount, max)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Batas karyawan paket ${planName ?? ""} tercapai (${currentCount}/${max}). Tingkatkan paket untuk menambah karyawan baru.`,
        });
      }
    }

    // Re-link an existing login stub: keep the person's real login, fill the
    // directory data, grant the role, and activate them immediately (they have
    // already logged in, so no invitation/onboarding is needed).
    if (adoptableStub) {
      await ctx.db.patch(adoptableStub._id, {
        name: args.name,
        nip: args.nip,
        email: normalizedEmail,
        jobTitle: args.jobTitle,
        department: args.department,
        phone: args.phone,
        location: args.location,
        startDate: args.startDate,
        dateOfBirth: args.dateOfBirth,
        managerId: args.managerId,
        role: resolvedRole,
        accountStatus: "active",
        organizationId: current.organizationId,
        onboardingAbandonedAt: undefined,
      });

      if (current.organizationId) {
        const { max, planId, planName } = await getOrgMetricLimit(
          ctx,
          current.organizationId,
          EMPLOYEE_METRIC,
        );
        const newCount = await countOrgEmployees(ctx, current.organizationId);
        await evaluateAndAlert(ctx, {
          organizationId: current.organizationId,
          metric: EMPLOYEE_METRIC,
          currentUsage: newCount,
          max,
          planId,
          planName,
        });
      }

      return adoptableStub._id;
    }

    // Use a placeholder tokenIdentifier so the user can later claim this profile
    const tokenIdentifier = `placeholder:${crypto.randomUUID()}`;

    const id = await ctx.db.insert("users", {
      tokenIdentifier,
      name: args.name,
      nip: args.nip,
      email: normalizedEmail,
      jobTitle: args.jobTitle,
      department: args.department,
      phone: args.phone,
      location: args.location,
      startDate: args.startDate,
      dateOfBirth: args.dateOfBirth,
      managerId: args.managerId,
      // Pre-assigned access role and "invited" status so the person is granted
      // the right access automatically the moment they first log in — no
      // onboarding wizard and no re-approval needed.
      role: resolvedRole,
      accountStatus: "invited",
      // Stamp the new employee with the creator's org for tenant isolation
      organizationId: current.organizationId,
    });

    // After adding, re-evaluate usage and fire graduated warnings if needed.
    if (current.organizationId) {
      const { max, planId, planName } = await getOrgMetricLimit(
        ctx,
        current.organizationId,
        EMPLOYEE_METRIC,
      );
      const newCount = await countOrgEmployees(ctx, current.organizationId);
      await evaluateAndAlert(ctx, {
        organizationId: current.organizationId,
        metric: EMPLOYEE_METRIC,
        currentUsage: newCount,
        max,
        planId,
        planName,
      });
    }

    return id;
  },
});

// ── Bulk Import Employees (from Excel) ───────────────────────────────────────

export const bulkCreateEmployees = mutation({
  args: {
    employees: v.array(
      v.object({
        name: v.string(),
        nip: v.optional(v.string()),
        email: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        department: v.optional(v.string()),
        phone: v.optional(v.string()),
        location: v.optional(v.string()),
        startDate: v.optional(v.string()),
        birthday: v.optional(v.string()),
        dateOfBirth: v.optional(v.string()),
        bio: v.optional(v.string()),
        customFields: v.optional(v.record(v.string(), v.string())),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ created: number; updated: number; errors: string[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const current = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!current || !isAdminRole(current.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat mengimpor karyawan",
      });
    }

    // Enforce the plan employee limit across the whole batch (0 = unlimited).
    const orgId = current.organizationId;
    const { max: employeeMax } = orgId
      ? await getOrgMetricLimit(ctx, orgId, EMPLOYEE_METRIC)
      : { max: 0 };
    let liveCount = orgId ? await countOrgEmployees(ctx, orgId) : 0;

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    // Track emails already seen within this batch to reject in-file duplicates
    const seenEmails = new Set<string>();
    // Track NIPs already seen within this batch to reject in-file duplicates
    const seenNips = new Set<string>();

    for (let i = 0; i < args.employees.length; i++) {
      const emp = args.employees[i];
      if (!emp) continue;

      // Validate name
      if (!emp.name || emp.name.trim().length < 2) {
        errors.push(`Baris ${i + 1}: Nama tidak valid atau kosong`);
        continue;
      }

      // Normalize startDate: accept DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD.
      if (emp.startDate && emp.startDate.trim() !== "") {
        const iso = normalizeIsoDate(emp.startDate);
        if (!iso) {
          errors.push(
            `Baris ${i + 1} (${emp.name}): Format tanggal mulai kerja tidak dikenali (gunakan DD/MM/YYYY atau YYYY-MM-DD)`,
          );
          continue;
        }
        emp.startDate = iso;
      }

      // Normalize full date of birth: accept DD/MM/YYYY, DD-MM-YYYY, or ISO.
      if (emp.dateOfBirth && emp.dateOfBirth.trim() !== "") {
        const iso = normalizeIsoDate(emp.dateOfBirth);
        if (!iso) {
          errors.push(
            `Baris ${i + 1} (${emp.name}): Format tanggal lahir tidak dikenali (gunakan DD/MM/YYYY atau YYYY-MM-DD)`,
          );
          continue;
        }
        emp.dateOfBirth = iso;
        // Auto-derive the year-agnostic birthday (MM-DD) when not supplied.
        if (!emp.birthday || emp.birthday.trim() === "") {
          emp.birthday = birthdayFromIso(iso);
        }
      }

      // Normalize birthday: accept MM-DD directly, or derive from a full date.
      if (emp.birthday && emp.birthday.trim() !== "") {
        const b = emp.birthday.trim();
        if (/^\d{2}-\d{2}$/.test(b)) {
          emp.birthday = b;
        } else {
          const iso = normalizeIsoDate(b);
          const mmdd = iso ? birthdayFromIso(iso) : undefined;
          if (!mmdd) {
            errors.push(
              `Baris ${i + 1} (${emp.name}): Format ulang tahun tidak dikenali (gunakan MM-DD atau tanggal lengkap)`,
            );
            continue;
          }
          emp.birthday = mmdd;
        }
      }

      const normalizedEmail =
        emp.email && emp.email.trim() !== ""
          ? normalizeEmail(emp.email)
          : undefined;

      // In-file duplicate guards (NIP and email must be unique within one file).
      const trimmedNip = emp.nip?.trim() || undefined;
      if (trimmedNip) {
        if (seenNips.has(trimmedNip)) {
          errors.push(
            `Baris ${i + 1} (${emp.name}): NIP "${trimmedNip}" muncul lebih dari sekali dalam file`,
          );
          continue;
        }
        seenNips.add(trimmedNip);
      }
      if (normalizedEmail && seenEmails.has(normalizedEmail)) {
        errors.push(
          `Baris ${i + 1} (${emp.name}): Email "${normalizedEmail}" muncul lebih dari sekali dalam file`,
        );
        continue;
      }

      // Find the existing employee to update. Match by NIP first (within the
      // caller's organization), then fall back to matching by email within the
      // same organization. This lets re-importing update an existing record —
      // even one originally added by another admin — instead of failing.
      let existing: Doc<"users"> | null = null;
      if (trimmedNip && orgId) {
        existing = await ctx.db
          .query("users")
          .withIndex("by_organization_and_nip", (q) =>
            q.eq("organizationId", orgId).eq("nip", trimmedNip),
          )
          .first();
      }

      if (normalizedEmail) {
        // All accounts sharing this email (usually one). Bounded, safe to collect.
        const emailMatches = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .collect();

        // If NIP did not match, adopt a same-organization email match for update.
        if (!existing) {
          const sameOrgEmail = emailMatches.find((u) =>
            orgId ? u.organizationId === orgId : true,
          );
          if (sameOrgEmail) existing = sameOrgEmail;
        }

        // Reject only when the email belongs to a DIFFERENT record than the one
        // being updated (e.g. an account in another organization). This keeps
        // organizations isolated while still allowing same-org overwrites.
        const conflict = emailMatches.some((u) => u._id !== existing?._id);
        if (conflict) {
          errors.push(
            `Baris ${i + 1} (${emp.name}): Email "${normalizedEmail}" sudah digunakan oleh akun di organisasi lain`,
          );
          continue;
        }
        seenEmails.add(normalizedEmail);
      }

      // Clean custom field values (drop empties)
      let customFields: Record<string, string> | undefined;
      if (emp.customFields) {
        const cleaned: Record<string, string> = {};
        for (const [key, value] of Object.entries(emp.customFields)) {
          if (value.trim() !== "") cleaned[key] = value.trim();
        }
        if (Object.keys(cleaned).length > 0) customFields = cleaned;
      }

      // Update path: a matching employee already exists (by NIP or email).
      // Only non-empty fields overwrite existing data; blank cells are ignored
      // so existing values are preserved.
      if (existing) {
        const patch: Partial<Doc<"users">> = {};
        const nameTrimmed = emp.name.trim();
        if (nameTrimmed) patch.name = nameTrimmed;
        if (trimmedNip) patch.nip = trimmedNip;
        if (normalizedEmail) patch.email = normalizedEmail;
        if (emp.jobTitle?.trim()) patch.jobTitle = emp.jobTitle.trim();
        if (emp.department?.trim()) patch.department = emp.department.trim();
        if (emp.phone?.trim()) patch.phone = emp.phone.trim();
        if (emp.location?.trim()) patch.location = emp.location.trim();
        if (emp.startDate) patch.startDate = emp.startDate;
        if (emp.birthday) patch.birthday = emp.birthday;
        if (emp.dateOfBirth) patch.dateOfBirth = emp.dateOfBirth;
        if (emp.bio?.trim()) patch.bio = emp.bio.trim();
        // Merge custom fields: incoming non-empty values overwrite, others kept.
        if (customFields) {
          patch.customFields = {
            ...(existing.customFields ?? {}),
            ...customFields,
          };
        }
        await ctx.db.patch(existing._id, patch);
        updated++;
        continue;
      }

      // Create path: stop importing once the plan limit is reached (0 = unlimited).
      if (employeeMax > 0 && liveCount >= employeeMax) {
        errors.push(
          `Baris ${i + 1} (${emp.name}): Batas karyawan paket tercapai (${liveCount}/${employeeMax}). Tingkatkan paket untuk menambah karyawan.`,
        );
        continue;
      }

      const tokenIdentifier = `placeholder:${crypto.randomUUID()}`;
      await ctx.db.insert("users", {
        tokenIdentifier,
        name: emp.name.trim(),
        nip: trimmedNip,
        email: normalizedEmail,
        jobTitle: emp.jobTitle?.trim() || undefined,
        department: emp.department?.trim() || undefined,
        phone: emp.phone?.trim() || undefined,
        location: emp.location?.trim() || undefined,
        startDate: emp.startDate || undefined,
        birthday: emp.birthday || undefined,
        dateOfBirth: emp.dateOfBirth || undefined,
        bio: emp.bio?.trim() || undefined,
        customFields,
        // Imported employees are pre-registered with the standard "employee"
        // role and "invited" status: they gain access automatically on first
        // login without onboarding or re-approval.
        role: "employee",
        accountStatus: "invited",
        organizationId: current.organizationId,
      });
      created++;
      liveCount++;
    }

    // Fire graduated warnings once after the batch based on the new total.
    if (orgId && created > 0) {
      const { max, planId, planName } = await getOrgMetricLimit(
        ctx,
        orgId,
        EMPLOYEE_METRIC,
      );
      const newCount = await countOrgEmployees(ctx, orgId);
      await evaluateAndAlert(ctx, {
        organizationId: orgId,
        metric: EMPLOYEE_METRIC,
        currentUsage: newCount,
        max,
        planId,
        planName,
      });
    }

    return { created, updated, errors };
  },
});

// ── Quick Access Shortcuts ────────────────────────────────────────────────────

export const getMyQuickAccess = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];
    return user.quickAccessShortcuts ?? [];
  },
});

export const updateMyQuickAccess = mutation({
  args: {
    shortcuts: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    await ctx.db.patch(user._id, { quickAccessShortcuts: args.shortcuts });
  },
});
