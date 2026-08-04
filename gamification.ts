import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireUser } from "./_helpers";

// XP reward per event type
export const XP_REWARDS = {
  lesson_completed: 10,
  course_completed: 50,
  quiz_passed: 30,
  certificate_earned: 40,
  review_submitted: 5,
  external_training_approved: 30,
  path_completed: 100,
} as const;

export type XpEvent = keyof typeof XP_REWARDS;

// Badge definitions
export const BADGE_DEFS: Array<{
  key: string;
  label: string;
  description: string;
  icon: string;
  check: (stats: Doc<"learnerStats">) => boolean;
}> = [
  {
    key: "first_course",
    label: "Langkah Pertama",
    description: "Menyelesaikan kelas pertama",
    icon: "🎯",
    check: (s) => s.coursesCompleted >= 1,
  },
  {
    key: "five_courses",
    label: "Pembelajar Aktif",
    description: "Menyelesaikan 5 kelas",
    icon: "📚",
    check: (s) => s.coursesCompleted >= 5,
  },
  {
    key: "ten_courses",
    label: "Ahli Pembelajar",
    description: "Menyelesaikan 10 kelas",
    icon: "🏆",
    check: (s) => s.coursesCompleted >= 10,
  },
  {
    key: "quiz_master",
    label: "Master Kuis",
    description: "Lulus 5 kuis",
    icon: "🧠",
    check: (s) => s.quizzesPassed >= 5,
  },
  {
    key: "certified",
    label: "Tersertifikasi",
    description: "Memiliki 3 sertifikat",
    icon: "🎓",
    check: (s) => s.certificatesEarned >= 3,
  },
  {
    key: "xp_hundred",
    label: "100 XP",
    description: "Mencapai 100 XP",
    icon: "⭐",
    check: (s) => s.totalXp >= 100,
  },
  {
    key: "xp_five_hundred",
    label: "500 XP",
    description: "Mencapai 500 XP",
    icon: "✨",
    check: (s) => s.totalXp >= 500,
  },
  {
    key: "xp_thousand",
    label: "Bintang Pembelajar",
    description: "Mencapai 1000 XP",
    icon: "💫",
    check: (s) => s.totalXp >= 1000,
  },
  {
    key: "streak_seven",
    label: "Streak 7 Hari",
    description: "Aktif belajar 7 hari berturut-turut",
    icon: "🔥",
    check: (s) => (s.streakDays ?? 0) >= 7,
  },
];

// ---- Helpers ----------------------------------------------------------

async function getOrCreateStats(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"learnerStats">> {
  const existing = await ctx.db
    .query("learnerStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const now = new Date().toISOString();
  const id = await ctx.db.insert("learnerStats", {
    userId,
    totalXp: 0,
    coursesCompleted: 0,
    certificatesEarned: 0,
    quizzesPassed: 0,
    badges: [],
    streakDays: 0,
    updatedAt: now,
  });
  const row = await ctx.db.get(id);
  if (!row) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Stats not created" });
  }
  return row;
}

export async function awardXp(
  ctx: MutationCtx,
  userId: Id<"users">,
  event: XpEvent,
  incCounts: Partial<{
    coursesCompleted: number;
    certificatesEarned: number;
    quizzesPassed: number;
  }> = {},
): Promise<void> {
  const stats = await getOrCreateStats(ctx, userId);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  let streakDays = stats.streakDays ?? 0;
  if (stats.lastActivityDate === today) {
    // same day, streak unchanged
  } else if (stats.lastActivityDate === yesterday) {
    streakDays += 1;
  } else {
    streakDays = 1;
  }
  const newStats: Doc<"learnerStats"> = {
    ...stats,
    totalXp: stats.totalXp + XP_REWARDS[event],
    coursesCompleted:
      stats.coursesCompleted + (incCounts.coursesCompleted ?? 0),
    certificatesEarned:
      stats.certificatesEarned + (incCounts.certificatesEarned ?? 0),
    quizzesPassed: stats.quizzesPassed + (incCounts.quizzesPassed ?? 0),
    streakDays,
    lastActivityDate: today,
    updatedAt: new Date().toISOString(),
  };
  // Evaluate badges
  const earnedBadges = new Set(stats.badges);
  for (const b of BADGE_DEFS) {
    if (b.check(newStats)) earnedBadges.add(b.key);
  }
  newStats.badges = Array.from(earnedBadges);
  await ctx.db.patch(stats._id, {
    totalXp: newStats.totalXp,
    coursesCompleted: newStats.coursesCompleted,
    certificatesEarned: newStats.certificatesEarned,
    quizzesPassed: newStats.quizzesPassed,
    badges: newStats.badges,
    streakDays: newStats.streakDays,
    lastActivityDate: newStats.lastActivityDate,
    updatedAt: newStats.updatedAt,
  });
}

// ---- Queries ----------------------------------------------------------

export const getMyStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalXp: number;
    coursesCompleted: number;
    certificatesEarned: number;
    quizzesPassed: number;
    badges: Array<{
      key: string;
      label: string;
      description: string;
      icon: string;
      earned: boolean;
    }>;
    streakDays: number;
    rank: number | null;
    level: number;
    levelProgress: number; // percent to next level
  }> => {
    const user = await requireUser(ctx);
    const stats = await ctx.db
      .query("learnerStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const totalXp = stats?.totalXp ?? 0;
    const coursesCompleted = stats?.coursesCompleted ?? 0;
    const certificatesEarned = stats?.certificatesEarned ?? 0;
    const quizzesPassed = stats?.quizzesPassed ?? 0;
    const streakDays = stats?.streakDays ?? 0;
    const badges = BADGE_DEFS.map((b) => ({
      key: b.key,
      label: b.label,
      description: b.description,
      icon: b.icon,
      earned: stats ? stats.badges.includes(b.key) : false,
    }));
    // Rank among all users
    let rank: number | null = null;
    if (stats) {
      const all = await ctx.db.query("learnerStats").collect();
      all.sort((a, b) => b.totalXp - a.totalXp);
      rank = all.findIndex((s) => s.userId === user._id) + 1;
    }
    // Level: 100xp per level
    const level = Math.floor(totalXp / 100) + 1;
    const levelProgress = totalXp % 100;
    return {
      totalXp,
      coursesCompleted,
      certificatesEarned,
      quizzesPassed,
      badges,
      streakDays,
      rank: rank === 0 ? null : rank,
      level,
      levelProgress,
    };
  },
});

export const getLeaderboard = query({
  args: {
    // "xp" | "courses" | "certificates"
    metric: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      rank: number;
      userId: Id<"users">;
      userName: string | null;
      userAvatar: string | null;
      userDepartment: string | null;
      value: number;
      level: number;
      badgeCount: number;
    }>
  > => {
    await requireUser(ctx);
    const all = await ctx.db.query("learnerStats").collect();
    const metric = args.metric ?? "xp";
    const sorted = [...all].sort((a, b) => {
      if (metric === "courses") return b.coursesCompleted - a.coursesCompleted;
      if (metric === "certificates")
        return b.certificatesEarned - a.certificatesEarned;
      return b.totalXp - a.totalXp;
    });
    const limit = Math.min(args.limit ?? 20, 50);
    const top = sorted.slice(0, limit);
    const out: Array<{
      rank: number;
      userId: Id<"users">;
      userName: string | null;
      userAvatar: string | null;
      userDepartment: string | null;
      value: number;
      level: number;
      badgeCount: number;
    }> = [];
    let rank = 0;
    for (const s of top) {
      rank += 1;
      const u = await ctx.db.get(s.userId);
      const value =
        metric === "courses"
          ? s.coursesCompleted
          : metric === "certificates"
            ? s.certificatesEarned
            : s.totalXp;
      out.push({
        rank,
        userId: s.userId,
        userName: u?.name ?? null,
        userAvatar: u?.avatarUrl ?? null,
        userDepartment: u?.department ?? null,
        value,
        level: Math.floor(s.totalXp / 100) + 1,
        badgeCount: s.badges.length,
      });
    }
    return out;
  },
});

// Used by other mutations (enroll, quiz) via internalQuery. Exposed for tests.
export const awardXpForEvent = mutation({
  args: {
    event: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const evt = args.event as XpEvent;
    if (!(evt in XP_REWARDS)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Event XP tidak valid",
      });
    }
    await awardXp(ctx, user._id, evt);
    return null;
  },
});

// Helper to award review xp used from review submission
export async function awardXpForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  event: XpEvent,
  incCounts: Partial<{
    coursesCompleted: number;
    certificatesEarned: number;
    quizzesPassed: number;
  }> = {},
): Promise<void> {
  await awardXp(ctx, userId, event, incCounts);
}

// Stats readonly helper
export async function readStats(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"learnerStats"> | null> {
  return await ctx.db
    .query("learnerStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}
