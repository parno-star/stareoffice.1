import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { getOrgScope } from "./_scope";

export const compareDepartments = query({
  args: { departments: v.array(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      department: string;
      headcount: number;
      managers: number;
      ics: number;
      avgSpan: number;
      avgTenureYears: number;
      openPositions: number;
      skillsCount: number;
    }>
  > => {
    const { users } = await getOrgScope(ctx);
    if (args.departments.length === 0) return [];

    const directReports = new Map<Id<"users">, number>();
    for (const u of users) {
      if (u.managerId) {
        directReports.set(u.managerId, (directReports.get(u.managerId) ?? 0) + 1);
      }
    }

    const now = Date.now();
    const memberIdsAll = new Set(users.map((u) => u._id));
    const allSkills = await ctx.db.query("employeeSkills").collect();
    const skills = allSkills.filter((s) => memberIdsAll.has(s.userId));
    const allPositions = await ctx.db.query("headcountPositions").collect();
    const orgDeptNames = new Set(
      users.map((u) => (u.department ?? "").trim()).filter((d) => d.length > 0),
    );
    const positions = allPositions.filter((p) => orgDeptNames.has(p.department));

    return args.departments.map((dept) => {
      const members = users.filter((u) => (u.department ?? "") === dept);
      let managers = 0;
      let spanTotal = 0;
      let tenureSum = 0;
      let tenureCount = 0;
      for (const m of members) {
        const reports = directReports.get(m._id) ?? 0;
        if (reports > 0) {
          managers += 1;
          spanTotal += reports;
        }
        if (m.startDate) {
          const ts = new Date(m.startDate + "T00:00:00Z").getTime();
          if (!Number.isNaN(ts)) {
            const years = (now - ts) / (365.25 * 24 * 3600 * 1000);
            if (years >= 0) {
              tenureSum += years;
              tenureCount += 1;
            }
          }
        }
      }
      const memberIds = new Set(members.map((m) => m._id));
      const skillsCount = skills.filter((s) => memberIds.has(s.userId)).length;
      const openPositions = positions.filter(
        (p) =>
          p.department === dept &&
          p.status !== "filled" &&
          p.status !== "cancelled",
      ).length;
      return {
        department: dept,
        headcount: members.length,
        managers,
        ics: members.length - managers,
        avgSpan: managers > 0 ? Math.round((spanTotal / managers) * 10) / 10 : 0,
        avgTenureYears:
          tenureCount > 0 ? Math.round((tenureSum / tenureCount) * 10) / 10 : 0,
        openPositions,
        skillsCount,
      };
    });
  },
});

export const aiSearch = query({
  args: { query: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      user: Doc<"users">;
      score: number;
      reasons: Array<string>;
    }>
  > => {
    const { users } = await getOrgScope(ctx);
    const query = args.query.trim().toLowerCase();
    if (query.length === 0) return [];

    const tokens = query
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1);

    const memberIds = new Set(users.map((u) => u._id));
    const allSkills = await ctx.db.query("employeeSkills").collect();
    const skills = allSkills.filter((s) => memberIds.has(s.userId));
    const skillsByUser = new Map<Id<"users">, Array<Doc<"employeeSkills">>>();
    for (const s of skills) {
      const list = skillsByUser.get(s.userId) ?? [];
      list.push(s);
      skillsByUser.set(s.userId, list);
    }

    const scored = users.map((u) => {
      const reasons: Array<string> = [];
      let score = 0;
      const haystacks: Array<{ field: string; value: string; weight: number }> = [
        { field: "name", value: (u.name ?? "").toLowerCase(), weight: 3 },
        {
          field: "jobTitle",
          value: (u.jobTitle ?? "").toLowerCase(),
          weight: 3,
        },
        {
          field: "department",
          value: (u.department ?? "").toLowerCase(),
          weight: 2,
        },
        { field: "bio", value: (u.bio ?? "").toLowerCase(), weight: 1 },
        {
          field: "location",
          value: (u.location ?? "").toLowerCase(),
          weight: 1,
        },
      ];
      for (const t of tokens) {
        for (const h of haystacks) {
          if (h.value.includes(t)) {
            score += h.weight;
            reasons.push(`${h.field}: "${t}"`);
          }
        }
        const userSkills = skillsByUser.get(u._id) ?? [];
        for (const s of userSkills) {
          if (s.skill.toLowerCase().includes(t)) {
            score += 2 + s.level;
            reasons.push(`keahlian ${s.skill} (Lv ${s.level})`);
          }
        }
      }
      return { user: u, score, reasons };
    });

    const filtered = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return filtered.map((s) => ({
      user: s.user,
      score: s.score,
      reasons: Array.from(new Set(s.reasons)).slice(0, 5),
    }));
  },
});
