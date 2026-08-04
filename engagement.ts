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

// Survey question type validator reused by multiple mutations.
const questionValidator = v.object({
  id: v.string(),
  text: v.string(),
  type: v.string(),
  options: v.optional(v.array(v.string())),
  required: v.boolean(),
  minLabel: v.optional(v.string()),
  maxLabel: v.optional(v.string()),
  category: v.optional(v.string()),
});

const answerValidator = v.object({
  questionId: v.string(),
  value: v.string(),
  values: v.optional(v.array(v.string())),
});

export type SurveyListItem = {
  _id: Id<"engagementSurveys">;
  _creationTime: number;
  title: string;
  description: string | null;
  kind: string;
  status: string;
  isAnonymous: boolean;
  startDate: string;
  endDate: string | null;
  questionCount: number;
  responseCount: number;
  averageScore: number | null;
  color: string;
  icon: string | null;
  targetDepartment: string | null;
  authorId: Id<"users">;
  authorName: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  hasResponded: boolean;
  canRespond: boolean;
};

export type SurveyDetail = SurveyListItem & {
  questions: Doc<"engagementSurveys">["questions"];
};

function toListItem(
  survey: Doc<"engagementSurveys">,
  authorName: string | null,
  hasResponded: boolean,
  canRespond: boolean,
): SurveyListItem {
  return {
    _id: survey._id,
    _creationTime: survey._creationTime,
    title: survey.title,
    description: survey.description ?? null,
    kind: survey.kind,
    status: survey.status,
    isAnonymous: survey.isAnonymous,
    startDate: survey.startDate,
    endDate: survey.endDate ?? null,
    questionCount: survey.questions.length,
    responseCount: survey.responseCount,
    averageScore: survey.averageScore ?? null,
    color: survey.color,
    icon: survey.icon ?? null,
    targetDepartment: survey.targetDepartment ?? null,
    authorId: survey.authorId,
    authorName,
    publishedAt: survey.publishedAt ?? null,
    closedAt: survey.closedAt ?? null,
    hasResponded,
    canRespond,
  };
}

function matchesDepartment(
  survey: Doc<"engagementSurveys">,
  user: Doc<"users">,
): boolean {
  if (!survey.targetDepartment || survey.targetDepartment === "all") {
    return true;
  }
  return (user.department ?? "") === survey.targetDepartment;
}

function isVisible(survey: Doc<"engagementSurveys">): boolean {
  if (survey.status !== "active") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (survey.startDate && survey.startDate > today) return false;
  if (survey.endDate && survey.endDate < today) return false;
  return true;
}

export const listSurveys = query({
  args: {
    filter: v.optional(v.string()), // "all" | "active" | "draft" | "closed" | "mine"
  },
  handler: async (ctx, args): Promise<Array<SurveyListItem>> => {
    const user = await requireUser(ctx);
    const filter = args.filter ?? "all";

    let surveys = await ctx.db
      .query("engagementSurveys")
      .order("desc")
      .take(200);

    // Non-admins only see surveys they can respond to or have responded to
    if (!isAdminRole(user.role)) {
      surveys = surveys.filter((s) => {
        if (s.status === "draft") return false;
        return matchesDepartment(s, user);
      });
    }

    if (filter === "active") {
      surveys = surveys.filter((s) => s.status === "active");
    } else if (filter === "draft") {
      surveys = surveys.filter((s) => s.status === "draft");
    } else if (filter === "closed") {
      surveys = surveys.filter((s) => s.status === "closed");
    } else if (filter === "mine") {
      surveys = surveys.filter((s) => s.authorId === user._id);
    }

    const authorsCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<SurveyListItem> = [];
    for (const s of surveys) {
      let author = authorsCache.get(s.authorId);
      if (author === undefined) {
        author = await ctx.db.get(s.authorId);
        authorsCache.set(s.authorId, author);
      }
      const myResponse = await ctx.db
        .query("engagementResponses")
        .withIndex("by_survey_and_user", (q) =>
          q.eq("surveyId", s._id).eq("userId", user._id),
        )
        .first();
      const hasResponded = myResponse !== null;
      const canRespond =
        !hasResponded && isVisible(s) && matchesDepartment(s, user);
      results.push(toListItem(s, author?.name ?? null, hasResponded, canRespond));
    }
    return results;
  },
});

export const getSurvey = query({
  args: { surveyId: v.id("engagementSurveys") },
  handler: async (ctx, args): Promise<SurveyDetail | null> => {
    const user = await requireUser(ctx);
    const s = await ctx.db.get(args.surveyId);
    if (!s) return null;
    if (!isAdminRole(user.role) && s.status === "draft") return null;

    const author = await ctx.db.get(s.authorId);
    const myResponse = await ctx.db
      .query("engagementResponses")
      .withIndex("by_survey_and_user", (q) =>
        q.eq("surveyId", s._id).eq("userId", user._id),
      )
      .first();
    const hasResponded = myResponse !== null;
    const canRespond =
      !hasResponded && isVisible(s) && matchesDepartment(s, user);
    const base = toListItem(s, author?.name ?? null, hasResponded, canRespond);
    return {
      ...base,
      questions: s.questions,
    };
  },
});

// Compute overall score for a response: averages numeric answers (rating,
// mood, nps) on a 0..100 scale. Other types are ignored.
function computeOverallScore(
  questions: Doc<"engagementSurveys">["questions"],
  answers: Array<{ questionId: string; value: string }>,
): number | undefined {
  const numericValues: Array<number> = [];
  for (const a of answers) {
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    const n = Number(a.value);
    if (Number.isNaN(n)) continue;
    if (q.type === "rating" || q.type === "mood") {
      // 1..5 -> 0..100
      numericValues.push(((n - 1) / 4) * 100);
    } else if (q.type === "nps") {
      // 0..10 -> 0..100
      numericValues.push((n / 10) * 100);
    }
  }
  if (numericValues.length === 0) return undefined;
  const avg =
    numericValues.reduce((sum, x) => sum + x, 0) / numericValues.length;
  return Math.round(avg * 10) / 10;
}

export const submitResponse = mutation({
  args: {
    surveyId: v.id("engagementSurveys"),
    answers: v.array(answerValidator),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"engagementResponses">> => {
    const user = await requireUser(ctx);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Survei tidak ditemukan",
      });
    }
    if (!isVisible(survey)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Survei tidak sedang aktif",
      });
    }
    if (!matchesDepartment(survey, user)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Survei ini tidak ditujukan untuk departemen Anda",
      });
    }
    const existing = await ctx.db
      .query("engagementResponses")
      .withIndex("by_survey_and_user", (q) =>
        q.eq("surveyId", args.surveyId).eq("userId", user._id),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Anda sudah mengisi survei ini",
      });
    }
    // Validate required questions
    for (const q of survey.questions) {
      if (!q.required) continue;
      const a = args.answers.find((x) => x.questionId === q.id);
      const hasValue =
        a !== undefined &&
        ((a.value && a.value.trim() !== "") ||
          (a.values !== undefined && a.values.length > 0));
      if (!hasValue) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: `Pertanyaan wajib belum diisi: ${q.text}`,
        });
      }
    }

    const overallScore = computeOverallScore(survey.questions, args.answers);

    const id = await ctx.db.insert("engagementResponses", {
      surveyId: args.surveyId,
      userId: user._id,
      userName: survey.isAnonymous ? undefined : (user.name ?? undefined),
      userDepartment: survey.isAnonymous ? undefined : user.department,
      overallScore,
      answers: args.answers,
      comment: args.comment?.trim() || undefined,
      submittedAt: new Date().toISOString(),
    });

    // Update denormalized counters & rolling average
    const allResponses = await ctx.db
      .query("engagementResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();
    const scoredResponses = allResponses.filter(
      (r) => r.overallScore !== undefined,
    );
    const avg =
      scoredResponses.length === 0
        ? undefined
        : Math.round(
            (scoredResponses.reduce(
              (sum, r) => sum + (r.overallScore ?? 0),
              0,
            ) /
              scoredResponses.length) *
              10,
          ) / 10;

    await ctx.db.patch(args.surveyId, {
      responseCount: allResponses.length,
      averageScore: avg,
    });

    return id;
  },
});

// Admin queries --------------------------------------------------------------

export type SurveyResultsSummary = {
  responseCount: number;
  averageScore: number | null;
  // Distribution per question
  questionResults: Array<{
    questionId: string;
    text: string;
    type: string;
    required: boolean;
    category: string | null;
    // Summary numbers
    responseCount: number;
    averageNumeric: number | null;
    // For choice/multi-choice: option => count
    distribution: Array<{ label: string; count: number; percentage: number }>;
    // For text: first 10 text answers (anonymized if survey is anonymous)
    textAnswers: Array<{ value: string; userName: string | null }>;
  }>;
  // Department aggregate (only when survey is not anonymous)
  departmentBreakdown: Array<{
    department: string;
    responseCount: number;
    averageScore: number | null;
  }>;
};

export const getSurveyResults = query({
  args: { surveyId: v.id("engagementSurveys") },
  handler: async (ctx, args): Promise<SurveyResultsSummary | null> => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return null;

    const responses = await ctx.db
      .query("engagementResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();

    const scored = responses.filter((r) => r.overallScore !== undefined);
    const averageScore =
      scored.length === 0
        ? null
        : Math.round(
            (scored.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) /
              scored.length) *
              10,
          ) / 10;

    const questionResults: SurveyResultsSummary["questionResults"] = survey
      .questions.map((q) => {
        const answers = responses
          .map((r) => r.answers.find((a) => a.questionId === q.id))
          .filter((a) => a !== undefined);

        const result: SurveyResultsSummary["questionResults"][number] = {
          questionId: q.id,
          text: q.text,
          type: q.type,
          required: q.required,
          category: q.category ?? null,
          responseCount: answers.length,
          averageNumeric: null,
          distribution: [],
          textAnswers: [],
        };

        if (q.type === "rating" || q.type === "mood" || q.type === "nps") {
          const numbers = answers
            .map((a) => Number(a.value))
            .filter((n) => !Number.isNaN(n));
          if (numbers.length > 0) {
            result.averageNumeric =
              Math.round(
                (numbers.reduce((s, n) => s + n, 0) / numbers.length) * 10,
              ) / 10;
          }
          // Build distribution buckets
          const range = q.type === "nps" ? 11 : 5;
          const offset = q.type === "nps" ? 0 : 1;
          for (let i = 0; i < range; i++) {
            const val = i + offset;
            const count = numbers.filter((n) => Math.round(n) === val).length;
            const pct =
              numbers.length === 0
                ? 0
                : Math.round((count / numbers.length) * 100);
            result.distribution.push({
              label: String(val),
              count,
              percentage: pct,
            });
          }
        } else if (q.type === "single_choice" || q.type === "multi_choice") {
          const options = q.options ?? [];
          for (const opt of options) {
            let count = 0;
            for (const a of answers) {
              if (!a) continue;
              if (q.type === "multi_choice") {
                if (a.values?.includes(opt)) count += 1;
              } else if (a.value === opt) {
                count += 1;
              }
            }
            const pct =
              answers.length === 0
                ? 0
                : Math.round((count / answers.length) * 100);
            result.distribution.push({ label: opt, count, percentage: pct });
          }
        } else if (q.type === "text") {
          const samples = answers.slice(0, 30);
          for (const a of samples) {
            if (!a || !a.value.trim()) continue;
            const parentResp = responses.find((r) =>
              r.answers.some(
                (rAnswer) =>
                  rAnswer.questionId === a.questionId &&
                  rAnswer.value === a.value,
              ),
            );
            const userName = survey.isAnonymous
              ? null
              : (parentResp?.userName ?? null);
            result.textAnswers.push({ value: a.value, userName });
          }
        }

        return result;
      });

    // Department breakdown only when not anonymous
    const departmentBreakdown: SurveyResultsSummary["departmentBreakdown"] = [];
    if (!survey.isAnonymous) {
      const map = new Map<
        string,
        { count: number; scoreSum: number; scoreCount: number }
      >();
      for (const r of responses) {
        const dept = r.userDepartment ?? "Tanpa Departemen";
        const entry = map.get(dept) ?? {
          count: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
        entry.count += 1;
        if (r.overallScore !== undefined) {
          entry.scoreSum += r.overallScore;
          entry.scoreCount += 1;
        }
        map.set(dept, entry);
      }
      for (const [department, e] of map.entries()) {
        departmentBreakdown.push({
          department,
          responseCount: e.count,
          averageScore:
            e.scoreCount === 0
              ? null
              : Math.round((e.scoreSum / e.scoreCount) * 10) / 10,
        });
      }
      departmentBreakdown.sort((a, b) => b.responseCount - a.responseCount);
    }

    return {
      responseCount: responses.length,
      averageScore,
      questionResults,
      departmentBreakdown,
    };
  },
});

export const createSurvey = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    kind: v.string(),
    isAnonymous: v.boolean(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    questions: v.array(questionValidator),
    targetDepartment: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    publishNow: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"engagementSurveys">> => {
    const user = await requireUser(ctx);
    requireAdmin(user);

    const title = args.title.trim();
    if (title.length < 3) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul minimal 3 karakter",
      });
    }
    if (args.questions.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Minimal 1 pertanyaan",
      });
    }
    const now = new Date().toISOString();
    const id = await ctx.db.insert("engagementSurveys", {
      title,
      description: args.description?.trim() || undefined,
      kind: args.kind,
      status: args.publishNow ? "active" : "draft",
      isAnonymous: args.isAnonymous,
      startDate: args.startDate,
      endDate: args.endDate,
      questions: args.questions,
      targetDepartment: args.targetDepartment,
      color: args.color,
      icon: args.icon,
      responseCount: 0,
      authorId: user._id,
      publishedAt: args.publishNow ? now : undefined,
    });
    if (args.publishNow) {
      await notifyAllUsers(ctx, {
        type: "engagement_survey",
        title: "Survei baru: " + title,
        message: `Mohon luangkan waktu untuk mengisi survei ${args.kind === "wellness" ? "wellness" : "engagement"} kami.`,
        link: `/engagement?id=${id}`,
        actorId: user._id,
      });
    }
    return id;
  },
});

export const updateSurvey = mutation({
  args: {
    surveyId: v.id("engagementSurveys"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    kind: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    questions: v.optional(v.array(questionValidator)),
    targetDepartment: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Survei tidak ditemukan",
      });
    }
    if (survey.status === "active" && args.questions !== undefined) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          "Pertanyaan tidak dapat diubah setelah survei aktif. Tutup dulu survei.",
      });
    }
    await ctx.db.patch(args.surveyId, {
      title: args.title?.trim() || survey.title,
      description: args.description?.trim(),
      kind: args.kind ?? survey.kind,
      isAnonymous: args.isAnonymous ?? survey.isAnonymous,
      startDate: args.startDate ?? survey.startDate,
      endDate: args.endDate ?? survey.endDate,
      questions: args.questions ?? survey.questions,
      targetDepartment: args.targetDepartment ?? survey.targetDepartment,
      color: args.color ?? survey.color,
      icon: args.icon ?? survey.icon,
    });
    return null;
  },
});

export const publishSurvey = mutation({
  args: { surveyId: v.id("engagementSurveys") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Survei tidak ditemukan",
      });
    }
    await ctx.db.patch(args.surveyId, {
      status: "active",
      publishedAt: new Date().toISOString(),
    });
    await notifyAllUsers(ctx, {
      type: "engagement_survey",
      title: "Survei baru: " + survey.title,
      message: `Mohon luangkan waktu untuk mengisi survei ${survey.kind === "wellness" ? "wellness" : "engagement"} kami.`,
      link: `/engagement?id=${args.surveyId}`,
      actorId: user._id,
    });
    return null;
  },
});

export const closeSurvey = mutation({
  args: { surveyId: v.id("engagementSurveys") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Survei tidak ditemukan",
      });
    }
    await ctx.db.patch(args.surveyId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const removeSurvey = mutation({
  args: { surveyId: v.id("engagementSurveys") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireAdmin(user);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Survei tidak ditemukan",
      });
    }
    const responses = await ctx.db
      .query("engagementResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();
    for (const r of responses) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.surveyId);
    return null;
  },
});

// Engagement / wellness stats ------------------------------------------------

export type EngagementStats = {
  activeSurveys: number;
  totalResponses: number;
  averageScore: number | null;
  participationRate: number; // 0..100
  mySurveysPending: number;
  mySurveysCompleted: number;
  myLatestMood: number | null;
  myStreakDays: number;
};

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<EngagementStats> => {
    const user = await requireUser(ctx);
    const surveys = await ctx.db.query("engagementSurveys").collect();
    const activeSurveys = surveys.filter((s) => s.status === "active");

    let totalResponses = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    for (const s of surveys) {
      totalResponses += s.responseCount;
      if (s.averageScore !== undefined) {
        scoreSum += s.averageScore;
        scoreCount += 1;
      }
    }

    // Participation: average responseCount / totalUsers across active surveys
    const totalUsers = (await ctx.db.query("users").collect()).length;
    let participationRate = 0;
    if (activeSurveys.length > 0 && totalUsers > 0) {
      const rates = activeSurveys.map((s) =>
        Math.min(100, Math.round((s.responseCount / totalUsers) * 100)),
      );
      participationRate = Math.round(
        rates.reduce((a, b) => a + b, 0) / rates.length,
      );
    }

    // Pending/completed for current user
    let mySurveysPending = 0;
    let mySurveysCompleted = 0;
    for (const s of activeSurveys) {
      if (!matchesDepartment(s, user)) continue;
      const myResp = await ctx.db
        .query("engagementResponses")
        .withIndex("by_survey_and_user", (q) =>
          q.eq("surveyId", s._id).eq("userId", user._id),
        )
        .first();
      if (myResp) mySurveysCompleted += 1;
      else mySurveysPending += 1;
    }

    // Latest wellness check-in mood
    const latestMood = await ctx.db
      .query("wellnessCheckins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();

    // Compute streak (consecutive days including today)
    const myCheckins = await ctx.db
      .query("wellnessCheckins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(60);
    const datesSet = new Set(myCheckins.map((c) => c.date));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (datesSet.has(iso)) {
        streak += 1;
      } else {
        break;
      }
    }

    return {
      activeSurveys: activeSurveys.length,
      totalResponses,
      averageScore:
        scoreCount === 0
          ? null
          : Math.round((scoreSum / scoreCount) * 10) / 10,
      participationRate,
      mySurveysPending,
      mySurveysCompleted,
      myLatestMood: latestMood?.moodScore ?? null,
      myStreakDays: streak,
    };
  },
});

// Wellness check-ins ---------------------------------------------------------

export type WellnessCheckinItem = {
  _id: Id<"wellnessCheckins">;
  _creationTime: number;
  moodScore: number;
  energyScore: number | null;
  stressScore: number | null;
  workloadScore: number | null;
  note: string | null;
  tags: Array<string>;
  date: string;
  checkedInAt: string;
};

function toCheckinItem(c: Doc<"wellnessCheckins">): WellnessCheckinItem {
  return {
    _id: c._id,
    _creationTime: c._creationTime,
    moodScore: c.moodScore,
    energyScore: c.energyScore ?? null,
    stressScore: c.stressScore ?? null,
    workloadScore: c.workloadScore ?? null,
    note: c.note ?? null,
    tags: c.tags,
    date: c.date,
    checkedInAt: c.checkedInAt,
  };
}

export const listMyWellnessCheckins = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<WellnessCheckinItem>> => {
    const user = await requireUser(ctx);
    const limit = Math.min(args.limit ?? 60, 180);
    const rows = await ctx.db
      .query("wellnessCheckins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return rows.map(toCheckinItem);
  },
});

export const getTodayWellness = query({
  args: {},
  handler: async (ctx): Promise<WellnessCheckinItem | null> => {
    const user = await requireUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
      .query("wellnessCheckins")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", today),
      )
      .first();
    return row ? toCheckinItem(row) : null;
  },
});

export type WellnessSummary = {
  averageMood: number | null;
  averageEnergy: number | null;
  averageStress: number | null;
  averageWorkload: number | null;
  totalCheckins: number;
  streakDays: number;
  last14Days: Array<{ date: string; moodScore: number | null }>;
  tagCounts: Array<{ tag: string; count: number }>;
};

export const getWellnessSummary = query({
  args: {},
  handler: async (ctx): Promise<WellnessSummary> => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("wellnessCheckins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(180);

    const avg = (key: keyof Doc<"wellnessCheckins">): number | null => {
      const vals = rows
        .map((r) => r[key])
        .filter(
          (val): val is number => typeof val === "number" && !Number.isNaN(val),
        );
      if (vals.length === 0) return null;
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) /
        10;
    };

    // last 14 days (oldest -> newest)
    const last14Days: Array<{ date: string; moodScore: number | null }> = [];
    const dateToMood = new Map<string, number>();
    for (const r of rows) dateToMood.set(r.date, r.moodScore);
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      last14Days.push({ date: iso, moodScore: dateToMood.get(iso) ?? null });
    }

    // Streak
    let streakDays = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (dateToMood.has(iso)) streakDays += 1;
      else break;
    }

    // Tags
    const tagMap = new Map<string, number>();
    for (const r of rows) {
      for (const t of r.tags) {
        tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
      }
    }
    const tagCounts = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      averageMood: avg("moodScore"),
      averageEnergy: avg("energyScore"),
      averageStress: avg("stressScore"),
      averageWorkload: avg("workloadScore"),
      totalCheckins: rows.length,
      streakDays,
      last14Days,
      tagCounts,
    };
  },
});

export const recordWellness = mutation({
  args: {
    moodScore: v.number(),
    energyScore: v.optional(v.number()),
    stressScore: v.optional(v.number()),
    workloadScore: v.optional(v.number()),
    note: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"wellnessCheckins">> => {
    const user = await requireUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    if (args.moodScore < 1 || args.moodScore > 5) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Mood harus antara 1-5",
      });
    }
    // Upsert for today - replace existing
    const existing = await ctx.db
      .query("wellnessCheckins")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", today),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        moodScore: args.moodScore,
        energyScore: args.energyScore,
        stressScore: args.stressScore,
        workloadScore: args.workloadScore,
        note: args.note?.trim() || undefined,
        tags: args.tags,
        checkedInAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("wellnessCheckins", {
      userId: user._id,
      moodScore: args.moodScore,
      energyScore: args.energyScore,
      stressScore: args.stressScore,
      workloadScore: args.workloadScore,
      note: args.note?.trim() || undefined,
      tags: args.tags,
      date: today,
      checkedInAt: now,
    });
  },
});

export const removeWellnessCheckin = mutation({
  args: { id: v.id("wellnessCheckins") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    if (row.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan check-in Anda",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
