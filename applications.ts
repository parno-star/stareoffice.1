import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import {
  requireRecruiter,
  canManageRecruitment,
  ACTIVE_STAGES,
  RECRUITMENT_STAGES,
  type RecruitmentStage,
} from "./_helpers";

export type ApplicationWithMeta = Doc<"candidateApplications"> & {
  candidateName: string;
  candidateEmail: string;
  candidateResumeUrl: string | null;
  candidateCurrentTitle: string | null;
  jobTitle: string;
  jobDepartment: string;
  jobStatus: string;
};

function candidateDisplayName(c: Doc<"candidates">): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

async function enrichApp(
  ctx: {
    db: {
      get: <T extends "candidates" | "recruitmentJobs">(
        id: Id<T>,
      ) => Promise<Doc<T> | null>;
    };
    storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> };
  },
  app: Doc<"candidateApplications">,
): Promise<ApplicationWithMeta> {
  const candidate = await ctx.db.get(app.candidateId);
  const job = await ctx.db.get(app.jobId);
  const resumeUrl = candidate?.resumeStorageId
    ? await ctx.storage.getUrl(candidate.resumeStorageId)
    : null;
  return {
    ...app,
    candidateName: candidate ? candidateDisplayName(candidate) : "—",
    candidateEmail: candidate?.email ?? "",
    candidateResumeUrl: resumeUrl,
    candidateCurrentTitle: candidate?.currentTitle ?? null,
    jobTitle: job?.title ?? "Lowongan dihapus",
    jobDepartment: job?.department ?? "",
    jobStatus: job?.status ?? "closed",
  };
}

export const listForJob = query({
  args: {
    jobId: v.id("recruitmentJobs"),
    stage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ApplicationWithMeta>> => {
    await requireRecruiter(ctx);
    let apps: Array<Doc<"candidateApplications">>;
    if (args.stage && args.stage !== "all") {
      apps = await ctx.db
        .query("candidateApplications")
        .withIndex("by_job_and_stage", (q) =>
          q.eq("jobId", args.jobId).eq("stage", args.stage as string),
        )
        .order("desc")
        .take(500);
    } else {
      apps = await ctx.db
        .query("candidateApplications")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .order("desc")
        .take(500);
    }
    const results: Array<ApplicationWithMeta> = [];
    for (const a of apps) {
      results.push(await enrichApp(ctx, a));
    }
    return results;
  },
});

export const listForCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<Array<ApplicationWithMeta>> => {
    await requireRecruiter(ctx);
    const apps = await ctx.db
      .query("candidateApplications")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .order("desc")
      .take(200);
    const results: Array<ApplicationWithMeta> = [];
    for (const a of apps) {
      results.push(await enrichApp(ctx, a));
    }
    return results;
  },
});

export const getPipeline = query({
  args: { jobId: v.id("recruitmentJobs") },
  handler: async (
    ctx,
    args,
  ): Promise<Record<RecruitmentStage, Array<ApplicationWithMeta>>> => {
    await requireRecruiter(ctx);
    const apps = await ctx.db
      .query("candidateApplications")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(1000);
    const grouped: Record<RecruitmentStage, Array<ApplicationWithMeta>> = {
      sourced: [],
      applied: [],
      screening: [],
      interview: [],
      offer: [],
      hired: [],
      rejected: [],
      withdrawn: [],
    };
    for (const a of apps) {
      const enriched = await enrichApp(ctx, a);
      const stage = a.stage as RecruitmentStage;
      if (stage in grouped) {
        grouped[stage].push(enriched);
      }
    }
    return grouped;
  },
});

export const add = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("recruitmentJobs"),
    stage: v.optional(v.string()),
    coverLetter: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"candidateApplications">> => {
    const user = await requireRecruiter(ctx);
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kandidat tidak ditemukan",
      });
    }
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Lowongan tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("candidateApplications")
      .withIndex("by_candidate_and_job", (q) =>
        q.eq("candidateId", args.candidateId).eq("jobId", args.jobId),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Kandidat sudah terdaftar pada lowongan ini",
      });
    }
    const stage = (args.stage as RecruitmentStage) ?? "applied";
    if (!RECRUITMENT_STAGES.includes(stage)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Stage tidak valid",
      });
    }
    const now = new Date().toISOString();
    const id = await ctx.db.insert("candidateApplications", {
      candidateId: args.candidateId,
      jobId: args.jobId,
      stage,
      appliedAt: now,
      coverLetter: args.coverLetter?.trim() || undefined,
      source: args.source,
      lastActivityAt: now,
      addedById: user._id,
    });
    await ctx.db.patch(job._id, {
      candidateCount: job.candidateCount + 1,
    });
    await ctx.db.patch(candidate._id, {
      applicationCount: candidate.applicationCount + 1,
    });
    return id;
  },
});

export const setStage = mutation({
  args: {
    id: v.id("candidateApplications"),
    stage: v.string(),
    reason: v.optional(v.string()),
    offeredSalary: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    await applySetStage(ctx, args.id, args.stage, args.reason, args.offeredSalary);
    return null;
  },
});

// Core stage-change logic shared by single and bulk actions. Throws on invalid
// input; bulk callers catch and skip.
async function applySetStage(
  ctx: MutationCtx,
  id: Id<"candidateApplications">,
  rawStage: string,
  reason: string | undefined,
  offeredSalary: number | undefined,
): Promise<void> {
    const stage = rawStage as RecruitmentStage;
    if (!RECRUITMENT_STAGES.includes(stage)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Stage tidak valid",
      });
    }
    const app = await ctx.db.get(id);
    if (!app) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Lamaran tidak ditemukan",
      });
    }
    const now = new Date().toISOString();
    const patch: Partial<Doc<"candidateApplications">> = {
      stage,
      lastActivityAt: now,
    };
    if (stage === "offer") {
      patch.offerSentAt = now;
      if (offeredSalary !== undefined) {
        patch.offeredSalary = offeredSalary;
      }
    }
    if (stage === "hired") {
      patch.hiredAt = now;
      if (offeredSalary !== undefined) {
        patch.offeredSalary = offeredSalary;
      }
    }
    if (stage === "rejected") {
      patch.rejectedAt = now;
      patch.closedReason = reason?.trim() || undefined;
    }
    if (stage === "withdrawn") {
      patch.withdrawnAt = now;
      patch.closedReason = reason?.trim() || undefined;
    }
    await ctx.db.patch(id, patch);

    // Side effects: update candidate status and job counts
    const candidate = await ctx.db.get(app.candidateId);
    const job = await ctx.db.get(app.jobId);
    if (stage === "hired") {
      if (candidate) {
        await ctx.db.patch(candidate._id, { status: "hired" });
      }
      if (job) {
        const newHired = job.hiredCount + 1;
        const shouldClose = newHired >= job.headcount;
        await ctx.db.patch(job._id, {
          hiredCount: newHired,
          status: shouldClose ? "closed" : job.status,
        });
      }
    } else if ((app.stage as RecruitmentStage) === "hired") {
      // Demoted back - decrement hired count
      if (job) {
        await ctx.db.patch(job._id, {
          hiredCount: Math.max(0, job.hiredCount - 1),
        });
      }
    }
}

// Move many applications to a stage (e.g. bulk reject or advance). Skips any
// application that cannot be updated; never throws mid-loop.
export const bulkSetStage = mutation({
  args: {
    ids: v.array(v.id("candidateApplications")),
    stage: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    await requireRecruiter(ctx);
    const stage = args.stage as RecruitmentStage;
    if (!RECRUITMENT_STAGES.includes(stage)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Stage tidak valid",
      });
    }
    if (args.ids.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 lamaran per aksi",
      });
    }
    const reason = args.reason?.trim() ? args.reason.trim() : undefined;
    let count = 0;
    for (const id of args.ids) {
      try {
        await applySetStage(ctx, id, args.stage, reason, undefined);
        count += 1;
      } catch {
        continue;
      }
    }
    return { count };
  },
});

export const remove = mutation({
  args: { id: v.id("candidateApplications") },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    const app = await ctx.db.get(args.id);
    if (!app) return null;
    const notes = await ctx.db
      .query("recruitmentNotes")
      .withIndex("by_application", (q) => q.eq("applicationId", args.id))
      .collect();
    for (const n of notes) await ctx.db.delete(n._id);
    const interviews = await ctx.db
      .query("recruitmentInterviews")
      .withIndex("by_application", (q) => q.eq("applicationId", args.id))
      .collect();
    for (const iv of interviews) await ctx.db.delete(iv._id);
    const job = await ctx.db.get(app.jobId);
    const candidate = await ctx.db.get(app.candidateId);
    if (job) {
      await ctx.db.patch(job._id, {
        candidateCount: Math.max(0, job.candidateCount - 1),
      });
    }
    if (candidate) {
      await ctx.db.patch(candidate._id, {
        applicationCount: Math.max(0, candidate.applicationCount - 1),
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export type NoteWithAuthor = Doc<"recruitmentNotes"> & {
  authorName: string | null;
  authorAvatarUrl: string | null;
};

export const listNotes = query({
  args: { applicationId: v.id("candidateApplications") },
  handler: async (ctx, args): Promise<Array<NoteWithAuthor>> => {
    await requireRecruiter(ctx);
    const notes = await ctx.db
      .query("recruitmentNotes")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .order("desc")
      .take(200);
    const results: Array<NoteWithAuthor> = [];
    for (const n of notes) {
      const author = await ctx.db.get(n.authorId);
      results.push({
        ...n,
        authorName: author?.name ?? null,
        authorAvatarUrl: author?.avatarUrl ?? null,
      });
    }
    return results;
  },
});

export const addNote = mutation({
  args: {
    applicationId: v.id("candidateApplications"),
    kind: v.string(),
    content: v.string(),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireRecruiter(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Lamaran tidak ditemukan",
      });
    }
    const valid = ["note", "feedback", "screening", "reference"];
    if (!valid.includes(args.kind)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jenis catatan tidak valid",
      });
    }
    if (!args.content.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Isi catatan tidak boleh kosong",
      });
    }
    if (
      args.rating !== undefined &&
      (args.rating < 1 || args.rating > 5)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Rating harus 1-5",
      });
    }
    await ctx.db.insert("recruitmentNotes", {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      authorId: user._id,
      kind: args.kind,
      content: args.content.trim(),
      rating: args.rating,
    });
    // update application lastActivityAt
    await ctx.db.patch(app._id, {
      lastActivityAt: new Date().toISOString(),
    });
    // Update average rating if rating provided
    if (args.rating !== undefined) {
      const all = await ctx.db
        .query("recruitmentNotes")
        .withIndex("by_application", (q) =>
          q.eq("applicationId", args.applicationId),
        )
        .collect();
      const rated = all.filter((n) => typeof n.rating === "number");
      if (rated.length > 0) {
        const avg =
          rated.reduce((sum, n) => sum + (n.rating ?? 0), 0) / rated.length;
        await ctx.db.patch(app._id, {
          rating: Math.round(avg * 10) / 10,
        });
      }
    }
    return null;
  },
});

export const removeNote = mutation({
  args: { id: v.id("recruitmentNotes") },
  handler: async (ctx, args) => {
    const user = await requireRecruiter(ctx);
    const note = await ctx.db.get(args.id);
    if (!note) return null;
    if (note.authorId !== user._id && user.role !== "super_admin" && user.role !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya penulis atau admin yang dapat menghapus",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

export const getById = query({
  args: { id: v.id("candidateApplications") },
  handler: async (ctx, args): Promise<ApplicationWithMeta | null> => {
    await requireRecruiter(ctx);
    const app = await ctx.db.get(args.id);
    if (!app) return null;
    return await enrichApp(ctx, app);
  },
});

// Lightweight sidebar badge count for "Rekrutmen & ATS".
// For recruiters/hiring managers: number of applications still active in the
// pipeline (sourced/applied/screening/interview/offer) within their scope.
// Others get 0. Never throws.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return 0;
    if (!canManageRecruitment(user.role)) return 0;

    const isSuperAdmin = user.role === "super_admin";
    const orgId = isSuperAdmin
      ? (user.viewingOrganizationId ?? null)
      : (user.organizationId ?? null);

    const activeStages: ReadonlyArray<string> = ACTIVE_STAGES;
    let total = 0;
    for (const stage of activeStages) {
      const rows = await ctx.db
        .query("candidateApplications")
        .withIndex("by_stage", (q) => q.eq("stage", stage))
        .take(500);
      total +=
        orgId === null
          ? rows.length
          : rows.filter((a) => a.organizationId === orgId).length;
    }
    return total;
  },
});
