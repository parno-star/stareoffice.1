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
      message: "Hanya admin yang dapat mengelola rencana suksesi",
    });
  }
  return me;
}

export const listForIncumbent = query({
  args: { incumbentId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{ plan: Doc<"successionPlans">; candidate: Doc<"users"> | null }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const rows = await ctx.db
      .query("successionPlans")
      .withIndex("by_incumbent", (q) => q.eq("incumbentId", args.incumbentId))
      .collect();
    rows.sort((a, b) => a.priority - b.priority);
    const out: Array<{
      plan: Doc<"successionPlans">;
      candidate: Doc<"users"> | null;
    }> = [];
    for (const r of rows) {
      const c = await ctx.db.get(r.candidateId);
      out.push({ plan: r, candidate: c });
    }
    return out;
  },
});

export const summary = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    coveredIncumbents: number;
    totalPlans: number;
    readyNowCount: number;
  }> => {
    const { userIds, isMember } = await getOrgScope(ctx);
    const allRows = await ctx.db.query("successionPlans").collect();
    // Scope to the viewing org: keep plans whose incumbent belongs to the org.
    const rows =
      userIds === null ? allRows : allRows.filter((r) => isMember(r.incumbentId));
    const inc = new Set<string>();
    let readyNow = 0;
    for (const r of rows) {
      inc.add(r.incumbentId);
      if (r.readiness === "ready_now") readyNow += 1;
    }
    return {
      coveredIncumbents: inc.size,
      totalPlans: rows.length,
      readyNowCount: readyNow,
    };
  },
});

export const createPlan = mutation({
  args: {
    incumbentId: v.id("users"),
    candidateId: v.id("users"),
    readiness: v.string(),
    strengths: v.optional(v.string()),
    development: v.optional(v.string()),
    priority: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"successionPlans">> => {
    const me = await requireAdmin(ctx);
    if (args.incumbentId === args.candidateId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Incumbent dan kandidat tidak boleh sama",
      });
    }
    const existing = await ctx.db
      .query("successionPlans")
      .withIndex("by_incumbent_and_candidate", (q) =>
        q
          .eq("incumbentId", args.incumbentId)
          .eq("candidateId", args.candidateId),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Kandidat sudah terdaftar untuk posisi ini",
      });
    }
    return await ctx.db.insert("successionPlans", {
      incumbentId: args.incumbentId,
      candidateId: args.candidateId,
      readiness: args.readiness,
      strengths: args.strengths,
      development: args.development,
      priority: args.priority,
      createdBy: me._id,
    });
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("successionPlans"),
    readiness: v.optional(v.string()),
    strengths: v.optional(v.string()),
    development: v.optional(v.string()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    const patch: Partial<Doc<"successionPlans">> = {};
    if (args.readiness !== undefined) patch.readiness = args.readiness;
    if (args.strengths !== undefined) patch.strengths = args.strengths;
    if (args.development !== undefined) patch.development = args.development;
    if (args.priority !== undefined) patch.priority = args.priority;
    await ctx.db.patch(args.planId, patch);
    return null;
  },
});

export const removePlan = mutation({
  args: { planId: v.id("successionPlans") },
  handler: async (ctx, args): Promise<null> => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.planId);
    return null;
  },
});
