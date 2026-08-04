import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { getOrgScope } from "./_scope";

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ row: Doc<"orgHistory">; actor: Doc<"users"> | null }>
  > => {
    const { organizationId, isMember } = await getOrgScope(ctx);
    const take = Math.min(Math.max(args.limit ?? 50, 1), 200);
    // Always scope: a super admin without an active grant has no org in scope
    // and therefore sees no history. Over-fetch so the post-filter still yields
    // a full page.
    const rows = await ctx.db
      .query("orgHistory")
      .withIndex("by_timestamp")
      .order("desc")
      .take(take * 10);
    const scoped = rows.filter((r) =>
      r.organizationId !== undefined
        ? r.organizationId === organizationId
        : isMember(r.actorId),
    );
    const limited = scoped.slice(0, take);
    const actorCache = new Map<Id<"users">, Doc<"users"> | null>();
    const out: Array<{ row: Doc<"orgHistory">; actor: Doc<"users"> | null }> = [];
    for (const r of limited) {
      let actor = actorCache.get(r.actorId);
      if (actor === undefined) {
        actor = await ctx.db.get(r.actorId);
        actorCache.set(r.actorId, actor);
      }
      out.push({ row: r, actor });
    }
    return out;
  },
});

/**
 * Full timeline with filters, search, and grouping metadata for the
 * enhanced timeline panel. Returns the latest `limit` entries after
 * filtering.
 */
export const listTimeline = query({
  args: {
    limit: v.optional(v.number()),
    // Filter by event group: "manager" | "department" | "team" | "position" | "dotted_line" | "all"
    filter: v.optional(v.string()),
    // Optional full text search over summary + subjectName
    search: v.optional(v.string()),
    // Optional actor filter
    actorId: v.optional(v.id("users")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    entries: Array<{
      row: Doc<"orgHistory">;
      actor: Doc<"users"> | null;
      dayKey: string;
    }>;
    counts: {
      total: number;
      manager: number;
      department: number;
      team: number;
      position: number;
      dottedLine: number;
    };
    topActors: Array<{ user: Doc<"users">; count: number }>;
    hasMore: boolean;
  }> => {
    const { organizationId, isMember } = await getOrgScope(ctx);
    const take = Math.min(Math.max(args.limit ?? 100, 1), 500);
    // Always scope (no org in scope → no results). Over-fetch for the page.
    const fetched = await ctx.db
      .query("orgHistory")
      .withIndex("by_timestamp")
      .order("desc")
      .take((take + 1) * 10);

    const scopedRows = fetched.filter((r) =>
      r.organizationId !== undefined
        ? r.organizationId === organizationId
        : isMember(r.actorId),
    );

    const hasMore = scopedRows.length > take;
    const slicedAll = hasMore ? scopedRows.slice(0, take) : scopedRows;

    const filter = args.filter?.toLowerCase();
    const searchTerm = args.search?.trim().toLowerCase() ?? "";

    const matchesFilter = (row: Doc<"orgHistory">): boolean => {
      if (!filter || filter === "all") return true;
      return row.eventType.startsWith(filter);
    };
    const matchesSearch = (row: Doc<"orgHistory">): boolean => {
      if (!searchTerm) return true;
      return (
        row.summary.toLowerCase().includes(searchTerm) ||
        row.subjectName.toLowerCase().includes(searchTerm)
      );
    };
    const matchesActor = (row: Doc<"orgHistory">): boolean => {
      if (!args.actorId) return true;
      return row.actorId === args.actorId;
    };

    const filtered = slicedAll.filter(
      (r) => matchesFilter(r) && matchesSearch(r) && matchesActor(r),
    );

    const actorCache = new Map<Id<"users">, Doc<"users"> | null>();
    const actorCount = new Map<Id<"users">, number>();
    const entries: Array<{
      row: Doc<"orgHistory">;
      actor: Doc<"users"> | null;
      dayKey: string;
    }> = [];
    for (const r of filtered) {
      let actor = actorCache.get(r.actorId);
      if (actor === undefined) {
        actor = await ctx.db.get(r.actorId);
        actorCache.set(r.actorId, actor);
      }
      actorCount.set(r.actorId, (actorCount.get(r.actorId) ?? 0) + 1);
      entries.push({
        row: r,
        actor,
        dayKey: r.timestamp.slice(0, 10),
      });
    }

    // Counts across full (unfiltered-by-search) slice for tab badges
    const counts = {
      total: slicedAll.length,
      manager: slicedAll.filter((r) => r.eventType.startsWith("manager")).length,
      department: slicedAll.filter((r) => r.eventType.startsWith("department"))
        .length,
      team: slicedAll.filter((r) => r.eventType.startsWith("team")).length,
      position: slicedAll.filter((r) => r.eventType.startsWith("position"))
        .length,
      dottedLine: slicedAll.filter((r) => r.eventType.startsWith("dotted"))
        .length,
    };

    // Top 5 actors across filtered range
    const topActors: Array<{ user: Doc<"users">; count: number }> = [];
    const actorPairs = Array.from(actorCount.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    for (const [id, count] of actorPairs.slice(0, 5)) {
      const user = actorCache.get(id);
      if (user) topActors.push({ user, count });
    }

    return { entries, counts, topActors, hasMore };
  },
});
