import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant, assertSameTenant } from "./lib/tenant";

export type PollOption = {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
  isSelected: boolean;
};

export type PollListItem = {
  _id: Id<"polls">;
  _creationTime: number;
  question: string;
  description: string | null;
  allowMultiple: boolean;
  isAnonymous: boolean;
  status: string;
  closesAt: string | null;
  authorId: Id<"users">;
  authorName: string | null;
  authorAvatar: string | null;
  voteCount: number;
  hasVoted: boolean;
  isClosed: boolean;
  options: Array<PollOption>;
  canSeeResults: boolean;
};

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "User not logged in",
    });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

function isPollClosed(poll: Doc<"polls">): boolean {
  if (poll.status === "closed") return true;
  if (poll.closesAt && new Date(poll.closesAt).getTime() <= Date.now()) {
    return true;
  }
  return false;
}

async function enrichPoll(
  ctx: QueryCtx,
  currentUserId: Id<"users">,
  poll: Doc<"polls">,
  authorsCache: Map<Id<"users">, Doc<"users"> | null>,
): Promise<PollListItem> {
  let author = authorsCache.get(poll.authorId);
  if (author === undefined) {
    author = await ctx.db.get(poll.authorId);
    authorsCache.set(poll.authorId, author);
  }

  // Get current user's vote (if any)
  const myVote = await ctx.db
    .query("pollVotes")
    .withIndex("by_poll_and_user", (q) =>
      q.eq("pollId", poll._id).eq("userId", currentUserId),
    )
    .unique();

  const closed = isPollClosed(poll);
  const canSeeResults = myVote !== null || closed;

  // Count votes per option (only if user can see results)
  const counts = new Map<string, number>();
  for (const opt of poll.options) counts.set(opt.id, 0);

  if (canSeeResults) {
    const allVotes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
      .collect();
    for (const v of allVotes) {
      for (const optId of v.optionIds) {
        counts.set(optId, (counts.get(optId) ?? 0) + 1);
      }
    }
  }

  const totalVoters = poll.voteCount;
  const options: Array<PollOption> = poll.options.map((opt) => {
    const voteCount = counts.get(opt.id) ?? 0;
    const percentage =
      canSeeResults && totalVoters > 0
        ? Math.round((voteCount / totalVoters) * 100)
        : 0;
    return {
      id: opt.id,
      text: opt.text,
      voteCount,
      percentage,
      isSelected: myVote ? myVote.optionIds.includes(opt.id) : false,
    };
  });

  return {
    _id: poll._id,
    _creationTime: poll._creationTime,
    question: poll.question,
    description: poll.description ?? null,
    allowMultiple: poll.allowMultiple,
    isAnonymous: poll.isAnonymous,
    status: poll.status,
    closesAt: poll.closesAt ?? null,
    authorId: poll.authorId,
    authorName: author?.name ?? null,
    authorAvatar: author?.avatarUrl ?? null,
    voteCount: poll.voteCount,
    hasVoted: myVote !== null,
    isClosed: closed,
    options,
    canSeeResults,
  };
}

export const listPolls = query({
  args: {
    filter: v.optional(v.string()), // "all" | "active" | "closed" | "mine"
  },
  handler: async (ctx, args): Promise<Array<PollListItem>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const filter = args.filter ?? "all";

    let polls = await ctx.db.query("polls").order("desc").take(200);

    // Apply tenant filter. A super admin without an active grant has
    // organizationId === null and therefore sees no polls.
    polls = polls.filter((p) => p.organizationId === organizationId);

    if (filter === "active") {
      polls = polls.filter((p) => !isPollClosed(p));
    } else if (filter === "closed") {
      polls = polls.filter((p) => isPollClosed(p));
    } else if (filter === "mine") {
      polls = polls.filter((p) => p.authorId === user._id);
    }

    const authorsCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<PollListItem> = [];
    for (const p of polls) {
      results.push(await enrichPoll(ctx, user._id, p, authorsCache));
    }
    return results;
  },
});

export const getPoll = query({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args): Promise<PollListItem | null> => {
    const user = await requireUser(ctx);
    const poll = await ctx.db.get(args.pollId);
    if (!poll) return null;
    return await enrichPoll(ctx, user._id, poll, new Map());
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    total: number;
    active: number;
    closed: number;
    myVotes: number;
  }> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const allRaw = await ctx.db.query("polls").collect();
    const all = allRaw.filter((p) => p.organizationId === organizationId);

    let active = 0;
    let closed = 0;
    for (const p of all) {
      if (isPollClosed(p)) closed++;
      else active++;
    }
    const myVotesList = await ctx.db
      .query("pollVotes")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    return {
      total: all.length,
      active,
      closed,
      myVotes: myVotesList.length,
    };
  },
});

export const createPoll = mutation({
  args: {
    question: v.string(),
    description: v.optional(v.string()),
    options: v.array(v.string()),
    allowMultiple: v.boolean(),
    isAnonymous: v.boolean(),
    closesAt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"polls">> => {
    const user = await requireUser(ctx);

    const question = args.question.trim();
    if (question.length < 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pertanyaan minimal 5 karakter",
      });
    }

    const trimmedOptions = args.options
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (trimmedOptions.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Minimal 2 pilihan jawaban",
      });
    }
    if (trimmedOptions.length > 10) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 10 pilihan jawaban",
      });
    }

    if (args.closesAt) {
      const closeTime = new Date(args.closesAt).getTime();
      if (Number.isNaN(closeTime)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Tanggal penutupan tidak valid",
        });
      }
      if (closeTime <= Date.now()) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Tanggal penutupan harus di masa depan",
        });
      }
    }

    const options = trimmedOptions.map((text, i) => ({
      id: `opt_${i}_${Math.random().toString(36).slice(2, 8)}`,
      text,
    }));

    return await ctx.db.insert("polls", {
      question,
      description: args.description?.trim() || undefined,
      options,
      allowMultiple: args.allowMultiple,
      isAnonymous: args.isAnonymous,
      status: "active",
      closesAt: args.closesAt,
      authorId: user._id,
      voteCount: 0,
      organizationId: user.organizationId,
    });
  },
});

export const vote = mutation({
  args: {
    pollId: v.id("polls"),
    optionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Polling tidak ditemukan" });
    }
    assertSameTenant(user.organizationId, poll.organizationId);
    if (isPollClosed(poll)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Polling sudah ditutup",
      });
    }

    if (args.optionIds.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih minimal satu jawaban",
      });
    }
    if (!poll.allowMultiple && args.optionIds.length > 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Polling ini hanya memperbolehkan satu pilihan",
      });
    }

    const validIds = new Set(poll.options.map((o) => o.id));
    for (const id of args.optionIds) {
      if (!validIds.has(id)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Pilihan tidak valid",
        });
      }
    }

    const existing = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_and_user", (q) =>
        q.eq("pollId", args.pollId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Anda sudah memberikan suara untuk polling ini",
      });
    }

    await ctx.db.insert("pollVotes", {
      pollId: args.pollId,
      userId: user._id,
      optionIds: args.optionIds,
      organizationId: user.organizationId,
    });
    await ctx.db.patch(args.pollId, { voteCount: poll.voteCount + 1 });
    return null;
  },
});

export const closePoll = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Polling tidak ditemukan" });
    }
    assertSameTenant(user.organizationId, poll.organizationId);
    if (poll.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pembuat atau admin yang dapat menutup polling",
      });
    }
    await ctx.db.patch(args.pollId, { status: "closed" });
    return null;
  },
});

export const removePoll = mutation({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Polling tidak ditemukan" });
    }
    assertSameTenant(user.organizationId, poll.organizationId);
    if (poll.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus polling ini",
      });
    }
    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();
    for (const v of votes) {
      await ctx.db.delete(v._id);
    }
    await ctx.db.delete(args.pollId);
    return null;
  },
});
