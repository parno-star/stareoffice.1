import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";
import { getOrgScope } from "./_scope";

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const me = await ctx.db.get(userId);
  if (!me) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User tidak ditemukan" });
  }
  if (!isAdminRole(me.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengelola jalur pelaporan sekunder",
    });
  }
  return me;
}

export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ row: Doc<"dottedLineReports">; manager: Doc<"users"> | null }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const rows = await ctx.db
      .query("dottedLineReports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const out: Array<{
      row: Doc<"dottedLineReports">;
      manager: Doc<"users"> | null;
    }> = [];
    for (const r of rows) {
      const m = await ctx.db.get(r.managerId);
      out.push({ row: r, manager: m });
    }
    return out;
  },
});

export const listAllLines = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"dottedLineReports">>> => {
    const { userIds, isMember } = await getOrgScope(ctx);
    const all = await ctx.db.query("dottedLineReports").collect();
    // All-orgs super admin view: no scoping. Otherwise keep only lines whose
    // employee AND secondary manager belong to the viewing organization.
    if (userIds === null) return all;
    return all.filter((r) => isMember(r.userId) && isMember(r.managerId));
  },
});

export const addDottedLine = mutation({
  args: {
    userId: v.id("users"),
    managerId: v.id("users"),
    relationshipType: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"dottedLineReports">> => {
    const me = await requireAdmin(ctx);
    if (args.userId === args.managerId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak bisa memilih diri sendiri",
      });
    }
    const existing = await ctx.db
      .query("dottedLineReports")
      .withIndex("by_user_and_manager", (q) =>
        q.eq("userId", args.userId).eq("managerId", args.managerId),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Relasi sudah ada",
      });
    }
    const id = await ctx.db.insert("dottedLineReports", {
      userId: args.userId,
      managerId: args.managerId,
      relationshipType: args.relationshipType,
      note: args.note,
      createdBy: me._id,
    });
    const u = await ctx.db.get(args.userId);
    const mu = await ctx.db.get(args.managerId);
    await ctx.db.insert("orgHistory", {
      eventType: "dotted_line_added",
      actorId: me._id,
      subjectType: "dotted_line",
      subjectName: `${u?.name ?? "?"} -> ${mu?.name ?? "?"}`,
      summary: `${me.name ?? "Admin"} menambahkan jalur ${args.relationshipType} dari ${u?.name ?? "?"} ke ${mu?.name ?? "?"}`,
      timestamp: new Date().toISOString(),
    });
    return id;
  },
});

export const removeDottedLine = mutation({
  args: { id: v.id("dottedLineReports") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const u = await ctx.db.get(row.userId);
    const mu = await ctx.db.get(row.managerId);
    await ctx.db.delete(args.id);
    await ctx.db.insert("orgHistory", {
      eventType: "dotted_line_removed",
      actorId: me._id,
      subjectType: "dotted_line",
      subjectName: `${u?.name ?? "?"} -> ${mu?.name ?? "?"}`,
      summary: `${me.name ?? "Admin"} menghapus jalur sekunder ${u?.name ?? "?"} ke ${mu?.name ?? "?"}`,
      timestamp: new Date().toISOString(),
    });
    return null;
  },
});
