import { ConvexError, v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requireTenant } from "./lib/tenant";

const KEY = "plan_alerts";

export type AlertEmailSettings = {
  senderEmail: string;
  senderName: string;
  emailEnabled: boolean;
};

const DEFAULTS: AlertEmailSettings = {
  senderEmail: "",
  senderName: "",
  emailEnabled: false,
};

/** Internal: used by the email action to resolve the verified sender. */
export const getSenderInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<AlertEmailSettings> => {
    const doc = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    if (!doc) return DEFAULTS;
    return {
      senderEmail: doc.senderEmail ?? "",
      senderName: doc.senderName ?? "",
      emailEnabled: doc.emailEnabled,
    };
  },
});

/** Super admin: read the current alert email settings. */
export const get = query({
  args: {},
  handler: async (ctx): Promise<AlertEmailSettings> => {
    const { isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!isSuperAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat melihat pengaturan email",
      });
    }
    const doc = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    if (!doc) return DEFAULTS;
    return {
      senderEmail: doc.senderEmail ?? "",
      senderName: doc.senderName ?? "",
      emailEnabled: doc.emailEnabled,
    };
  },
});

/** Super admin: update the sender address and email toggle. */
export const update = mutation({
  args: {
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    emailEnabled: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { userId, isSuperAdmin } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!isSuperAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat mengubah pengaturan email",
      });
    }

    const existing = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        senderEmail: args.senderEmail.trim(),
        senderName: args.senderName?.trim() ?? "",
        emailEnabled: args.emailEnabled,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("alertEmailSettings", {
        key: KEY,
        senderEmail: args.senderEmail.trim(),
        senderName: args.senderName?.trim() ?? "",
        emailEnabled: args.emailEnabled,
        updatedBy: userId,
        updatedAt: now,
      });
    }
  },
});
