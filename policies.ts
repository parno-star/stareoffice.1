import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { notifyAllUsers } from "./notifications";
import { requireTenant, assertSameTenant } from "./lib/tenant";
import { filterCountableEmployees } from "./lib/countableUsers";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
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
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

async function requireAdmin(
  ctx: MutationCtx | QueryCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola kebijakan perusahaan",
    });
  }
  return user;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyWithAuthor = Doc<"policies"> & {
  authorName: string | null;
  hasAcknowledged: boolean;
  attachmentUrl: string | null;
};

export type PolicyListItem = {
  _id: Id<"policies">;
  _creationTime: number;
  title: string;
  summary: string;
  category: string;
  version: string;
  status: string;
  requiresAcknowledgment: boolean;
  effectiveDate: string;
  isPinned: boolean;
  tags: Array<string>;
  viewCount: number;
  acknowledgmentCount: number;
  publishedAt: string | undefined;
  lastEditedAt: string;
  hasAcknowledged: boolean;
  authorName: string | null;
};

// ---------------------------------------------------------------------------
// List & search
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    includeDrafts: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<PolicyListItem>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const isAdmin = isAdminRole(user.role);
    const includeDrafts = Boolean(args.includeDrafts) && isAdmin;

    let rows: Array<Doc<"policies">>;
    if (args.search && args.search.trim().length > 0) {
      rows = await ctx.db
        .query("policies")
        .withSearchIndex("search_title", (q) => {
          let builder = q.search("title", args.search!);
          if (args.category && args.category !== "all") {
            builder = builder.eq("category", args.category);
          }
          return builder;
        })
        .take(100);
    } else if (args.category && args.category !== "all") {
      rows = await ctx.db
        .query("policies")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    } else {
      rows = await ctx.db.query("policies").collect();
    }

    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      rows = rows.filter((p) => p.organizationId === organizationId);
    }

    const filtered = rows.filter((p) => {
      if (includeDrafts) return p.status !== "archived" || isAdmin;
      return p.status === "published";
    });

    // Pin first, then by publishedAt desc (falls back to creation time)
    filtered.sort((a, b) => {
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      const ta = a.publishedAt
        ? new Date(a.publishedAt).getTime()
        : a._creationTime;
      const tb = b.publishedAt
        ? new Date(b.publishedAt).getTime()
        : b._creationTime;
      return tb - ta;
    });

    // Compute acknowledgment for each policy for this user
    const items: Array<PolicyListItem> = [];
    for (const p of filtered) {
      const ack = await ctx.db
        .query("policyAcknowledgments")
        .withIndex("by_policy_and_user", (q) =>
          q.eq("policyId", p._id).eq("userId", user._id),
        )
        .first();
      const hasAcknowledged =
        ack !== null && ack !== undefined && ack.version === p.version;
      const author = await ctx.db.get(p.authorId);
      items.push({
        _id: p._id,
        _creationTime: p._creationTime,
        title: p.title,
        summary: p.summary,
        category: p.category,
        version: p.version,
        status: p.status,
        requiresAcknowledgment: p.requiresAcknowledgment,
        effectiveDate: p.effectiveDate,
        isPinned: Boolean(p.isPinned),
        tags: p.tags,
        viewCount: p.viewCount,
        acknowledgmentCount: p.acknowledgmentCount,
        publishedAt: p.publishedAt,
        lastEditedAt: p.lastEditedAt,
        hasAcknowledged,
        authorName: author?.name ?? null,
      });
    }
    return items;
  },
});

// ---------------------------------------------------------------------------
// Stats (for header cards)
// ---------------------------------------------------------------------------

export type PolicyStats = {
  totalPublished: number;
  totalRequiringAck: number;
  myAcknowledged: number;
  myPending: number;
  totalUsers: number;
  recentlyUpdated: number; // updated in last 30 days
};

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<PolicyStats> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    let policies = await ctx.db
      .query("policies")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      policies = policies.filter((p) => p.organizationId === organizationId);
    }

    let users = await ctx.db.query("users").collect();
    // Post-filter users by organization for accurate totalUsers count
    if (organizationId) {
      users = users.filter((u) => u.organizationId === organizationId);
    }
    // Exclude test/simulation & super_admin accounts from the workforce count.
    users = filterCountableEmployees(users);

    const requiring = policies.filter((p) => p.requiresAcknowledgment);
    let myAcknowledged = 0;
    for (const p of requiring) {
      const ack = await ctx.db
        .query("policyAcknowledgments")
        .withIndex("by_policy_and_user", (q) =>
          q.eq("policyId", p._id).eq("userId", user._id),
        )
        .first();
      if (ack && ack.version === p.version) myAcknowledged += 1;
    }
    const myPending = requiring.length - myAcknowledged;

    const thirty = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentlyUpdated = policies.filter((p) => {
      const t = new Date(p.lastEditedAt).getTime();
      return Number.isFinite(t) && t >= thirty;
    }).length;

    return {
      totalPublished: policies.length,
      totalRequiringAck: requiring.length,
      myAcknowledged,
      myPending,
      totalUsers: users.length,
      recentlyUpdated,
    };
  },
});

// ---------------------------------------------------------------------------
// Get single policy
// ---------------------------------------------------------------------------

export const getById = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<PolicyWithAuthor | null> => {
    const user = await requireUser(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) return null;
    // Employees can only view published or archived policies
    if (policy.status === "draft" && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Kebijakan ini belum dipublikasikan",
      });
    }
    const author = await ctx.db.get(policy.authorId);
    const ack = await ctx.db
      .query("policyAcknowledgments")
      .withIndex("by_policy_and_user", (q) =>
        q.eq("policyId", policy._id).eq("userId", user._id),
      )
      .first();
    let attachmentUrl: string | null = null;
    if (policy.attachmentStorageId) {
      attachmentUrl = await ctx.storage.getUrl(policy.attachmentStorageId);
    }
    return {
      ...policy,
      authorName: author?.name ?? null,
      hasAcknowledged:
        ack !== null && ack !== undefined && ack.version === policy.version,
      attachmentUrl,
    };
  },
});

// ---------------------------------------------------------------------------
// Acknowledgment list for a policy (admin only)
// ---------------------------------------------------------------------------

export type PolicyAckRow = {
  _id: Id<"policyAcknowledgments">;
  userId: Id<"users">;
  userName: string;
  userDepartment: string | undefined;
  userAvatar: string | undefined;
  version: string;
  acknowledgedAt: string;
};

export const getAcknowledgments = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<Array<PolicyAckRow>> => {
    await requireAdmin(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const rows = await ctx.db
      .query("policyAcknowledgments")
      .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
      .collect();
    const items: Array<PolicyAckRow> = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      if (!u) continue;
      // Post-filter by organization
      if (organizationId && u.organizationId !== organizationId) continue;
      items.push({
        _id: r._id,
        userId: r.userId,
        userName: u.name ?? "Karyawan",
        userDepartment: u.department,
        userAvatar: u.avatarUrl,
        version: r.version,
        acknowledgedAt: r.acknowledgedAt,
      });
    }
    items.sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt));
    return items;
  },
});

export type PolicyPendingRow = {
  userId: Id<"users">;
  userName: string;
  userDepartment: string | undefined;
  userAvatar: string | undefined;
};

export const getPendingAcknowledgments = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<Array<PolicyPendingRow>> => {
    await requireAdmin(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const policy = await ctx.db.get(args.policyId);
    if (!policy) return [];
    const acks = await ctx.db
      .query("policyAcknowledgments")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect();
    const ackSet = new Set(
      acks.filter((a) => a.version === policy.version).map((a) => a.userId),
    );
    let users = await ctx.db.query("users").collect();
    // Post-filter by organization (also applies to a super admin viewing one org)
    if (organizationId) {
      users = users.filter((u) => u.organizationId === organizationId);
    }
    const pending = users
      .filter((u) => !ackSet.has(u._id))
      .map((u) => ({
        userId: u._id,
        userName: u.name ?? "Karyawan",
        userDepartment: u.department,
        userAvatar: u.avatarUrl,
      }));
    pending.sort((a, b) => a.userName.localeCompare(b.userName));
    return pending;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

export const create = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    category: v.string(),
    version: v.string(),
    effectiveDate: v.string(),
    requiresAcknowledgment: v.boolean(),
    tags: v.array(v.string()),
    expiresAt: v.optional(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
    publishNow: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"policies">> => {
    const admin = await requireAdmin(ctx);
    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul tidak boleh kosong",
      });
    }
    if (args.summary.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Ringkasan tidak boleh kosong",
      });
    }
    const now = nowIso();
    const policyId = await ctx.db.insert("policies", {
      title: args.title.trim(),
      summary: args.summary.trim(),
      content: args.content,
      category: args.category,
      version: args.version.trim() || "1.0",
      status: args.publishNow ? "published" : "draft",
      requiresAcknowledgment: args.requiresAcknowledgment,
      effectiveDate: args.effectiveDate,
      expiresAt: args.expiresAt,
      tags: args.tags,
      attachmentStorageId: args.attachmentStorageId,
      attachmentFileName: args.attachmentFileName,
      authorId: admin._id,
      lastEditorId: admin._id,
      lastEditedAt: now,
      publishedAt: args.publishNow ? now : undefined,
      viewCount: 0,
      acknowledgmentCount: 0,
      isPinned: args.isPinned,
      organizationId: admin.organizationId,
    });
    if (args.publishNow) {
      await notifyAllUsers(ctx, {
        type: "policy_published",
        title: "Kebijakan baru diterbitkan",
        message: args.title,
        link: `/policies/${policyId}`,
        actorId: admin._id,
      });
    }
    return policyId;
  },
});

export const update = mutation({
  args: {
    policyId: v.id("policies"),
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    category: v.string(),
    version: v.string(),
    effectiveDate: v.string(),
    requiresAcknowledgment: v.boolean(),
    tags: v.array(v.string()),
    expiresAt: v.optional(v.string()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentFileName: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
    bumpAcknowledgments: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireAdmin(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kebijakan tidak ditemukan",
      });
    }
    if (policy.organizationId) {
      assertSameTenant(admin.organizationId ?? null, policy.organizationId, "policy");
    }
    const versionChanged = policy.version !== args.version.trim();
    const now = nowIso();
    await ctx.db.patch(args.policyId, {
      title: args.title.trim(),
      summary: args.summary.trim(),
      content: args.content,
      category: args.category,
      version: args.version.trim() || policy.version,
      effectiveDate: args.effectiveDate,
      requiresAcknowledgment: args.requiresAcknowledgment,
      tags: args.tags,
      expiresAt: args.expiresAt,
      attachmentStorageId: args.attachmentStorageId,
      attachmentFileName: args.attachmentFileName,
      isPinned: args.isPinned,
      lastEditorId: admin._id,
      lastEditedAt: now,
      // Reset acknowledgment count if we bumped the version
      acknowledgmentCount:
        versionChanged && args.bumpAcknowledgments
          ? 0
          : policy.acknowledgmentCount,
    });
    if (
      versionChanged &&
      args.bumpAcknowledgments &&
      policy.status === "published"
    ) {
      await notifyAllUsers(ctx, {
        type: "policy_updated",
        title: "Kebijakan diperbarui - butuh konfirmasi ulang",
        message: `${args.title} (versi ${args.version})`,
        link: `/policies/${args.policyId}`,
        actorId: admin._id,
      });
    }
  },
});

export const publish = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireAdmin(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kebijakan tidak ditemukan",
      });
    }
    if (policy.organizationId) {
      assertSameTenant(admin.organizationId ?? null, policy.organizationId, "policy");
    }
    const now = nowIso();
    await ctx.db.patch(args.policyId, {
      status: "published",
      publishedAt: policy.publishedAt ?? now,
      lastEditedAt: now,
      lastEditorId: admin._id,
    });
    await notifyAllUsers(ctx, {
      type: "policy_published",
      title: "Kebijakan baru diterbitkan",
      message: policy.title,
      link: `/policies/${args.policyId}`,
      actorId: admin._id,
    });
  },
});

export const archive = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireAdmin(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) return;
    if (policy.organizationId) {
      assertSameTenant(admin.organizationId ?? null, policy.organizationId, "policy");
    }
    await ctx.db.patch(args.policyId, {
      status: "archived",
      lastEditedAt: nowIso(),
      lastEditorId: admin._id,
    });
  },
});

export const remove = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<void> => {
    const admin = await requireAdmin(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (policy?.organizationId) {
      assertSameTenant(admin.organizationId ?? null, policy.organizationId, "policy");
    }
    const acks = await ctx.db
      .query("policyAcknowledgments")
      .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
      .collect();
    for (const a of acks) {
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(args.policyId);
  },
});

export const acknowledge = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUser(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kebijakan tidak ditemukan",
      });
    }
    if (policy.organizationId) {
      assertSameTenant(user.organizationId ?? null, policy.organizationId, "policy");
    }
    if (policy.status !== "published") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya kebijakan yang sudah terbit yang bisa dikonfirmasi",
      });
    }
    const existing = await ctx.db
      .query("policyAcknowledgments")
      .withIndex("by_policy_and_user", (q) =>
        q.eq("policyId", args.policyId).eq("userId", user._id),
      )
      .first();
    const now = nowIso();
    if (existing) {
      if (existing.version === policy.version) return;
      await ctx.db.patch(existing._id, {
        version: policy.version,
        acknowledgedAt: now,
      });
    } else {
      await ctx.db.insert("policyAcknowledgments", {
        policyId: policy._id,
        userId: user._id,
        version: policy.version,
        acknowledgedAt: now,
      });
    }
    // Recompute acknowledgment count for current version (simple approach)
    const allAck = await ctx.db
      .query("policyAcknowledgments")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .collect();
    const count = allAck.filter((a) => a.version === policy.version).length;
    await ctx.db.patch(policy._id, { acknowledgmentCount: count });
  },
});

export const incrementView = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUser(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) return;
    if (policy.organizationId) {
      assertSameTenant(user.organizationId ?? null, policy.organizationId, "policy");
    }
    await ctx.db.patch(args.policyId, {
      viewCount: (policy.viewCount ?? 0) + 1,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
