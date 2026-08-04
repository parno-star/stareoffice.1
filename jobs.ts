import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";
import { canManageTeam, isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

export type JobWithMeta = Doc<"jobPostings"> & {
  postedByName: string | null;
  hiringManagerName: string | null;
  myApplicationId: Id<"jobApplications"> | null;
  myApplicationStatus: string | null;
};

export type ApplicationWithUser = Doc<"jobApplications"> & {
  applicantName: string | null;
  applicantAvatar: string | null;
  applicantEmail: string | null;
  applicantJobTitle: string | null;
  applicantDepartment: string | null;
  reviewerName: string | null;
  resumeUrl: string | null;
  jobTitle: string | null;
  jobDepartment: string | null;
  jobStatus: string | null;
};

function canPostJobs(role: string | undefined | null): boolean {
  return isAdminRole(role) || canManageTeam(role);
}

const VALID_EMPLOYMENT_TYPES = [
  "fulltime",
  "parttime",
  "contract",
  "internship",
  "temporary",
] as const;

const VALID_LEVELS = [
  "entry",
  "mid",
  "senior",
  "lead",
  "manager",
] as const;

const VALID_APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
] as const;

async function myApplicationFor(
  ctx: QueryCtx,
  jobId: Id<"jobPostings">,
  userId: Id<"users">,
): Promise<Doc<"jobApplications"> | null> {
  return await ctx.db
    .query("jobApplications")
    .withIndex("by_job_and_applicant", (q) =>
      q.eq("jobId", jobId).eq("applicantId", userId),
    )
    .unique();
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireTenant(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ---- Job postings ------------------------------------------------------

export const list = query({
  args: {
    status: v.optional(v.string()), // "all" | "open" | "closed"
    department: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<JobWithMeta>> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const statusFilter = args.status ?? "open";

    let jobs: Array<Doc<"jobPostings">>;
    const search = args.search?.trim();
    if (search && search.length > 0) {
      jobs = await ctx.db
        .query("jobPostings")
        .withSearchIndex("search_title", (q) => {
          let sq = q.search("title", search);
          if (statusFilter !== "all") {
            sq = sq.eq("status", statusFilter);
          }
          if (args.department && args.department !== "all") {
            sq = sq.eq("department", args.department);
          }
          return sq;
        })
        .take(200);
      // Apply org filter in-memory for search results
      if (organizationId !== null) {
        jobs = jobs.filter((j) => j.organizationId === organizationId);
      }
    } else if (organizationId !== null) {
      // Org-scoped path: use by_organization index, filter status/dept in memory
      jobs = await ctx.db
        .query("jobPostings")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(200);
      if (statusFilter !== "all") {
        jobs = jobs.filter((j) => j.status === statusFilter);
      }
      if (args.department && args.department !== "all") {
        jobs = jobs.filter((j) => j.department === args.department);
      }
    } else if (statusFilter === "all") {
      jobs = await ctx.db.query("jobPostings").order("desc").take(200);
      if (args.department && args.department !== "all") {
        jobs = jobs.filter((j) => j.department === args.department);
      }
    } else {
      jobs = await ctx.db
        .query("jobPostings")
        .withIndex("by_status", (q) => q.eq("status", statusFilter))
        .order("desc")
        .take(200);
      if (args.department && args.department !== "all") {
        jobs = jobs.filter((j) => j.department === args.department);
      }
    }

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };

    const results: Array<JobWithMeta> = [];
    for (const job of jobs) {
      const postedBy = await getUser(job.postedById);
      const hiringManager = job.hiringManagerId
        ? await getUser(job.hiringManagerId)
        : null;
      const myApp = await myApplicationFor(ctx, job._id, user._id);
      results.push({
        ...job,
        postedByName: postedBy?.name ?? null,
        hiringManagerName: hiringManager?.name ?? null,
        myApplicationId: myApp?._id ?? null,
        myApplicationStatus: myApp?.status ?? null,
      });
    }
    return results;
  },
});

export const getById = query({
  args: { id: v.id("jobPostings") },
  handler: async (ctx, args): Promise<JobWithMeta | null> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const job = await ctx.db.get(args.id);
    if (!job) return null;
    const postedBy = await ctx.db.get(job.postedById);
    const hiringManager = job.hiringManagerId
      ? await ctx.db.get(job.hiringManagerId)
      : null;
    const myApp = await myApplicationFor(ctx, job._id, user._id);
    return {
      ...job,
      postedByName: postedBy?.name ?? null,
      hiringManagerName: hiringManager?.name ?? null,
      myApplicationId: myApp?._id ?? null,
      myApplicationStatus: myApp?.status ?? null,
    };
  },
});

export const listDepartments = query({
  args: {},
  handler: async (ctx): Promise<Array<string>> => {
    const { organizationId } = await requireTenant(ctx);
    let jobs: Array<Doc<"jobPostings">>;
    if (organizationId !== null) {
      jobs = await ctx.db
        .query("jobPostings")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .take(500);
    } else {
      jobs = await ctx.db.query("jobPostings").take(500);
    }
    const set = new Set<string>();
    for (const j of jobs) {
      if (j.department.trim()) set.add(j.department.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    openCount: number;
    totalCount: number;
    myApplicationCount: number;
    pendingReviewCount: number;
    canPost: boolean;
  }> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

    let open: Array<Doc<"jobPostings">>;
    let all: Array<Doc<"jobPostings">>;
    if (organizationId !== null) {
      const orgJobs = await ctx.db
        .query("jobPostings")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .take(500);
      open = orgJobs.filter((j) => j.status === "open");
      all = orgJobs;
    } else {
      open = await ctx.db
        .query("jobPostings")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .take(500);
      all = await ctx.db.query("jobPostings").take(500);
    }

    const myApps = await ctx.db
      .query("jobApplications")
      .withIndex("by_applicant", (q) => q.eq("applicantId", user._id))
      .take(200);

    // For posters, count applications that are still actionable (submitted/reviewing/interview)
    let pendingReviewCount = 0;
    if (canPostJobs(user.role)) {
      // Look at submitted & reviewing & interview across all jobs
      for (const st of ["submitted", "reviewing", "interview"] as const) {
        const byStatus = await ctx.db
          .query("jobApplications")
          .filter((q) => q.eq(q.field("status"), st))
          .take(300);
        // Filter by org when scoped
        const orgFiltered =
          organizationId !== null
            ? byStatus.filter((a) => a.organizationId === organizationId)
            : byStatus;
        pendingReviewCount += orgFiltered.length;
      }
    }

    return {
      openCount: open.length,
      totalCount: all.length,
      myApplicationCount: myApps.length,
      pendingReviewCount,
      canPost: canPostJobs(user.role),
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    department: v.string(),
    location: v.string(),
    employmentType: v.string(),
    level: v.string(),
    description: v.string(),
    responsibilities: v.string(),
    requirements: v.string(),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    closingDate: v.optional(v.string()),
    hiringManagerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"jobPostings">> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canPostJobs(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau atasan yang dapat memposting lowongan",
      });
    }

    const title = args.title.trim();
    const department = args.department.trim();
    const location = args.location.trim();
    if (!title) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul lowongan wajib diisi",
      });
    }
    if (!department) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Departemen wajib diisi",
      });
    }
    if (!location) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Lokasi kerja wajib diisi",
      });
    }
    if (!VALID_EMPLOYMENT_TYPES.includes(args.employmentType as typeof VALID_EMPLOYMENT_TYPES[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe pekerjaan tidak valid",
      });
    }
    if (!VALID_LEVELS.includes(args.level as typeof VALID_LEVELS[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Level posisi tidak valid",
      });
    }
    if (args.closingDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.closingDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal penutupan tidak valid",
      });
    }
    if (
      args.salaryMin !== undefined &&
      args.salaryMax !== undefined &&
      args.salaryMin > args.salaryMax
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Gaji minimum tidak boleh lebih besar dari maksimum",
      });
    }

    const id = await ctx.db.insert("jobPostings", {
      title,
      department,
      location,
      employmentType: args.employmentType,
      level: args.level,
      description: args.description.trim(),
      responsibilities: args.responsibilities.trim(),
      requirements: args.requirements.trim(),
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      closingDate: args.closingDate,
      status: "open",
      postedById: user._id,
      hiringManagerId: args.hiringManagerId,
      applicationCount: 0,
      organizationId: organizationId ?? undefined,
    });

    // Broadcast new opening to all employees in the same org (exclude the poster)
    let usersToNotify: Array<Doc<"users">>;
    if (organizationId !== null) {
      usersToNotify = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    } else {
      usersToNotify = await ctx.db.query("users").collect();
    }
    for (const u of usersToNotify) {
      if (u._id === user._id) continue;
      await ctx.db.insert("notifications", {
        userId: u._id,
        type: "job_new",
        title: "Lowongan internal baru",
        message: `${title} - ${department}`,
        link: `/jobs/${id}`,
        actorId: user._id,
        organizationId: organizationId ?? undefined,
      });
    }

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("jobPostings"),
    title: v.string(),
    department: v.string(),
    location: v.string(),
    employmentType: v.string(),
    level: v.string(),
    description: v.string(),
    responsibilities: v.string(),
    requirements: v.string(),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    closingDate: v.optional(v.string()),
    hiringManagerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lowongan tidak ditemukan" });
    }
    const isOwner = job.postedById === user._id;
    if (!isOwner && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pemilik atau admin yang dapat mengubah lowongan",
      });
    }
    if (!VALID_EMPLOYMENT_TYPES.includes(args.employmentType as typeof VALID_EMPLOYMENT_TYPES[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tipe pekerjaan tidak valid",
      });
    }
    if (!VALID_LEVELS.includes(args.level as typeof VALID_LEVELS[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Level posisi tidak valid",
      });
    }
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      department: args.department.trim(),
      location: args.location.trim(),
      employmentType: args.employmentType,
      level: args.level,
      description: args.description.trim(),
      responsibilities: args.responsibilities.trim(),
      requirements: args.requirements.trim(),
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      closingDate: args.closingDate,
      hiringManagerId: args.hiringManagerId,
    });
    return null;
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("jobPostings"),
    status: v.string(), // "open" | "closed"
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lowongan tidak ditemukan" });
    }
    const isOwner = job.postedById === user._id;
    if (!isOwner && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pemilik atau admin yang dapat menutup lowongan",
      });
    }
    if (args.status !== "open" && args.status !== "closed") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const job = await ctx.db.get(args.id);
    if (!job) return null;
    const isOwner = job.postedById === user._id;
    if (!isOwner && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin",
      });
    }

    // Delete all applications + attached resumes
    const apps = await ctx.db
      .query("jobApplications")
      .withIndex("by_job", (q) => q.eq("jobId", args.id))
      .take(1000);
    for (const a of apps) {
      if (a.resumeStorageId) {
        await ctx.storage.delete(a.resumeStorageId);
      }
      await ctx.db.delete(a._id);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- Applications ------------------------------------------------------

export const apply = mutation({
  args: {
    jobId: v.id("jobPostings"),
    coverLetter: v.string(),
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"jobApplications">> => {
    const { userId, organizationId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lowongan tidak ditemukan" });
    }
    if (job.status !== "open") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Lowongan ini sudah ditutup",
      });
    }
    const cover = args.coverLetter.trim();
    if (cover.length < 20) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Surat lamaran terlalu singkat (minimum 20 karakter)",
      });
    }
    const existing = await myApplicationFor(ctx, job._id, user._id);
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Anda sudah melamar untuk lowongan ini",
      });
    }
    const id = await ctx.db.insert("jobApplications", {
      jobId: job._id,
      applicantId: user._id,
      coverLetter: cover,
      resumeStorageId: args.resumeStorageId,
      resumeFileName: args.resumeFileName,
      status: "submitted",
      organizationId: organizationId ?? undefined,
    });
    await ctx.db.patch(job._id, {
      applicationCount: job.applicationCount + 1,
    });

    await notifyUser(ctx, {
      userId: job.postedById,
      type: "job_application_new",
      title: "Lamaran internal baru",
      message: `${user.name ?? "Karyawan"} melamar ${job.title}`,
      link: `/jobs/${job._id}`,
      actorId: user._id,
    });
    if (job.hiringManagerId && job.hiringManagerId !== job.postedById) {
      await notifyUser(ctx, {
        userId: job.hiringManagerId,
        type: "job_application_new",
        title: "Lamaran internal baru",
        message: `${user.name ?? "Karyawan"} melamar ${job.title}`,
        link: `/jobs/${job._id}`,
        actorId: user._id,
      });
    }
    return id;
  },
});

export const withdraw = mutation({
  args: { id: v.id("jobApplications") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const app = await ctx.db.get(args.id);
    if (!app) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lamaran tidak ditemukan" });
    }
    if (app.applicantId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda hanya dapat menarik lamaran sendiri",
      });
    }
    if (app.status === "accepted" || app.status === "rejected") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Lamaran yang sudah diproses tidak dapat ditarik",
      });
    }
    await ctx.db.patch(args.id, {
      status: "withdrawn",
    });
    return null;
  },
});

export const review = mutation({
  args: {
    id: v.id("jobApplications"),
    status: v.string(), // reviewing | interview | accepted | rejected
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    if (!canPostJobs(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin atau atasan yang dapat meninjau lamaran",
      });
    }
    if (!VALID_APPLICATION_STATUSES.includes(args.status as typeof VALID_APPLICATION_STATUSES[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status lamaran tidak valid",
      });
    }
    if (args.status === "withdrawn" || args.status === "submitted") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tersebut tidak dapat diatur manual",
      });
    }
    const app = await ctx.db.get(args.id);
    if (!app) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lamaran tidak ditemukan" });
    }
    const job = await ctx.db.get(app.jobId);
    if (!job) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lowongan tidak ditemukan" });
    }
    const isOwner = job.postedById === user._id;
    const isHiringManager = job.hiringManagerId === user._id;
    if (!isOwner && !isHiringManager && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin untuk meninjau lowongan ini",
      });
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewerId: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNote: args.note?.trim() || undefined,
    });

    const STATUS_MESSAGES: Record<string, string> = {
      reviewing: "Lamaran Anda sedang ditinjau",
      interview: "Anda diundang ke tahap interview",
      accepted: "Selamat! Lamaran Anda diterima",
      rejected: "Lamaran Anda belum dapat kami lanjutkan",
    };
    await notifyUser(ctx, {
      userId: app.applicantId,
      type: "job_application_status",
      title: STATUS_MESSAGES[args.status] ?? "Status lamaran diperbarui",
      message: `${job.title}${args.note ? ` · ${args.note}` : ""}`,
      link: `/jobs/${job._id}`,
      actorId: user._id,
    });
    return null;
  },
});

export const listApplicationsForJob = query({
  args: {
    jobId: v.id("jobPostings"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<ApplicationWithUser>> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Lowongan tidak ditemukan" });
    }
    const isOwner = job.postedById === user._id;
    const isHiringManager = job.hiringManagerId === user._id;
    if (!isOwner && !isHiringManager && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak memiliki izin untuk melihat pelamar",
      });
    }
    let apps: Array<Doc<"jobApplications">>;
    if (args.status && args.status !== "all") {
      apps = await ctx.db
        .query("jobApplications")
        .withIndex("by_job_and_status", (q) =>
          q.eq("jobId", args.jobId).eq("status", args.status as string),
        )
        .order("desc")
        .take(300);
    } else {
      apps = await ctx.db
        .query("jobApplications")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .order("desc")
        .take(300);
    }
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };
    const results: Array<ApplicationWithUser> = [];
    for (const a of apps) {
      const applicant = await getUser(a.applicantId);
      const reviewer = a.reviewerId ? await getUser(a.reviewerId) : null;
      const resumeUrl = a.resumeStorageId
        ? await ctx.storage.getUrl(a.resumeStorageId)
        : null;
      results.push({
        ...a,
        applicantName: applicant?.name ?? null,
        applicantAvatar: applicant?.avatarUrl ?? null,
        applicantEmail: applicant?.email ?? null,
        applicantJobTitle: applicant?.jobTitle ?? null,
        applicantDepartment: applicant?.department ?? null,
        reviewerName: reviewer?.name ?? null,
        resumeUrl,
        jobTitle: job.title,
        jobDepartment: job.department,
        jobStatus: job.status,
      });
    }
    return results;
  },
});

export const listMyApplications = query({
  args: {},
  handler: async (ctx): Promise<Array<ApplicationWithUser>> => {
    const { userId } = await requireTenant(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const apps = await ctx.db
      .query("jobApplications")
      .withIndex("by_applicant", (q) => q.eq("applicantId", user._id))
      .order("desc")
      .take(200);

    const results: Array<ApplicationWithUser> = [];
    const jobCache = new Map<Id<"jobPostings">, Doc<"jobPostings"> | null>();
    for (const a of apps) {
      const cached = jobCache.get(a.jobId);
      let job: Doc<"jobPostings"> | null;
      if (cached === undefined) {
        job = await ctx.db.get(a.jobId);
        jobCache.set(a.jobId, job);
      } else {
        job = cached;
      }
      const reviewer = a.reviewerId ? await ctx.db.get(a.reviewerId) : null;
      const resumeUrl = a.resumeStorageId
        ? await ctx.storage.getUrl(a.resumeStorageId)
        : null;
      results.push({
        ...a,
        applicantName: user.name ?? null,
        applicantAvatar: user.avatarUrl ?? null,
        applicantEmail: user.email ?? null,
        applicantJobTitle: user.jobTitle ?? null,
        applicantDepartment: user.department ?? null,
        reviewerName: reviewer?.name ?? null,
        resumeUrl,
        jobTitle: job?.title ?? null,
        jobDepartment: job?.department ?? null,
        jobStatus: job?.status ?? null,
      });
    }
    return results;
  },
});
