import { ConvexError, v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requireTenant } from "./lib/tenant";

// Dedicated singleton row for the "Kirim Surat via Email" sender. Kept separate
// from the plan-limit alert sender ("plan_alerts") so the two features can use
// different verified addresses and toggles.
const KEY = "letter_email";

export type LetterEmailSettings = {
  senderEmail: string;
  emailEnabled: boolean;
};

const DEFAULTS: LetterEmailSettings = {
  senderEmail: "",
  emailEnabled: false,
};

/** Internal: used by the letter email action to resolve the verified sender. */
export const getSenderInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<LetterEmailSettings> => {
    const doc = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    if (!doc) return DEFAULTS;
    return {
      senderEmail: doc.senderEmail ?? "",
      emailEnabled: doc.emailEnabled,
    };
  },
});

/**
 * Any authenticated user: read whether letter email is active and the sender
 * address recipients will see. Only exposes the non-sensitive "from" address
 * (which recipients receive anyway), not who configured it.
 */
export const getStatus = query({
  args: {},
  handler: async (ctx): Promise<LetterEmailSettings> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Anda harus masuk terlebih dahulu",
      });
    }
    const doc = await ctx.db
      .query("alertEmailSettings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .unique();
    if (!doc) return DEFAULTS;
    return {
      senderEmail: doc.emailEnabled ? doc.senderEmail ?? "" : "",
      emailEnabled: doc.emailEnabled,
    };
  },
});

/** Super admin: read the current letter-email sender settings. */
export const get = query({
  args: {},
  handler: async (ctx): Promise<LetterEmailSettings> => {
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
      emailEnabled: doc.emailEnabled,
    };
  },
});

/** Super admin: update the letter-email sender address and toggle. */
export const update = mutation({
  args: {
    senderEmail: v.string(),
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
        emailEnabled: args.emailEnabled,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("alertEmailSettings", {
        key: KEY,
        senderEmail: args.senderEmail.trim(),
        emailEnabled: args.emailEnabled,
        updatedBy: userId,
        updatedAt: now,
      });
    }
  },
});
