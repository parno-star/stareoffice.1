import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { notifyAllUsers } from "./notifications";
import { requireTenant } from "./lib/tenant";

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

function requireAdmin(user: Doc<"users">) {
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat melakukan aksi ini",
    });
  }
}

// ---- Helpers ---------------------------------------------------------

const QUESTION_TYPES = ["mood", "rating", "nps", "yes_no"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

// Normalize the raw primary answer string to a 0..100 sentiment score.
export function computeSentiment(
  questionType: string,
  answer: string,
): number {
  const n = Number(answer);
  if (questionType === "mood" || questionType === "rating") {
    if (Number.isNaN(n) || n < 1 || n > 5) return 0;
    return Math.round(((n - 1) / 4) * 1000) / 10;
  }
  if (questionType === "nps") {
    if (Number.isNaN(n) || n < 0 || n > 10) return 0;
    return Math.round((n / 10) * 1000) / 10;
  }
  if (questionType === "yes_no") {
    return answer === "yes" ? 100 : 0;
  }
  return 0;
}

function matchesDepartment(
  pulse: Doc<"pulseSurveys">,
  user: Doc<"users">,
): boolean {
  if (!pulse.targetDepartment || pulse.targetDepartment === "all") return true;
  return (user.department ?? "") === pulse.targetDepartment;
}

function isVisible(pulse: Doc<"pulseSurveys">): boolean {
  if (pulse.status !== "active") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (pulse.startDate && pulse.startDate > today) return false;
  if (pulse.endDate && pulse.endDate < today) return false;
  return true;
}

async function recomputePulseStats(
  ctx: MutationCtx,
  pulseId: Id<"pulseSurveys">,
): Promise<void> {
  const pulse = await ctx.db.get(pulseId);
  if (!pulse) return;
  const responses = await ctx.db
    .query("pulseResponses")
    .withIndex("by_pulse", (q) => q.eq("pulseId", pulseId))
    .collect();
  if (responses.length === 0) {
    await ctx.db.patch(pulseId, {
      responseCount: 0,
      averageSentiment: undefined,
      distribution: undefined,
    });
    return;
  }
  const total = responses.reduce((sum, r) => sum + r.sentimentScore, 0);
  const avg = Math.round((total / responses.length) * 10) / 10;
  const dist: Record<string, number> = {};
  for (const r of responses) {
    dist[r.answer] = (dist[r.answer] ?? 0) + 1;
  }
  await ctx.db.patch(pulseId, {
    responseCount: responses.length,
    averageSentiment: avg,
    distribution: dist,
  });
}

// ---- Types ----------------------------------------------------------

export type PulseListItem = {
  _id: Id<"pulseSurveys">;
  _creationTime: number;
  title: string;
  description: string | null;
  question: string;
  questionType: string;
  commentPrompt: string | null;
  category: string;
  frequency: string;
  status: string;
  isAnonymous: boolean;
  targetDepartment: string | null;
  startDate: string;
  endDate: string | null;
  seriesKey: string | null;
  color: string;
  icon: string | null;
  responseCount: number;
  averageSentiment: number | null;
  distribution: Record<string, number> | null;
  publishedAt: string | null;
  closedAt: string | null;
  authorId: Id<"users">;
  authorName: string | null;
  hasResponded: boolean;
  canRespond: boolean;
};

function toListItem(
  pulse: Doc<"pulseSurveys">,
  authorName: string | null,
  hasResponded: boolean,
  canRespond: boolean,
): PulseListItem {
  return {
    _id: pulse._id,
    _creationTime: pulse._creationTime,
    title: pulse.title,
    description: pulse.description ?? null,
    question: pulse.question,
    questionType: pulse.questionType,
    commentPrompt: pulse.commentPrompt ?? null,
    category: pulse.category,
    frequency: pulse.frequency,
    status: pulse.status,
    isAnonymous: pulse.isAnonymous,
    targetDepartment: pulse.targetDepartment ?? null,
    startDate: pulse.startDate,
    endDate: pulse.endDate ?? null,
    seriesKey: pulse.seriesKey ?? null,
    color: pulse.color,
    icon: pulse.icon ?? null,
    responseCount: pulse.responseCount,
    averageSentiment: pulse.averageSentiment ?? null,
    distribution: pulse.distribution ?? null,
    publishedAt: pulse.publishedAt ?? null,
    closedAt: pulse.closedAt ?? null,
    authorId: pulse.authorId,
    authorName,
    hasResponded,
    canRespond,
  };
}

// ---- Queries --------------------------------------------------------

export const listPulses = query({
  args: {
    filter: v.optional(v.string()), // "all" | "active" | "draft" | "closed" | "mine"
  },
  handler: async (ctx, args): Promise<Array<PulseListItem>> => {
    const user = await requireUser(ctx);
    const filter = args.filter ?? "all";

    let pulses = await ctx.db
      .query("pulseSurveys")
      .order("desc")
      .take(200);

    if (!isAdminRole(user.role)) {
      pulses = pulses.filter((p) => {
        if (p.status === "draft") return false;
        return matchesDepartment(p, user);
      });
    }

    if (filter === "active") {
      pulses = pulses.filter((p) => p.status === "active");
    } else if (filter === "draft") {
      pulses = pulses.filter((p) => p.status === "draft");
    } else if (filter === "closed") {
      pulses = pulses.filter((p) => p.status === "closed");
    } else if (filter === "mine") {
      pulses = pulses.filter((p) => p.authorId === user._id);
    }

    const authorsCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<PulseListItem> = [];
    for (const p of pulses) {
      let author = authorsCache.get(p.authorId);
      if (author === undefined) {
        author = await ctx.db.get(p.authorId);
        authorsCache.set(p.authorId, author);
      }
      const myResponse = p.isAnonymous
        ? null
        : await ctx.db
            .query("pulseResponses")
            .withIndex("by_pulse_and_user", (q) =>
              q.eq("pulseId", p._id).eq("userId", user._id),
            )
            .first();
      const hasResponded = myResponse !== null;
      const canRespond =
        !hasResponded && isVisible(p) && matchesDepartment(p, user);
      results.push(toListItem(p, author?.name ?? null, hasResponded, canRespond));
    }
    return results;
  },
});

export const getPulse = query({
  args: { pulseId: v.id("pulseSurveys") },
  handler: async (ctx, args): Promise<PulseListItem | null> => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.pulseId);
    if (!p) return null;
    if (!isAdminRole(user.role) && p.status === "draft") return null;

    const author = await ctx.db.get(p.authorId);
    const myResponse = p.isAnonymous
      ? null
      : await ctx.db
          .query("pulseResponses")
          .withIndex("by_pulse_and_user", (q) =>
            q.eq("pulseId", p._id).eq("userId", user._id),
          )
          .first();
    const hasResponded = myResponse !== null;
    const canRespond =
      !hasResponded && isVisible(p) && matchesDepartment(p, user);
    return toListItem(p, author?.name ?? null, hasResponded, canRespond);
  },
});

export type PulseStats = {
  activePulses: number;
  totalResponses: number;
  averageSentiment: number | null;
  participationRate: number;
  myPending: number;
  trend: Array<{ date: string; score: number; responses: number }>;
  distributionByCategory: Array<{
    category: string;
    averageSentiment: number;
    responseCount: number;
  }>;
};

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<PulseStats> => {
    const user = await requireUser(ctx);

    const allPulses = await ctx.db.query("pulseSurveys").collect();
    const visible = isAdminRole(user.role)
      ? allPulses
      : allPulses.filter(
          (p) => p.status !== "draft" && matchesDepartment(p, user),
        );

    const active = visible.filter((p) => p.status === "active");
    let totalResponses = 0;
    let sentimentSum = 0;
    let sentimentCount = 0;
    for (const p of visible) {
      totalResponses += p.responseCount;
      if (p.averageSentiment !== undefined && p.responseCount > 0) {
        sentimentSum += p.averageSentiment * p.responseCount;
        sentimentCount += p.responseCount;
      }
    }

    // Participation rate based on active pulses only (unique users who
    // responded / active pulses * total employees).
    const allUsers = await ctx.db.query("users").collect();
    const respondents = new Set<string>();
    for (const p of active) {
      const responses = await ctx.db
        .query("pulseResponses")
        .withIndex("by_pulse", (q) => q.eq("pulseId", p._id))
        .collect();
      for (const r of responses) {
        if (r.userId) respondents.add(r.userId);
      }
    }
    const participationRate =
      active.length > 0 && allUsers.length > 0
        ? Math.round((respondents.size / allUsers.length) * 100)
        : 0;

    // My pending active pulses
    let myPending = 0;
    for (const p of active) {
      if (!matchesDepartment(p, user)) continue;
      if (p.isAnonymous) {
        // Can't easily tell per-user without tracking; skip counting anon.
        continue;
      }
      const myResponse = await ctx.db
        .query("pulseResponses")
        .withIndex("by_pulse_and_user", (q) =>
          q.eq("pulseId", p._id).eq("userId", user._id),
        )
        .first();
      if (!myResponse) myPending += 1;
    }

    // Trend: last 12 weeks, average sentiment per ISO week based on response
    // submittedAt.
    const now = new Date();
    const weekKeyFromDate = (d: Date): string => {
      const target = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      );
      const dayNum = target.getUTCDay() || 7;
      target.setUTCDate(target.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(
        ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
      );
      return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    };

    const visibleIds = new Set(visible.map((p) => p._id));
    const weekBuckets = new Map<
      string,
      { sum: number; count: number; date: string }
    >();
    // Fetch responses across visible pulses (bounded to 1500 for safety)
    let responseTotal = 0;
    for (const p of visible) {
      const rs = await ctx.db
        .query("pulseResponses")
        .withIndex("by_pulse", (q) => q.eq("pulseId", p._id))
        .take(500);
      for (const r of rs) {
        if (!visibleIds.has(r.pulseId)) continue;
        const d = new Date(r.submittedAt);
        const diffMs = now.getTime() - d.getTime();
        if (diffMs > 12 * 7 * 24 * 3600 * 1000) continue;
        const key = weekKeyFromDate(d);
        const bucket = weekBuckets.get(key);
        if (bucket) {
          bucket.sum += r.sentimentScore;
          bucket.count += 1;
        } else {
          weekBuckets.set(key, {
            sum: r.sentimentScore,
            count: 1,
            date: d.toISOString().slice(0, 10),
          });
        }
        responseTotal += 1;
        if (responseTotal > 1500) break;
      }
      if (responseTotal > 1500) break;
    }

    const trend = Array.from(weekBuckets.entries())
      .map(([key, { sum, count, date }]) => ({
        date: `${key} (${date})`,
        score: Math.round((sum / count) * 10) / 10,
        responses: count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Distribution by category
    const catAgg = new Map<string, { sum: number; count: number }>();
    for (const p of visible) {
      if (p.responseCount === 0 || p.averageSentiment === undefined) continue;
      const agg = catAgg.get(p.category);
      if (agg) {
        agg.sum += p.averageSentiment * p.responseCount;
        agg.count += p.responseCount;
      } else {
        catAgg.set(p.category, {
          sum: p.averageSentiment * p.responseCount,
          count: p.responseCount,
        });
      }
    }
    const distributionByCategory = Array.from(catAgg.entries())
      .map(([category, { sum, count }]) => ({
        category,
        averageSentiment: Math.round((sum / count) * 10) / 10,
        responseCount: count,
      }))
      .sort((a, b) => b.responseCount - a.responseCount);

    return {
      activePulses: active.length,
      totalResponses,
      averageSentiment:
        sentimentCount > 0
          ? Math.round((sentimentSum / sentimentCount) * 10) / 10
          : null,
      participationRate,
      myPending,
      trend,
      distributionByCategory,
    };
  },
});

export type PulseResultsData = {
  pulse: PulseListItem;
  responseCount: number;
  averageSentiment: number | null;
  distribution: Array<{ key: string; count: number; label: string }>;
  departmentBreakdown: Array<{
    department: string;
    averageSentiment: number;
    responseCount: number;
  }>;
  recentComments: Array<{
    submittedAt: string;
    comment: string;
    authorName: string | null;
    sentimentScore: number;
  }>;
  trend: Array<{ date: string; score: number }>;
};

const ANSWER_LABELS: Record<string, Record<string, string>> = {
  mood: {
    "1": "Sangat Buruk",
    "2": "Buruk",
    "3": "Netral",
    "4": "Baik",
    "5": "Sangat Baik",
  },
  rating: {
    "1": "1 Bintang",
    "2": "2 Bintang",
    "3": "3 Bintang",
    "4": "4 Bintang",
    "5": "5 Bintang",
  },
  yes_no: { yes: "Ya", no: "Tidak" },
};

function formatAnswerLabel(type: string, key: string): string {
  const byType = ANSWER_LABELS[type];
  if (byType && byType[key]) return byType[key];
  if (type === "nps") return `Skor ${key}`;
  return key;
}

export const getPulseResults = query({
  args: { pulseId: v.id("pulseSurveys") },
  handler: async (ctx, args): Promise<PulseResultsData | null> => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.pulseId);
    if (!p) return null;
    // Anyone with access to the pulse can view aggregated results
    if (!isAdminRole(user.role) && p.status === "draft") return null;

    const responses = await ctx.db
      .query("pulseResponses")
      .withIndex("by_pulse", (q) => q.eq("pulseId", args.pulseId))
      .collect();

    const distMap = new Map<string, number>();
    for (const r of responses) {
      distMap.set(r.answer, (distMap.get(r.answer) ?? 0) + 1);
    }
    const distribution = Array.from(distMap.entries())
      .map(([key, count]) => ({
        key,
        count,
        label: formatAnswerLabel(p.questionType, key),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const deptMap = new Map<string, { sum: number; count: number }>();
    for (const r of responses) {
      const dept = r.userDepartment ?? "Tidak ada";
      const agg = deptMap.get(dept);
      if (agg) {
        agg.sum += r.sentimentScore;
        agg.count += 1;
      } else {
        deptMap.set(dept, { sum: r.sentimentScore, count: 1 });
      }
    }
    const departmentBreakdown = Array.from(deptMap.entries())
      .map(([department, { sum, count }]) => ({
        department,
        averageSentiment: Math.round((sum / count) * 10) / 10,
        responseCount: count,
      }))
      .sort((a, b) => b.responseCount - a.responseCount);

    // Recent comments (max 20, newest first). Anonymous pulses omit author.
    const comments: Array<{
      submittedAt: string;
      comment: string;
      authorName: string | null;
      sentimentScore: number;
    }> = [];
    const sortedByDate = [...responses].sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    );
    for (const r of sortedByDate) {
      if (!r.comment || r.comment.trim() === "") continue;
      let authorName: string | null = null;
      if (!p.isAnonymous && r.userId) {
        const u = await ctx.db.get(r.userId);
        authorName = u?.name ?? null;
      }
      comments.push({
        submittedAt: r.submittedAt,
        comment: r.comment,
        authorName,
        sentimentScore: r.sentimentScore,
      });
      if (comments.length >= 20) break;
    }

    // Daily trend from responses (last 60 days)
    const dayMap = new Map<string, { sum: number; count: number }>();
    const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
    for (const r of responses) {
      const t = new Date(r.submittedAt).getTime();
      if (t < cutoff) continue;
      const day = r.submittedAt.slice(0, 10);
      const agg = dayMap.get(day);
      if (agg) {
        agg.sum += r.sentimentScore;
        agg.count += 1;
      } else {
        dayMap.set(day, { sum: r.sentimentScore, count: 1 });
      }
    }
    const trend = Array.from(dayMap.entries())
      .map(([date, { sum, count }]) => ({
        date,
        score: Math.round((sum / count) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const authorDoc = await ctx.db.get(p.authorId);
    const pulseItem = toListItem(p, authorDoc?.name ?? null, false, false);

    return {
      pulse: pulseItem,
      responseCount: responses.length,
      averageSentiment:
        responses.length > 0
          ? Math.round(
              (responses.reduce((s, r) => s + r.sentimentScore, 0) /
                responses.length) *
                10,
            ) / 10
          : null,
      distribution,
      departmentBreakdown,
      recentComments: comments,
      trend,
    };
  },
});

// ---- Mutations -------------------------------------------------------

export const createPulse = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    question: v.string(),
    questionType: v.string(),
    commentPrompt: v.optional(v.string()),
    category: v.string(),
    frequency: v.string(),
    isAnonymous: v.boolean(),
    targetDepartment: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"pulseSurveys">> => {
    const user = await requireUser(ctx);
    requireAdmin(user);

    if (!QUESTION_TYPES.includes(args.questionType as QuestionType)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe pertanyaan tidak valid",
      });
    }
    if (args.title.trim() === "" || args.question.trim() === "") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul dan pertanyaan wajib diisi",
      });
    }

    const id = await ctx.db.insert("pulseSurveys", {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      question: args.question.trim(),
      questionType: args.questionType,
      commentPrompt: args.commentPrompt?.trim() || undefined,
      category: args.category,
      frequency: args.frequency,
      status: "draft",
      isAnonymous: args.isAnonymous,
      targetDepartment: args.targetDepartment || undefined,
      startDate: args.startDate,
      endDate: args.endDate || undefined,
      color: args.color,
      icon: args.icon,
      responseCount: 0,
      authorId: user._id,
    });
    return id;
  },
});

export const updatePulse = mutation({
  args: {
    pulseId: v.id("pulseSurveys"),
    title: v.string(),
    description: v.optional(v.string()),
    question: v.string(),
    questionType: v.string(),
    commentPrompt: v.optional(v.string()),
    category: v.string(),
    frequency: v.string(),
    isAnonymous: v.boolean(),
    targetDepartment: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const p = await ctx.db.get(args.pulseId);
    if (!p) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pulse tidak ditemukan",
      });
    }
    if (p.status !== "draft") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Pulse yang sudah diterbitkan tidak dapat diubah strukturnya. Tutup lalu duplikasi.",
      });
    }
    await ctx.db.patch(args.pulseId, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      question: args.question.trim(),
      questionType: args.questionType,
      commentPrompt: args.commentPrompt?.trim() || undefined,
      category: args.category,
      frequency: args.frequency,
      isAnonymous: args.isAnonymous,
      targetDepartment: args.targetDepartment || undefined,
      startDate: args.startDate,
      endDate: args.endDate || undefined,
      color: args.color,
      icon: args.icon,
    });
  },
});

export const publishPulse = mutation({
  args: { pulseId: v.id("pulseSurveys") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const p = await ctx.db.get(args.pulseId);
    if (!p) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pulse tidak ditemukan",
      });
    }
    if (p.status === "active") return;
    const now = new Date().toISOString();
    await ctx.db.patch(args.pulseId, {
      status: "active",
      publishedAt: p.publishedAt ?? now,
      closedAt: undefined,
    });
    // Notify everyone (or target department members if scoped)
    await notifyAllUsers(ctx, {
      type: "pulse_published",
      title: "Pulse Survey Baru",
      message: `Berikan pendapat cepat: ${p.title}`,
      link: `/pulse?id=${args.pulseId}`,
      actorId: user._id,
    });
  },
});

export const closePulse = mutation({
  args: { pulseId: v.id("pulseSurveys") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const p = await ctx.db.get(args.pulseId);
    if (!p) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pulse tidak ditemukan",
      });
    }
    await ctx.db.patch(args.pulseId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
  },
});

export const duplicatePulse = mutation({
  args: {
    pulseId: v.id("pulseSurveys"),
    startDate: v.string(),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"pulseSurveys">> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const p = await ctx.db.get(args.pulseId);
    if (!p) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pulse tidak ditemukan",
      });
    }
    const seriesKey = p.seriesKey ?? `series_${args.pulseId}`;
    // Make sure the original has seriesKey set so future duplicates link up.
    if (!p.seriesKey) {
      await ctx.db.patch(args.pulseId, { seriesKey });
    }
    const id = await ctx.db.insert("pulseSurveys", {
      title: p.title,
      description: p.description,
      question: p.question,
      questionType: p.questionType,
      commentPrompt: p.commentPrompt,
      category: p.category,
      frequency: p.frequency,
      status: "draft",
      isAnonymous: p.isAnonymous,
      targetDepartment: p.targetDepartment,
      startDate: args.startDate,
      endDate: args.endDate,
      seriesKey,
      color: p.color,
      icon: p.icon,
      responseCount: 0,
      authorId: user._id,
    });
    return id;
  },
});

export const removePulse = mutation({
  args: { pulseId: v.id("pulseSurveys") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const p = await ctx.db.get(args.pulseId);
    if (!p) return;
    // Delete responses first
    const responses = await ctx.db
      .query("pulseResponses")
      .withIndex("by_pulse", (q) => q.eq("pulseId", args.pulseId))
      .collect();
    for (const r of responses) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.pulseId);
  },
});

export const submitResponse = mutation({
  args: {
    pulseId: v.id("pulseSurveys"),
    answer: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"pulseResponses">> => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.pulseId);
    if (!p) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pulse tidak ditemukan",
      });
    }
    if (!isVisible(p)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pulse ini tidak sedang aktif",
      });
    }
    if (!matchesDepartment(p, user)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Pulse ini tidak ditujukan untuk departemen Anda",
      });
    }
    if (!p.isAnonymous) {
      const existing = await ctx.db
        .query("pulseResponses")
        .withIndex("by_pulse_and_user", (q) =>
          q.eq("pulseId", args.pulseId).eq("userId", user._id),
        )
        .first();
      if (existing) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Anda sudah memberikan pendapat pada pulse ini",
        });
      }
    }

    const sentimentScore = computeSentiment(p.questionType, args.answer);
    const id = await ctx.db.insert("pulseResponses", {
      pulseId: args.pulseId,
      userId: p.isAnonymous ? undefined : user._id,
      userDepartment: user.department,
      answer: args.answer,
      sentimentScore,
      comment: args.comment?.trim() || undefined,
      submittedAt: new Date().toISOString(),
    });

    await recomputePulseStats(ctx, args.pulseId);
    return id;
  },
});
