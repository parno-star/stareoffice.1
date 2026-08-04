import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

function requireAdmin(user: Doc<"users">): void {
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengakses fitur ini",
    });
  }
}

// ─── Default BUMN Position Levels ─────────────────────────────────────────────
export const DEFAULT_POSITION_LEVELS = [
  {
    code: "L1",
    name: "Direktur Utama",
    rank: 1,
    description: "Pimpinan tertinggi perusahaan. Bertanggung jawab atas seluruh operasional dan strategi.",
    maxApprovalAmount: 0, // unlimited
    canSignLetters: true,
    canApproveLetters: true,
    defaultLetterRole: "penyetuju",
    color: "rose",
  },
  {
    code: "L2",
    name: "Direktur",
    rank: 2,
    description: "Anggota direksi yang memimpin direktorat tertentu (Keuangan, Operasi, SDM, dll).",
    maxApprovalAmount: 0, // unlimited
    canSignLetters: true,
    canApproveLetters: true,
    defaultLetterRole: "penyetuju",
    color: "red",
  },
  {
    code: "L3",
    name: "VP / Kepala Divisi",
    rank: 3,
    description: "Memimpin divisi di bawah direktorat. Koordinasi lintas departemen.",
    maxApprovalAmount: 5_000_000_000, // 5 miliar
    canSignLetters: true,
    canApproveLetters: true,
    defaultLetterRole: "penyetuju",
    color: "orange",
  },
  {
    code: "L4",
    name: "Senior Manager",
    rank: 4,
    description: "Manajer senior yang membawahi beberapa unit/bagian dalam divisi.",
    maxApprovalAmount: 2_000_000_000, // 2 miliar
    canSignLetters: true,
    canApproveLetters: true,
    defaultLetterRole: "pemeriksa",
    color: "amber",
  },
  {
    code: "L5",
    name: "Manager / Kepala Bagian",
    rank: 5,
    description: "Memimpin bagian/departemen. Bertanggung jawab atas operasional harian unit kerja.",
    maxApprovalAmount: 500_000_000, // 500 juta
    canSignLetters: true,
    canApproveLetters: true,
    defaultLetterRole: "pemeriksa",
    color: "yellow",
  },
  {
    code: "L6",
    name: "Asisten Manager / Kepala Seksi",
    rank: 6,
    description: "Membantu manager dan memimpin seksi/sub-bagian tertentu.",
    maxApprovalAmount: 100_000_000, // 100 juta
    canSignLetters: true,
    canApproveLetters: true,
    defaultLetterRole: "pemeriksa",
    color: "lime",
  },
  {
    code: "L7",
    name: "Supervisor / Pengawas",
    rank: 7,
    description: "Mengawasi pelaksanaan kerja tim dan memastikan standar operasional terpenuhi.",
    maxApprovalAmount: 25_000_000, // 25 juta
    canSignLetters: false,
    canApproveLetters: false,
    defaultLetterRole: "konseptor",
    color: "green",
  },
  {
    code: "L8",
    name: "Staff Senior / Analis",
    rank: 8,
    description: "Pelaksana berpengalaman dengan keahlian spesifik. Dapat membimbing staff junior.",
    maxApprovalAmount: 10_000_000, // 10 juta
    canSignLetters: false,
    canApproveLetters: false,
    defaultLetterRole: "konseptor",
    color: "teal",
  },
  {
    code: "L9",
    name: "Staff / Pelaksana",
    rank: 9,
    description: "Pelaksana tugas operasional harian sesuai arahan atasan.",
    maxApprovalAmount: 5_000_000, // 5 juta
    canSignLetters: false,
    canApproveLetters: false,
    defaultLetterRole: "konseptor",
    color: "blue",
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/** List all position levels, sorted by rank */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"positionLevels">[]> => {
    await requireUser(ctx);
    const levels = await ctx.db.query("positionLevels").collect();
    return levels.sort((a, b) => a.rank - b.rank);
  },
});

/** List only active levels (for dropdowns) */
export const listActive = query({
  args: {},
  handler: async (ctx): Promise<Array<Pick<Doc<"positionLevels">, "_id" | "code" | "name" | "rank" | "color" | "maxApprovalAmount" | "canSignLetters" | "canApproveLetters" | "defaultLetterRole">>> => {
    await requireUser(ctx);
    const levels = await ctx.db
      .query("positionLevels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return levels
      .sort((a, b) => a.rank - b.rank)
      .map((l) => ({
        _id: l._id,
        code: l.code,
        name: l.name,
        rank: l.rank,
        color: l.color,
        maxApprovalAmount: l.maxApprovalAmount,
        canSignLetters: l.canSignLetters,
        canApproveLetters: l.canApproveLetters,
        defaultLetterRole: l.defaultLetterRole,
      }));
  },
});

/** Get a single position level by ID */
export const get = query({
  args: { id: v.id("positionLevels") },
  handler: async (ctx, args): Promise<Doc<"positionLevels"> | null> => {
    await requireUser(ctx);
    return ctx.db.get(args.id);
  },
});

/** Get the position level for a user */
export const getForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Doc<"positionLevels"> | null> => {
    await requireUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user || !user.positionLevelId) return null;
    return ctx.db.get(user.positionLevelId);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Seed default BUMN position levels (idempotent) */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx): Promise<{ created: number; skipped: number }> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    let created = 0;
    let skipped = 0;

    for (const def of DEFAULT_POSITION_LEVELS) {
      const existing = await ctx.db
        .query("positionLevels")
        .withIndex("by_code", (q) => q.eq("code", def.code))
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("positionLevels", {
        ...def,
        isActive: true,
        order: def.rank,
        organizationId: me.organizationId,
      });
      created++;
    }
    return { created, skipped };
  },
});

/** Create a new position level */
export const create = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    rank: v.number(),
    description: v.optional(v.string()),
    maxApprovalAmount: v.number(),
    canSignLetters: v.boolean(),
    canApproveLetters: v.boolean(),
    defaultLetterRole: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"positionLevels">> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    // Check code uniqueness
    const existing = await ctx.db
      .query("positionLevels")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .first();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: `Kode '${args.code}' sudah digunakan` });
    }

    return ctx.db.insert("positionLevels", {
      code: args.code.trim().toUpperCase(),
      name: args.name.trim(),
      rank: args.rank,
      description: args.description?.trim(),
      maxApprovalAmount: args.maxApprovalAmount,
      canSignLetters: args.canSignLetters,
      canApproveLetters: args.canApproveLetters,
      defaultLetterRole: args.defaultLetterRole,
      color: args.color,
      isActive: true,
      order: args.rank,
      organizationId: me.organizationId,
    });
  },
});

/** Update a position level */
export const update = mutation({
  args: {
    id: v.id("positionLevels"),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    rank: v.optional(v.number()),
    description: v.optional(v.string()),
    maxApprovalAmount: v.optional(v.number()),
    canSignLetters: v.optional(v.boolean()),
    canApproveLetters: v.optional(v.boolean()),
    defaultLetterRole: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const level = await ctx.db.get(args.id);
    if (!level) throw new ConvexError({ code: "NOT_FOUND", message: "Level tidak ditemukan" });

    // Check code uniqueness if changing
    if (args.code !== undefined && args.code.trim().toUpperCase() !== level.code) {
      const dup = await ctx.db
        .query("positionLevels")
        .withIndex("by_code", (q) => q.eq("code", args.code!.trim().toUpperCase()))
        .first();
      if (dup) {
        throw new ConvexError({ code: "CONFLICT", message: `Kode '${args.code}' sudah digunakan` });
      }
    }

    const patch: Record<string, unknown> = {};
    if (args.code !== undefined) patch.code = args.code.trim().toUpperCase();
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.rank !== undefined) patch.rank = args.rank;
    if (args.description !== undefined) patch.description = args.description?.trim();
    if (args.maxApprovalAmount !== undefined) patch.maxApprovalAmount = args.maxApprovalAmount;
    if (args.canSignLetters !== undefined) patch.canSignLetters = args.canSignLetters;
    if (args.canApproveLetters !== undefined) patch.canApproveLetters = args.canApproveLetters;
    if (args.defaultLetterRole !== undefined) patch.defaultLetterRole = args.defaultLetterRole;
    if (args.color !== undefined) patch.color = args.color;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.order !== undefined) patch.order = args.order;

    await ctx.db.patch(args.id, patch);
  },
});

/** Delete a position level (if no users assigned) */
export const remove = mutation({
  args: { id: v.id("positionLevels") },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    // Check if any user is assigned to this level
    const allUsers = await ctx.db.query("users").collect();
    const assigned = allUsers.filter((u) => u.positionLevelId === args.id);
    if (assigned.length > 0) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Level ini masih digunakan oleh ${assigned.length} karyawan. Hapus penugasan terlebih dahulu.`,
      });
    }

    await ctx.db.delete(args.id);
  },
});

/** Assign a position level to a user */
export const assignToUser = mutation({
  args: {
    userId: v.id("users"),
    positionLevelId: v.union(v.id("positionLevels"), v.null()),
  },
  handler: async (ctx, args): Promise<void> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User tidak ditemukan" });

    if (args.positionLevelId) {
      const level = await ctx.db.get(args.positionLevelId);
      if (!level) throw new ConvexError({ code: "NOT_FOUND", message: "Level tidak ditemukan" });
    }

    await ctx.db.patch(args.userId, {
      positionLevelId: args.positionLevelId ?? undefined,
    });
  },
});

/** Get users grouped by position level */
export const getUsersByLevel = query({
  args: {},
  handler: async (ctx): Promise<Array<{ level: Doc<"positionLevels">; users: Array<{ _id: Id<"users">; name: string; department: string; jobTitle: string }> }>> => {
    const me = await requireUser(ctx);
    requireAdmin(me);

    const levels = await ctx.db
      .query("positionLevels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    levels.sort((a, b) => a.rank - b.rank);

    const allUsers = await ctx.db.query("users").collect();
    const activeUsers = allUsers.filter(
      (u) => u.accountStatus === "active" || !u.accountStatus,
    );

    const result = [];
    for (const level of levels) {
      const usersAtLevel = activeUsers
        .filter((u) => u.positionLevelId === level._id)
        .map((u) => ({
          _id: u._id,
          name: u.name ?? "Unknown",
          department: u.department ?? "-",
          jobTitle: u.jobTitle ?? "-",
        }));
      result.push({ level, users: usersAtLevel });
    }

    // Add unassigned users
    const unassigned = activeUsers
      .filter((u) => !u.positionLevelId)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Unknown",
        department: u.department ?? "-",
        jobTitle: u.jobTitle ?? "-",
      }));
    if (unassigned.length > 0) {
      result.push({
        level: {
          _id: "unassigned" as Id<"positionLevels">,
          _creationTime: 0,
          code: "N/A",
          name: "Belum Ditetapkan",
          rank: 99,
          description: "Karyawan yang belum memiliki level jabatan",
          maxApprovalAmount: 0,
          canSignLetters: false,
          canApproveLetters: false,
          defaultLetterRole: "none",
          color: "gray",
          isActive: true,
          order: 99,
        },
        users: unassigned,
      });
    }

    return result;
  },
});
