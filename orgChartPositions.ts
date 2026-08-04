import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { isAdminRole } from "./roles";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";

async function requireAdminUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengatur tata letak bagan",
    });
  }
  return user;
}

// Returns a map of userId -> { x, y } for the caller's effective organization.
// Cards without a saved position simply won't appear in the map and fall back to
// the automatic tree layout on the frontend.
export const getPositions = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<Record<string, { x: number; y: number }>> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (organizationId === null) return {};
    const rows = await ctx.db
      .query("orgChartPositions")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const map: Record<string, { x: number; y: number }> = {};
    for (const r of rows) {
      map[r.userId] = { x: r.x, y: r.y };
    }
    return map;
  },
});

// Upsert a single card's manual position.
export const savePosition = mutation({
  args: {
    userId: v.id("users"),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdminUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (organizationId === null) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih organisasi terlebih dahulu untuk menyimpan tata letak",
      });
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Karyawan tidak ditemukan" });
    }
    if (target.organizationId && target.organizationId !== organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Karyawan bukan bagian dari organisasi Anda",
      });
    }

    const existing = await ctx.db
      .query("orgChartPositions")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", args.userId),
      )
      .unique();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { x: args.x, y: args.y, updatedAt: now });
    } else {
      await ctx.db.insert("orgChartPositions", {
        organizationId,
        userId: args.userId,
        x: args.x,
        y: args.y,
        updatedAt: now,
      });
    }
  },
});

// Save many positions at once (used when persisting the whole free layout).
export const saveManyPositions = mutation({
  args: {
    positions: v.array(
      v.object({ userId: v.id("users"), x: v.number(), y: v.number() }),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireAdminUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (organizationId === null) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih organisasi terlebih dahulu untuk menyimpan tata letak",
      });
    }

    const now = new Date().toISOString();
    for (const p of args.positions) {
      const existing = await ctx.db
        .query("orgChartPositions")
        .withIndex("by_organization_and_user", (q) =>
          q.eq("organizationId", organizationId).eq("userId", p.userId),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { x: p.x, y: p.y, updatedAt: now });
      } else {
        await ctx.db.insert("orgChartPositions", {
          organizationId,
          userId: p.userId,
          x: p.x,
          y: p.y,
          updatedAt: now,
        });
      }
    }
  },
});

// Clear all manual positions for the org — reverts the chart to the automatic
// tree layout for everyone.
export const clearPositions = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    await requireAdminUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (organizationId === null) return;

    const rows = await ctx.db
      .query("orgChartPositions")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    for (const r of rows) {
      await ctx.db.delete(r._id);
    }
  },
});
