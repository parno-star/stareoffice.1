import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenant } from "./lib/tenant";
import { LANDING_SECTIONS, type SectionId } from "./lib/landingSections";

// Re-exported for existing imports within the backend.
export { LANDING_SECTIONS };
export type { SectionId };

// Default: all sections visible
function getDefaultVisibility(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const s of LANDING_SECTIONS) {
    result[s.id] = true;
  }
  return result;
}

/** Public query – returns visibility map for all landing sections */
export const getLandingSectionVisibility = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "landing_sections"))
      .unique();

    if (!doc) return getDefaultVisibility();

    // Merge with defaults so new sections are always visible
    const defaults = getDefaultVisibility();
    const merged: Record<string, boolean> = { ...defaults };
    for (const [key, val] of Object.entries(doc.sections)) {
      if (key in merged) {
        merged[key] = val;
      }
    }
    return merged;
  },
});

/** Super-admin only – update section visibility */
export const updateLandingSectionVisibility = mutation({
  args: {
    sections: v.record(v.string(), v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!isSuperAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya Super Admin yang dapat mengubah pengaturan ini",
      });
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", "landing_sections"))
      .unique();

    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sections: args.sections,
        updatedBy: user._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("siteSettings", {
        key: "landing_sections",
        sections: args.sections,
        updatedBy: user._id,
        updatedAt: now,
      });
    }
  },
});
