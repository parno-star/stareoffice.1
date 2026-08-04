import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, canManageFinance, normalizeRole } from "./roles";
import { writeAuditLog } from "./financeAuditLog";
import { requireTenant } from "./lib/tenant";

// ─── Helper ──────────────────────────────────────────────────────────────────
// requireTenant menghitung organisasi EFEKTIF: untuk super admin ini adalah
// tenant yang sedang dipilih (viewingOrganizationId) dengan grant aktif — bukan
// organisasi milik super admin itu sendiri (yang selalu null). Kita timpa
// `organizationId` pada objek user yang dikembalikan dengan nilai efektif ini
// agar SEMUA penyaringan di bawah otomatis mengikuti tenant yang sedang dipilih.
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId, organizationId } = await requireTenant(ctx, {
    allowSuperAdmin: true,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { ...user, organizationId: organizationId ?? undefined };
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type FundAttachmentWithUrl = {
  storageId: Id<"_storage">;
  fileName: string;
  label?: string;
  mimeType?: string;
  size?: number;
  url: string | null;
};

export type FundRequestWithDetails = Doc<"fundRequests"> & {
  submitterName: string | null;
  submitterAvatar: string | null;
  submitterJobTitle: string | null;
  approvals: Array<Doc<"fundRequestApprovals">>;
  currentApprover: Doc<"users"> | null;
  attachmentsWithUrl: FundAttachmentWithUrl[];
};

// ─── Enrich helper ───────────────────────────────────────────────────────────
async function enrichRequest(
  ctx: QueryCtx,
  req: Doc<"fundRequests">,
): Promise<FundRequestWithDetails> {
  const submitter = await ctx.db.get(req.submitterId);
  const approvals = await ctx.db
    .query("fundRequestApprovals")
    .withIndex("by_fund_request", (q) => q.eq("fundRequestId", req._id))
    .collect();
  approvals.sort((a, b) => a.level - b.level);

  // Find current approver (the one at currentApprovalLevel)
  const currentApprovalRow = approvals.find((a) => a.level === req.currentApprovalLevel);
  const currentApprover = currentApprovalRow
    ? await ctx.db.get(currentApprovalRow.approverId)
    : null;

  // Collect attachments – support legacy single attachment + new array
  const attachmentsWithUrl: FundAttachmentWithUrl[] = [];
  if (req.attachments && req.attachments.length > 0) {
    for (const a of req.attachments) {
      const url = await ctx.storage.getUrl(a.storageId);
      attachmentsWithUrl.push({
        storageId: a.storageId,
        fileName: a.fileName,
        label: a.label,
        mimeType: a.mimeType,
        size: a.size,
        url,
      });
    }
  } else if (req.attachmentStorageId && req.attachmentFileName) {
    const url = await ctx.storage.getUrl(req.attachmentStorageId);
    attachmentsWithUrl.push({
      storageId: req.attachmentStorageId,
      fileName: req.attachmentFileName,
      url,
    });
  }

  return {
    ...req,
    submitterName: submitter?.name ?? null,
    submitterAvatar: submitter?.avatarUrl ?? null,
    submitterJobTitle: submitter?.jobTitle ?? null,
    approvals,
    currentApprover,
    attachmentsWithUrl,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** List all fund requests visible to the current user.
 * - Employee sees their own requests.
 * - Admin / treasurer / supervisor sees all. */
export const list = query({
  args: {
    statusFilter: v.optional(v.string()),
    categoryFilter: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<FundRequestWithDetails[]> => {
    const me = await requireUser(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role) || me.role === "supervisor";

    // Organisasi efektif dari caller. Jika tidak ada (mis. super admin tanpa
    // grant aktif), jangan tampilkan pengajuan apa pun agar tidak ada data lintas
    // organisasi / data sisa yang bocor.
    const orgId = me.organizationId;
    if (!orgId) return [];

    let rows: Doc<"fundRequests">[];
    if (isPrivileged) {
      if (args.statusFilter && args.statusFilter !== "all") {
        rows = await ctx.db
          .query("fundRequests")
          .withIndex("by_status", (q) => q.eq("status", args.statusFilter!))
          .collect();
      } else {
        rows = await ctx.db.query("fundRequests").collect();
      }
    } else {
      if (args.statusFilter && args.statusFilter !== "all") {
        rows = await ctx.db
          .query("fundRequests")
          .withIndex("by_submitter_and_status", (q) =>
            q.eq("submitterId", me._id).eq("status", args.statusFilter!),
          )
          .collect();
      } else {
        rows = await ctx.db
          .query("fundRequests")
          .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
          .collect();
      }
    }

    // Batasi ke organisasi caller. Pengajuan tanpa organizationId (data lama /
    // simulasi) tidak lagi ditampilkan agar daftar tetap bersih.
    rows = rows.filter((r) => r.organizationId === orgId);

    if (args.categoryFilter && args.categoryFilter !== "all") {
      rows = rows.filter((r) => r.category === args.categoryFilter);
    }

    rows.sort((a, b) => b._creationTime - a._creationTime);
    return Promise.all(rows.map((r) => enrichRequest(ctx, r)));
  },
});

/** List requests that the current user needs to approve */
export const listPendingForMe = query({
  args: {},
  handler: async (ctx): Promise<FundRequestWithDetails[]> => {
    const me = await requireUser(ctx);
    const pendingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_approver_and_status", (q) =>
        q.eq("approverId", me._id).eq("status", "pending"),
      )
      .collect();

    const results: FundRequestWithDetails[] = [];
    for (const approval of pendingApprovals) {
      const req = await ctx.db.get(approval.fundRequestId);
      if (!req) continue;
      // Only show if this is the current active level
      if (req.currentApprovalLevel !== approval.level) continue;
      if (req.status !== "in_review" && req.status !== "pending") continue;
      results.push(await enrichRequest(ctx, req));
    }
    return results;
  },
});

// Lightweight sidebar badge count for "Pengajuan Dana".
// Counts fund requests currently awaiting THIS user's approval turn. Users who
// are not approvers get 0. Never throws.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!me) return 0;

    const pendingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_approver_and_status", (q) =>
        q.eq("approverId", me._id).eq("status", "pending"),
      )
      .take(500);

    let count = 0;
    for (const approval of pendingApprovals) {
      const req = await ctx.db.get(approval.fundRequestId);
      if (!req) continue;
      if (req.currentApprovalLevel !== approval.level) continue;
      if (req.status !== "in_review" && req.status !== "pending") continue;
      count += 1;
    }
    return count;
  },
});

/** Get single request by id */
export const getById = query({
  args: { id: v.id("fundRequests") },
  handler: async (ctx, args): Promise<FundRequestWithDetails | null> => {
    const req = await ctx.db.get(args.id);
    if (!req) return null;
    return enrichRequest(ctx, req);
  },
});

/** Summary stats for dashboard / recap */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const isPrivileged = isAdminRole(me.role) || canManageFinance(me.role);

    // Organisasi efektif; tanpa organisasi dalam cakupan, statistik nol agar
    // konsisten dengan daftar (tidak ada data lintas organisasi / sisa).
    const orgId = me.organizationId;
    if (!orgId) {
      return {
        total: 0,
        totalAmount: 0,
        approvedAmount: 0,
        pendingAmount: 0,
        byStatus: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        awaitingMyApproval: 0,
      };
    }

    let all: Doc<"fundRequests">[];
    if (isPrivileged) {
      all = await ctx.db.query("fundRequests").collect();
    } else {
      all = await ctx.db
        .query("fundRequests")
        .withIndex("by_submitter", (q) => q.eq("submitterId", me._id))
        .collect();
    }

    // Batasi ke organisasi caller (buang data lama/simulasi tanpa organizationId).
    all = all.filter((r) => r.organizationId === orgId);

    const pendingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_approver_and_status", (q) =>
        q.eq("approverId", me._id).eq("status", "pending"),
      )
      .collect();

    const totalAmount = all.reduce((s, r) => s + r.amount, 0);
    const approvedAmount = all
      .filter((r) => r.status === "approved" || r.status === "disbursed")
      .reduce((s, r) => s + r.amount, 0);
    const pendingAmount = all
      .filter((r) => r.status === "pending" || r.status === "in_review")
      .reduce((s, r) => s + r.amount, 0);

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    }

    return {
      total: all.length,
      totalAmount,
      approvedAmount,
      pendingAmount,
      byStatus,
      byCategory,
      awaitingMyApproval: pendingApprovals.length,
    };
  },
});

/** Get upload URL for attachments */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Create a draft fund request */
export const create = mutation({
  args: {
    title: v.string(),
    purpose: v.string(),
    category: v.string(),
    requestType: v.optional(v.string()),
    amount: v.number(),
    neededBy: v.string(),
    typeSpecificData: v.optional(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          label: v.optional(v.string()),
          mimeType: v.optional(v.string()),
          size: v.optional(v.number()),
        }),
      ),
    ),
    // Ordered list of approver user IDs (level 1 first) — optional for auto-routing
    approverIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const approverIds = args.approverIds ?? [];
    const id = await ctx.db.insert("fundRequests", {
      submitterId: me._id,
      userDepartment: me.department,
      title: args.title,
      purpose: args.purpose,
      category: args.category,
      requestType: args.requestType,
      amount: args.amount,
      neededBy: args.neededBy,
      typeSpecificData: args.typeSpecificData,
      attachmentStorageId: args.attachmentStorageId,
      attachmentFileName: args.attachmentFileName,
      attachments: args.attachments,
      status: "draft",
      currentApprovalLevel: 1,
      totalApprovalLevels: approverIds.length > 0 ? approverIds.length : 0,
      organizationId: me.organizationId,
    });

    // Create approval rows if manual approvers specified
    for (let i = 0; i < approverIds.length; i++) {
      const approver = await ctx.db.get(approverIds[i]);
      await ctx.db.insert("fundRequestApprovals", {
        fundRequestId: id,
        level: i + 1,
        approverId: approverIds[i],
        approverName: approver?.name ?? undefined,
        approverJobTitle: approver?.jobTitle ?? undefined,
        approverRole: approver?.role ?? undefined,
        status: "pending",
      });
    }

    // Audit log: request created
    const submitter = await ctx.db.get(me._id);
    await writeAuditLog(ctx, {
      fundRequestId: id,
      action: "created",
      actorId: me._id,
      actorName: me.name ?? "Unknown",
      actorRole: me.role,
      requestTitle: args.title,
      requestAmount: args.amount,
      requestStatus: "draft",
      requestCategory: args.category,
      requestType: args.requestType,
      submitterId: me._id,
      submitterName: me.name,
      submitterDepartment: me.department,
      organizationId: submitter?.organizationId,
    });

    return id;
  },
});

// ─── Approval Engine Helpers (used by submit mutation) ────────────────────────

/** Resolve the actual approver user for a given approval level definition. */
async function resolveApproverForLevel(
  ctx: QueryCtx | MutationCtx,
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

    // First try: walk the submitter's manager chain to find someone at this level
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

    // Fallback: any active user at this position level (same dept preferred)
    const allUsers = await ctx.db.query("users").collect();
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
    const anyUser = allUsers.find(
      (u) =>
        u.positionLevelId === level.positionLevelId &&
        u._id !== submitter._id &&
        u.accountStatus !== "suspended",
    );
    if (anyUser) {
      return { userId: anyUser._id, userName: anyUser.name ?? "Unknown" };
    }

    // Last resort: user at a higher rank (lower rank number)
    const activeLevels = await ctx.db
      .query("positionLevels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const higherLevels = activeLevels
      .filter((pl) => pl.rank < targetLevel.rank)
      .sort((a, b) => b.rank - a.rank);

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
    const mapping = await ctx.db
      .query("financeRoleMappings")
      .withIndex("by_function_key", (q) => q.eq("functionKey", level.roleKey!))
      .first();
    if (mapping && mapping.isActive && mapping.assignedUserIds.length > 0) {
      for (const uid of mapping.assignedUserIds) {
        if (uid === submitter._id) continue;
        const user = await ctx.db.get(uid);
        if (user && user.accountStatus !== "suspended") {
          return { userId: user._id, userName: user.name ?? "Unknown" };
        }
      }
    }
    const fallbackRole = mapping?.fallbackRole ?? level.roleKey;
    const allUsers = await ctx.db.query("users").collect();
    for (const user of allUsers) {
      if (user._id === submitter._id) continue;
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

/** Check if there's an active delegation for a given approver. */
async function checkDelegation(
  ctx: QueryCtx | MutationCtx,
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
    if (d.chainId && d.chainId !== chainId) continue;
    const delegate = await ctx.db.get(d.delegateId);
    if (delegate && delegate.accountStatus !== "suspended") {
      return { delegateId: delegate._id, delegateName: delegate.name ?? "Unknown" };
    }
  }
  return null;
}

/** Calculate SLA deadline from now, based on business hours (8h/day, Mon-Fri). */
function calculateSlaDeadline(slaHours: number): string {
  const now = new Date();
  const businessHoursPerDay = 8;
  let remainingHours = slaHours;
  const deadline = new Date(now);
  while (remainingHours > 0) {
    deadline.setDate(deadline.getDate() + 1);
    const day = deadline.getDay();
    if (day === 0 || day === 6) continue;
    remainingHours -= businessHoursPerDay;
  }
  return deadline.toISOString();
}

/** Submit a draft for approval — delegates to the approval engine for auto-routing */
export const submit = mutation({
  args: { id: v.id("fundRequests") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (req.submitterId !== me._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Bukan pengajuan Anda" });
    }
    if (req.status !== "draft") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Hanya draft yang bisa diajukan" });
    }

    // Try auto-routing via the approval engine
    // Import the engine's chain matching logic inline
    const matchType = req.requestType ?? req.category;
    const chains = await ctx.db
      .query("financeApprovalChains")
      .withIndex("by_request_type", (q) => q.eq("requestType", matchType))
      .collect();
    const activeChains = chains.filter((c) => c.isActive);
    const matchingChains = activeChains.filter((c) => {
      const meetsMin = req.amount >= c.minAmount;
      const meetsMax = c.maxAmount === 0 || req.amount <= c.maxAmount;
      return meetsMin && meetsMax;
    });

    if (matchingChains.length > 0) {
      // Auto-routing path: use the approval engine via submitWithAutoRouting
      // We call it directly from the api to keep it as a separate function
      // For now, trigger the auto-routing inline
      matchingChains.sort((a, b) => a.order - b.order);
      const chain = matchingChains[0];

      const levels = await ctx.db
        .query("financeApprovalLevels")
        .withIndex("by_chain", (q) => q.eq("chainId", chain._id))
        .collect();
      levels.sort((a, b) => a.level - b.level);

      if (levels.length > 0) {
        const submitter = await ctx.db.get(req.submitterId);
        if (!submitter) throw new ConvexError({ code: "NOT_FOUND", message: "Data pengaju tidak ditemukan" });

        // Delete any existing approval rows
        const existingApprovals = await ctx.db
          .query("fundRequestApprovals")
          .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.id))
          .collect();
        for (const ea of existingApprovals) {
          await ctx.db.delete(ea._id);
        }

        // Resolve approvers
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

          // Segregation of Duties
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

        if (resolvedApprovers.length > 0) {
          const now = new Date().toISOString();

          for (let i = 0; i < resolvedApprovers.length; i++) {
            const ra = resolvedApprovers[i];
            const slaDeadline = i === 0 ? calculateSlaDeadline(ra.slaHours) : undefined;
            await ctx.db.insert("fundRequestApprovals", {
              fundRequestId: args.id,
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

          await ctx.db.patch(args.id, {
            status: "in_review",
            currentApprovalLevel: 1,
            totalApprovalLevels: resolvedApprovers.length,
            submittedAt: now,
            approvalChainId: chain._id,
            approvalChainName: chain.name,
          });

          // Notify first approver
          await ctx.db.insert("notifications", {
            userId: resolvedApprovers[0].userId,
            type: "finance_approval",
            title: "Pengajuan Dana Menunggu Persetujuan",
            message: `${submitter.name ?? "Seseorang"} mengajukan dana "${req.title}" sebesar Rp ${req.amount.toLocaleString("id-ID")}. Silakan review.`,
            link: `/fund-requests?id=${args.id}`,
          });

          // Audit log: submitted
          await writeAuditLog(ctx, {
            fundRequestId: args.id,
            action: "submitted",
            actorId: me._id,
            actorName: me.name ?? "Unknown",
            actorRole: me.role,
            requestTitle: req.title,
            requestAmount: req.amount,
            requestStatus: "in_review",
            requestCategory: req.category,
            requestType: req.requestType,
            submitterId: req.submitterId,
            submitterName: submitter.name,
            submitterDepartment: submitter.department,
            metadata: JSON.stringify({ chainName: chain.name, chainId: chain._id, approverCount: resolvedApprovers.length }),
            organizationId: req.organizationId,
          });

          return;
        }
      }
    }

    // Fallback: use manual approvers if they exist
    const existingApprovals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.id))
      .collect();

    if (existingApprovals.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak ada rantai persetujuan yang cocok dan tidak ada approver manual. Hubungi admin untuk mengkonfigurasi rantai persetujuan.",
      });
    }

    await ctx.db.patch(args.id, {
      status: "in_review",
      submittedAt: new Date().toISOString(),
    });
  },
});

/** Approver approves or rejects the current level (with SLA tracking and notifications) */
export const review = mutation({
  args: {
    id: v.id("fundRequests"),
    action: v.union(v.literal("approve"), v.literal("reject"), v.literal("revise")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    await applyFundReview(ctx, me, args.id, args.action, args.note);
  },
});

// Core review logic shared by single and bulk review. Throws on invalid state
// so callers can decide whether to surface or skip (bulk skips).
async function applyFundReview(
  ctx: MutationCtx,
  me: Doc<"users">,
  id: Id<"fundRequests">,
  action: "approve" | "reject" | "revise",
  note: string | undefined,
): Promise<void> {
    const req = await ctx.db.get(id);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (req.status !== "in_review" && req.status !== "pending") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dalam status review" });
    }

    // Find the approval row for this level
    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", id))
      .collect();

    const currentRow = approvals.find((a) => a.level === req.currentApprovalLevel);
    if (!currentRow) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Data persetujuan tidak ditemukan" });
    }
    if (currentRow.approverId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Anda bukan penyetuju untuk level ini" });
    }

    const now = new Date().toISOString();
    const submitter = await ctx.db.get(req.submitterId);

    if (action === "reject") {
      await ctx.db.patch(currentRow._id, { status: "rejected", note, actedAt: now });
      await ctx.db.patch(id, {
        status: "rejected",
        rejectedAt: now,
        rejectedBy: me._id,
        rejectionReason: note,
      });
      // Audit log: rejected
      await writeAuditLog(ctx, {
        fundRequestId: id,
        action: "rejected",
        actorId: me._id,
        actorName: me.name ?? "Unknown",
        actorRole: me.role,
        approvalLevel: req.currentApprovalLevel,
        note,
        requestTitle: req.title,
        requestAmount: req.amount,
        requestStatus: "rejected",
        requestCategory: req.category,
        requestType: req.requestType,
        submitterId: req.submitterId,
        submitterName: submitter?.name,
        submitterDepartment: req.userDepartment,
        organizationId: req.organizationId,
      });
      // Notify submitter
      if (submitter) {
        await ctx.db.insert("notifications", {
          userId: submitter._id,
          type: "finance_approval",
          title: "Pengajuan Dana Ditolak",
          message: `Pengajuan "${req.title}" ditolak oleh ${me.name ?? "approver"} di level ${req.currentApprovalLevel}${note ? `. Alasan: ${note}` : ""}`,
          link: `/fund-requests?id=${id}`,
        });
      }
      return;
    }

    if (action === "revise") {
      if (!note) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Catatan revisi diperlukan" });
      }
      await ctx.db.patch(currentRow._id, { status: "revision", note, actedAt: now });
      await ctx.db.patch(id, {
        status: "revision_needed",
        revisionNote: note,
        revisionRequestedBy: me._id,
        revisionRequestedAt: now,
      });
      // Audit log: revision requested
      await writeAuditLog(ctx, {
        fundRequestId: id,
        action: "revision_requested",
        actorId: me._id,
        actorName: me.name ?? "Unknown",
        actorRole: me.role,
        approvalLevel: req.currentApprovalLevel,
        note,
        requestTitle: req.title,
        requestAmount: req.amount,
        requestStatus: "revision_needed",
        requestCategory: req.category,
        requestType: req.requestType,
        submitterId: req.submitterId,
        submitterName: submitter?.name,
        submitterDepartment: req.userDepartment,
        organizationId: req.organizationId,
      });
      // Notify submitter
      if (submitter) {
        await ctx.db.insert("notifications", {
          userId: submitter._id,
          type: "finance_approval",
          title: "Pengajuan Dana Perlu Revisi",
          message: `Pengajuan "${req.title}" perlu direvisi. Catatan dari ${me.name ?? "approver"}: ${note}`,
          link: `/fund-requests?id=${id}`,
        });
      }
      return;
    }

    // approve
    await ctx.db.patch(currentRow._id, { status: "approved", note, actedAt: now });

    // Audit log: approved at this level
    await writeAuditLog(ctx, {
      fundRequestId: id,
      action: "approved",
      actorId: me._id,
      actorName: me.name ?? "Unknown",
      actorRole: me.role,
      approvalLevel: req.currentApprovalLevel,
      note,
      requestTitle: req.title,
      requestAmount: req.amount,
      requestStatus: req.status,
      requestCategory: req.category,
      requestType: req.requestType,
      submitterId: req.submitterId,
      submitterName: submitter?.name,
      submitterDepartment: req.userDepartment,
      metadata: JSON.stringify({ level: req.currentApprovalLevel, totalLevels: req.totalApprovalLevels }),
      organizationId: req.organizationId,
    });

    const nextLevel = req.currentApprovalLevel + 1;
    if (nextLevel > req.totalApprovalLevels) {
      // All levels approved
      await ctx.db.patch(id, { status: "approved", currentApprovalLevel: nextLevel });
      // Notify submitter
      if (submitter) {
        await ctx.db.insert("notifications", {
          userId: submitter._id,
          type: "finance_approval",
          title: "Pengajuan Dana Disetujui",
          message: `Pengajuan "${req.title}" telah disetujui oleh semua level. Menunggu pencairan.`,
          link: `/fund-requests?id=${id}`,
        });
      }
    } else {
      // Advance to next level
      await ctx.db.patch(id, { currentApprovalLevel: nextLevel });

      // Set SLA for next level and notify
      const nextRow = approvals.find((a) => a.level === nextLevel);
      if (nextRow) {
        // Try to get SLA from chain config
        let slaHours = 48;
        if (req.approvalChainId) {
          const chainLevels = await ctx.db
            .query("financeApprovalLevels")
            .withIndex("by_chain", (q) => q.eq("chainId", req.approvalChainId!))
            .collect();
          const nextLevelConfig = chainLevels.find((l) => l.level === nextLevel);
          if (nextLevelConfig) slaHours = nextLevelConfig.slaHours;
        }
        const slaDeadline = calculateSlaDeadline(slaHours);
        await ctx.db.patch(nextRow._id, { slaDeadline });

        // Notify next approver
        await ctx.db.insert("notifications", {
          userId: nextRow.approverId,
          type: "finance_approval",
          title: "Pengajuan Dana Menunggu Persetujuan Anda",
          message: `Pengajuan "${req.title}" dari ${submitter?.name ?? "Seseorang"} (Rp ${req.amount.toLocaleString("id-ID")}) telah disetujui level sebelumnya. Giliran Anda review.`,
          link: `/fund-requests?id=${id}`,
        });
      }
    }
}

// Approve or reject many fund requests where it is the current user's approval
// turn. Skips items that are not in a reviewable state or not the user's level.
export const bulkReview = mutation({
  args: {
    ids: v.array(v.id("fundRequests")),
    action: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const me = await requireUser(ctx);
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 pengajuan per aksi",
      });
    }
    const note = args.note?.trim() ? args.note.trim() : undefined;
    let count = 0;
    for (const id of args.ids) {
      try {
        await applyFundReview(ctx, me, id, args.action, note);
        count += 1;
      } catch {
        // Skip items the user cannot act on or that are in the wrong state.
        continue;
      }
    }
    return { count };
  },
});

/** Finance marks the request as disbursed */
export const disburse = mutation({
  args: {
    id: v.id("fundRequests"),
    paymentMethod: v.string(),
    paymentReference: v.optional(v.string()),
    disbursementNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!canManageFinance(me.role) && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya Bendahara/Admin yang bisa mencairkan" });
    }
    const req = await ctx.db.get(args.id);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (req.status !== "approved") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Hanya pengajuan yang disetujui bisa dicairkan" });
    }
    await ctx.db.patch(args.id, {
      status: "disbursed",
      disbursedAt: new Date().toISOString(),
      disbursedById: me._id,
      paymentMethod: args.paymentMethod,
      paymentReference: args.paymentReference,
      disbursementNote: args.disbursementNote,
    });

    // Audit log: disbursed
    const submitter = await ctx.db.get(req.submitterId);
    await writeAuditLog(ctx, {
      fundRequestId: args.id,
      action: "disbursed",
      actorId: me._id,
      actorName: me.name ?? "Unknown",
      actorRole: me.role,
      requestTitle: req.title,
      requestAmount: req.amount,
      requestStatus: "disbursed",
      requestCategory: req.category,
      requestType: req.requestType,
      submitterId: req.submitterId,
      submitterName: submitter?.name,
      submitterDepartment: req.userDepartment,
      metadata: JSON.stringify({ paymentMethod: args.paymentMethod, paymentReference: args.paymentReference }),
      organizationId: req.organizationId,
    });
  },
});

/** Cancel a pending/draft request (submitter or admin) */
export const cancel = mutation({
  args: { id: v.id("fundRequests") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    const canCancel =
      req.submitterId === me._id ||
      isAdminRole(me.role) ||
      canManageFinance(me.role);
    if (!canCancel) throw new ConvexError({ code: "FORBIDDEN", message: "Tidak diizinkan membatalkan" });
    const cancellable = ["draft", "pending", "in_review", "revision_needed"];
    if (!cancellable.includes(req.status)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dapat dibatalkan" });
    }
    await ctx.db.patch(args.id, { status: "cancelled" });

    // Audit log: cancelled
    const submitter = await ctx.db.get(req.submitterId);
    await writeAuditLog(ctx, {
      fundRequestId: args.id,
      action: "cancelled",
      actorId: me._id,
      actorName: me.name ?? "Unknown",
      actorRole: me.role,
      requestTitle: req.title,
      requestAmount: req.amount,
      requestStatus: "cancelled",
      requestCategory: req.category,
      requestType: req.requestType,
      submitterId: req.submitterId,
      submitterName: submitter?.name,
      submitterDepartment: req.userDepartment,
      organizationId: req.organizationId,
    });
  },
});

/** Re-submit a revised request. Resets the approval chain from the revision level. */
export const resubmitAfterRevision = mutation({
  args: { id: v.id("fundRequests") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new ConvexError({ code: "NOT_FOUND", message: "Pengajuan tidak ditemukan" });
    if (req.submitterId !== me._id && !isAdminRole(me.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Bukan pengajuan Anda" });
    }
    if (req.status !== "revision_needed") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Pengajuan tidak dalam status revisi" });
    }

    const approvals = await ctx.db
      .query("fundRequestApprovals")
      .withIndex("by_fund_request", (q) => q.eq("fundRequestId", args.id))
      .collect();

    // Find the level that requested revision
    const revisionRow = approvals.find((a) => a.status === "revision");
    const resetFromLevel = revisionRow?.level ?? req.currentApprovalLevel;

    for (const approval of approvals) {
      if (approval.level >= resetFromLevel) {
        await ctx.db.patch(approval._id, {
          status: "pending",
          note: undefined,
          actedAt: undefined,
          slaDeadline: approval.level === resetFromLevel
            ? calculateSlaDeadline(48)
            : undefined,
        });
      }
    }

    await ctx.db.patch(args.id, {
      status: "in_review",
      currentApprovalLevel: resetFromLevel,
      revisionNote: undefined,
      revisionRequestedBy: undefined,
      revisionRequestedAt: undefined,
    });

    // Notify the approver
    if (revisionRow) {
      await ctx.db.insert("notifications", {
        userId: revisionRow.approverId,
        type: "finance_approval",
        title: "Pengajuan Dana Direvisi",
        message: `${me.name ?? "Pengaju"} telah merevisi pengajuan "${req.title}". Silakan review kembali.`,
        link: `/fund-requests?id=${args.id}`,
      });
    }

    // Audit log: resubmitted
    await writeAuditLog(ctx, {
      fundRequestId: args.id,
      action: "resubmitted",
      actorId: me._id,
      actorName: me.name ?? "Unknown",
      actorRole: me.role,
      approvalLevel: resetFromLevel,
      requestTitle: req.title,
      requestAmount: req.amount,
      requestStatus: "in_review",
      requestCategory: req.category,
      requestType: req.requestType,
      submitterId: req.submitterId,
      submitterName: me.name,
      submitterDepartment: req.userDepartment,
      organizationId: req.organizationId,
    });
  },
});

// ─── Custom Categories ───────────────────────────────────────────────────────

/** List all custom categories (admins see inactive too; others only active) */
export const listCategories = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"fundCategories">>> => {
    const me = await requireUser(ctx);
    const rows = await ctx.db.query("fundCategories").collect();
    const filtered = isAdminRole(me.role) ? rows : rows.filter((r) => r.isActive);
    filtered.sort((a, b) => a.order - b.order);
    return filtered;
  },
});

function slugifyKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// Built-in keys reserved by the frontend (fund-utils.ts). New custom categories
// cannot reuse these keys.
const BUILTIN_KEYS = new Set([
  "operational",
  "procurement",
  "travel",
  "training",
  "event",
  "other",
]);

/** Create a new custom category (admin only) */
export const createCategory = mutation({
  args: {
    label: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang bisa mengelola kategori",
      });
    }
    const label = args.label.trim();
    if (label.length < 2) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nama kategori minimal 2 karakter" });
    }
    const baseKey = slugifyKey(label);
    if (!baseKey) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama kategori tidak valid",
      });
    }

    // Ensure uniqueness against builtins and existing rows.
    const existingRows = await ctx.db.query("fundCategories").collect();
    const takenKeys = new Set([
      ...BUILTIN_KEYS,
      ...existingRows.map((r) => r.key),
    ]);
    let key = baseKey;
    let i = 2;
    while (takenKeys.has(key)) {
      key = `${baseKey}_${i}`;
      i += 1;
    }

    const maxOrder = existingRows.reduce((m, r) => Math.max(m, r.order), 0);
    const id = await ctx.db.insert("fundCategories", {
      key,
      label,
      description: args.description?.trim() || undefined,
      color: args.color ?? "slate",
      isActive: true,
      order: maxOrder + 1,
      createdById: me._id,
    });
    return id;
  },
});

/** Update a custom category (admin only) */
export const updateCategory = mutation({
  args: {
    id: v.id("fundCategories"),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang bisa mengelola kategori",
      });
    }
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError({ code: "NOT_FOUND", message: "Kategori tidak ditemukan" });
    const patch: Partial<Doc<"fundCategories">> = {};
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (label.length < 2) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Nama kategori minimal 2 karakter" });
      }
      patch.label = label;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.color !== undefined) patch.color = args.color;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a custom category (admin only). Existing requests retain their category string. */
export const deleteCategory = mutation({
  args: { id: v.id("fundCategories") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang bisa mengelola kategori",
      });
    }
    await ctx.db.delete(args.id);
  },
});
