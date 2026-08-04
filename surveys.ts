import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Course survey: post-course feedback questions.

export const getSurvey = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (Doc<"courseSurveys"> & {
        hasResponded: boolean;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const survey = await ctx.db
      .query("courseSurveys")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    if (!survey) return null;
    const existing = await ctx.db
      .query("courseSurveyResponses")
      .withIndex("by_survey_and_user", (q) =>
        q.eq("surveyId", survey._id).eq("userId", user._id),
      )
      .unique();
    return { ...survey, hasResponded: existing !== null };
  },
});

export const upsertSurvey = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        type: v.string(),
        options: v.optional(v.array(v.string())),
        required: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("courseSurveys")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title.trim(),
        description: args.description?.trim() || undefined,
        isActive: args.isActive,
        questions: args.questions,
      });
      return existing._id;
    }
    return await ctx.db.insert("courseSurveys", {
      courseId: args.courseId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      isActive: args.isActive,
      questions: args.questions,
      authorId: admin._id,
      responseCount: 0,
    });
  },
});

export const removeSurvey = mutation({
  args: { id: v.id("courseSurveys") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const responses = await ctx.db
      .query("courseSurveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
      .collect();
    for (const r of responses) await ctx.db.delete(r._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

export const submitResponse = mutation({
  args: {
    surveyId: v.id("courseSurveys"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey || !survey.isActive) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Survei tidak aktif",
      });
    }
    const existing = await ctx.db
      .query("courseSurveyResponses")
      .withIndex("by_survey_and_user", (q) =>
        q.eq("surveyId", args.surveyId).eq("userId", user._id),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        answers: args.answers,
        submittedAt: new Date().toISOString(),
      });
      return null;
    }
    await ctx.db.insert("courseSurveyResponses", {
      surveyId: args.surveyId,
      courseId: survey.courseId,
      userId: user._id,
      answers: args.answers,
      submittedAt: new Date().toISOString(),
    });
    await ctx.db.patch(args.surveyId, {
      responseCount: survey.responseCount + 1,
    });
    return null;
  },
});

export const getSurveyResponses = query({
  args: { surveyId: v.id("courseSurveys") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    survey: Doc<"courseSurveys"> | null;
    responses: Array<{
      _id: Id<"courseSurveyResponses">;
      userName: string | null;
      userDepartment: string | null;
      answers: Array<{ questionId: string; value: string }>;
      submittedAt: string;
    }>;
  }> => {
    await requireAdmin(ctx);
    const survey = await ctx.db.get(args.surveyId);
    if (!survey) return { survey: null, responses: [] };
    const responses = await ctx.db
      .query("courseSurveyResponses")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();
    const out: Array<{
      _id: Id<"courseSurveyResponses">;
      userName: string | null;
      userDepartment: string | null;
      answers: Array<{ questionId: string; value: string }>;
      submittedAt: string;
    }> = [];
    for (const r of responses) {
      const u = await ctx.db.get(r.userId);
      out.push({
        _id: r._id,
        userName: u?.name ?? null,
        userDepartment: u?.department ?? null,
        answers: r.answers,
        submittedAt: r.submittedAt,
      });
    }
    out.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
    return { survey, responses: out };
  },
});
