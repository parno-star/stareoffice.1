import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Microlearning: admin creates bite-size 1-5 minute lessons, employees read
// them and can mark them complete. Optionally linked to a flashcard deck.

export const listMicrolessons = query({
  args: {
    category: v.optional(v.string()),
    onlyPublished: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<
      Doc<"microlessons"> & {
        completedByMe: boolean;
      }
    >
  > => {
    const user = await requireUser(ctx);
    let rows: Array<Doc<"microlessons">>;
    if (args.onlyPublished !== false) {
      rows = await ctx.db
        .query("microlessons")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .collect();
    } else {
      rows = await ctx.db.query("microlessons").collect();
    }
    if (args.category && args.category !== "all") {
      rows = rows.filter((m) => m.category === args.category);
    }
    // Completion markers for current user
    const completions = await ctx.db
      .query("microlessonCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const completedSet = new Set(completions.map((c) => c.microlessonId));
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return rows.map((m) => ({ ...m, completedByMe: completedSet.has(m._id) }));
  },
});

export const getMicrolesson = query({
  args: { id: v.id("microlessons") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (Doc<"microlessons"> & {
        completedByMe: boolean;
        deck: Doc<"flashcardDecks"> | null;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const completion = await ctx.db
      .query("microlessonCompletions")
      .withIndex("by_user_and_microlesson", (q) =>
        q.eq("userId", user._id).eq("microlessonId", row._id),
      )
      .unique();
    const deck = row.deckId ? await ctx.db.get(row.deckId) : null;
    return { ...row, completedByMe: completion !== null, deck };
  },
});

export const createMicrolesson = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    category: v.string(),
    durationMinutes: v.number(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    deckId: v.optional(v.id("flashcardDecks")),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"microlessons">> => {
    const admin = await requireAdmin(ctx);
    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul microlesson wajib diisi",
      });
    }
    const id = await ctx.db.insert("microlessons", {
      title: args.title.trim(),
      summary: args.summary.trim(),
      content: args.content,
      category: args.category,
      durationMinutes: Math.max(1, Math.min(15, Math.round(args.durationMinutes))),
      coverColor: args.coverColor,
      icon: args.icon,
      deckId: args.deckId,
      isPublished: args.isPublished,
      authorId: admin._id,
      viewCount: 0,
      completionCount: 0,
    });
    return id;
  },
});

export const updateMicrolesson = mutation({
  args: {
    id: v.id("microlessons"),
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    category: v.string(),
    durationMinutes: v.number(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    deckId: v.optional(v.id("flashcardDecks")),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Microlesson tidak ditemukan",
      });
    }
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      summary: args.summary.trim(),
      content: args.content,
      category: args.category,
      durationMinutes: Math.max(1, Math.min(15, Math.round(args.durationMinutes))),
      coverColor: args.coverColor,
      icon: args.icon,
      deckId: args.deckId,
      isPublished: args.isPublished,
    });
    return null;
  },
});

export const deleteMicrolesson = mutation({
  args: { id: v.id("microlessons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const completions = await ctx.db
      .query("microlessonCompletions")
      .withIndex("by_microlesson", (q) => q.eq("microlessonId", args.id))
      .collect();
    for (const c of completions) await ctx.db.delete(c._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

// Track a read/view. Called when the user opens the microlesson.
export const markViewed = mutation({
  args: { id: v.id("microlessons") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    await ctx.db.patch(args.id, { viewCount: row.viewCount + 1 });
    return null;
  },
});

export const toggleCompleted = mutation({
  args: { id: v.id("microlessons") },
  handler: async (ctx, args): Promise<{ completed: boolean }> => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Microlesson tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("microlessonCompletions")
      .withIndex("by_user_and_microlesson", (q) =>
        q.eq("userId", user._id).eq("microlessonId", row._id),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(row._id, {
        completionCount: Math.max(0, row.completionCount - 1),
      });
      return { completed: false };
    }
    await ctx.db.insert("microlessonCompletions", {
      userId: user._id,
      microlessonId: row._id,
      completedAt: new Date().toISOString(),
    });
    await ctx.db.patch(row._id, { completionCount: row.completionCount + 1 });
    return { completed: true };
  },
});

export const getMicrolearningStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalLessons: number;
    myCompletions: number;
    totalMinutes: number;
    myMinutes: number;
  }> => {
    const user = await requireUser(ctx);
    const all = await ctx.db
      .query("microlessons")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    const completions = await ctx.db
      .query("microlessonCompletions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const completedIds = new Set(completions.map((c) => c.microlessonId));
    const myMinutes = all
      .filter((m) => completedIds.has(m._id))
      .reduce((sum, m) => sum + m.durationMinutes, 0);
    return {
      totalLessons: all.length,
      myCompletions: completions.length,
      totalMinutes: all.reduce((s, m) => s + m.durationMinutes, 0),
      myMinutes,
    };
  },
});
