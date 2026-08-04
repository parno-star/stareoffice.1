import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant, assertSameTenant } from "./lib/tenant";

async function requireAuthUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
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
  return user;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const me = await requireAuthUser(ctx);
  if (!isAdminRole(me.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola struktur organisasi",
    });
  }
  return me;
}

export const listAll = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"users">>> => {
    const { organizationId } = await requireTenant(ctx);
    const all = (await ctx.db.query("users").collect())
      // Super admin accounts manage the platform and should never appear in
      // the organization structure / chart.
      .filter((u) => u.role !== "super_admin");
    // Scope to the caller's org. A super admin without an active grant has
    // organizationId === null and therefore sees no employees.
    return all.filter((u) => u.organizationId === organizationId);
  },
});

/** Returns a map of userId -> positionLevel doc for all users with assigned levels */
export const getPositionLevelMap = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Record<
      string,
      { code: string; name: string; rank: number; color: string }
    >
  > => {
    const { organizationId } = await requireTenant(ctx);
    const allUsers = (await ctx.db.query("users").collect()).filter(
      (u) => u.role !== "super_admin",
    );
    const users = allUsers.filter((u) => u.organizationId === organizationId);

    // Collect unique positionLevelIds
    const levelIds = new Set<Id<"positionLevels">>();
    for (const u of users) {
      if (u.positionLevelId) levelIds.add(u.positionLevelId);
    }

    // Fetch all referenced levels
    const levelMap = new Map<
      Id<"positionLevels">,
      { code: string; name: string; rank: number; color: string }
    >();
    for (const lid of levelIds) {
      const level = await ctx.db.get(lid);
      if (level) {
        levelMap.set(lid, {
          code: level.code,
          name: level.name,
          rank: level.rank,
          color: level.color,
        });
      }
    }

    // Build userId -> level info
    const result: Record<
      string,
      { code: string; name: string; rank: number; color: string }
    > = {};
    for (const u of users) {
      if (u.positionLevelId && levelMap.has(u.positionLevelId)) {
        result[u._id] = levelMap.get(u.positionLevelId)!;
      }
    }
    return result;
  },
});

export const getOrgStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalEmployees: number;
    totalDepartments: number;
    totalManagers: number;
    unassignedCount: number;
  }> => {
    const { organizationId } = await requireTenant(ctx);
    const allUsers = (await ctx.db.query("users").collect()).filter(
      (u) => u.role !== "super_admin",
    );
    // Scope to caller's org (super admin without grant → empty)
    const users = allUsers.filter((u) => u.organizationId === organizationId);

    // Count departments from the official departments table
    const allDepartments = await ctx.db.query("departments").collect();
    const orgDepartments = allDepartments.filter(
      (d) => d.organizationId === organizationId,
    );

    // Also count unique department names from user profiles (for departments not yet in official table)
    const userDeptNames = new Set<string>();
    const managerIds = new Set<string>();
    let unassignedCount = 0;
    for (const u of users) {
      if (u.department && u.department.trim().length > 0) {
        userDeptNames.add(u.department);
      }
      if (u.managerId) {
        managerIds.add(u.managerId);
      } else {
        unassignedCount += 1;
      }
    }
    // Total departments = official departments + user-assigned departments not in official list
    const officialNames = new Set(orgDepartments.map((d) => d.name));
    for (const name of userDeptNames) {
      officialNames.add(name);
    }
    return {
      totalEmployees: users.length,
      totalDepartments: officialNames.size,
      totalManagers: managerIds.size,
      unassignedCount,
    };
  },
});

export const setManager = mutation({
  args: {
    userId: v.id("users"),
    managerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const me = await requireAdmin(ctx);
    const isSuperAdmin = me.role === "super_admin";

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Karyawan tidak ditemukan",
      });
    }

    // Tenant isolation: non-super-admins can only manage users in their org
    if (!isSuperAdmin && target.organizationId !== me.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Karyawan tidak ditemukan di organisasi Anda",
      });
    }

    if (args.managerId && args.managerId === args.userId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Karyawan tidak dapat menjadi atasan dirinya sendiri",
      });
    }

    if (args.managerId) {
      let currentId: Id<"users"> | undefined = args.managerId;
      const seen = new Set<string>();
      while (currentId) {
        if (currentId === args.userId) {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message:
              "Perubahan ini akan membentuk lingkaran hierarki. Pilih atasan lain.",
          });
        }
        if (seen.has(currentId)) break;
        seen.add(currentId);
        const next: Doc<"users"> | null = await ctx.db.get(currentId);
        currentId = next?.managerId;
      }
    }

    const previousManagerId = target.managerId;
    await ctx.db.patch(args.userId, {
      managerId: args.managerId ?? undefined,
    });

    // Log history — include organizationId for tenant-scoped audit logs
    const previousManager = previousManagerId
      ? await ctx.db.get(previousManagerId)
      : null;
    const newManager = args.managerId ? await ctx.db.get(args.managerId) : null;
    await ctx.db.insert("orgHistory", {
      eventType: args.managerId ? "manager_changed" : "manager_cleared",
      actorId: me._id,
      subjectType: "user",
      subjectName: target.name ?? "Tanpa Nama",
      summary: args.managerId
        ? `${me.name ?? "Admin"} mengubah atasan ${target.name ?? "?"} dari ${
            previousManager?.name ?? "—"
          } menjadi ${newManager?.name ?? "?"}`
        : `${me.name ?? "Admin"} melepas atasan ${target.name ?? "?"} (sebelumnya ${
            previousManager?.name ?? "—"
          })`,
      timestamp: new Date().toISOString(),
      organizationId: me.organizationId,
    });
    return args.userId;
  },
});

// ------------- Analytics -------------

export const getAnalytics = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalEmployees: number;
    totalManagers: number;
    icCount: number; // individual contributors (no direct reports)
    maxDepth: number;
    avgSpan: number;
    maxSpan: number;
    topManagers: Array<{ userId: Id<"users">; name: string; reports: number }>;
    depthDistribution: Array<{ depth: number; count: number }>;
    departmentSizes: Array<{ department: string; count: number }>;
  }> => {
    const { organizationId } = await requireTenant(ctx);
    const allUsers = (await ctx.db.query("users").collect()).filter(
      (u) => u.role !== "super_admin",
    );
    // Scope to caller's org (super admin without grant → empty)
    const users = allUsers.filter((u) => u.organizationId === organizationId);

    const total = users.length;

    const directReports = new Map<Id<"users">, Array<Doc<"users">>>();
    for (const u of users) {
      if (u.managerId) {
        const list = directReports.get(u.managerId) ?? [];
        list.push(u);
        directReports.set(u.managerId, list);
      }
    }

    const usersById = new Map<Id<"users">, Doc<"users">>();
    for (const u of users) usersById.set(u._id, u);

    // Depth from root (no manager)
    const depthCache = new Map<Id<"users">, number>();
    function depthOf(userId: Id<"users">, seen: Set<string>): number {
      if (depthCache.has(userId)) return depthCache.get(userId) ?? 0;
      const u = usersById.get(userId);
      if (!u || !u.managerId || seen.has(userId)) {
        depthCache.set(userId, 0);
        return 0;
      }
      seen.add(userId);
      const d = depthOf(u.managerId, seen) + 1;
      depthCache.set(userId, d);
      return d;
    }

    let maxDepth = 0;
    const depthCounts = new Map<number, number>();
    for (const u of users) {
      const d = depthOf(u._id, new Set());
      if (d > maxDepth) maxDepth = d;
      depthCounts.set(d, (depthCounts.get(d) ?? 0) + 1);
    }

    const managerList: Array<{ u: Doc<"users">; reports: number }> = [];
    for (const u of users) {
      const reports = directReports.get(u._id)?.length ?? 0;
      if (reports > 0) managerList.push({ u, reports });
    }
    managerList.sort((a, b) => b.reports - a.reports);

    const totalManagers = managerList.length;
    const icCount = total - totalManagers;
    const totalSpan = managerList.reduce((s, m) => s + m.reports, 0);
    const avgSpan = totalManagers > 0 ? totalSpan / totalManagers : 0;
    const maxSpan = managerList[0]?.reports ?? 0;

    const deptCounts = new Map<string, number>();
    for (const u of users) {
      const key =
        u.department && u.department.trim().length > 0
          ? u.department
          : "Tanpa Departemen";
      deptCounts.set(key, (deptCounts.get(key) ?? 0) + 1);
    }

    return {
      totalEmployees: total,
      totalManagers,
      icCount,
      maxDepth,
      avgSpan: Math.round(avgSpan * 10) / 10,
      maxSpan,
      topManagers: managerList.slice(0, 5).map((m) => ({
        userId: m.u._id,
        name: m.u.name ?? "Tanpa Nama",
        reports: m.reports,
      })),
      depthDistribution: Array.from(depthCounts.entries())
        .map(([depth, count]) => ({ depth, count }))
        .sort((a, b) => a.depth - b.depth),
      departmentSizes: Array.from(deptCounts.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

export const getReportingLine = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Array<Doc<"users">>> => {
    await requireAuthUser(ctx);
    const chain: Array<Doc<"users">> = [];
    const seen = new Set<string>();
    let currentId: Id<"users"> | undefined = args.userId;
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const u: Doc<"users"> | null = await ctx.db.get(currentId);
      if (!u) break;
      chain.push(u);
      currentId = u.managerId;
    }
    // Return top-down (CEO at top)
    return chain.reverse();
  },
});

// ------------- Departments -------------

export const listDepartments = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      department: Doc<"departments">;
      head: Doc<"users"> | null;
      memberCount: number;
    }>
  > => {
    const { organizationId } = await requireTenant(ctx);
    const allDepartments = await ctx.db.query("departments").collect();
    // Scope to caller's org (super admin without grant → empty)
    const departments = allDepartments.filter(
      (d) => d.organizationId === organizationId,
    );

    const allUsers = (await ctx.db.query("users").collect()).filter(
      (u) => u.role !== "super_admin",
    );
    const orgUsers = allUsers.filter(
      (u) => u.organizationId === organizationId,
    );

    const memberCountByName = new Map<string, number>();
    for (const u of orgUsers) {
      if (u.department && u.department.trim().length > 0) {
        memberCountByName.set(
          u.department,
          (memberCountByName.get(u.department) ?? 0) + 1,
        );
      }
    }
    const result: Array<{
      department: Doc<"departments">;
      head: Doc<"users"> | null;
      memberCount: number;
    }> = [];
    for (const d of departments) {
      const head = d.headId ? await ctx.db.get(d.headId) : null;
      result.push({
        department: d,
        head,
        memberCount: memberCountByName.get(d.name) ?? 0,
      });
    }
    result.sort((a, b) => {
      if (a.department.order !== b.department.order) {
        return a.department.order - b.department.order;
      }
      return a.department.name.localeCompare(b.department.name);
    });
    return result;
  },
});

export const getDepartmentByName = query({
  args: { name: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    department: Doc<"departments"> | null;
    head: Doc<"users"> | null;
    members: Array<Doc<"users">>;
    subDepartments: Array<Doc<"departments">>;
  }> => {
    const { organizationId } = await requireTenant(ctx);
    const dept = await ctx.db
      .query("departments")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    const allUsers = (await ctx.db.query("users").collect()).filter(
      (u) => u.role !== "super_admin",
    );
    // Filter members to same org as caller, then by department name
    const members = allUsers
      .filter(
        (u) =>
          (u.department ?? "") === args.name &&
          u.organizationId === organizationId,
      )
      .sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "id", {
          sensitivity: "base",
        }),
      );
    const head = dept?.headId ? await ctx.db.get(dept.headId) : null;
    const subDepartments = dept
      ? await ctx.db
          .query("departments")
          .withIndex("by_parent", (q) => q.eq("parentId", dept._id))
          .collect()
      : [];
    return { department: dept, head, members, subDepartments };
  },
});

export const createDepartment = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    headId: v.optional(v.id("users")),
    parentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args): Promise<Id<"departments">> => {
    const me = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama departemen tidak boleh kosong",
      });
    }
    const existing = await ctx.db
      .query("departments")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Departemen dengan nama tersebut sudah ada",
      });
    }
    const all = await ctx.db.query("departments").collect();
    const order = all.length;
    return await ctx.db.insert("departments", {
      name,
      description: args.description,
      color: args.color,
      icon: args.icon,
      headId: args.headId,
      parentId: args.parentId,
      order,
      // Stamp the new department with the creator's org for tenant isolation
      organizationId: me.organizationId,
    });
  },
});

export const updateDepartment = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    headId: v.optional(v.union(v.id("users"), v.null())),
    parentId: v.optional(v.union(v.id("departments"), v.null())),
  },
  handler: async (ctx, args): Promise<Id<"departments">> => {
    const me = await requireAdmin(ctx);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Departemen tidak ditemukan",
      });
    }
    // Verify caller belongs to the same org as this department (super_admin bypasses)
    if (dept.organizationId) {
      assertSameTenant(me.organizationId ?? null, dept.organizationId, "department");
    }
    const patch: Partial<Doc<"departments">> = {};
    if (args.name !== undefined && args.name.trim().length > 0) {
      const newName = args.name.trim();
      if (newName !== dept.name) {
        const existing = await ctx.db
          .query("departments")
          .withIndex("by_name", (q) => q.eq("name", newName))
          .unique();
        if (existing && existing._id !== dept._id) {
          throw new ConvexError({
            code: "CONFLICT",
            message: "Departemen dengan nama tersebut sudah ada",
          });
        }
        patch.name = newName;
      }
    }
    if (args.description !== undefined) patch.description = args.description;
    if (args.color !== undefined) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.headId !== undefined) {
      patch.headId = args.headId ?? undefined;
    }
    if (args.parentId !== undefined) {
      if (args.parentId === args.departmentId) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Departemen tidak bisa menjadi parent dirinya sendiri",
        });
      }
      patch.parentId = args.parentId ?? undefined;
    }
    await ctx.db.patch(args.departmentId, patch);
    return args.departmentId;
  },
});

export const deleteDepartment = mutation({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Departemen tidak ditemukan",
      });
    }
    // Verify caller belongs to the same org as this department (super_admin bypasses)
    if (dept.organizationId) {
      assertSameTenant(me.organizationId ?? null, dept.organizationId, "department");
    }
    await ctx.db.delete(args.departmentId);
    return null;
  },
});

// ------------- Teams -------------

export const listTeams = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      team: Doc<"teams">;
      lead: Doc<"users"> | null;
      members: Array<Doc<"users">>;
    }>
  > => {
    const { organizationId } = await requireTenant(ctx);
    const allTeams = await ctx.db.query("teams").collect();
    // Scope to caller's org (super admin without grant → empty)
    const teams = allTeams.filter((t) => t.organizationId === organizationId);

    const all: Array<{
      team: Doc<"teams">;
      lead: Doc<"users"> | null;
      members: Array<Doc<"users">>;
    }> = [];
    for (const t of teams) {
      const lead = t.leadId ? await ctx.db.get(t.leadId) : null;
      const memberRows = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", t._id))
        .collect();
      const members: Array<Doc<"users">> = [];
      for (const m of memberRows) {
        const u = await ctx.db.get(m.userId);
        if (u) members.push(u);
      }
      members.sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "id", {
          sensitivity: "base",
        }),
      );
      all.push({ team: t, lead, members });
    }
    all.sort((a, b) => a.team.name.localeCompare(b.team.name));
    return all;
  },
});

export const getTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    team: Doc<"teams"> | null;
    lead: Doc<"users"> | null;
    members: Array<{ user: Doc<"users">; role: string }>;
  }> => {
    const { organizationId } = await requireTenant(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) return { team: null, lead: null, members: [] };
    // Verify caller can access this team. A super admin without an active grant
    // (organizationId === null) cannot access any org-scoped team.
    if (team.organizationId && team.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this team",
      });
    }
    const lead = team.leadId ? await ctx.db.get(team.leadId) : null;
    const memberRows = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const members: Array<{ user: Doc<"users">; role: string }> = [];
    for (const m of memberRows) {
      const u = await ctx.db.get(m.userId);
      if (u) members.push({ user: u, role: m.role });
    }
    members.sort((a, b) => {
      if (a.role === "lead" && b.role !== "lead") return -1;
      if (b.role === "lead" && a.role !== "lead") return 1;
      return (a.user.name ?? "").localeCompare(b.user.name ?? "");
    });
    return { team, lead, members };
  },
});

export const createTeam = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    leadId: v.optional(v.id("users")),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"teams">> => {
    const me = await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama tim tidak boleh kosong",
      });
    }
    // Stamp the new team with the creator's org for tenant isolation
    const teamId = await ctx.db.insert("teams", {
      name,
      description: args.description,
      color: args.color,
      icon: args.icon,
      leadId: args.leadId,
      authorId: me._id,
      memberCount: 0,
      organizationId: me.organizationId,
    });
    const now = new Date().toISOString();
    const seen = new Set<string>();
    let memberCount = 0;
    if (args.leadId) {
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: args.leadId,
        role: "lead",
        joinedAt: now,
      });
      seen.add(args.leadId);
      memberCount += 1;
    }
    for (const uid of args.memberIds) {
      if (seen.has(uid)) continue;
      await ctx.db.insert("teamMembers", {
        teamId,
        userId: uid,
        role: "member",
        joinedAt: now,
      });
      seen.add(uid);
      memberCount += 1;
    }
    await ctx.db.patch(teamId, { memberCount });
    return teamId;
  },
});

export const updateTeam = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    leadId: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, args): Promise<Id<"teams">> => {
    const me = await requireAdmin(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tim tidak ditemukan",
      });
    }
    // Verify caller belongs to the same org as this team (super_admin bypasses)
    if (team.organizationId) {
      assertSameTenant(me.organizationId ?? null, team.organizationId, "team");
    }
    const patch: Partial<Doc<"teams">> = {};
    if (args.name !== undefined && args.name.trim().length > 0) {
      patch.name = args.name.trim();
    }
    if (args.description !== undefined) patch.description = args.description;
    if (args.color !== undefined) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.leadId !== undefined) {
      patch.leadId = args.leadId ?? undefined;
    }
    await ctx.db.patch(args.teamId, patch);
    return args.teamId;
  },
});

export const deleteTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tim tidak ditemukan",
      });
    }
    // Verify caller belongs to the same org as this team (super_admin bypasses)
    if (team.organizationId) {
      assertSameTenant(me.organizationId ?? null, team.organizationId, "team");
    }
    const memberRows = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    for (const m of memberRows) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.teamId);
    return null;
  },
});

export const addTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tim tidak ditemukan",
      });
    }
    // Verify caller belongs to the same org as this team (super_admin bypasses)
    if (team.organizationId) {
      assertSameTenant(me.organizationId ?? null, team.organizationId, "team");
    }
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("userId", args.userId),
      )
      .unique();
    if (existing) return null;
    await ctx.db.insert("teamMembers", {
      teamId: args.teamId,
      userId: args.userId,
      role: args.role,
      joinedAt: new Date().toISOString(),
    });
    await ctx.db.patch(args.teamId, { memberCount: team.memberCount + 1 });
    return null;
  },
});

export const removeTeamMember = mutation({
  args: { teamId: v.id("teams"), userId: v.id("users") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;
    // Verify caller belongs to the same org as this team (super_admin bypasses)
    if (team.organizationId) {
      assertSameTenant(me.organizationId ?? null, team.organizationId, "team");
    }
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("userId", args.userId),
      )
      .unique();
    if (!member) return null;
    await ctx.db.delete(member._id);
    await ctx.db.patch(args.teamId, {
      memberCount: Math.max(0, team.memberCount - 1),
    });
    // If removing the team lead, also clear the team.leadId
    if (team.leadId === args.userId) {
      await ctx.db.patch(args.teamId, { leadId: undefined });
    }
    return null;
  },
});
