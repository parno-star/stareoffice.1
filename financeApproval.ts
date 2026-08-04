import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, canManageFinance } from "./roles";
import { requireTenant } from "./lib/tenant";
import { REQUEST_TYPES, FINANCE_FUNCTIONS } from "./lib/financeConstants";

// Re-exported for existing imports within the backend.
export { REQUEST_TYPES, FINANCE_FUNCTIONS };

// ─── Helper ──────────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

function requireFinanceAdmin(user: Doc<"users">): void {
  if (!isAdminRole(user.role) && !canManageFinance(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin atau manajer keuangan yang dapat mengakses fitur ini",
    });
  }
}

// ─── Request type constants ──────────────────────────────────────────────────
// (moved to ./lib/financeConstants and re-exported above)

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL CHAINS
// ═══════════════════════════════════════════════════════════════════════════════

/** List all approval chains (with their levels) */
export const listChains = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"financeApprovalChains"> & { levels: Doc<"financeApprovalLevels">[] }>> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const chains = await ctx.db
      .query("financeApprovalChains")
      .collect();
    chains.sort((a, b) => a.order - b.order);

    const result = [];
    for (const chain of chains) {
      const levels = await ctx.db
        .query("financeApprovalLevels")
        .withIndex("by_chain", (q) => q.eq("chainId", chain._id))
        .collect();
      levels.sort((a, b) => a.level - b.level);
      result.push({ ...chain, levels });
    }
    return result;
  },
});

/** Get a single chain with its levels */
export const getChain = query({
  args: { id: v.id("financeApprovalChains") },
  handler: async (ctx, args): Promise<(Doc<"financeApprovalChains"> & { levels: Doc<"financeApprovalLevels">[] }) | null> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const chain = await ctx.db.get(args.id);
    if (!chain) return null;

    const levels = await ctx.db
      .query("financeApprovalLevels")
      .withIndex("by_chain", (q) => q.eq("chainId", chain._id))
      .collect();
    levels.sort((a, b) => a.level - b.level);

    return { ...chain, levels };
  },
});

/** Create a new approval chain */
export const createChain = mutation({
  args: {
    name: v.string(),
    requestType: v.string(),
    description: v.optional(v.string()),
    minAmount: v.number(),
    maxAmount: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"financeApprovalChains">> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    // Get max order
    const existing = await ctx.db.query("financeApprovalChains").collect();
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.order), 0);

    return ctx.db.insert("financeApprovalChains", {
      name: args.name.trim(),
      requestType: args.requestType,
      description: args.description?.trim(),
      minAmount: args.minAmount,
      maxAmount: args.maxAmount,
      isActive: true,
      order: maxOrder + 1,
      createdBy: me._id,
      updatedAt: new Date().toISOString(),
      organizationId: me.organizationId,
    });
  },
});

/** Update an approval chain */
export const updateChain = mutation({
  args: {
    id: v.id("financeApprovalChains"),
    name: v.optional(v.string()),
    requestType: v.optional(v.string()),
    description: v.optional(v.string()),
    minAmount: v.optional(v.number()),
    maxAmount: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const chain = await ctx.db.get(args.id);
    if (!chain) throw new ConvexError({ code: "NOT_FOUND", message: "Chain tidak ditemukan" });

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.requestType !== undefined) patch.requestType = args.requestType;
    if (args.description !== undefined) patch.description = args.description?.trim();
    if (args.minAmount !== undefined) patch.minAmount = args.minAmount;
    if (args.maxAmount !== undefined) patch.maxAmount = args.maxAmount;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.order !== undefined) patch.order = args.order;

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete an approval chain and all its levels */
export const deleteChain = mutation({
  args: { id: v.id("financeApprovalChains") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    // Delete all levels
    const levels = await ctx.db
      .query("financeApprovalLevels")
      .withIndex("by_chain", (q) => q.eq("chainId", args.id))
      .collect();
    for (const level of levels) {
      await ctx.db.delete(level._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL LEVELS
// ═══════════════════════════════════════════════════════════════════════════════

/** Add a level to a chain */
export const addLevel = mutation({
  args: {
    chainId: v.id("financeApprovalChains"),
    label: v.string(),
    approverType: v.string(), // "role" | "specific_user" | "manager" | "position_level" | "department_head"
    roleKey: v.optional(v.string()),
    specificUserId: v.optional(v.id("users")),
    positionLevelId: v.optional(v.id("positionLevels")),
    slaHours: v.optional(v.number()),
    canDelegate: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"financeApprovalLevels">> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const chain = await ctx.db.get(args.chainId);
    if (!chain) throw new ConvexError({ code: "NOT_FOUND", message: "Chain tidak ditemukan" });

    // Get next level number
    const existingLevels = await ctx.db
      .query("financeApprovalLevels")
      .withIndex("by_chain", (q) => q.eq("chainId", args.chainId))
      .collect();
    const maxLevel = existingLevels.reduce((m, l) => Math.max(m, l.level), 0);

    return ctx.db.insert("financeApprovalLevels", {
      chainId: args.chainId,
      level: maxLevel + 1,
      label: args.label.trim(),
      approverType: args.approverType,
      roleKey: args.roleKey,
      specificUserId: args.specificUserId,
      positionLevelId: args.positionLevelId,
      slaHours: args.slaHours ?? 48,
      canDelegate: args.canDelegate ?? true,
      organizationId: me.organizationId,
    });
  },
});

/** Update a level */
export const updateLevel = mutation({
  args: {
    id: v.id("financeApprovalLevels"),
    label: v.optional(v.string()),
    approverType: v.optional(v.string()),
    roleKey: v.optional(v.string()),
    specificUserId: v.optional(v.union(v.id("users"), v.null())),
    positionLevelId: v.optional(v.union(v.id("positionLevels"), v.null())),
    slaHours: v.optional(v.number()),
    canDelegate: v.optional(v.boolean()),
    level: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError({ code: "NOT_FOUND", message: "Level tidak ditemukan" });

    const patch: Record<string, unknown> = {};
    if (args.label !== undefined) patch.label = args.label.trim();
    if (args.approverType !== undefined) patch.approverType = args.approverType;
    if (args.roleKey !== undefined) patch.roleKey = args.roleKey;
    if (args.specificUserId !== undefined) {
      patch.specificUserId = args.specificUserId === null ? undefined : args.specificUserId;
    }
    if (args.positionLevelId !== undefined) {
      patch.positionLevelId = args.positionLevelId === null ? undefined : args.positionLevelId;
    }
    if (args.slaHours !== undefined) patch.slaHours = args.slaHours;
    if (args.canDelegate !== undefined) patch.canDelegate = args.canDelegate;
    if (args.level !== undefined) patch.level = args.level;

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a level and re-order remaining */
export const deleteLevel = mutation({
  args: { id: v.id("financeApprovalLevels") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const level = await ctx.db.get(args.id);
    if (!level) throw new ConvexError({ code: "NOT_FOUND", message: "Level tidak ditemukan" });

    await ctx.db.delete(args.id);

    // Re-order remaining levels
    const remaining = await ctx.db
      .query("financeApprovalLevels")
      .withIndex("by_chain", (q) => q.eq("chainId", level.chainId))
      .collect();
    remaining.sort((a, b) => a.level - b.level);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].level !== i + 1) {
        await ctx.db.patch(remaining[i]._id, { level: i + 1 });
      }
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELEGATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** List all active delegations */
export const listDelegations = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"financeApprovalDelegations"> & { delegatorName: string; delegateName: string }>> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const delegations = await ctx.db
      .query("financeApprovalDelegations")
      .collect();
    delegations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const result = [];
    for (const d of delegations) {
      const delegator = await ctx.db.get(d.delegatorId);
      const delegate = await ctx.db.get(d.delegateId);
      result.push({
        ...d,
        delegatorName: delegator?.name ?? "Unknown",
        delegateName: delegate?.name ?? "Unknown",
      });
    }
    return result;
  },
});

/** Create a delegation */
export const createDelegation = mutation({
  args: {
    delegatorId: v.id("users"),
    delegateId: v.id("users"),
    chainId: v.optional(v.id("financeApprovalChains")),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"financeApprovalDelegations">> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    if (args.delegatorId === args.delegateId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tidak bisa mendelegasikan ke diri sendiri" });
    }

    return ctx.db.insert("financeApprovalDelegations", {
      delegatorId: args.delegatorId,
      delegateId: args.delegateId,
      chainId: args.chainId,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason.trim(),
      isActive: true,
      createdBy: me._id,
      createdAt: new Date().toISOString(),
      organizationId: me.organizationId,
    });
  },
});

/** Toggle delegation active/inactive */
export const toggleDelegation = mutation({
  args: {
    id: v.id("financeApprovalDelegations"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);
    await ctx.db.patch(args.id, { isActive: args.isActive });
  },
});

/** Delete a delegation */
export const deleteDelegation = mutation({
  args: { id: v.id("financeApprovalDelegations") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);
    await ctx.db.delete(args.id);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE ROLE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════════

/** List all finance role mappings */
export const listRoleMappings = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"financeRoleMappings"> & { assignedUsers: Array<{ _id: Id<"users">; name: string }> }>> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const mappings = await ctx.db.query("financeRoleMappings").collect();

    const result = [];
    for (const m of mappings) {
      const assignedUsers: Array<{ _id: Id<"users">; name: string }> = [];
      for (const userId of m.assignedUserIds) {
        const user = await ctx.db.get(userId);
        if (user) {
          assignedUsers.push({ _id: user._id, name: user.name ?? "Unknown" });
        }
      }
      result.push({ ...m, assignedUsers });
    }
    return result;
  },
});

/** Upsert a finance role mapping */
export const upsertRoleMapping = mutation({
  args: {
    functionKey: v.string(),
    functionLabel: v.string(),
    description: v.optional(v.string()),
    assignedUserIds: v.array(v.id("users")),
    fallbackRole: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    // Check if mapping already exists
    const existing = await ctx.db
      .query("financeRoleMappings")
      .withIndex("by_function_key", (q) => q.eq("functionKey", args.functionKey))
      .first();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        functionLabel: args.functionLabel,
        description: args.description,
        assignedUserIds: args.assignedUserIds,
        fallbackRole: args.fallbackRole,
        updatedBy: me._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("financeRoleMappings", {
        functionKey: args.functionKey,
        functionLabel: args.functionLabel,
        description: args.description,
        assignedUserIds: args.assignedUserIds,
        fallbackRole: args.fallbackRole,
        isActive: true,
        updatedBy: me._id,
        updatedAt: now,
        organizationId: me.organizationId,
      });
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER LIST (for dropdowns)
// ═══════════════════════════════════════════════════════════════════════════════

/** Get all users for assignment dropdowns */
export const listUsersForAssignment = query({
  args: {},
  handler: async (ctx): Promise<Array<{ _id: Id<"users">; name: string; role: string; department: string; jobTitle: string }>> => {
    const me = await requireUser(ctx);
    requireFinanceAdmin(me);

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.accountStatus === "active" || !u.accountStatus)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Unknown",
        role: u.role ?? "employee",
        department: u.department ?? "-",
        jobTitle: u.jobTitle ?? "-",
      }));
  },
});
