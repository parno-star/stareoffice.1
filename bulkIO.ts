import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";
import { getOrgScope } from "./_scope";

// ---------- helpers ----------

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const me = await ctx.db.get(userId);
  if (!me) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User tidak ditemukan" });
  }
  if (!isAdminRole(me.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat melakukan impor/ekspor massal",
    });
  }
  return me;
}

function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

// ---------- Preview + apply employee bulk update ----------

// Row shape coming from the client. Email is the key used to match existing users.
const employeeRowValidator = v.object({
  email: v.string(),
  name: v.optional(v.string()),
  department: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  phone: v.optional(v.string()),
  location: v.optional(v.string()),
  managerEmail: v.optional(v.string()),
  startDate: v.optional(v.string()),
  birthday: v.optional(v.string()),
  // Custom directory field values keyed by the field definition id
  customFields: v.optional(v.record(v.string(), v.string())),
});

type EmployeeRow = {
  email: string;
  name?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  location?: string;
  managerEmail?: string;
  startDate?: string;
  birthday?: string;
  customFields?: Record<string, string>;
};

type EmployeePreview = {
  rowIndex: number;
  email: string;
  status: "match" | "no_match" | "error";
  message?: string;
  userId?: Id<"users">;
  changes: Array<{ field: string; from: string; to: string }>;
};

export const previewEmployeeImport = query({
  args: { rows: v.array(employeeRowValidator) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    matched: number;
    unmatched: number;
    errors: number;
    preview: Array<EmployeePreview>;
  }> => {
    await requireAdmin(ctx);
    const { users } = await getOrgScope(ctx);
    const byEmail = new Map<string, Doc<"users">>();
    for (const u of users) {
      const e = normalizeEmail(u.email);
      if (e.length > 0) byEmail.set(e, u);
    }

    const preview: Array<EmployeePreview> = [];
    let matched = 0;
    let unmatched = 0;
    let errors = 0;

    for (let i = 0; i < args.rows.length; i += 1) {
      const row = args.rows[i] as EmployeeRow;
      const email = normalizeEmail(row.email);
      if (email.length === 0) {
        preview.push({
          rowIndex: i,
          email: row.email,
          status: "error",
          message: "Email kosong",
          changes: [],
        });
        errors += 1;
        continue;
      }
      const user = byEmail.get(email);
      if (!user) {
        preview.push({
          rowIndex: i,
          email,
          status: "no_match",
          message: "Karyawan tidak ditemukan",
          changes: [],
        });
        unmatched += 1;
        continue;
      }

      const changes: Array<{ field: string; from: string; to: string }> = [];
      const record = row as unknown as Record<string, string | undefined>;
      const simpleFields = [
        "name",
        "department",
        "jobTitle",
        "phone",
        "location",
        "startDate",
        "birthday",
      ] as const;
      for (const field of simpleFields) {
        const next = record[field];
        if (next === undefined) continue;
        const trimmed = next.trim();
        if (trimmed.length === 0) continue;
        const current = (user as Record<string, unknown>)[field];
        const currentStr =
          typeof current === "string" ? current : current == null ? "" : String(current);
        if (currentStr !== trimmed) {
          changes.push({ field, from: currentStr, to: trimmed });
        }
      }

      // Manager email -> managerId
      if (row.managerEmail !== undefined) {
        const me = normalizeEmail(row.managerEmail);
        if (me.length === 0) {
          // clear
          if (user.managerId) {
            changes.push({
              field: "managerId",
              from: user.managerId,
              to: "(dilepas)",
            });
          }
        } else {
          const manager = byEmail.get(me);
          if (!manager) {
            preview.push({
              rowIndex: i,
              email,
              status: "error",
              message: `Atasan '${row.managerEmail}' tidak ditemukan`,
              userId: user._id,
              changes,
            });
            errors += 1;
            continue;
          }
          if (manager._id === user._id) {
            preview.push({
              rowIndex: i,
              email,
              status: "error",
              message: "Atasan tidak boleh diri sendiri",
              userId: user._id,
              changes,
            });
            errors += 1;
            continue;
          }
          if (user.managerId !== manager._id) {
            changes.push({
              field: "managerId",
              from: user.managerId
                ? (byEmail.get(normalizeEmail(
                    users.find((u) => u._id === user.managerId)?.email,
                  ))?.name ?? "?")
                : "(kosong)",
              to: manager.name ?? manager.email ?? "?",
            });
          }
        }
      }

      // Custom directory field changes (keyed by definition id)
      if (row.customFields) {
        const currentCustom = user.customFields ?? {};
        for (const [key, value] of Object.entries(row.customFields)) {
          const trimmed = value.trim();
          if (trimmed.length === 0) continue;
          const currentVal = currentCustom[key] ?? "";
          if (currentVal !== trimmed) {
            changes.push({ field: "custom", from: currentVal, to: trimmed });
          }
        }
      }

      preview.push({
        rowIndex: i,
        email,
        status: "match",
        userId: user._id,
        changes,
      });
      matched += 1;
    }

    return { matched, unmatched, errors, preview };
  },
});

export const applyEmployeeImport = mutation({
  args: { rows: v.array(employeeRowValidator) },
  handler: async (
    ctx,
    args,
  ): Promise<{ updated: number; skipped: number; failures: number }> => {
    const me = await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const byEmail = new Map<string, Doc<"users">>();
    for (const u of users) {
      const e = normalizeEmail(u.email);
      if (e.length > 0) byEmail.set(e, u);
    }

    let updated = 0;
    let skipped = 0;
    let failures = 0;

    for (const row of args.rows as Array<EmployeeRow>) {
      const email = normalizeEmail(row.email);
      if (email.length === 0) {
        failures += 1;
        continue;
      }
      const user = byEmail.get(email);
      if (!user) {
        skipped += 1;
        continue;
      }
      const patch: Partial<Doc<"users">> = {};
      const record = row as unknown as Record<string, string | undefined>;
      const simpleFields: Array<
        | "name"
        | "department"
        | "jobTitle"
        | "phone"
        | "location"
        | "startDate"
        | "birthday"
      > = [
        "name",
        "department",
        "jobTitle",
        "phone",
        "location",
        "startDate",
        "birthday",
      ];
      for (const field of simpleFields) {
        const next = record[field];
        if (next === undefined) continue;
        const trimmed = next.trim();
        if (trimmed.length === 0) continue;
        (patch as Record<string, string>)[field] = trimmed;
      }

      if (row.managerEmail !== undefined) {
        const meEmail = normalizeEmail(row.managerEmail);
        if (meEmail.length === 0) {
          patch.managerId = undefined;
        } else {
          const manager = byEmail.get(meEmail);
          if (!manager || manager._id === user._id) {
            failures += 1;
            continue;
          }
          // Simple cycle prevention: walk up manager chain, check for user id
          let guard = 0;
          let cursor: Id<"users"> | undefined = manager._id;
          let circular = false;
          const seen = new Set<string>();
          while (cursor && guard < 64 && !seen.has(cursor)) {
            if (cursor === user._id) {
              circular = true;
              break;
            }
            seen.add(cursor);
            const parent: Doc<"users"> | null = await ctx.db.get(cursor);
            cursor = parent?.managerId;
            guard += 1;
          }
          if (circular) {
            failures += 1;
            continue;
          }
          patch.managerId = manager._id;
        }
      }

      // Merge custom field values (drop empties, keep existing)
      if (row.customFields && Object.keys(row.customFields).length > 0) {
        const merged: Record<string, string> = { ...(user.customFields ?? {}) };
        for (const [key, value] of Object.entries(row.customFields)) {
          const trimmed = value.trim();
          if (trimmed === "") {
            delete merged[key];
          } else {
            merged[key] = trimmed;
          }
        }
        patch.customFields = merged;
      }

      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }
      await ctx.db.patch(user._id, patch);
      updated += 1;

      // Log manager change in org history
      if (patch.managerId !== undefined && patch.managerId !== user.managerId) {
        const previousManager = user.managerId
          ? await ctx.db.get(user.managerId)
          : null;
        const newManager = patch.managerId
          ? await ctx.db.get(patch.managerId)
          : null;
        await ctx.db.insert("orgHistory", {
          eventType: patch.managerId ? "manager_changed" : "manager_cleared",
          actorId: me._id,
          subjectType: "user",
          subjectName: user.name ?? user.email ?? "Tanpa Nama",
          summary: patch.managerId
            ? `${me.name ?? "Admin"} (import massal) mengatur atasan ${
                user.name ?? "?"
              } menjadi ${newManager?.name ?? "?"}`
            : `${me.name ?? "Admin"} (import massal) melepas atasan ${
                user.name ?? "?"
              } (sebelumnya ${previousManager?.name ?? "—"})`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { updated, skipped, failures };
  },
});

// ---------- Bulk import departments ----------

const departmentRowValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  color: v.optional(v.string()),
  icon: v.optional(v.string()),
  headEmail: v.optional(v.string()),
  parentName: v.optional(v.string()),
});

const COLOR_SET = new Set([
  "blue",
  "emerald",
  "violet",
  "amber",
  "rose",
  "sky",
  "teal",
  "orange",
  "pink",
  "indigo",
  "lime",
  "fuchsia",
]);

export const applyDepartmentImport = mutation({
  args: { rows: v.array(departmentRowValidator) },
  handler: async (
    ctx,
    args,
  ): Promise<{ created: number; updated: number; skipped: number }> => {
    await requireAdmin(ctx);
    const { organizationId, users } = await getOrgScope(ctx);
    const byEmail = new Map<string, Doc<"users">>();
    for (const u of users) {
      const e = normalizeEmail(u.email);
      if (e.length > 0) byEmail.set(e, u);
    }

    const allDepartments = await ctx.db.query("departments").collect();
    // Only consider departments in the viewing org.
    const existingDepartments =
      organizationId === null
        ? allDepartments
        : allDepartments.filter((d) => d.organizationId === organizationId);
    const byName = new Map<string, Doc<"departments">>();
    for (const d of existingDepartments) {
      byName.set(d.name.toLowerCase(), d);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let orderCounter = existingDepartments.length;

    for (const row of args.rows) {
      const name = row.name.trim();
      if (name.length === 0) {
        skipped += 1;
        continue;
      }
      const color =
        row.color && COLOR_SET.has(row.color.toLowerCase())
          ? row.color.toLowerCase()
          : "blue";
      const headId = row.headEmail
        ? byEmail.get(normalizeEmail(row.headEmail))?._id
        : undefined;
      const parent = row.parentName
        ? byName.get(row.parentName.trim().toLowerCase())
        : undefined;

      const existing = byName.get(name.toLowerCase());
      if (existing) {
        const patch: Partial<Doc<"departments">> = {};
        if (row.description !== undefined) patch.description = row.description;
        if (row.color !== undefined) patch.color = color;
        if (row.icon !== undefined) patch.icon = row.icon;
        if (row.headEmail !== undefined) patch.headId = headId;
        if (row.parentName !== undefined && parent) patch.parentId = parent._id;
        if (Object.keys(patch).length === 0) {
          skipped += 1;
          continue;
        }
        await ctx.db.patch(existing._id, patch);
        updated += 1;
      } else {
        await ctx.db.insert("departments", {
          name,
          description: row.description,
          color,
          icon: row.icon,
          headId,
          parentId: parent?._id,
          order: orderCounter,
          organizationId: organizationId ?? undefined,
        });
        orderCounter += 1;
        created += 1;
      }
    }

    return { created, updated, skipped };
  },
});

// ---------- Bulk import skills ----------

const skillRowValidator = v.object({
  email: v.string(),
  skill: v.string(),
  category: v.optional(v.string()),
  level: v.number(),
  yearsExperience: v.optional(v.number()),
  note: v.optional(v.string()),
});

const SKILL_CATEGORY_SET = new Set([
  "technical",
  "soft",
  "language",
  "certification",
  "tool",
]);

export const applySkillsImport = mutation({
  args: { rows: v.array(skillRowValidator) },
  handler: async (
    ctx,
    args,
  ): Promise<{ created: number; updated: number; skipped: number }> => {
    await requireAdmin(ctx);
    const { users } = await getOrgScope(ctx);
    const byEmail = new Map<string, Doc<"users">>();
    for (const u of users) {
      const e = normalizeEmail(u.email);
      if (e.length > 0) byEmail.set(e, u);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const email = normalizeEmail(row.email);
      const user = email ? byEmail.get(email) : undefined;
      const skill = row.skill.trim();
      if (!user || skill.length === 0) {
        skipped += 1;
        continue;
      }
      const level = Math.max(1, Math.min(5, Math.round(row.level)));
      const category =
        row.category && SKILL_CATEGORY_SET.has(row.category.toLowerCase())
          ? row.category.toLowerCase()
          : "technical";

      const existing = await ctx.db
        .query("employeeSkills")
        .withIndex("by_user_and_skill", (q) =>
          q.eq("userId", user._id).eq("skill", skill),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          level,
          category,
          yearsExperience: row.yearsExperience,
          note: row.note,
        });
        updated += 1;
      } else {
        await ctx.db.insert("employeeSkills", {
          userId: user._id,
          skill,
          category,
          level,
          yearsExperience: row.yearsExperience,
          note: row.note,
        });
        created += 1;
      }
    }

    return { created, updated, skipped };
  },
});

// ---------- Exports ----------

export const exportEmployees = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      email: string;
      name: string;
      department: string;
      jobTitle: string;
      phone: string;
      location: string;
      managerName: string;
      managerEmail: string;
      startDate: string;
      birthday: string;
      role: string;
    }>
  > => {
    await requireAdmin(ctx);
    const { users } = await getOrgScope(ctx);
    const byId = new Map<Id<"users">, Doc<"users">>();
    for (const u of users) byId.set(u._id, u);
    const result = users.map((u) => {
      const manager = u.managerId ? byId.get(u.managerId) : undefined;
      return {
        email: u.email ?? "",
        name: u.name ?? "",
        department: u.department ?? "",
        jobTitle: u.jobTitle ?? "",
        phone: u.phone ?? "",
        location: u.location ?? "",
        managerName: manager?.name ?? "",
        managerEmail: manager?.email ?? "",
        startDate: u.startDate ?? "",
        birthday: u.birthday ?? "",
        role: u.role ?? "",
      };
    });
    result.sort((a, b) => a.name.localeCompare(b.name, "id"));
    return result;
  },
});

export const exportDepartments = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      name: string;
      description: string;
      color: string;
      icon: string;
      headName: string;
      headEmail: string;
      parentName: string;
      memberCount: number;
    }>
  > => {
    await requireAdmin(ctx);
    const { organizationId, users } = await getOrgScope(ctx);
    const allDepartments = await ctx.db.query("departments").collect();
    const departments =
      organizationId === null
        ? allDepartments
        : allDepartments.filter((d) => d.organizationId === organizationId);
    const deptById = new Map<Id<"departments">, Doc<"departments">>();
    for (const d of departments) deptById.set(d._id, d);
    const memberCountByName = new Map<string, number>();
    for (const u of users) {
      if (u.department && u.department.trim().length > 0) {
        memberCountByName.set(
          u.department,
          (memberCountByName.get(u.department) ?? 0) + 1,
        );
      }
    }
    const rows = [];
    for (const d of departments) {
      const head = d.headId ? await ctx.db.get(d.headId) : null;
      const parent = d.parentId ? deptById.get(d.parentId) : undefined;
      rows.push({
        name: d.name,
        description: d.description ?? "",
        color: d.color,
        icon: d.icon ?? "",
        headName: head?.name ?? "",
        headEmail: head?.email ?? "",
        parentName: parent?.name ?? "",
        memberCount: memberCountByName.get(d.name) ?? 0,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
    return rows;
  },
});

export const exportTeams = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      name: string;
      description: string;
      color: string;
      leadName: string;
      leadEmail: string;
      memberCount: number;
      memberEmails: string;
    }>
  > => {
    await requireAdmin(ctx);
    const { organizationId, isMember } = await getOrgScope(ctx);
    const allTeams = await ctx.db.query("teams").collect();
    const teams =
      organizationId === null
        ? allTeams
        : allTeams.filter((t) =>
            t.organizationId !== undefined
              ? t.organizationId === organizationId
              : isMember(t.leadId) || isMember(t.authorId),
          );
    const rows = [];
    for (const t of teams) {
      const lead = t.leadId ? await ctx.db.get(t.leadId) : null;
      const memberRows = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", t._id))
        .collect();
      const emails: Array<string> = [];
      for (const m of memberRows) {
        const u = await ctx.db.get(m.userId);
        if (u?.email) emails.push(u.email);
      }
      rows.push({
        name: t.name,
        description: t.description ?? "",
        color: t.color,
        leadName: lead?.name ?? "",
        leadEmail: lead?.email ?? "",
        memberCount: memberRows.length,
        memberEmails: emails.join(";"),
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
    return rows;
  },
});

export const exportSkills = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      email: string;
      name: string;
      skill: string;
      category: string;
      level: number;
      yearsExperience: number;
      note: string;
    }>
  > => {
    await requireAdmin(ctx);
    const { userIds, isMember } = await getOrgScope(ctx);
    const allSkills = await ctx.db.query("employeeSkills").collect();
    const skills =
      userIds === null
        ? allSkills
        : allSkills.filter((s) => isMember(s.userId));
    const rows = [];
    for (const s of skills) {
      const u = await ctx.db.get(s.userId);
      rows.push({
        email: u?.email ?? "",
        name: u?.name ?? "",
        skill: s.skill,
        category: s.category,
        level: s.level,
        yearsExperience: s.yearsExperience ?? 0,
        note: s.note ?? "",
      });
    }
    rows.sort(
      (a, b) => a.name.localeCompare(b.name, "id") || a.skill.localeCompare(b.skill),
    );
    return rows;
  },
});

export const exportSuccessionPlans = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      incumbentName: string;
      incumbentEmail: string;
      incumbentTitle: string;
      candidateName: string;
      candidateEmail: string;
      candidateTitle: string;
      readiness: string;
      priority: number;
      strengths: string;
      development: string;
    }>
  > => {
    await requireAdmin(ctx);
    const { userIds, isMember } = await getOrgScope(ctx);
    const allPlans = await ctx.db.query("successionPlans").collect();
    const plans =
      userIds === null
        ? allPlans
        : allPlans.filter((p) => isMember(p.incumbentId));
    const rows = [];
    for (const p of plans) {
      const inc = await ctx.db.get(p.incumbentId);
      const cand = await ctx.db.get(p.candidateId);
      rows.push({
        incumbentName: inc?.name ?? "",
        incumbentEmail: inc?.email ?? "",
        incumbentTitle: inc?.jobTitle ?? "",
        candidateName: cand?.name ?? "",
        candidateEmail: cand?.email ?? "",
        candidateTitle: cand?.jobTitle ?? "",
        readiness: p.readiness,
        priority: p.priority,
        strengths: p.strengths ?? "",
        development: p.development ?? "",
      });
    }
    rows.sort((a, b) => a.incumbentName.localeCompare(b.incumbentName, "id"));
    return rows;
  },
});

export const exportOrgTree = query({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdmin(ctx);
    const { users } = await getOrgScope(ctx);
    const byId = new Map<Id<"users">, Doc<"users">>();
    for (const u of users) byId.set(u._id, u);

    type TreeNode = {
      id: Id<"users">;
      name: string;
      email: string;
      title: string;
      department: string;
      children: Array<TreeNode>;
    };

    const childrenByParent = new Map<Id<"users">, Array<Doc<"users">>>();
    const roots: Array<Doc<"users">> = [];
    for (const u of users) {
      if (u.managerId && byId.has(u.managerId)) {
        const list = childrenByParent.get(u.managerId) ?? [];
        list.push(u);
        childrenByParent.set(u.managerId, list);
      } else {
        roots.push(u);
      }
    }

    const toNode = (u: Doc<"users">): TreeNode => ({
      id: u._id,
      name: u.name ?? "",
      email: u.email ?? "",
      title: u.jobTitle ?? "",
      department: u.department ?? "",
      children: (childrenByParent.get(u._id) ?? [])
        .slice()
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "id"))
        .map(toNode),
    });

    const tree = roots
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "id"))
      .map(toNode);

    return JSON.stringify(
      { generatedAt: new Date().toISOString(), tree },
      null,
      2,
    );
  },
});
