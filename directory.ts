// Advanced Directory backend: enriched employee listings with filters,
// aggregated skills, manager / report info, and filter option metadata.

import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant, isScopeBlocked, getGrantedOrgIds } from "./lib/tenant";
import { isCountableEmployee } from "./lib/countableUsers";
import { isSuperAdminBlocked } from "./superAdminDataAccess";
import { isAdminRole } from "./roles";

/**
 * Sensitive employee fields that only administrators may see in the directory.
 * Regular employees see general columns (name, job title, department, location,
 * work email/phone, manager) but never these. Kept in sync with the frontend
 * SENSITIVE_BUILTIN_KEYS in src/pages/directory/_lib/directory-columns.ts.
 *
 * `customFields` is redacted wholesale because admin-defined custom columns may
 * hold private data (e.g. salary, ID numbers, SK/contract details).
 */
function redactDirectoryUser(user: Doc<"users">): Doc<"users"> {
  return {
    ...user,
    nip: undefined,
    dateOfBirth: undefined,
    startDate: undefined,
    customFields: undefined,
  };
}

export type DirectorySkill = {
  skill: string;
  category: string;
  level: number;
};

export type DirectoryEntry = {
  user: Doc<"users">;
  skills: Array<DirectorySkill>;
  directReportCount: number;
  managerName: string | null;
  departmentName: string | null;
};

export const listAdvanced = query({
  args: {
    search: v.optional(v.string()),
    department: v.optional(v.string()), // "all" | department name
    location: v.optional(v.string()), // "all" | location
    jobTitle: v.optional(v.string()), // "all" | jobTitle
    skill: v.optional(v.string()), // "all" | skill name (case-insensitive)
    hasManager: v.optional(v.string()), // "all" | "yes" | "no"
    sortBy: v.optional(v.string()), // "name" | "department" | "jobTitle" | "reports"
    sortDir: v.optional(v.string()), // "asc" | "desc"
    organizationId: v.optional(v.id("organizations")), // super_admin only: scope to a specific org
  },
  handler: async (ctx, args): Promise<Array<DirectoryEntry>> => {
    const { userId, organizationId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    // Determine whether the viewer may see sensitive columns. Super admins and
    // company administrators see everything; every other role sees a redacted
    // set of general columns only.
    const viewer = await ctx.db.get(userId);
    const isAdminViewer = isSuperAdmin || isAdminRole(viewer?.role);

    // Super admin data-access gate: when blocked, return no directory entries.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return [];
    }
    // Scoped consent gate: vendor needs the "Data Kepegawaian (HR)" scope.
    if (await isScopeBlocked(ctx, "hr_people")) {
      return [];
    }

    // Consent-first for super admins: only reveal users from companies that
    // have granted active access. A super admin without an org filter sees the
    // union of all granted organizations (not every organization).
    const grantedOrgIds = isSuperAdmin
      ? await getGrantedOrgIds(ctx, userId)
      : null;

    // super_admin may scope to a specific organization via args.organizationId,
    // but only if that organization has granted access.
    if (isSuperAdmin && args.organizationId && grantedOrgIds) {
      if (!grantedOrgIds.has(args.organizationId)) {
        return [];
      }
    }
    const scopeOrgId =
      isSuperAdmin && args.organizationId ? args.organizationId : organizationId;

    // Scope users to the resolved organization. Without a scoped org (super
    // admin who has not selected/been granted an org), show nothing.
    let users: Array<Doc<"users">>;
    if (scopeOrgId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", scopeOrgId))
        .collect();
    } else {
      users = [];
    }

    // Super admin accounts manage the platform and should never appear as
    // employees inside any organization's directory listing. Test/simulation
    // accounts are excluded too so headcount reflects the real workforce.
    users = users.filter(isCountableEmployee);

    // Scope skills to the same organization
    let allSkills: Array<Doc<"employeeSkills">>;
    if (scopeOrgId) {
      allSkills = await ctx.db
        .query("employeeSkills")
        .withIndex("by_organization", (q) => q.eq("organizationId", scopeOrgId))
        .collect();
    } else {
      allSkills = [];
    }
    const skillsByUser = new Map<Id<"users">, Array<DirectorySkill>>();
    for (const s of allSkills) {
      const list = skillsByUser.get(s.userId) ?? [];
      list.push({ skill: s.skill, category: s.category, level: s.level });
      skillsByUser.set(s.userId, list);
    }

    // Direct report counts
    const reportsCount = new Map<Id<"users">, number>();
    for (const u of users) {
      if (u.managerId) {
        reportsCount.set(u.managerId, (reportsCount.get(u.managerId) ?? 0) + 1);
      }
    }

    const userById = new Map<Id<"users">, Doc<"users">>();
    for (const u of users) userById.set(u._id, u);

    // Build entries
    let entries: Array<DirectoryEntry> = users.map((u) => {
      const skills = (skillsByUser.get(u._id) ?? [])
        .slice()
        .sort((a, b) => b.level - a.level);
      const manager = u.managerId ? userById.get(u.managerId) : null;
      return {
        user: u,
        skills,
        directReportCount: reportsCount.get(u._id) ?? 0,
        managerName: manager?.name ?? null,
        departmentName: u.department ?? null,
      };
    });

    // Filters
    const searchTerm = args.search?.trim().toLowerCase();
    if (searchTerm && searchTerm.length > 0) {
      entries = entries.filter((e) => {
        const nameMatch = (e.user.name ?? "").toLowerCase().includes(searchTerm);
        const titleMatch = (e.user.jobTitle ?? "")
          .toLowerCase()
          .includes(searchTerm);
        const emailMatch = (e.user.email ?? "")
          .toLowerCase()
          .includes(searchTerm);
        const deptMatch = (e.user.department ?? "")
          .toLowerCase()
          .includes(searchTerm);
        const locMatch = (e.user.location ?? "")
          .toLowerCase()
          .includes(searchTerm);
        const skillMatch = e.skills.some((s) =>
          s.skill.toLowerCase().includes(searchTerm),
        );
        return (
          nameMatch ||
          titleMatch ||
          emailMatch ||
          deptMatch ||
          locMatch ||
          skillMatch
        );
      });
    }

    const department = args.department?.trim();
    if (department && department !== "all") {
      entries = entries.filter((e) => e.user.department === department);
    }

    const location = args.location?.trim();
    if (location && location !== "all") {
      entries = entries.filter((e) => e.user.location === location);
    }

    const jobTitle = args.jobTitle?.trim();
    if (jobTitle && jobTitle !== "all") {
      entries = entries.filter((e) => e.user.jobTitle === jobTitle);
    }

    const skill = args.skill?.trim().toLowerCase();
    if (skill && skill !== "all") {
      entries = entries.filter((e) =>
        e.skills.some((s) => s.skill.toLowerCase() === skill),
      );
    }

    const hasManager = args.hasManager?.trim();
    if (hasManager === "yes") {
      entries = entries.filter((e) => e.user.managerId !== undefined);
    } else if (hasManager === "no") {
      entries = entries.filter((e) => e.user.managerId === undefined);
    }

    // Sort
    const sortBy = args.sortBy ?? "name";
    const sortDir = args.sortDir === "desc" ? -1 : 1;

    const cmp = (a: string, b: string) =>
      a.localeCompare(b, "id", { sensitivity: "base" });

    entries.sort((a, b) => {
      let result = 0;
      if (sortBy === "department") {
        result = cmp(a.user.department ?? "", b.user.department ?? "");
        if (result === 0)
          result = cmp(a.user.name ?? "", b.user.name ?? "");
      } else if (sortBy === "jobTitle") {
        result = cmp(a.user.jobTitle ?? "", b.user.jobTitle ?? "");
        if (result === 0)
          result = cmp(a.user.name ?? "", b.user.name ?? "");
      } else if (sortBy === "reports") {
        result = a.directReportCount - b.directReportCount;
        if (result === 0)
          result = cmp(a.user.name ?? "", b.user.name ?? "");
      } else {
        result = cmp(a.user.name ?? "", b.user.name ?? "");
      }
      return result * sortDir;
    });

    // Strip sensitive columns for non-admin viewers so private data (NIP, dates
    // of birth, start dates, and all custom fields like salary) never leaves the
    // server for regular employees.
    if (!isAdminViewer) {
      entries = entries.map((e) => ({
        ...e,
        user: redactDirectoryUser(e.user),
      }));
    }

    return entries;
  },
});

export type DirectoryFilterOptions = {
  departments: Array<{ value: string; count: number }>;
  locations: Array<{ value: string; count: number }>;
  jobTitles: Array<{ value: string; count: number }>;
  skills: Array<{ value: string; category: string; count: number }>;
  totalEmployees: number;
  withManagerCount: number;
  withoutManagerCount: number;
};

export const listFilterOptions = query({
  args: {
    organizationId: v.optional(v.id("organizations")), // super_admin only
  },
  handler: async (ctx, args): Promise<DirectoryFilterOptions> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    // Super admin data-access gate: when blocked, return empty stats.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return {
        departments: [],
        locations: [],
        jobTitles: [],
        skills: [],
        totalEmployees: 0,
        withManagerCount: 0,
        withoutManagerCount: 0,
      };
    }

    const scopeOrgId =
      isSuperAdmin && args.organizationId ? args.organizationId : organizationId;

    // Scope users to the resolved organization. Without a scoped org, none.
    let users: Array<Doc<"users">>;
    if (scopeOrgId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", scopeOrgId))
        .collect();
    } else {
      users = [];
    }

    // Exclude platform super_admin accounts and test/simulation accounts from
    // organization stats so headcount and filter counts reflect the real workforce.
    users = users.filter(isCountableEmployee);

    // Scope skills to the same organization
    let skills: Array<Doc<"employeeSkills">>;
    if (scopeOrgId) {
      skills = await ctx.db
        .query("employeeSkills")
        .withIndex("by_organization", (q) => q.eq("organizationId", scopeOrgId))
        .collect();
    } else {
      skills = [];
    }

    const deptMap = new Map<string, number>();
    const locMap = new Map<string, number>();
    const titleMap = new Map<string, number>();
    let withManager = 0;
    let withoutManager = 0;

    for (const u of users) {
      if (u.department && u.department.trim().length > 0) {
        deptMap.set(u.department, (deptMap.get(u.department) ?? 0) + 1);
      }
      if (u.location && u.location.trim().length > 0) {
        locMap.set(u.location, (locMap.get(u.location) ?? 0) + 1);
      }
      if (u.jobTitle && u.jobTitle.trim().length > 0) {
        titleMap.set(u.jobTitle, (titleMap.get(u.jobTitle) ?? 0) + 1);
      }
      if (u.managerId) withManager += 1;
      else withoutManager += 1;
    }

    const skillMap = new Map<
      string,
      { value: string; category: string; count: number }
    >();
    for (const s of skills) {
      const key = s.skill.toLowerCase();
      const existing = skillMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        skillMap.set(key, {
          value: s.skill,
          category: s.category,
          count: 1,
        });
      }
    }

    const asArray = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([value, count]) => ({ value, count }))
        .sort(
          (a, b) =>
            b.count - a.count ||
            a.value.localeCompare(b.value, "id", { sensitivity: "base" }),
        );

    return {
      departments: asArray(deptMap),
      locations: asArray(locMap),
      jobTitles: asArray(titleMap),
      skills: Array.from(skillMap.values()).sort(
        (a, b) =>
          b.count - a.count ||
          a.value.localeCompare(b.value, "id", { sensitivity: "base" }),
      ),
      totalEmployees: users.length,
      withManagerCount: withManager,
      withoutManagerCount: withoutManager,
    };
  },
});

export type EmployeeDetail = {
  user: Doc<"users">;
  manager: Doc<"users"> | null;
  directReports: Array<Doc<"users">>;
  colleagues: Array<Doc<"users">>; // same manager, excluding self
  skills: Array<DirectorySkill>;
  departmentHead: Doc<"users"> | null;
  departmentColor: string | null;
};

export const getEmployeeDetail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<EmployeeDetail | null> => {
    const { userId: callerId, organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    // Viewer privilege: super admins and company admins see all columns; other
    // roles see a redacted set of general columns for everyone but themselves.
    const caller = await ctx.db.get(callerId);
    const isAdminViewer = isSuperAdmin || isAdminRole(caller?.role);

    // Super admin data-access gate: when blocked, hide the employee detail.
    if (await isSuperAdminBlocked(ctx, isSuperAdmin, "directory")) {
      return null;
    }
    // Scoped consent gate: vendor needs the "Data Kepegawaian (HR)" scope.
    if (await isScopeBlocked(ctx, "hr_people")) {
      return null;
    }

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Enforce tenant isolation: user must belong to the effective viewing org
    if (organizationId && user.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this employee",
      });
    }

    // Consent-first for super admins: block viewing full detail of a user whose
    // company has not granted active access.
    if (isSuperAdmin && user.organizationId) {
      const grantedOrgIds = await getGrantedOrgIds(ctx, callerId);
      if (!grantedOrgIds.has(user.organizationId)) {
        return null;
      }
    }

    const manager = user.managerId ? await ctx.db.get(user.managerId) : null;

    const directReports = await ctx.db
      .query("users")
      .withIndex("by_manager", (q) => q.eq("managerId", args.userId))
      .collect();
    directReports.sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "id", { sensitivity: "base" }),
    );

    let colleagues: Array<Doc<"users">> = [];
    if (user.managerId) {
      const siblings = await ctx.db
        .query("users")
        .withIndex("by_manager", (q) => q.eq("managerId", user.managerId))
        .collect();
      colleagues = siblings
        .filter((s) => s._id !== user._id)
        .sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", "id", {
            sensitivity: "base",
          }),
        );
    }

    const skillRows = await ctx.db
      .query("employeeSkills")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const skills: Array<DirectorySkill> = skillRows
      .map((s) => ({ skill: s.skill, category: s.category, level: s.level }))
      .sort((a, b) => b.level - a.level);

    // Department head lookup by department name
    let departmentHead: Doc<"users"> | null = null;
    let departmentColor: string | null = null;
    if (user.department && user.department.trim().length > 0) {
      const dept = await ctx.db
        .query("departments")
        .withIndex("by_name", (q) => q.eq("name", user.department ?? ""))
        .unique();
      if (dept) {
        departmentColor = dept.color;
        if (dept.headId) {
          departmentHead = await ctx.db.get(dept.headId);
        }
      }
    }

    // Redact sensitive columns when a non-admin views someone else's profile.
    // Users always see their own full record.
    const isSelf = user._id === callerId;
    const outUser = isAdminViewer || isSelf ? user : redactDirectoryUser(user);

    return {
      user: outUser,
      manager,
      directReports,
      colleagues,
      skills,
      departmentHead,
      departmentColor,
    };
  },
});
