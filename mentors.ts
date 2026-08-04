import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireUser } from "./_helpers";

// Mentor profiles: employees opt-in to be mentors with a short bio, expertise
// tags, and capacity. Other employees can browse the directory and request
// mentorship.

export type MentorDirectoryEntry = Doc<"mentorProfiles"> & {
  user: Doc<"users"> | null;
};

async function fetchMentorWithUser(
  ctx: { db: { get: (id: Id<"users">) => Promise<Doc<"users"> | null> } },
  profile: Doc<"mentorProfiles">,
): Promise<MentorDirectoryEntry> {
  const user = await ctx.db.get(profile.userId);
  return { ...profile, user };
}

export const listMentors = query({
  args: {
    category: v.optional(v.string()),
    acceptingOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<MentorDirectoryEntry>> => {
    await requireUser(ctx);
    const profiles = await ctx.db
      .query("mentorProfiles")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    let filtered = profiles;
    if (args.category && args.category !== "all") {
      filtered = filtered.filter((p) =>
        p.categories.includes(args.category as string),
      );
    }
    if (args.acceptingOnly) {
      filtered = filtered.filter((p) => p.isAcceptingRequests);
    }
    filtered.sort((a, b) => {
      const ra = a.averageRating ?? 0;
      const rb = b.averageRating ?? 0;
      if (rb !== ra) return rb - ra;
      return b.sessionCount - a.sessionCount;
    });
    const result: Array<MentorDirectoryEntry> = [];
    for (const p of filtered) {
      result.push(await fetchMentorWithUser(ctx, p));
    }
    return result;
  },
});

export const getMyMentorProfile = query({
  args: {},
  handler: async (ctx): Promise<Doc<"mentorProfiles"> | null> => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("mentorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const getMentorProfileByUser = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<MentorDirectoryEntry | null> => {
    await requireUser(ctx);
    const profile = await ctx.db
      .query("mentorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) return null;
    return await fetchMentorWithUser(ctx, profile);
  },
});

export const upsertMyMentorProfile = mutation({
  args: {
    headline: v.string(),
    bio: v.string(),
    expertise: v.array(v.string()),
    categories: v.array(v.string()),
    preferredMentee: v.string(),
    preferredChannel: v.optional(v.string()),
    capacity: v.number(),
    availability: v.optional(v.string()),
    isAcceptingRequests: v.boolean(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"mentorProfiles">> => {
    const user = await requireUser(ctx);
    if (args.headline.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Headline wajib diisi",
      });
    }
    if (args.capacity < 1 || args.capacity > 20) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kapasitas harus antara 1 dan 20",
      });
    }
    const existing = await ctx.db
      .query("mentorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        headline: args.headline.trim(),
        bio: args.bio,
        expertise: args.expertise,
        categories: args.categories,
        preferredMentee: args.preferredMentee,
        preferredChannel: args.preferredChannel,
        capacity: args.capacity,
        availability: args.availability,
        isAcceptingRequests: args.isAcceptingRequests,
        isPublished: args.isPublished,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("mentorProfiles", {
      userId: user._id,
      headline: args.headline.trim(),
      bio: args.bio,
      expertise: args.expertise,
      categories: args.categories,
      preferredMentee: args.preferredMentee,
      preferredChannel: args.preferredChannel,
      capacity: args.capacity,
      availability: args.availability,
      isAcceptingRequests: args.isAcceptingRequests,
      isPublished: args.isPublished,
      activeMentees: 0,
      totalMentees: 0,
      sessionCount: 0,
      averageRating: undefined,
      ratingCount: 0,
      updatedAt: now,
    });
  },
});

export const deleteMyMentorProfile = mutation({
  args: {},
  handler: async (ctx): Promise<null> => {
    const user = await requireUser(ctx);
    const profile = await ctx.db
      .query("mentorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) return null;
    // Block deletion if there are active mentorships
    const active = await ctx.db
      .query("mentorships")
      .withIndex("by_mentor_and_status", (q) =>
        q.eq("mentorId", user._id).eq("status", "active"),
      )
      .collect();
    if (active.length > 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Masih ada mentee aktif. Selesaikan terlebih dahulu.",
      });
    }
    await ctx.db.delete(profile._id);
    return null;
  },
});

export const getMentorshipStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    mentorCount: number;
    activeMentorships: number;
    totalRequests: number;
    upcomingSessions: number;
  }> => {
    await requireUser(ctx);
    const profiles = await ctx.db
      .query("mentorProfiles")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    const active = await ctx.db
      .query("mentorships")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const pending = await ctx.db
      .query("mentorships")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const nowIso = new Date().toISOString();
    const sessions = await ctx.db.query("mentorshipSessions").collect();
    const upcoming = sessions.filter(
      (s) => s.status === "scheduled" && s.scheduledAt >= nowIso,
    );
    return {
      mentorCount: profiles.length,
      activeMentorships: active.length,
      totalRequests: pending.length,
      upcomingSessions: upcoming.length,
    };
  },
});
