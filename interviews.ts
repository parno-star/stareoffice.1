import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireRecruiter } from "./_helpers";
import { notifyUser } from "../notifications";

export type InterviewWithMeta = Doc<"recruitmentInterviews"> & {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  interviewerNames: Array<string>;
};

function candidateDisplayName(c: Doc<"candidates">): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

const VALID_TYPES = [
  "screening",
  "technical",
  "behavioral",
  "culture_fit",
  "final",
  "other",
] as const;

const VALID_FORMATS = ["online", "onsite", "phone"] as const;

const VALID_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

async function enrichInterview(
  ctx: { db: { get: (id: Id<"candidates"> | Id<"recruitmentJobs"> | Id<"users">) => Promise<unknown> } },
  iv: Doc<"recruitmentInterviews">,
): Promise<InterviewWithMeta> {
  const candidate = (await ctx.db.get(iv.candidateId)) as Doc<"candidates"> | null;
  const job = (await ctx.db.get(iv.jobId)) as Doc<"recruitmentJobs"> | null;
  const interviewerNames: Array<string> = [];
  for (const uid of iv.interviewerIds) {
    const u = (await ctx.db.get(uid)) as Doc<"users"> | null;
    if (u?.name) interviewerNames.push(u.name);
  }
  return {
    ...iv,
    candidateName: candidate ? candidateDisplayName(candidate) : "—",
    candidateEmail: candidate?.email ?? "",
    jobTitle: job?.title ?? "Lowongan dihapus",
    interviewerNames,
  };
}

export const listForApplication = query({
  args: { applicationId: v.id("candidateApplications") },
  handler: async (ctx, args): Promise<Array<InterviewWithMeta>> => {
    await requireRecruiter(ctx);
    const rows = await ctx.db
      .query("recruitmentInterviews")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .order("desc")
      .take(100);
    const results: Array<InterviewWithMeta> = [];
    for (const iv of rows) {
      results.push(await enrichInterview(ctx, iv));
    }
    return results;
  },
});

export const listUpcoming = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<InterviewWithMeta>> => {
    await requireRecruiter(ctx);
    const now = new Date();
    const daysAhead = args.days ?? 14;
    const limit = new Date(now);
    limit.setDate(limit.getDate() + daysAhead);
    const rows = await ctx.db
      .query("recruitmentInterviews")
      .withIndex("by_scheduled")
      .order("asc")
      .take(400);
    const filtered = rows.filter((r) => {
      if (r.status !== "scheduled") return false;
      const dt = new Date(r.scheduledAt);
      return dt >= now && dt <= limit;
    });
    const results: Array<InterviewWithMeta> = [];
    for (const iv of filtered) {
      results.push(await enrichInterview(ctx, iv));
    }
    return results;
  },
});

export const schedule = mutation({
  args: {
    applicationId: v.id("candidateApplications"),
    title: v.string(),
    interviewType: v.string(),
    format: v.string(),
    scheduledAt: v.string(),
    durationMinutes: v.number(),
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    interviewerIds: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"recruitmentInterviews">> => {
    const user = await requireRecruiter(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Lamaran tidak ditemukan",
      });
    }
    if (!VALID_TYPES.includes(args.interviewType as (typeof VALID_TYPES)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe interview tidak valid",
      });
    }
    if (!VALID_FORMATS.includes(args.format as (typeof VALID_FORMATS)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Format interview tidak valid",
      });
    }
    if (!args.title.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul interview wajib diisi",
      });
    }
    if (Number.isNaN(new Date(args.scheduledAt).getTime())) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal jadwal tidak valid",
      });
    }
    if (args.durationMinutes <= 0 || args.durationMinutes > 720) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Durasi harus antara 1-720 menit",
      });
    }
    const id = await ctx.db.insert("recruitmentInterviews", {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      jobId: app.jobId,
      title: args.title.trim(),
      interviewType: args.interviewType,
      format: args.format,
      scheduledAt: args.scheduledAt,
      durationMinutes: Math.round(args.durationMinutes),
      meetingUrl: args.meetingUrl?.trim() || undefined,
      location: args.location?.trim() || undefined,
      interviewerIds: args.interviewerIds,
      status: "scheduled",
      createdById: user._id,
    });

    // Move application to "interview" if still in earlier stage
    if (app.stage === "applied" || app.stage === "sourced" || app.stage === "screening") {
      await ctx.db.patch(app._id, {
        stage: "interview",
        lastActivityAt: new Date().toISOString(),
      });
    }
    // Notify assigned interviewers
    const job = await ctx.db.get(app.jobId);
    const candidate = await ctx.db.get(app.candidateId);
    const candidateName = candidate ? candidateDisplayName(candidate) : "Kandidat";
    for (const uid of args.interviewerIds) {
      if (uid === user._id) continue;
      await notifyUser(ctx, {
        userId: uid,
        type: "recruitment_interview",
        title: "Anda dijadwalkan sebagai pewawancara",
        message: `${candidateName} - ${job?.title ?? "Lowongan"}`,
        link: "/recruitment",
        actorId: user._id,
      });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("recruitmentInterviews"),
    title: v.string(),
    interviewType: v.string(),
    format: v.string(),
    scheduledAt: v.string(),
    durationMinutes: v.number(),
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    interviewerIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    const iv = await ctx.db.get(args.id);
    if (!iv) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Interview tidak ditemukan",
      });
    }
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      interviewType: args.interviewType,
      format: args.format,
      scheduledAt: args.scheduledAt,
      durationMinutes: Math.round(args.durationMinutes),
      meetingUrl: args.meetingUrl?.trim() || undefined,
      location: args.location?.trim() || undefined,
      interviewerIds: args.interviewerIds,
    });
    return null;
  },
});

export const setOutcome = mutation({
  args: {
    id: v.id("recruitmentInterviews"),
    status: v.string(),
    outcomeNote: v.optional(v.string()),
    overallScore: v.optional(v.number()),
    recommendation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    if (!VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const iv = await ctx.db.get(args.id);
    if (!iv) return null;
    const patch: Partial<Doc<"recruitmentInterviews">> = {
      status: args.status,
      outcomeNote: args.outcomeNote?.trim() || undefined,
      overallScore: args.overallScore,
      recommendation: args.recommendation,
    };
    if (args.status === "completed") {
      patch.completedAt = new Date().toISOString();
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("recruitmentInterviews") },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});
