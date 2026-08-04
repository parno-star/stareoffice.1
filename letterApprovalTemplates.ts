import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireTenant } from "./lib/tenant";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  }
  return user;
}

function requireAdmin(user: Doc<"users">): void {
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new ConvexError({
      message: "Hanya admin yang dapat mengakses fitur ini",
      code: "FORBIDDEN",
    });
  }
}

// ─── Step role labels ────────────────────────────────────────────────────────

export const STEP_ROLES = [
  { value: "konseptor", label: "Konseptor" },
  { value: "pemeriksa_1", label: "Pemeriksa I" },
  { value: "pemeriksa_2", label: "Pemeriksa II" },
  { value: "penyetuju", label: "Penyetuju / Penandatangan" },
] as const;

export const RESOLVER_TYPES = [
  { value: "author", label: "Pembuat Surat (Konseptor)" },
  { value: "direct_manager", label: "Atasan Langsung" },
  { value: "department_head", label: "Kepala Departemen/Bagian" },
  { value: "position_level", label: "Berdasarkan Jenjang Jabatan" },
  { value: "specific_user", label: "Pengguna Tertentu" },
] as const;

export const LETTER_TYPES_FOR_TEMPLATE = [
  { value: "keluar", label: "Surat Keluar" },
  { value: "masuk", label: "Surat Masuk" },
  { value: "memo", label: "Nota" },
  { value: "sk", label: "Surat Keputusan (SK)" },
  { value: "all", label: "Semua Jenis Surat" },
] as const;

// ═════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═════════════════════════════════════════════════════════════════════════════

/** List all templates */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"letterApprovalTemplates">[]> => {
    await requireAuth(ctx);
    return await ctx.db.query("letterApprovalTemplates").collect();
  },
});

/** List active templates, optionally filtered by letter type */
export const listActive = query({
  args: { letterType: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Doc<"letterApprovalTemplates">[]> => {
    await requireAuth(ctx);
    const all = await ctx.db
      .query("letterApprovalTemplates")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    if (!args.letterType) return all;
    return all.filter(
      (t) => t.letterType === args.letterType || t.letterType === "all",
    );
  },
});

/** Get a single template */
export const get = query({
  args: { id: v.id("letterApprovalTemplates") },
  handler: async (ctx, args): Promise<Doc<"letterApprovalTemplates"> | null> => {
    await requireAuth(ctx);
    return ctx.db.get(args.id);
  },
});

/** Get the default template for a specific letter type */
export const getDefault = query({
  args: { letterType: v.string() },
  handler: async (ctx, args): Promise<Doc<"letterApprovalTemplates"> | null> => {
    await requireAuth(ctx);
    // First try exact type match
    const all = await ctx.db
      .query("letterApprovalTemplates")
      .withIndex("by_letter_type", (q) => q.eq("letterType", args.letterType))
      .collect();
    const activeDefault = all.find((t) => t.isActive && t.isDefault);
    if (activeDefault) return activeDefault;

    // Fall back to "all" type
    const allType = await ctx.db
      .query("letterApprovalTemplates")
      .withIndex("by_letter_type", (q) => q.eq("letterType", "all"))
      .collect();
    const fallback = allType.find((t) => t.isActive && t.isDefault);
    return fallback ?? null;
  },
});

// ─── Resolve approvers for a template ────────────────────────────────────────

type ResolvedApprover = {
  stepOrder: number;
  role: string;
  label: string;
  resolverType: string;
  userId: Id<"users"> | null;
  userName: string | null;
  userJobTitle: string | null;
  positionLevelName: string | null;
};

/**
 * Resolve the concrete approver list for a template given the author (konseptor).
 * Walks up the org hierarchy using managerId and positionLevelId.
 */
export const resolveApprovers = query({
  args: {
    templateId: v.id("letterApprovalTemplates"),
    authorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<ResolvedApprover[]> => {
    const me = await requireAuth(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) return [];

    const authorId = args.authorId ?? me._id;
    const author = await ctx.db.get(authorId);
    if (!author) return [];

    const results: ResolvedApprover[] = [];

    for (const step of template.steps) {
      let userId: Id<"users"> | null = null;
      let userName: string | null = null;
      let userJobTitle: string | null = null;
      let positionLevelName: string | null = null;

      switch (step.resolverType) {
        case "author": {
          userId = author._id;
          userName = author.name ?? null;
          userJobTitle = author.jobTitle ?? null;
          if (author.positionLevelId) {
            const lvl = await ctx.db.get(author.positionLevelId);
            if (lvl) positionLevelName = lvl.name;
          }
          break;
        }
        case "direct_manager": {
          if (author.managerId) {
            const mgr = await ctx.db.get(author.managerId);
            if (mgr) {
              userId = mgr._id;
              userName = mgr.name ?? null;
              userJobTitle = mgr.jobTitle ?? null;
              if (mgr.positionLevelId) {
                const lvl = await ctx.db.get(mgr.positionLevelId);
                if (lvl) positionLevelName = lvl.name;
              }
            }
          }
          break;
        }
        case "department_head": {
          // Find users in the same department with managerId = null or
          // whose positionLevel has rank <= 5 (Manager level or higher)
          if (author.department) {
            const deptUsers = await ctx.db
              .query("users")
              .filter((q) =>
                q.and(
                  q.eq(q.field("department"), author.department),
                  q.neq(q.field("_id"), author._id),
                ),
              )
              .collect();
            // Pick user with highest rank (lowest rank number) who can approve letters
            let bestCandidate: Doc<"users"> | null = null;
            let bestRank = 999;
            for (const u of deptUsers) {
              if (u.positionLevelId) {
                const lvl = await ctx.db.get(u.positionLevelId);
                if (lvl && lvl.canApproveLetters && lvl.rank < bestRank) {
                  bestRank = lvl.rank;
                  bestCandidate = u;
                }
              }
            }
            if (bestCandidate) {
              userId = bestCandidate._id;
              userName = bestCandidate.name ?? null;
              userJobTitle = bestCandidate.jobTitle ?? null;
              if (bestCandidate.positionLevelId) {
                const lvl = await ctx.db.get(bestCandidate.positionLevelId);
                if (lvl) positionLevelName = lvl.name;
              }
            }
          }
          break;
        }
        case "position_level": {
          // Find user with matching position level code, walking up from author's manager
          if (step.minPositionLevelCode) {
            // Find target position level
            const targetLevel = await ctx.db
              .query("positionLevels")
              .withIndex("by_code", (q) => q.eq("code", step.minPositionLevelCode!))
              .first();
            if (targetLevel) {
              positionLevelName = targetLevel.name;
              // Walk up the manager chain to find someone at or above target level
              let currentUser: Doc<"users"> | null = author;
              const visited = new Set<string>();
              while (currentUser?.managerId && !visited.has(currentUser.managerId)) {
                visited.add(currentUser.managerId);
                const mgrUser: Doc<"users"> | null = await ctx.db.get(currentUser.managerId);
                if (!mgrUser) break;
                if (mgrUser.positionLevelId) {
                  const mgrLevel: Doc<"positionLevels"> | null = await ctx.db.get(mgrUser.positionLevelId);
                  if (mgrLevel && mgrLevel.rank <= targetLevel.rank) {
                    userId = mgrUser._id;
                    userName = mgrUser.name ?? null;
                    userJobTitle = mgrUser.jobTitle ?? null;
                    positionLevelName = mgrLevel.name;
                    break;
                  }
                }
                currentUser = mgrUser;
              }
            }
          }
          break;
        }
        case "specific_user": {
          if (step.specificUserId) {
            const u = await ctx.db.get(step.specificUserId);
            if (u) {
              userId = u._id;
              userName = u.name ?? null;
              userJobTitle = u.jobTitle ?? null;
              if (u.positionLevelId) {
                const lvl = await ctx.db.get(u.positionLevelId);
                if (lvl) positionLevelName = lvl.name;
              }
            }
          }
          break;
        }
      }

      results.push({
        stepOrder: step.order,
        role: step.role,
        label: step.label,
        resolverType: step.resolverType,
        userId,
        userName,
        userJobTitle,
        positionLevelName,
      });
    }

    return results;
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═════════════════════════════════════════════════════════════════════════════

const stepValidator = v.object({
  order: v.number(),
  role: v.string(),
  label: v.string(),
  resolverType: v.string(),
  minPositionLevelCode: v.optional(v.string()),
  specificUserId: v.optional(v.id("users")),
});

/** Create a new template */
export const create = mutation({
  args: {
    name: v.string(),
    letterType: v.string(),
    description: v.optional(v.string()),
    steps: v.array(stepValidator),
    isActive: v.boolean(),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"letterApprovalTemplates">> => {
    const me = await requireAuth(ctx);
    requireAdmin(me);

    if (args.steps.length === 0) {
      throw new ConvexError({
        message: "Template harus memiliki minimal 1 langkah",
        code: "BAD_REQUEST",
      });
    }

    // If setting as default, unset existing defaults for this letter type
    if (args.isDefault) {
      const existing = await ctx.db
        .query("letterApprovalTemplates")
        .withIndex("by_letter_type", (q) => q.eq("letterType", args.letterType))
        .collect();
      for (const t of existing) {
        if (t.isDefault) {
          await ctx.db.patch(t._id, { isDefault: false });
        }
      }
    }

    return await ctx.db.insert("letterApprovalTemplates", {
      name: args.name,
      letterType: args.letterType,
      description: args.description,
      steps: args.steps,
      isActive: args.isActive,
      isDefault: args.isDefault,
      createdBy: me._id,
      updatedAt: new Date().toISOString(),
    });
  },
});

/** Update an existing template */
export const update = mutation({
  args: {
    id: v.id("letterApprovalTemplates"),
    name: v.optional(v.string()),
    letterType: v.optional(v.string()),
    description: v.optional(v.string()),
    steps: v.optional(v.array(stepValidator)),
    isActive: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    requireAdmin(me);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({ message: "Template tidak ditemukan", code: "NOT_FOUND" });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.letterType !== undefined) patch.letterType = args.letterType;
    if (args.description !== undefined) patch.description = args.description;
    if (args.steps !== undefined) {
      if (args.steps.length === 0) {
        throw new ConvexError({
          message: "Template harus memiliki minimal 1 langkah",
          code: "BAD_REQUEST",
        });
      }
      patch.steps = args.steps;
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    if (args.isDefault === true) {
      const letterType = args.letterType ?? existing.letterType;
      const others = await ctx.db
        .query("letterApprovalTemplates")
        .withIndex("by_letter_type", (q) => q.eq("letterType", letterType))
        .collect();
      for (const t of others) {
        if (t._id !== args.id && t.isDefault) {
          await ctx.db.patch(t._id, { isDefault: false });
        }
      }
      patch.isDefault = true;
    } else if (args.isDefault === false) {
      patch.isDefault = false;
    }

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a template */
export const remove = mutation({
  args: { id: v.id("letterApprovalTemplates") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireAuth(ctx);
    requireAdmin(me);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({ message: "Template tidak ditemukan", code: "NOT_FOUND" });
    }

    await ctx.db.delete(args.id);
  },
});

/** Seed default BUMN letter approval templates (idempotent) */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx): Promise<{ created: number; skipped: number }> => {
    const me = await requireAuth(ctx);
    requireAdmin(me);

    const existing = await ctx.db
      .query("letterApprovalTemplates")
      .collect();

    const defaults = [
      {
        name: "Surat Keluar Standar",
        letterType: "keluar",
        description: "Alur persetujuan standar untuk surat keluar: Konseptor → Pemeriksa I (atasan langsung) → Pemeriksa II (kepala bagian) → Penyetuju (kepala divisi/direktur)",
        steps: [
          { order: 1, role: "konseptor", label: "Konseptor", resolverType: "author" },
          { order: 2, role: "pemeriksa_1", label: "Pemeriksa I", resolverType: "direct_manager" },
          { order: 3, role: "pemeriksa_2", label: "Pemeriksa II", resolverType: "position_level", minPositionLevelCode: "L5" },
          { order: 4, role: "penyetuju", label: "Penyetuju", resolverType: "position_level", minPositionLevelCode: "L3" },
        ],
        isDefault: true,
      },
      {
        name: "Nota Internal",
        letterType: "memo",
        description: "Alur persetujuan nota internal: Konseptor → Pemeriksa (atasan langsung) → Disetujui (kepala bagian)",
        steps: [
          { order: 1, role: "konseptor", label: "Konseptor", resolverType: "author" },
          { order: 2, role: "pemeriksa_1", label: "Pemeriksa", resolverType: "direct_manager" },
          { order: 3, role: "penyetuju", label: "Penyetuju", resolverType: "department_head" },
        ],
        isDefault: true,
      },
      {
        name: "Surat Keputusan (SK)",
        letterType: "sk",
        description: "Alur persetujuan SK: Konseptor → Pemeriksa I → Pemeriksa II → Direktur",
        steps: [
          { order: 1, role: "konseptor", label: "Konseptor", resolverType: "author" },
          { order: 2, role: "pemeriksa_1", label: "Pemeriksa I", resolverType: "direct_manager" },
          { order: 3, role: "pemeriksa_2", label: "Pemeriksa II", resolverType: "position_level", minPositionLevelCode: "L4" },
          { order: 4, role: "penyetuju", label: "Penyetuju", resolverType: "position_level", minPositionLevelCode: "L2" },
        ],
        isDefault: true,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const def of defaults) {
      // Check if a template with this name already exists
      const dup = existing.find((t) => t.name === def.name);
      if (dup) {
        skipped++;
        continue;
      }

      await ctx.db.insert("letterApprovalTemplates", {
        ...def,
        isActive: true,
        createdBy: me._id,
        updatedAt: new Date().toISOString(),
      });
      created++;
    }

    return { created, skipped };
  },
});
