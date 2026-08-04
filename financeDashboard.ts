/**
 * Finance Dashboard – backend queries for the comprehensive
 * finance dashboard with SLA monitoring, trend analytics,
 * and approval tracking.
 */
import { ConvexError, v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, canManageFinance, canApprove } from "./roles";
import { requireTenant, isScopeBlocked } from "./lib/tenant";

// ─── Auth helper ────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const { user } = await requireFinanceContext(ctx);
  return user;
}

// Returns the caller and the effective organization in scope. The organization
// comes from requireTenant, which for a super admin resolves to the viewing org
// ONLY when an active data-access grant exists (otherwise null). Privileged
// finance queries must scope to this org so a super admin without a grant sees
// no cross-organization data.
async function requireFinanceContext(
  ctx: QueryCtx,
): Promise<{ user: Doc<"users">; organizationId: Id<"organizations"> | null }> {
  const { userId, organizationId } = await requireTenant(ctx, {
    allowSuperAdmin: true,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { user, organizationId };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type DashboardSummary = {
  totalRequests: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  disbursedCount: number;
  disbursedAmount: number;
  revisionCount: number;
  draftCount: number;
  awaitingMyApproval: number;
};

export type SlaItem = {
  requestId: Id<"fundRequests">;
  title: string;
  amount: number;
  status: string;
  submitterName: string | null;
  submitterAvatar: string | null;
  category: string;
  requestType: string | null;
  currentLevel: number;
  totalLevels: number;
  currentApproverName: string | null;
  slaDeadline: string | null;
  isOverdue: boolean;
  hoursRemaining: number | null;
  submittedAt: string | null;
};

export type MonthlyTrend = {
  month: string; // "YYYY-MM"
  label: string; // "Jan 2026"
  submitted: number;
  approved: number;
  rejected: number;
  disbursed: number;
  totalAmount: number;
  approvedAmount: number;
};

export type CategoryBreakdown = {
  category: string;
  label: string;
  count: number;
  amount: number;
  approvedAmount: number;
};

export type DepartmentBreakdown = {
  department: string;
  count: number;
  amount: number;
  approvedAmount: number;
  pendingCount: number;
};

export type RequestTypeBreakdown = {
  requestType: string;
  label: string;
  count: number;
  amount: number;
};

export type RecentActivity = {
  requestId: Id<"fundRequests">;
  title: string;
  amount: number;
  status: string;
  action: string; // "submitted" | "approved" | "rejected" | "disbursed" | "revision"
  actorName: string | null;
  timestamp: string;
};

export type PendingApprovalItem = {
  requestId: Id<"fundRequests">;
  title: string;
  amount: number;
  category: string;
  requestType: string | null;
  submitterName: string | null;
  submitterAvatar: string | null;
  submitterJobTitle: string | null;
  level: number;
  totalLevels: number;
  slaDeadline: string | null;
  isOverdue: boolean;
  hoursRemaining: number | null;
  submittedAt: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonthLabel(monthStr: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [year, month] = monthStr.split("-");
  return `${MONTHS[parseInt(month, 10) - 1]} ${year}`;
}

function computeSlaInfo(deadline: string | null | undefined): { isOverdue: boolean; hoursRemaining: number | null } {
  if (!deadline) return { isOverdue: false, hoursRemaining: null };
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diff = deadlineMs - now;
  return {
    isOverdue: diff < 0,
    hoursRemaining: Math.round(diff / (1000 * 60 * 60)),
  };
}

// ─── Summary Stats ──────────────────────────────────────────────────────────

export const getSummary = query({
  args: {},
  handler: async (ctx): Promise<DashboardSummary> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    // Scoped consent gate: a vendor without the "Keuangan & Penggajian" scope
    // must not see company-wide finance data — downgrade to their own only.
    const financeScopeBlocked = await isScopeBlocked(ctx, "finance_payroll");
    const isPrivileged =
      !financeScopeBlocked &&
      (isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role));

    let all: Doc<"fundRequests">[];
    if (isPrivileged) {
      // Privileged users see their organization's requests. A super admin
      // without an active grant has organizationId === null → nothing.
      all = organizationId
        ? await ctx.db
            .query("fundRequests")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .collect()
        : [];
    } else {
      all = await ctx.db
        .query("fundRequests")
        .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
        .collect();
    }

    const pendingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_approver_and_status", (q) =>
        q.eq("approverId", me._id).eq("status", "pending"),
      )
      .collect();

    // Count active pending approvals (only at current level)
    let awaitingMyApproval = 0;
    for (const a of pendingApprovals) {
      const req = await ctx.db.get(a.fundRequestId);
      if (req && req.currentApprovalLevel === a.level && (req.status === "in_review" || req.status === "pending")) {
        awaitingMyApproval++;
      }
    }

    const summary: DashboardSummary = {
      totalRequests: all.length,
      totalAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      approvedCount: 0,
      approvedAmount: 0,
      rejectedCount: 0,
      rejectedAmount: 0,
      disbursedCount: 0,
      disbursedAmount: 0,
      revisionCount: 0,
      draftCount: 0,
      awaitingMyApproval,
    };

    for (const r of all) {
      summary.totalAmount += r.amount;
      switch (r.status) {
        case "in_review":
        case "pending":
          summary.pendingCount++;
          summary.pendingAmount += r.amount;
          break;
        case "approved":
          summary.approvedCount++;
          summary.approvedAmount += r.amount;
          break;
        case "rejected":
          summary.rejectedCount++;
          summary.rejectedAmount += r.amount;
          break;
        case "disbursed":
          summary.disbursedCount++;
          summary.disbursedAmount += r.amount;
          break;
        case "revision_needed":
          summary.revisionCount++;
          break;
        case "draft":
          summary.draftCount++;
          break;
      }
    }

    return summary;
  },
});

// ─── SLA Monitoring ─────────────────────────────────────────────────────────

export const getSlaMonitoring = query({
  args: {},
  handler: async (ctx): Promise<SlaItem[]> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);
    if (!isPrivileged) return [];
    // A super admin without an active grant has organizationId === null → none.
    if (!organizationId) return [];

    // Get all in_review requests for this organization
    const inReview = (
      await ctx.db
        .query("fundRequests")
        .withIndex("by_status", (q) => q.eq("status", "in_review"))
        .collect()
    ).filter((r) => r.organizationId === organizationId);

    const items: SlaItem[] = [];
    for (const req of inReview) {
      const submitter = await ctx.db.get(req.submitterId);
      // Get current approval level row
      const approvals = await ctx.db
        .query("fundRequestApprovals")
        .withIndex("by_fund_request", (q) => q.eq("fundRequestId", req._id))
        .collect();
      const currentApproval = approvals.find((a) => a.level === req.currentApprovalLevel && a.status === "pending");
      const currentApprover = currentApproval ? await ctx.db.get(currentApproval.approverId) : null;

      const slaDeadline = currentApproval?.slaDeadline ?? null;
      const { isOverdue, hoursRemaining } = computeSlaInfo(slaDeadline);

      items.push({
        requestId: req._id,
        title: req.title,
        amount: req.amount,
        status: req.status,
        submitterName: submitter?.name ?? null,
        submitterAvatar: submitter?.avatarUrl ?? null,
        category: req.category,
        requestType: req.requestType ?? null,
        currentLevel: req.currentApprovalLevel,
        totalLevels: req.totalApprovalLevels,
        currentApproverName: currentApprover?.name ?? null,
        slaDeadline,
        isOverdue,
        hoursRemaining,
        submittedAt: req.submittedAt ?? null,
      });
    }

    // Sort: overdue first, then by hours remaining ascending
    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return (a.hoursRemaining ?? 999) - (b.hoursRemaining ?? 999);
    });

    return items;
  },
});

// ─── Monthly Trends ─────────────────────────────────────────────────────────

export const getMonthlyTrends = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args): Promise<MonthlyTrend[]> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);

    let all: Doc<"fundRequests">[];
    if (isPrivileged) {
      all = organizationId
        ? await ctx.db
            .query("fundRequests")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .collect()
        : [];
    } else {
      all = await ctx.db
        .query("fundRequests")
        .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
        .collect();
    }

    const monthCount = args.months ?? 6;
    const now = new Date();
    const months: string[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const trendMap: Record<string, MonthlyTrend> = {};
    for (const m of months) {
      trendMap[m] = {
        month: m,
        label: getMonthLabel(m),
        submitted: 0,
        approved: 0,
        rejected: 0,
        disbursed: 0,
        totalAmount: 0,
        approvedAmount: 0,
      };
    }

    for (const r of all) {
      const dateStr = r.submittedAt ?? new Date(r._creationTime).toISOString();
      const monthKey = dateStr.slice(0, 7);
      if (!trendMap[monthKey]) continue;

      trendMap[monthKey].submitted++;
      trendMap[monthKey].totalAmount += r.amount;

      if (r.status === "approved" || r.status === "disbursed") {
        trendMap[monthKey].approved++;
        trendMap[monthKey].approvedAmount += r.amount;
      }
      if (r.status === "rejected") {
        trendMap[monthKey].rejected++;
      }
      if (r.status === "disbursed") {
        trendMap[monthKey].disbursed++;
      }
    }

    return months.map((m) => trendMap[m]);
  },
});

// ─── Category Breakdown ─────────────────────────────────────────────────────

export const getCategoryBreakdown = query({
  args: {},
  handler: async (ctx): Promise<CategoryBreakdown[]> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);

    let all: Doc<"fundRequests">[];
    if (isPrivileged) {
      all = organizationId
        ? await ctx.db
            .query("fundRequests")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .collect()
        : [];
    } else {
      all = await ctx.db
        .query("fundRequests")
        .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
        .collect();
    }

    const map: Record<string, CategoryBreakdown> = {};
    for (const r of all) {
      if (!map[r.category]) {
        map[r.category] = { category: r.category, label: r.category, count: 0, amount: 0, approvedAmount: 0 };
      }
      map[r.category].count++;
      map[r.category].amount += r.amount;
      if (r.status === "approved" || r.status === "disbursed") {
        map[r.category].approvedAmount += r.amount;
      }
    }

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  },
});

// ─── Department Breakdown ───────────────────────────────────────────────────

export const getDepartmentBreakdown = query({
  args: {},
  handler: async (ctx): Promise<DepartmentBreakdown[]> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);
    if (!isPrivileged) return [];
    // A super admin without an active grant has organizationId === null → none.
    if (!organizationId) return [];

    const all = await ctx.db
      .query("fundRequests")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();
    const map: Record<string, DepartmentBreakdown> = {};
    for (const r of all) {
      const dept = r.userDepartment ?? "Tidak Ada Departemen";
      if (!map[dept]) {
        map[dept] = { department: dept, count: 0, amount: 0, approvedAmount: 0, pendingCount: 0 };
      }
      map[dept].count++;
      map[dept].amount += r.amount;
      if (r.status === "approved" || r.status === "disbursed") {
        map[dept].approvedAmount += r.amount;
      }
      if (r.status === "in_review" || r.status === "pending") {
        map[dept].pendingCount++;
      }
    }

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  },
});

// ─── Request Type Breakdown ─────────────────────────────────────────────────

export const getRequestTypeBreakdown = query({
  args: {},
  handler: async (ctx): Promise<RequestTypeBreakdown[]> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);

    let all: Doc<"fundRequests">[];
    if (isPrivileged) {
      all = organizationId
        ? await ctx.db
            .query("fundRequests")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .collect()
        : [];
    } else {
      all = await ctx.db
        .query("fundRequests")
        .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
        .collect();
    }

    const map: Record<string, RequestTypeBreakdown> = {};
    for (const r of all) {
      const type = r.requestType ?? "custom";
      if (!map[type]) {
        map[type] = { requestType: type, label: type, count: 0, amount: 0 };
      }
      map[type].count++;
      map[type].amount += r.amount;
    }

    return Object.values(map).sort((a, b) => b.amount - a.amount);
  },
});

// ─── Pending Approvals (for current user) ───────────────────────────────────

export const getMyPendingApprovals = query({
  args: {},
  handler: async (ctx): Promise<PendingApprovalItem[]> => {
    const me = await requireUser(ctx);

    const pendingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_approver_and_status", (q) =>
        q.eq("approverId", me._id).eq("status", "pending"),
      )
      .collect();

    const items: PendingApprovalItem[] = [];
    for (const approval of pendingApprovals) {
      const req = await ctx.db.get(approval.fundRequestId);
      if (!req) continue;
      if (req.currentApprovalLevel !== approval.level) continue;
      if (req.status !== "in_review" && req.status !== "pending") continue;

      const submitter = await ctx.db.get(req.submitterId);
      const slaDeadline = approval.slaDeadline ?? null;
      const { isOverdue, hoursRemaining } = computeSlaInfo(slaDeadline);

      items.push({
        requestId: req._id,
        title: req.title,
        amount: req.amount,
        category: req.category,
        requestType: req.requestType ?? null,
        submitterName: submitter?.name ?? null,
        submitterAvatar: submitter?.avatarUrl ?? null,
        submitterJobTitle: submitter?.jobTitle ?? null,
        level: approval.level,
        totalLevels: req.totalApprovalLevels,
        slaDeadline,
        isOverdue,
        hoursRemaining,
        submittedAt: req.submittedAt ?? null,
      });
    }

    // Sort: overdue first, then nearest deadline
    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return (a.hoursRemaining ?? 999) - (b.hoursRemaining ?? 999);
    });

    return items;
  },
});

// Lightweight sidebar badge count for "Dashboard Keuangan".
// For finance managers/admins: the number of fund requests still in the
// approval pipeline (pending + in_review) within their scope — the whole queue
// to control, not just their own approval turn. Others get 0. Never throws.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return 0;
    if (!canManageFinance(user.role)) return 0;

    const isSuperAdmin = user.role === "super_admin";
    const orgId = isSuperAdmin
      ? (user.viewingOrganizationId ?? null)
      : (user.organizationId ?? null);

    let rows: Array<Doc<"fundRequests">>;
    if (orgId !== null) {
      rows = await ctx.db
        .query("fundRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(1000);
    } else {
      // Super admin without a viewing org in scope: no cross-org totals.
      return 0;
    }
    return rows.filter(
      (r) => r.status === "pending" || r.status === "in_review",
    ).length;
  },
});

// ─── Recent Activity ────────────────────────────────────────────────────────

export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<RecentActivity[]> => {
    const { user: me, organizationId } = await requireFinanceContext(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || canApprove(me.role);
    const maxItems = args.limit ?? 15;

    // A privileged super admin without an active grant has organizationId ===
    // null and must not see any organization's activity.
    if (isPrivileged && !organizationId) return [];

    // Get recent approvals (sorted by _creationTime desc)
    const recentApprovals = await ctx.db
      .query("fundRequestApprovals")
      .order("desc")
      .take(50);

    const activities: RecentActivity[] = [];

    for (const approval of recentApprovals) {
      if (activities.length >= maxItems) break;
      if (approval.status === "pending") continue;

      const req = await ctx.db.get(approval.fundRequestId);
      if (!req) continue;

      // Privileged users only see their organization's activity
      if (isPrivileged) {
        if (req.organizationId !== organizationId) continue;
      } else if (req.submitterId !== me._id) {
        // Non-privileged users only see their own
        continue;
      }

      const actor = await ctx.db.get(approval.approverId);

      let action = "approved";
      if (approval.status === "rejected") action = "rejected";
      else if (approval.status === "revision") action = "revision";

      activities.push({
        requestId: req._id,
        title: req.title,
        amount: req.amount,
        status: req.status,
        action,
        actorName: actor?.name ?? null,
        timestamp: approval.actedAt ?? new Date(approval._creationTime).toISOString(),
      });
    }

    // Also add recently submitted requests
    let recentSubmitted: Doc<"fundRequests">[];
    if (isPrivileged) {
      recentSubmitted = organizationId
        ? await ctx.db
            .query("fundRequests")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .order("desc")
            .take(20)
        : [];
    } else {
      recentSubmitted = await ctx.db
        .query("fundRequests")
        .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
        .order("desc")
        .take(20);
    }

    for (const req of recentSubmitted) {
      if (activities.length >= maxItems) break;
      if (req.status === "draft") continue;

      const submitter = await ctx.db.get(req.submitterId);

      // Add submission event
      if (req.submittedAt) {
        activities.push({
          requestId: req._id,
          title: req.title,
          amount: req.amount,
          status: req.status,
          action: "submitted",
          actorName: submitter?.name ?? null,
          timestamp: req.submittedAt,
        });
      }

      // Add disbursement event
      if (req.status === "disbursed" && req.disbursedAt) {
        const disburser = req.disbursedById ? await ctx.db.get(req.disbursedById) : null;
        activities.push({
          requestId: req._id,
          title: req.title,
          amount: req.amount,
          status: req.status,
          action: "disbursed",
          actorName: disburser?.name ?? submitter?.name ?? null,
          timestamp: req.disbursedAt,
        });
      }
    }

    // Sort by timestamp desc, deduplicate, and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Deduplicate by requestId + action
    const seen = new Set<string>();
    const unique: RecentActivity[] = [];
    for (const a of activities) {
      const key = `${a.requestId}-${a.action}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
      if (unique.length >= maxItems) break;
    }

    return unique;
  },
});
