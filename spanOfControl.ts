import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { getOrgScope } from "./_scope";

export type SpanRow = {
  manager: Doc<"users">;
  directReports: number;
  totalReports: number; // entire subtree
  depth: number; // max depth of subtree below this manager (0 = only ICs)
  // "healthy" | "stretched" | "underused" | "lonely" | "deep"
  health: string;
  // Department breakdown of direct reports (first 3, plus overflow)
  departments: Array<{ name: string; count: number }>;
};

export type SpanStats = {
  totalManagers: number;
  totalIcs: number;
  managerRatio: number; // ics / managers
  avgSpan: number;
  maxSpan: number;
  stretchedCount: number; // managers with > 8 direct reports
  underusedCount: number; // managers with 1 direct report
  orphanCount: number; // ICs without a manager
  maxDepth: number; // deepest management chain in org
  rows: Array<SpanRow>;
};

export const getSpanStats = query({
  args: {},
  handler: async (ctx): Promise<SpanStats> => {
    const { users } = await getOrgScope(ctx);
    const userById = new Map<Id<"users">, Doc<"users">>();
    const childrenOf = new Map<Id<"users">, Array<Doc<"users">>>();
    for (const u of users) {
      userById.set(u._id, u);
    }
    for (const u of users) {
      if (u.managerId) {
        const list = childrenOf.get(u.managerId) ?? [];
        list.push(u);
        childrenOf.set(u.managerId, list);
      }
    }

    const managerIds = new Set<Id<"users">>();
    for (const [mid, kids] of childrenOf.entries()) {
      if (kids.length > 0) managerIds.add(mid);
    }

    const orphans = users.filter(
      (u) => !u.managerId && !managerIds.has(u._id),
    );

    const rows: Array<SpanRow> = [];

    const subtreeSize = (root: Id<"users">): number => {
      let total = 0;
      const stack: Array<Id<"users">> = [root];
      while (stack.length > 0) {
        const id = stack.pop()!;
        const kids = childrenOf.get(id) ?? [];
        for (const k of kids) {
          total += 1;
          stack.push(k._id);
        }
      }
      return total;
    };

    const subtreeDepth = (root: Id<"users">): number => {
      // BFS; returns max levels below root (0 if no reports).
      let depth = 0;
      let frontier: Array<Id<"users">> = [root];
      while (frontier.length > 0) {
        const next: Array<Id<"users">> = [];
        for (const id of frontier) {
          const kids = childrenOf.get(id) ?? [];
          for (const k of kids) next.push(k._id);
        }
        if (next.length === 0) break;
        depth += 1;
        frontier = next;
      }
      return depth;
    };

    let totalSpan = 0;
    let maxSpan = 0;
    let maxDepth = 0;
    let stretched = 0;
    let underused = 0;

    for (const mid of managerIds) {
      const manager = userById.get(mid);
      if (!manager) continue;
      const kids = childrenOf.get(mid) ?? [];
      const direct = kids.length;
      const total = subtreeSize(mid);
      const depth = subtreeDepth(mid);
      totalSpan += direct;
      if (direct > maxSpan) maxSpan = direct;
      if (depth > maxDepth) maxDepth = depth;

      let health: string;
      if (direct > 10) {
        health = "stretched";
        stretched += 1;
      } else if (direct >= 5 && direct <= 10) {
        health = "healthy";
      } else if (direct === 1) {
        health = "underused";
        underused += 1;
      } else if (depth >= 4) {
        health = "deep";
      } else {
        health = "lonely";
      }

      const deptCounts = new Map<string, number>();
      for (const k of kids) {
        const d = (k.department ?? "Tanpa Departemen").trim() || "Tanpa Departemen";
        deptCounts.set(d, (deptCounts.get(d) ?? 0) + 1);
      }
      const departments = Array.from(deptCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      rows.push({
        manager,
        directReports: direct,
        totalReports: total,
        depth,
        health,
        departments,
      });
    }

    rows.sort((a, b) => b.directReports - a.directReports);

    const totalManagers = managerIds.size;
    const totalIcs = users.length - totalManagers;
    const avgSpan = totalManagers > 0 ? totalSpan / totalManagers : 0;

    return {
      totalManagers,
      totalIcs,
      managerRatio:
        totalManagers > 0
          ? Math.round((totalIcs / totalManagers) * 10) / 10
          : 0,
      avgSpan: Math.round(avgSpan * 10) / 10,
      maxSpan,
      stretchedCount: stretched,
      underusedCount: underused,
      orphanCount: orphans.length,
      maxDepth,
      rows,
    };
  },
});
