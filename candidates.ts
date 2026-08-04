import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import {
  requireRecruiter,
  CANDIDATE_SOURCES,
} from "./_helpers";

export type CandidateWithMeta = Doc<"candidates"> & {
  ownerName: string | null;
  resumeUrl: string | null;
  activeApplicationCount: number;
};

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireRecruiter(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {
    status: v.optional(v.string()), // "all" | "active" | "hired" | "archived" | "blacklisted"
    search: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<CandidateWithMeta>> => {
    await requireRecruiter(ctx);
    const statusFilter = args.status ?? "active";
    const search = args.search?.trim() ?? "";

    let rows: Array<Doc<"candidates">>;
    if (search) {
      rows = await ctx.db
        .query("candidates")
        .withSearchIndex("search_name", (q) => {
          let sq = q.search("firstName", search);
          if (statusFilter !== "all") sq = sq.eq("status", statusFilter);
          return sq;
        })
        .take(200);
    } else if (statusFilter === "all") {
      rows = await ctx.db.query("candidates").order("desc").take(300);
    } else {
      rows = await ctx.db
        .query("candidates")
        .withIndex("by_status", (q) => q.eq("status", statusFilter))
        .order("desc")
        .take(300);
    }

    if (args.source && args.source !== "all") {
      rows = rows.filter((c) => c.source === args.source);
    }

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<CandidateWithMeta> = [];
    for (const c of rows) {
      const owner = c.ownerId
        ? userCache.get(c.ownerId) ?? (await ctx.db.get(c.ownerId))
        : null;
      if (c.ownerId && !userCache.has(c.ownerId)) {
        userCache.set(c.ownerId, owner);
      }
      const apps = await ctx.db
        .query("candidateApplications")
        .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
        .collect();
      const activeApplicationCount = apps.filter(
        (a) =>
          a.stage !== "hired" &&
          a.stage !== "rejected" &&
          a.stage !== "withdrawn",
      ).length;
      const resumeUrl = c.resumeStorageId
        ? await ctx.storage.getUrl(c.resumeStorageId)
        : null;
      results.push({
        ...c,
        ownerName: owner?.name ?? null,
        resumeUrl,
        activeApplicationCount,
      });
    }
    return results;
  },
});

export const getById = query({
  args: { id: v.id("candidates") },
  handler: async (ctx, args): Promise<CandidateWithMeta | null> => {
    await requireRecruiter(ctx);
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    const owner = c.ownerId ? await ctx.db.get(c.ownerId) : null;
    const apps = await ctx.db
      .query("candidateApplications")
      .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
      .collect();
    const activeApplicationCount = apps.filter(
      (a) =>
        a.stage !== "hired" &&
        a.stage !== "rejected" &&
        a.stage !== "withdrawn",
    ).length;
    const resumeUrl = c.resumeStorageId
      ? await ctx.storage.getUrl(c.resumeStorageId)
      : null;
    return {
      ...c,
      ownerName: owner?.name ?? null,
      resumeUrl,
      activeApplicationCount,
    };
  },
});

function validateCandidateInput(args: {
  firstName: string;
  email: string;
  source: string;
  yearsExperience?: number;
  expectedSalary?: number;
  noticeDays?: number;
}): void {
  if (!args.firstName.trim()) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Nama depan wajib diisi",
    });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(args.email.trim())) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Email tidak valid",
    });
  }
  if (
    !CANDIDATE_SOURCES.includes(
      args.source as (typeof CANDIDATE_SOURCES)[number],
    )
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Sumber kandidat tidak valid",
    });
  }
  if (
    args.yearsExperience !== undefined &&
    (args.yearsExperience < 0 || args.yearsExperience > 80)
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Pengalaman tidak valid",
    });
  }
  if (args.expectedSalary !== undefined && args.expectedSalary < 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Ekspektasi gaji tidak valid",
    });
  }
  if (
    args.noticeDays !== undefined &&
    (args.noticeDays < 0 || args.noticeDays > 365)
  ) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Notice period tidak valid",
    });
  }
}

export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    currentTitle: v.optional(v.string()),
    currentCompany: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    noticeDays: v.optional(v.number()),
    source: v.string(),
    sourceDetail: v.optional(v.string()),
    tags: v.array(v.string()),
    skills: v.array(v.string()),
    summary: v.optional(v.string()),
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"candidates">> => {
    const user = await requireRecruiter(ctx);
    validateCandidateInput(args);

    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("candidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Kandidat dengan email tersebut sudah terdaftar",
      });
    }

    return await ctx.db.insert("candidates", {
      firstName: args.firstName.trim(),
      lastName: args.lastName?.trim() || undefined,
      email,
      phone: args.phone?.trim() || undefined,
      location: args.location?.trim() || undefined,
      currentTitle: args.currentTitle?.trim() || undefined,
      currentCompany: args.currentCompany?.trim() || undefined,
      linkedinUrl: args.linkedinUrl?.trim() || undefined,
      portfolioUrl: args.portfolioUrl?.trim() || undefined,
      yearsExperience: args.yearsExperience,
      expectedSalary: args.expectedSalary,
      noticeDays: args.noticeDays,
      source: args.source,
      sourceDetail: args.sourceDetail?.trim() || undefined,
      tags: args.tags.map((t) => t.trim()).filter((t) => t.length > 0),
      skills: args.skills.map((s) => s.trim()).filter((s) => s.length > 0),
      summary: args.summary?.trim() || undefined,
      resumeStorageId: args.resumeStorageId,
      resumeFileName: args.resumeFileName,
      ownerId: args.ownerId ?? user._id,
      status: "active",
      applicationCount: 0,
      createdById: user._id,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("candidates"),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    currentTitle: v.optional(v.string()),
    currentCompany: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    expectedSalary: v.optional(v.number()),
    noticeDays: v.optional(v.number()),
    source: v.string(),
    sourceDetail: v.optional(v.string()),
    tags: v.array(v.string()),
    skills: v.array(v.string()),
    summary: v.optional(v.string()),
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    const c = await ctx.db.get(args.id);
    if (!c) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kandidat tidak ditemukan",
      });
    }
    validateCandidateInput(args);
    const email = args.email.trim().toLowerCase();
    if (email !== c.email) {
      const existing = await ctx.db
        .query("candidates")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existing && existing._id !== args.id) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Kandidat lain dengan email tersebut sudah ada",
        });
      }
    }
    await ctx.db.patch(args.id, {
      firstName: args.firstName.trim(),
      lastName: args.lastName?.trim() || undefined,
      email,
      phone: args.phone?.trim() || undefined,
      location: args.location?.trim() || undefined,
      currentTitle: args.currentTitle?.trim() || undefined,
      currentCompany: args.currentCompany?.trim() || undefined,
      linkedinUrl: args.linkedinUrl?.trim() || undefined,
      portfolioUrl: args.portfolioUrl?.trim() || undefined,
      yearsExperience: args.yearsExperience,
      expectedSalary: args.expectedSalary,
      noticeDays: args.noticeDays,
      source: args.source,
      sourceDetail: args.sourceDetail?.trim() || undefined,
      tags: args.tags.map((t) => t.trim()).filter((t) => t.length > 0),
      skills: args.skills.map((s) => s.trim()).filter((s) => s.length > 0),
      summary: args.summary?.trim() || undefined,
      resumeStorageId: args.resumeStorageId,
      resumeFileName: args.resumeFileName,
      ownerId: args.ownerId,
    });
    return null;
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("candidates"),
    status: v.string(), // "active" | "hired" | "archived" | "blacklisted"
  },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    const valid = ["active", "hired", "archived", "blacklisted"];
    if (!valid.includes(args.status)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    await ctx.db.patch(args.id, { status: args.status });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("candidates") },
  handler: async (ctx, args) => {
    await requireRecruiter(ctx);
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    const apps = await ctx.db
      .query("candidateApplications")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.id))
      .collect();
    for (const a of apps) {
      const notes = await ctx.db
        .query("recruitmentNotes")
        .withIndex("by_application", (q) => q.eq("applicationId", a._id))
        .collect();
      for (const n of notes) await ctx.db.delete(n._id);
      const interviews = await ctx.db
        .query("recruitmentInterviews")
        .withIndex("by_application", (q) => q.eq("applicationId", a._id))
        .collect();
      for (const iv of interviews) await ctx.db.delete(iv._id);
      const job = await ctx.db.get(a.jobId);
      if (job) {
        await ctx.db.patch(job._id, {
          candidateCount: Math.max(0, job.candidateCount - 1),
        });
      }
      await ctx.db.delete(a._id);
    }
    if (c.resumeStorageId) {
      await ctx.storage.delete(c.resumeStorageId);
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
