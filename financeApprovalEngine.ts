/**
 * Finance Approval Engine
 *
 * Automatic routing engine that:
 * 1. Matches a fund request to the correct approval chain based on request type + amount
 * 2. Resolves each chain level to the correct approver (role lookup, specific user, or manager)
 * 3. Handles delegation substitution (active delegate replaces original approver)
 * 4. Enforces Segregation of Duties (submitter cannot be their own approver)
 * 5. Tracks SLA deadlines per level
 * 6. Provides approve / reject / revise actions that advance the chain
 * 7. Creates notifications for next approver in the chain
 */

import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, canManageFinance, canApprove, normalizeRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ─── Auth helper ────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ResolvedApprover = {
  level: number;
  label: string;
  userId: Id<"users">;
  userName: string;
  approverType: string;
  roleKey?: string;
  slaHours: number;
  canDelegate: boolean;
  // If delegation applied, the original approver who delegated
  delegatedFromId?: Id<"users">;
  delegatedFromName?: string;
  slaDeadline: string; // ISO timestamp
};

export type ChainMatchResult = {
  chainId: Id<"financeApprovalChains">;
  chainName: string;
  approvers: ResolvedApprover[];
};

// ─── Chain Matching ─────────────────────────────────────────────────────────

/**
 * Find the best matching approval chain for a given request type and amount.
 * Priority: active chains matching request type, then filter by amount range,
 * then pick the one with lowest order (highest priority).
 */
async function findMatchingChain(
  ctx: QueryCtx,
  requestType: string,
  amount: number,
): Promise<Doc<"financeApprovalChains"> | null> {
  const chains = await ctx.db
    .query("financeApprovalChains")
    .withIndex("by_request_type", (q) => q.eq("requestType", requestType))
    .collect();

  const active = chains.filter((c) => c.isActive);

  // Filter by amount range
  const matching = active.filter((c) => {
    const meetsMin = amount >= c.minAmount;
    const meetsMax = c.maxAmount === 0 || amount <= c.maxAmount;
    return meetsMin && meetsMax;
  });

  if (matching.length === 0) return null;

  // Pick the chain with the lowest order (highest priority)
  matching.sort((a, b) => a.order - b.order);
  return matching[0];
}

/**
 * Resolve the actual approver user for a given approval level definition.
 * Handles role-based, specific-user, manager-based, position-level, and department-head resolution.
 */
async function resolveApproverForLevel(
  ctx: QueryCtx,
  level: Doc<"financeApprovalLevels">,
  submitter: Doc<"users">,
): Promise<{ userId: Id<"users">; userName: string } | null> {
  if (level.approverType === "specific_user" && level.specificUserId) {
    const user = await ctx.db.get(level.specificUserId);
    if (user && user.accountStatus !== "suspended") {
      return { userId: user._id, userName: user.name ?? "Unknown" };
    }
    return null;
  }

  if (level.approverType === "manager") {
    if (!submitter.managerId) return null;
    const manager = await ctx.db.get(submitter.managerId);
    if (manager && manager.accountStatus !== "suspended") {
      return { userId: manager._id, userName: manager.name ?? "Unknown" };
    }
    return null;
  }

  // Position level: find user with the specified position level who is a superior
  if (level.approverType === "position_level" && level.positionLevelId) {
    const targetLevel = await ctx.db.get(level.positionLevelId);
    if (!targetLevel) return null;

    // First try: find the submitter's manager chain up to someone at this level
    let currentManager = submitter.managerId ? await ctx.db.get(submitter.managerId) : null;
    const visited = new Set<string>();
    while (currentManager && !visited.has(currentManager._id)) {
      visited.add(currentManager._id);
      if (
        currentManager.positionLevelId === level.positionLevelId &&
        currentManager._id !== submitter._id &&
        currentManager.accountStatus !== "suspended"
      ) {
        return { userId: currentManager._id, userName: currentManager.name ?? "Unknown" };
      }
      currentManager = currentManager.managerId ? await ctx.db.get(currentManager.managerId) : null;
    }

    // Fallback: find any active user at this position level (same department preferred)
    const allUsers = await ctx.db.query("users").collect();
    // Prefer same department
    const sameDeptUser = allUsers.find(
      (u) =>
        u.positionLevelId === level.positionLevelId &&
        u._id !== submitter._id &&
        u.accountStatus !== "suspended" &&
        u.department === submitter.department,
    );
    if (sameDeptUser) {
      return { userId: sameDeptUser._id, userName: sameDeptUser.name ?? "Unknown" };
    }
    // Then any user at this level
    const anyUser = allUsers.find(
      (u) =>
        u.positionLevelId === level.positionLevelId &&
        u._id !== submitter._id &&
        u.accountStatus !== "suspended",
    );
    if (anyUser) {
      return { userId: anyUser._id, userName: anyUser.name ?? "Unknown" };
    }

    // Last resort: find user at a higher rank (lower rank number) than the target level
    const activeLevels = await ctx.db
      .query("positionLevels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const higherLevels = activeLevels
      .filter((pl) => pl.rank < targetLevel.rank)
      .sort((a, b) => b.rank - a.rank); // closest higher rank first

    for (const hl of higherLevels) {
      const userAtHigher = allUsers.find(
        (u) =>
          u.positionLevelId === hl._id &&
          u._id !== submitter._id &&
          u.accountStatus !== "suspended",
      );
      if (userAtHigher) {
        return { userId: userAtHigher._id, userName: userAtHigher.name ?? "Unknown" };
      }
    }

    return null;
  }

  // Department head: resolve to the head of the submitter's department
  if (level.approverType === "department_head") {
    if (!submitter.department) return null;

    const dept = await ctx.db
      .query("departments")
      .withIndex("by_name", (q) => q.eq("name", submitter.department!))
      .first();

    if (dept?.headId) {
      const head = await ctx.db.get(dept.headId);
      if (head && head._id !== submitter._id && head.accountStatus !== "suspended") {
        return { userId: head._id, userName: head.name ?? "Unknown" };
      }
    }

    // Fallback: find the submitter's manager
    if (submitter.managerId) {
      const manager = await ctx.db.get(submitter.managerId);
      if (manager && manager.accountStatus !== "suspended") {
        return { userId: manager._id, userName: manager.name ?? "Unknown" };
      }
    }

    return null;
  }

  if (level.approverType === "role" && level.roleKey) {
    // First check finance role mappings
    const mapping = await ctx.db
      .query("financeRoleMappings")
      .withIndex("by_function_key", (q) => q.eq("functionKey", level.roleKey!))
      .first();

    if (mapping && mapping.isActive && mapping.assignedUserIds.length > 0) {
      // Pick the first assigned user who is active and not the submitter
      for (const uid of mapping.assignedUserIds) {
        if (uid === submitter._id) continue; // Segregation of Duties
        const user = await ctx.db.get(uid);
        if (user && user.accountStatus !== "suspended") {
          return { userId: user._id, userName: user.name ?? "Unknown" };
        }
      }
    }

    // Fallback: find any user with this role in the system
    const fallbackRole = mapping?.fallbackRole ?? level.roleKey;
    const allUsers = await ctx.db.query("users").collect();
    for (const user of allUsers) {
      if (user._id === submitter._id) continue; // Segregation of Duties
      if (user.accountStatus === "suspended") continue;
      const normalized = normalizeRole(user.role);
      if (normalized === fallbackRole || user.role === fallbackRole) {
        return { userId: user._id, userName: user.name ?? "Unknown" };
      }
    }

    return null;
  }

  return null;
}

/**
 * Check if there's an active delegation for a given approver.
 * If found, returns the delegate user who should act in their place.
 */
async function checkDelegation(
  ctx: QueryCtx,
  approverId: Id<"users">,
  chainId: Id<"financeApprovalChains">,
): Promise<{ delegateId: Id<"users">; delegateName: string } | null> {
  const today = new Date().toISOString().slice(0, 10);

  const delegations = await ctx.db
    .query("financeApprovalDelegations")
    .withIndex("by_delegator", (q) => q.eq("delegatorId", approverId))
    .collect();

  for (const d of delegations) {
    if (!d.isActive) continue;
    if (d.startDate > today || d.endDate < today) continue;
    // If delegation is chain-specific, must match
    if (d.chainId && d.chainId !== chainId) continue;

    const delegate = await ctx.db.get(d.delegateId);
    if (delegate && delegate.accountStatus !== "suspended") {
      return { delegateId: delegate._id, delegateName: delegate.name ?? "Unknown" };
    }
  }

  return null;
}

/**
 * Calculate SLA deadline from now, based on business hours.
 * Assumes 8 business hours per day, Mon-Fri.
 */
function calculateSlaDeadline(slaHours: number): string {
  const now = new Date();
  const businessHoursPerDay = 8;
  let remainingHours = slaHours;
  const deadline = new Date(now);

  while (remainingHours > 0) {
    deadline.setDate(deadline.getDate() + 1);
    const day = deadline.getDay();
    // Skip weekends
    if (day === 0 || day === 6) continue;
    remainingHours -= businessHoursPerDay;
  }

  return deadline.toISOString();
}

// ─── Public Queries ─────────────────────────────────────────────────────────

/**
 * Preview the approval chain for a given request type and amount.
 * Used in the submission form to show the user who will approve their request.
 */
export const previewApprovalChain = query({
  args: {
    requestType: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args): Promise<ChainMatchResult | null> => {
    const me = await requireUser(ctx);
    const chain = await findMatchingChain(ctx, args.requestType, args.amount);
    if (!chain) return null;

    const levels = await ctx.db
      .query("financeApprovalLevels")
      .withIndex("by_chain", (q) => q.eq("chainId", chain._id))
      .collect();
    levels.sort((a, b) => a.level - b.level);

    const approvers: ResolvedApprover[] = [];
    for (const level of levels) {
      const resolved = await resolveApproverForLevel(ctx, level, me);
      if (!resolved) continue;

      // Check delegation
      const delegation = await checkDelegation(ctx, resolved.userId, chain._id);
      const finalUserId = delegation?.delegateId ?? resolved.userId;
      const finalUserName = delegation?.delegateName ?? resolved.userName;

      // Segregation of Duties: skip if final approver is the submitter
      if (finalUserId === me._id) continue;

      approvers.push({
        level: level.level,
        label: level.label,
        userId: finalUserId,
        userName: finalUserName,
        approverType: level.approverType,
        roleKey: level.roleKey,
        slaHours: level.slaHours,
        canDelegate: level.canDelegate,
        delegatedFromId: delegation ? resolved.userId : undefined,
        delegatedFromName: delegation ? resolved.userName : undefined,
        slaDeadline: calculateSlaDeadline(level.slaHours),
      });
    }

    return {
      chainId: chain._id,
      chainName: chain.name,
      approvers,
    };
  },
});

/**
 * Get the full approval status/trail for a specific fund request.
 */
export const getApprovalStatus = query({
  args: { fundRequestId: v.id("fundRequests") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const req = await ctx.db.get(args.fundRequestId);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });

    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();
    approvals.sort((a, b) => a.level - b.level);

    // Enrich with user data
    const enriched = await Promise.all(
      approvals.map(async (a) => {
        const approver = await ctx.db.get(a.approverId);
        return {
          ...a,
          approverName: a.approverName ?? approver?.name ?? "Unknown",
          approverJobTitle: a.approverJobTitle ?? approver?.jobTitle,
          approverAvatar: approver?.avatarUrl,
          isCurrent: req.status === "in_review" && a.level === req.currentApprovalLevel,
          isOverdue: a.slaDeadline ? new Date(a.slaDeadline) < new Date() && a.status === "pending" : false,
        };
      }),
    );

    return {
      requestId: req._id,
      status: req.status,
      currentLevel: req.currentApprovalLevel,
      totalLevels: req.totalApprovalLevels,
      chainId: req.approvalChainId,
      chainName: req.approvalChainName,
      approvals: enriched,
    };
  },
});

/**
 * List all requests pending the current user's approval, with SLA info.
 */
export const listMyPendingApprovals = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);

    const myApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_approver_and_status", (q) =>
        q.eq("approverId", me._id).eq("status", "pending"),
      )
      .collect();

    const results = [];
    for (const approval of myApprovals) {
      const req = await ctx.db.get(approval.fundRequestId);
      if (!req) continue;
      if (req.status !== "in_review") continue;
      if (req.currentApprovalLevel !== approval.level) continue;

      const submitter = await ctx.db.get(req.submitterId);
      results.push({
        request: req,
        approval,
        submitterName: submitter?.name ?? "Unknown",
        submitterDepartment: submitter?.department,
        submitterJobTitle: submitter?.jobTitle,
        isOverdue: approval.slaDeadline ? new Date(approval.slaDeadline) < new Date() : false,
        slaDeadline: approval.slaDeadline,
      });
    }

    // Sort by SLA deadline (most urgent first)
    results.sort((a, b) => {
      if (!a.slaDeadline) return 1;
      if (!b.slaDeadline) return -1;
      return a.slaDeadline.localeCompare(b.slaDeadline);
    });

    return results;
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Submit a fund request and automatically route it through the matching
 * approval chain. This replaces the old manual approver selection.
 */
export const submitWithAutoRouting = mutation({
  args: {
    fundRequestId: v.id("fundRequests"),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.fundRequestId);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (req.submitterId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Bukan pengajuan Anda" });
    }
    if (req.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Hanya draft yang bisa diajukan" });
    }

    // Find matching chain
    const matchType = req.requestType ?? req.category;
    const chain = await findMatchingChain(ctx, matchType, req.amount);
    if (!chain) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak ada rantai persetujuan yang cocok untuk jenis dan nilai pengajuan ini. Hubungi admin untuk mengkonfigurasi rantai persetujuan.",
      });
    }

    const submitter = await ctx.db.get(req.submitterId);
    if (!submitter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data pengaju tidak ditemukan" });
    }

    // Resolve all approval levels
    const levels = await ctx.db
      .query("financeApprovalLevels")
      .withIndex("by_chain", (q) => q.eq("chainId", chain._id))
      .collect();
    levels.sort((a, b) => a.level - b.level);

    if (levels.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Rantai persetujuan belum memiliki level. Hubungi admin.",
      });
    }

    // Delete any existing approval rows (in case of re-submit from draft)
    const existingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();
    for (const ea of existingApprovals) {
      await ctx.db.delete(ea._id);
    }

    // Resolve and create approval rows
    const resolvedApprovers: Array<{
      level: number;
      userId: Id<"users">;
      userName: string;
      label: string;
      slaHours: number;
      delegatedFromId?: Id<"users">;
      delegatedFromName?: string;
    }> = [];

    for (const level of levels) {
      const resolved = await resolveApproverForLevel(ctx, level, submitter);
      if (!resolved) continue;

      // Check delegation
      const delegation = await checkDelegation(ctx, resolved.userId, chain._id);
      const finalUserId = delegation?.delegateId ?? resolved.userId;
      const finalUserName = delegation?.delegateName ?? resolved.userName;

      // Segregation of Duties: skip if final approver is the submitter
      if (finalUserId === submitter._id) continue;

      resolvedApprovers.push({
        level: level.level,
        userId: finalUserId,
        userName: finalUserName,
        label: level.label,
        slaHours: level.slaHours,
        delegatedFromId: delegation ? resolved.userId : undefined,
        delegatedFromName: delegation ? resolved.userName : undefined,
      });
    }

    if (resolvedApprovers.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak ada approver yang tersedia. Periksa konfigurasi rantai persetujuan atau mapping fungsi.",
      });
    }

    // Re-number levels sequentially
    const now = new Date().toISOString();
    for (let i = 0; i < resolvedApprovers.length; i++) {
      const ra = resolvedApprovers[i];
      const slaDeadline = i === 0 ? calculateSlaDeadline(ra.slaHours) : undefined;

      await ctx.db.insert("fundRequestApprovals", {
        fundRequestId: args.fundRequestId,
        level: i + 1,
        approverId: ra.userId,
        approverName: ra.userName,
        approverJobTitle: ra.label,
        approverRole: ra.label,
        status: "pending",
        slaDeadline,
        delegatedFromId: ra.delegatedFromId,
        delegatedFromName: ra.delegatedFromName,
      });
    }

    // Update the fund request
    await ctx.db.patch(args.fundRequestId, {
      status: "in_review",
      currentApprovalLevel: 1,
      totalApprovalLevels: resolvedApprovers.length,
      submittedAt: now,
      approvalChainId: chain._id,
      approvalChainName: chain.name,
    });

    // Notify first approver
    const firstApprover = resolvedApprovers[0];
    await ctx.db.insert("notifications", {
      userId: firstApprover.userId,
      type: "finance_approval",
      title: "Pengajuan Dana Menunggu Persetujuan",
      message: `${submitter.name ?? "Seseorang"} mengajukan dana "${req.title}" sebesar Rp ${req.amount.toLocaleString("id-ID")}. Silakan review.`,
      link: `/fund-requests?id=${args.fundRequestId}`,
    });
  },
});

/**
 * Approve the current level. Advances to next level or marks fully approved.
 */
export const approveLevel = mutation({
  args: {
    fundRequestId: v.id("fundRequests"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.fundRequestId);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });

    if (req.status !== "in_review") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dalam status review" });
    }

    // Find the current approval row
    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();

    const currentRow = approvals.find((a) => a.level === req.currentApprovalLevel);
    if (!currentRow) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data persetujuan level ini tidak ditemukan" });
    }

    // Check authorization: must be the assigned approver or admin
    if (currentRow.approverId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Anda bukan penyetuju untuk level ini" });
    }

    const now = new Date().toISOString();

    // Mark this level as approved
    await ctx.db.patch(currentRow._id, {
      status: "approved",
      note: args.note,
      actedAt: now,
    });

    const nextLevel = req.currentApprovalLevel + 1;

    if (nextLevel > req.totalApprovalLevels) {
      // All levels approved - mark request as approved
      await ctx.db.patch(args.fundRequestId, {
        status: "approved",
        currentApprovalLevel: nextLevel,
      });

      // Notify submitter
      const submitter = await ctx.db.get(req.submitterId);
      if (submitter) {
        await ctx.db.insert("notifications", {
          userId: submitter._id,
          type: "finance_approval",
          title: "Pengajuan Dana Disetujui",
          message: `Pengajuan "${req.title}" telah disetujui oleh semua level. Menunggu pencairan.`,
          link: `/fund-requests?id=${args.fundRequestId}`,
        });
      }
    } else {
      // Advance to next level
      await ctx.db.patch(args.fundRequestId, {
        currentApprovalLevel: nextLevel,
      });

      // Set SLA deadline for next approver
      const nextRow = approvals.find((a) => a.level === nextLevel);
      if (nextRow) {
        // Calculate SLA based on level config
        const levelConfig = req.approvalChainId
          ? await ctx.db
              .query("financeApprovalLevels")
              .withIndex("by_chain", (q) => q.eq("chainId", req.approvalChainId!))
              .collect()
          : [];
        const nextLevelConfig = levelConfig.find((l) => l.level === nextLevel);
        const slaHours = nextLevelConfig?.slaHours ?? 48;
        const slaDeadline = calculateSlaDeadline(slaHours);

        await ctx.db.patch(nextRow._id, { slaDeadline });

        // Notify next approver
        const submitter = await ctx.db.get(req.submitterId);
        await ctx.db.insert("notifications", {
          userId: nextRow.approverId,
          type: "finance_approval",
          title: "Pengajuan Dana Menunggu Persetujuan Anda",
          message: `Pengajuan "${req.title}" dari ${submitter?.name ?? "Seseorang"} (Rp ${req.amount.toLocaleString("id-ID")}) telah disetujui level sebelumnya. Giliran Anda untuk review.`,
          link: `/fund-requests?id=${args.fundRequestId}`,
        });
      }
    }
  },
});

/**
 * Reject the request at the current level. Stops the entire chain.
 */
export const rejectLevel = mutation({
  args: {
    fundRequestId: v.id("fundRequests"),
    note: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.fundRequestId);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });

    if (req.status !== "in_review") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dalam status review" });
    }

    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();

    const currentRow = approvals.find((a) => a.level === req.currentApprovalLevel);
    if (!currentRow) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data persetujuan level ini tidak ditemukan" });
    }

    if (currentRow.approverId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Anda bukan penyetuju untuk level ini" });
    }

    const now = new Date().toISOString();

    // Mark this level as rejected
    await ctx.db.patch(currentRow._id, {
      status: "rejected",
      note: args.note,
      actedAt: now,
    });

    // Mark the entire request as rejected
    await ctx.db.patch(args.fundRequestId, {
      status: "rejected",
      rejectedAt: now,
      rejectedBy: me._id,
      rejectionReason: args.note,
    });

    // Notify submitter
    const submitter = await ctx.db.get(req.submitterId);
    if (submitter) {
      await ctx.db.insert("notifications", {
        userId: submitter._id,
        type: "finance_approval",
        title: "Pengajuan Dana Ditolak",
        message: `Pengajuan "${req.title}" ditolak oleh ${me.name ?? "approver"} di level ${req.currentApprovalLevel}. Alasan: ${args.note}`,
        link: `/fund-requests?id=${args.fundRequestId}`,
      });
    }
  },
});

/**
 * Request revision: sends back to the submitter for corrections.
 * The request status changes to "revision_needed" and the submitter can edit and re-submit.
 */
export const requestRevision = mutation({
  args: {
    fundRequestId: v.id("fundRequests"),
    note: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.fundRequestId);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });

    if (req.status !== "in_review") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dalam status review" });
    }

    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();

    const currentRow = approvals.find((a) => a.level === req.currentApprovalLevel);
    if (!currentRow) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data persetujuan level ini tidak ditemukan" });
    }

    if (currentRow.approverId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Anda bukan penyetuju untuk level ini" });
    }

    const now = new Date().toISOString();

    // Mark current level as revision requested
    await ctx.db.patch(currentRow._id, {
      status: "revision",
      note: args.note,
      actedAt: now,
    });

    // Set request status to revision_needed
    await ctx.db.patch(args.fundRequestId, {
      status: "revision_needed",
      revisionNote: args.note,
      revisionRequestedBy: me._id,
      revisionRequestedAt: now,
    });

    // Notify submitter
    const submitter = await ctx.db.get(req.submitterId);
    if (submitter) {
      await ctx.db.insert("notifications", {
        userId: submitter._id,
        type: "finance_approval",
        title: "Pengajuan Dana Perlu Revisi",
        message: `Pengajuan "${req.title}" perlu direvisi. Catatan dari ${me.name ?? "approver"}: ${args.note}`,
        link: `/fund-requests?id=${args.fundRequestId}`,
      });
    }
  },
});

/**
 * Re-submit a revised request. Resets the approval chain from the level
 * that requested the revision.
 */
export const resubmitAfterRevision = mutation({
  args: {
    fundRequestId: v.id("fundRequests"),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.fundRequestId);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });

    if (req.submitterId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Bukan pengajuan Anda" });
    }

    if (req.status !== "revision_needed") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dalam status revisi" });
    }

    const now = new Date().toISOString();

    // Reset the revision level and all subsequent levels back to pending
    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.fundRequestId))
      .collect();

    // Find the level that requested revision
    const revisionLevel = approvals.find((a) => a.status === "revision");
    const resetFromLevel = revisionLevel?.level ?? req.currentApprovalLevel;

    for (const approval of approvals) {
      if (approval.level >= resetFromLevel) {
        await ctx.db.patch(approval._id, {
          status: "pending",
          note: undefined,
          actedAt: undefined,
          slaDeadline: approval.level === resetFromLevel
            ? calculateSlaDeadline(48) // default SLA
            : undefined,
        });
      }
    }

    // Reset request status
    await ctx.db.patch(args.fundRequestId, {
      status: "in_review",
      currentApprovalLevel: resetFromLevel,
      revisionNote: undefined,
      revisionRequestedBy: undefined,
      revisionRequestedAt: undefined,
    });

    // Notify the approver at the reset level
    if (revisionLevel) {
      await ctx.db.insert("notifications", {
        userId: revisionLevel.approverId,
        type: "finance_approval",
        title: "Pengajuan Dana Direvisi",
        message: `${me.name ?? "Pengaju"} telah merevisi pengajuan "${req.title}". Silakan review kembali.`,
        link: `/fund-requests?id=${args.fundRequestId}`,
      });
    }
  },
});
