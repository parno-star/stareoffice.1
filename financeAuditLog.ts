/**
 * Finance Audit Log
 *
 * Immutable event log for the entire lifecycle of fund requests.
 * Provides queries for timeline view, reporting, and data export.
 */

import { ConvexError, v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, canManageFinance, canApprove } from "./roles";
import { requireTenant } from "./lib/tenant";
import { paginationOptsValidator } from "convex/server";

// ─── Auth helper ────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

// ─── Audit Log Writer (internal helper for mutations) ───────────────────────

export type AuditLogEntry = {
  fundRequestId: Id<"fundRequests">;
  action: string;
  actorId: Id<"users">;
  actorName: string;
  actorRole?: string;
  approvalLevel?: number;
  note?: string;
  requestTitle: string;
  requestAmount: number;
  requestStatus: string;
  requestCategory: string;
  requestType?: string;
  submitterId: Id<"users">;
  submitterName?: string;
  submitterDepartment?: string;
  metadata?: string;
  organizationId?: Id<"organizations">;
};

/**
 * Writes an audit log entry. Call from any mutation.
 */
export async function writeAuditLog(
  ctx: MutationCtx,
  entry: AuditLogEntry,
): Promise<Id<"financeAuditLog">> {
  return ctx.db.insert("financeAuditLog", {
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

// ─── Internal mutation (for use with ctx.scheduler or runMutation) ──────────

export const insertAuditLog = internalMutation({
  args: {
    fundRequestId: v.id("fundRequests"),
    action: v.string(),
    actorId: v.id("users"),
    actorName: v.string(),
    actorRole: v.optional(v.string()),
    approvalLevel: v.optional(v.number()),
    note: v.optional(v.string()),
    requestTitle: v.string(),
    requestAmount: v.number(),
    requestStatus: v.string(),
    requestCategory: v.string(),
    requestType: v.optional(v.string()),
    submitterId: v.id("users"),
    submitterName: v.optional(v.string()),
    submitterDepartment: v.optional(v.string()),
    metadata: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("financeAuditLog", {
      ...args,
      timestamp: new Date().toISOString(),
    });
  },
});

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get the audit timeline for a specific fund request.
 * Available to the submitter, approvers, and privileged users.
 */
export const getRequestTimeline = query({
  args: { fundRequestId: v.id("fundRequests") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.fundRequestId);
    if (!req) return [];

    // Access control: submitter, privileged users, or approvers
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);
    if (!isPrivileged && req.submitterId !== me._id) {
      // Check if user is an approver for this request
      const approvals = await ctx.db
        .query("fundRequestApprovals")
        .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
        .collect();
      const isApprover = approvals.some((a) => a.approverId === me._id);
      if (!isApprover) return [];
    }

    const logs = await ctx.db
      .query("financeAuditLog")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();

    // Sort chronologically
    logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Enrich with actor avatar
    const enriched = await Promise.all(
      logs.map(async (log) => {
        const actor = await ctx.db.get(log.actorId);
        return {
          ...log,
          actorAvatar: actor?.avatarUrl ?? null,
        };
      }),
    );

    return enriched;
  },
});

/**
 * List all audit logs with pagination and filters.
 * Only available to admin/finance roles.
 */
export const listAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    actionFilter: v.optional(v.string()),
    actorFilter: v.optional(v.id("users")),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role);
    if (!isPrivileged) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Akses ditolak" });
    }

    // Query by action filter if provided, otherwise by timestamp
    let baseQuery;
    if (args.actionFilter && args.actionFilter !== "all") {
      baseQuery = ctx.db
        .query("financeAuditLog")
        .withIndex("by_action", (q) => q.eq("action", args.actionFilter!));
    } else {
      baseQuery = ctx.db
        .query("financeAuditLog")
        .withIndex("by_timestamp");
    }

    const results = await baseQuery
      .order("desc")
      .paginate(args.paginationOpts);

    // Apply additional filters on the page
    let filtered = results.page;
    if (args.actorFilter) {
      filtered = filtered.filter((l) => l.actorId === args.actorFilter);
    }
    if (args.dateFrom) {
      filtered = filtered.filter((l) => l.timestamp >= args.dateFrom!);
    }
    if (args.dateTo) {
      const endOfDay = args.dateTo + "T23:59:59.999Z";
      filtered = filtered.filter((l) => l.timestamp <= endOfDay);
    }

    // Enrich
    const enriched = await Promise.all(
      filtered.map(async (log) => {
        const actor = await ctx.db.get(log.actorId);
        return {
          ...log,
          actorAvatar: actor?.avatarUrl ?? null,
        };
      }),
    );

    return {
      ...results,
      page: enriched,
    };
  },
});

/**
 * Get audit log statistics for the reporting dashboard.
 */
export const getAuditStats = query({
  args: {
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);
    if (!isPrivileged) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Akses ditolak" });
    }

    const allLogs = await ctx.db
      .query("financeAuditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    // Apply date filter
    let filtered = allLogs;
    if (args.dateFrom) {
      filtered = filtered.filter((l) => l.timestamp >= args.dateFrom!);
    }
    if (args.dateTo) {
      const endOfDay = args.dateTo + "T23:59:59.999Z";
      filtered = filtered.filter((l) => l.timestamp <= endOfDay);
    }

    // Count by action type
    const byAction: Record<string, number> = {};
    for (const log of filtered) {
      byAction[log.action] = (byAction[log.action] ?? 0) + 1;
    }

    // Count by actor (top 10)
    const byActor: Record<string, { count: number; name: string }> = {};
    for (const log of filtered) {
      if (!byActor[log.actorId]) {
        byActor[log.actorId] = { count: 0, name: log.actorName };
      }
      byActor[log.actorId].count++;
    }
    const topActors = Object.entries(byActor)
      .map(([id, data]) => ({ id, name: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Monthly breakdown
    const byMonth: Record<string, Record<string, number>> = {};
    for (const log of filtered) {
      const month = log.timestamp.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = {};
      byMonth[month][log.action] = (byMonth[month][log.action] ?? 0) + 1;
    }

    // Average time between submit and approval/rejection
    const requestTimelines: Record<string, { submitted?: string; resolved?: string }> = {};
    for (const log of filtered) {
      const rid = log.fundRequestId;
      if (!requestTimelines[rid]) requestTimelines[rid] = {};
      if (log.action === "submitted") {
        requestTimelines[rid].submitted = log.timestamp;
      }
      if (log.action === "approved" || log.action === "rejected") {
        requestTimelines[rid].resolved = log.timestamp;
      }
    }

    let totalResolutionHours = 0;
    let resolvedCount = 0;
    for (const rt of Object.values(requestTimelines)) {
      if (rt.submitted && rt.resolved) {
        const diff = new Date(rt.resolved).getTime() - new Date(rt.submitted).getTime();
        totalResolutionHours += diff / (1000 * 60 * 60);
        resolvedCount++;
      }
    }
    const avgResolutionHours = resolvedCount > 0 ? Math.round(totalResolutionHours / resolvedCount) : null;

    return {
      totalEvents: filtered.length,
      byAction,
      topActors,
      byMonth,
      avgResolutionHours,
    };
  },
});

/**
 * Get all audit logs for CSV export (no pagination).
 * Only admin/finance manager.
 */
export const getAuditLogsForExport = query({
  args: {
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    actionFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role);
    if (!isPrivileged) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Akses ditolak" });
    }

    const allLogs = await ctx.db
      .query("financeAuditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    let filtered = allLogs;
    if (args.actionFilter && args.actionFilter !== "all") {
      filtered = filtered.filter((l) => l.action === args.actionFilter);
    }
    if (args.dateFrom) {
      filtered = filtered.filter((l) => l.timestamp >= args.dateFrom!);
    }
    if (args.dateTo) {
      const endOfDay = args.dateTo + "T23:59:59.999Z";
      filtered = filtered.filter((l) => l.timestamp <= endOfDay);
    }

    return filtered;
  },
});
