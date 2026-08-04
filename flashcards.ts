import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Flashcard decks + cards with a simplified SM-2 spaced repetition engine.

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

// ---- Decks ------------------------------------------------------------

export const listDecks = query({
  args: {
    category: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    includeUnpublished: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<
      Doc<"flashcardDecks"> & {
        dueCount: number;
        newCount: number;
        learnedCount: number;
      }
    >
  > => {
    const user = await requireUser(ctx);
    let decks: Array<Doc<"flashcardDecks">>;
    if (args.includeUnpublished) {
      decks = await ctx.db.query("flashcardDecks").collect();
    } else {
      decks = await ctx.db
        .query("flashcardDecks")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .collect();
    }
    if (args.category && args.category !== "all") {
      decks = decks.filter((d) => d.category === args.category);
    }
    if (args.courseId) {
      decks = decks.filter((d) => d.courseId === args.courseId);
    }
    decks.sort((a, b) => b._creationTime - a._creationTime);
    const now = new Date().toISOString();
    const out: Array<
      Doc<"flashcardDecks"> & {
        dueCount: number;
        newCount: number;
        learnedCount: number;
      }
    > = [];
    for (const d of decks) {
      const reviews = await ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_and_deck", (q) =>
          q.eq("userId", user._id).eq("deckId", d._id),
        )
        .collect();
      const learnedCount = reviews.length;
      const dueCount = reviews.filter((r) => r.dueAt <= now).length;
      const newCount = Math.max(0, d.cardCount - learnedCount);
      out.push({ ...d, dueCount, newCount, learnedCount });
    }
    return out;
  },
});

export const getDeck = query({
  args: { id: v.id("flashcardDecks") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (Doc<"flashcardDecks"> & {
        cards: Array<Doc<"flashcards">>;
      })
    | null
  > => {
    await requireUser(ctx);
    const deck = await ctx.db.get(args.id);
    if (!deck) return null;
    const cards = await ctx.db
      .query("flashcards")
      .withIndex("by_deck", (q) => q.eq("deckId", deck._id))
      .collect();
    cards.sort((a, b) => a.order - b.order);
    return { ...deck, cards };
  },
});

export const createDeck = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"flashcardDecks">> => {
    const admin = await requireAdmin(ctx);
    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul deck wajib diisi",
      });
    }
    return await ctx.db.insert("flashcardDecks", {
      title: args.title.trim(),
      description: args.description?.trim(),
      category: args.category,
      coverColor: args.coverColor,
      icon: args.icon,
      courseId: args.courseId,
      isPublished: args.isPublished,
      authorId: admin._id,
      cardCount: 0,
    });
  },
});

export const updateDeck = mutation({
  args: {
    id: v.id("flashcardDecks"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Deck tidak ditemukan",
      });
    }
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      description: args.description?.trim(),
      category: args.category,
      coverColor: args.coverColor,
      icon: args.icon,
      courseId: args.courseId,
      isPublished: args.isPublished,
    });
    return null;
  },
});

export const deleteDeck = mutation({
  args: { id: v.id("flashcardDecks") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const cards = await ctx.db
      .query("flashcards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.id))
      .collect();
    // Clean up any user reviews referencing this deck (covers all users).
    const deckReviews = await ctx.db.query("flashcardReviews").collect();
    for (const r of deckReviews) {
      if (r.deckId === args.id) await ctx.db.delete(r._id);
    }
    for (const c of cards) await ctx.db.delete(c._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Cards ------------------------------------------------------------

export const addCard = mutation({
  args: {
    deckId: v.id("flashcardDecks"),
    front: v.string(),
    back: v.string(),
    hint: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"flashcards">> => {
    await requireAdmin(ctx);
    const deck = await ctx.db.get(args.deckId);
    if (!deck) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Deck tidak ditemukan",
      });
    }
    if (args.front.trim().length === 0 || args.back.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Depan dan belakang kartu wajib diisi",
      });
    }
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_deck", (q) => q.eq("deckId", deck._id))
      .collect();
    const order = existing.length;
    const id = await ctx.db.insert("flashcards", {
      deckId: deck._id,
      front: args.front.trim(),
      back: args.back.trim(),
      hint: args.hint?.trim(),
      order,
    });
    await ctx.db.patch(deck._id, { cardCount: deck.cardCount + 1 });
    return id;
  },
});

export const updateCard = mutation({
  args: {
    id: v.id("flashcards"),
    front: v.string(),
    back: v.string(),
    hint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kartu tidak ditemukan",
      });
    }
    await ctx.db.patch(args.id, {
      front: args.front.trim(),
      back: args.back.trim(),
      hint: args.hint?.trim(),
    });
    return null;
  },
});

export const deleteCard = mutation({
  args: { id: v.id("flashcards") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const card = await ctx.db.get(args.id);
    if (!card) return null;
    const deck = await ctx.db.get(card.deckId);
    // Delete user reviews of this card
    const reviews = await ctx.db.query("flashcardReviews").collect();
    for (const r of reviews) {
      if (r.cardId === args.id) await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.id);
    if (deck) {
      await ctx.db.patch(deck._id, {
        cardCount: Math.max(0, deck.cardCount - 1),
      });
    }
    return null;
  },
});

// ---- Study Session / SRS ---------------------------------------------

// Pick next batch of cards to review in a deck: due cards first, then new.
export const startSession = query({
  args: {
    deckId: v.id("flashcardDecks"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    deck: Doc<"flashcardDecks">;
    queue: Array<{
      card: Doc<"flashcards">;
      review: Doc<"flashcardReviews"> | null;
      state: "new" | "due" | "learned";
    }>;
    totals: { due: number; new: number; learned: number };
  }> => {
    const user = await requireUser(ctx);
    const deck = await ctx.db.get(args.deckId);
    if (!deck) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Deck tidak ditemukan",
      });
    }
    const cards = await ctx.db
      .query("flashcards")
      .withIndex("by_deck", (q) => q.eq("deckId", deck._id))
      .collect();
    cards.sort((a, b) => a.order - b.order);
    const reviews = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", user._id).eq("deckId", deck._id),
      )
      .collect();
    const reviewsByCard = new Map<Id<"flashcards">, Doc<"flashcardReviews">>();
    for (const r of reviews) reviewsByCard.set(r.cardId, r);
    const now = new Date().toISOString();
    const due: Array<{
      card: Doc<"flashcards">;
      review: Doc<"flashcardReviews"> | null;
      state: "new" | "due" | "learned";
    }> = [];
    const news: typeof due = [];
    const learned: typeof due = [];
    for (const c of cards) {
      const r = reviewsByCard.get(c._id);
      if (!r) {
        news.push({ card: c, review: null, state: "new" });
      } else if (r.dueAt <= now) {
        due.push({ card: c, review: r, state: "due" });
      } else {
        learned.push({ card: c, review: r, state: "learned" });
      }
    }
    const limit = Math.min(args.limit ?? 20, 50);
    const queue = [...due, ...news].slice(0, limit);
    return {
      deck,
      queue,
      totals: {
        due: due.length,
        new: news.length,
        learned: learned.length,
      },
    };
  },
});

// SM-2 algorithm: quality rating 0..5 (0=again, 3=good, 5=easy).
function computeNext(
  prev: Doc<"flashcardReviews"> | null,
  quality: number,
): {
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
} {
  let ease = prev?.ease ?? DEFAULT_EASE;
  let repetitions = prev?.repetitions ?? 0;
  let intervalDays = prev?.intervalDays ?? 0;

  if (quality < 3) {
    // Failed: reset
    repetitions = 0;
    intervalDays = 0; // review again soon (today / 10min later, approximated to 0)
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * ease);
    ease =
      ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < MIN_EASE) ease = MIN_EASE;
  }
  const due = new Date();
  if (intervalDays <= 0) {
    // Bring back within current session: 10 minutes later
    due.setMinutes(due.getMinutes() + 10);
  } else {
    due.setDate(due.getDate() + intervalDays);
  }
  return {
    ease: Number(ease.toFixed(2)),
    intervalDays,
    repetitions,
    dueAt: due.toISOString(),
  };
}

export const reviewCard = mutation({
  args: {
    cardId: v.id("flashcards"),
    // 0 = again, 1 = hard, 3 = good, 5 = easy
    quality: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ease: number;
    intervalDays: number;
    repetitions: number;
    dueAt: string;
  }> => {
    const user = await requireUser(ctx);
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kartu tidak ditemukan",
      });
    }
    const quality = Math.max(0, Math.min(5, Math.round(args.quality)));
    const prev = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user_and_card", (q) =>
        q.eq("userId", user._id).eq("cardId", card._id),
      )
      .unique();
    const next = computeNext(prev, quality);
    const now = new Date().toISOString();
    if (prev) {
      await ctx.db.patch(prev._id, {
        ease: next.ease,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueAt: next.dueAt,
        lastReviewedAt: now,
        lastQuality: quality,
        correctCount:
          quality >= 3 ? prev.correctCount + 1 : prev.correctCount,
        wrongCount: quality < 3 ? prev.wrongCount + 1 : prev.wrongCount,
      });
    } else {
      await ctx.db.insert("flashcardReviews", {
        userId: user._id,
        cardId: card._id,
        deckId: card.deckId,
        ease: next.ease,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueAt: next.dueAt,
        lastReviewedAt: now,
        lastQuality: quality,
        correctCount: quality >= 3 ? 1 : 0,
        wrongCount: quality < 3 ? 1 : 0,
      });
    }
    return next;
  },
});

export const resetDeckProgress = mutation({
  args: { deckId: v.id("flashcardDecks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const reviews = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user_and_deck", (q) =>
        q.eq("userId", user._id).eq("deckId", args.deckId),
      )
      .collect();
    for (const r of reviews) await ctx.db.delete(r._id);
    return null;
  },
});

// Overview of all flashcard learning for the current user.
export const getMyFlashcardStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalDecks: number;
    totalCards: number;
    learned: number;
    dueToday: number;
    accuracy: number; // 0..100
  }> => {
    const user = await requireUser(ctx);
    const decks = await ctx.db
      .query("flashcardDecks")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();
    const totalCards = decks.reduce((s, d) => s + d.cardCount, 0);
    const reviews = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const now = new Date().toISOString();
    const dueToday = reviews.filter((r) => r.dueAt <= now).length;
    let correct = 0;
    let wrong = 0;
    for (const r of reviews) {
      correct += r.correctCount;
      wrong += r.wrongCount;
    }
    const total = correct + wrong;
    const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
    return {
      totalDecks: decks.length,
      totalCards,
      learned: reviews.length,
      dueToday,
      accuracy,
    };
  },
});
