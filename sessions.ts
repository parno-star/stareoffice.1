import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// Live training sessions: scheduled events tied to a course.

export type SessionWithMeta = Doc<"trainingSessions"> & {
  courseTitle: string;
  registration:
    | (Doc<"trainingSessionRegistrations"> & {
        isSelf: boolean;
      })
    | null;
  canJoin: boolean;
};

export const listSessions = query({
  args: {
    // "upcoming" | "past" | "all"
    filter: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
  },
  handler: async (ctx, args): Promise<Array<SessionWithMeta>> => {
    const user = await requireUser(ctx);
    let sessions: Array<Doc<"trainingSessions">>;
    if (args.courseId) {
      sessions = await ctx.db
        .query("trainingSessions")
        .withIndex("by_course", (q) => q.eq("courseId", args.courseId!))
        .order("desc")
        .take(200);
    } else {
      sessions = await ctx.db
        .query("trainingSessions")
        .withIndex("by_start")
        .order("desc")
        .take(200);
    }
    const now = new Date().toISOString();
    const filter = args.filter ?? "all";
    if (filter === "upcoming") {
      sessions = sessions.filter((s) => s.endAt >= now);
      sessions.sort((a, b) => a.startAt.localeCompare(b.startAt));
    } else if (filter === "past") {
      sessions = sessions.filter((s) => s.endAt < now);
    }
    const out: Array<SessionWithMeta> = [];
    for (const s of sessions) {
      const course = await ctx.db.get(s.courseId);
      const reg = await ctx.db
        .query("trainingSessionRegistrations")
        .withIndex("by_session_and_user", (q) =>
          q.eq("sessionId", s._id).eq("userId", user._id),
        )
        .unique();
      out.push({
        ...s,
        courseTitle: course?.title ?? "Kelas terhapus",
        registration: reg ? { ...reg, isSelf: true } : null,
        canJoin:
          s.status === "scheduled" &&
          s.endAt >= now &&
          (s.capacity === undefined || s.registeredCount < s.capacity),
      });
    }
    return out;
  },
});

export const getSession = query({
  args: { id: v.id("trainingSessions") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (SessionWithMeta & {
        participants: Array<{
          userId: Id<"users">;
          userName: string | null;
          userAvatar: string | null;
          userDepartment: string | null;
          status: string;
          registeredAt: string;
        }>;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.id);
    if (!session) return null;
    const course = await ctx.db.get(session.courseId);
    const reg = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", session._id).eq("userId", user._id),
      )
      .unique();
    const regs = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const participants: Array<{
      userId: Id<"users">;
      userName: string | null;
      userAvatar: string | null;
      userDepartment: string | null;
      status: string;
      registeredAt: string;
    }> = [];
    for (const r of regs) {
      const u = await ctx.db.get(r.userId);
      participants.push({
        userId: r.userId,
        userName: u?.name ?? null,
        userAvatar: u?.avatarUrl ?? null,
        userDepartment: u?.department ?? null,
        status: r.status,
        registeredAt: r.registeredAt,
      });
    }
    const now = new Date().toISOString();
    return {
      ...session,
      courseTitle: course?.title ?? "Kelas terhapus",
      registration: reg ? { ...reg, isSelf: true } : null,
      canJoin:
        session.status === "scheduled" &&
        session.endAt >= now &&
        (session.capacity === undefined ||
          session.registeredCount < session.capacity),
      participants,
    };
  },
});

export const createSession = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    startAt: v.string(),
    endAt: v.string(),
    format: v.string(),
    location: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
    capacity: v.optional(v.number()),
    trainerName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"trainingSessions">> => {
    const admin = await requireAdmin(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    if (args.endAt <= args.startAt) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Waktu selesai harus setelah waktu mulai",
      });
    }
    return await ctx.db.insert("trainingSessions", {
      courseId: args.courseId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      startAt: args.startAt,
      endAt: args.endAt,
      format: args.format,
      location: args.location?.trim() || undefined,
      meetingUrl: args.meetingUrl?.trim() || undefined,
      capacity: args.capacity,
      trainerName: args.trainerName?.trim() || undefined,
      status: "scheduled",
      authorId: admin._id,
      registeredCount: 0,
    });
  },
});

export const updateSession = mutation({
  args: {
    id: v.id("trainingSessions"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startAt: v.optional(v.string()),
    endAt: v.optional(v.string()),
    format: v.optional(v.string()),
    location: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
    capacity: v.optional(v.number()),
    trainerName: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sesi tidak ditemukan",
      });
    }
    const patch: Partial<Doc<"trainingSessions">> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.startAt !== undefined) patch.startAt = args.startAt;
    if (args.endAt !== undefined) patch.endAt = args.endAt;
    if (args.format !== undefined) patch.format = args.format;
    if (args.location !== undefined)
      patch.location = args.location.trim() || undefined;
    if (args.meetingUrl !== undefined)
      patch.meetingUrl = args.meetingUrl.trim() || undefined;
    if (args.capacity !== undefined) patch.capacity = args.capacity;
    if (args.trainerName !== undefined)
      patch.trainerName = args.trainerName.trim() || undefined;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

export const removeSession = mutation({
  args: { id: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const regs = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const r of regs) await ctx.db.delete(r._id);
    await ctx.db.delete(args.id);
    return null;
  },
});

export const registerForSession = mutation({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sesi tidak ditemukan",
      });
    }
    const existing = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id),
      )
      .unique();
    if (existing) {
      if (existing.status === "cancelled") {
        await ctx.db.patch(existing._id, {
          status: "registered",
          registeredAt: new Date().toISOString(),
        });
        await ctx.db.patch(args.sessionId, {
          registeredCount: session.registeredCount + 1,
        });
      }
      return null;
    }
    if (
      session.capacity !== undefined &&
      session.registeredCount >= session.capacity
    ) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Kapasitas sesi sudah penuh",
      });
    }
    await ctx.db.insert("trainingSessionRegistrations", {
      sessionId: args.sessionId,
      userId: user._id,
      status: "registered",
      registeredAt: new Date().toISOString(),
    });
    await ctx.db.patch(args.sessionId, {
      registeredCount: session.registeredCount + 1,
    });
    return null;
  },
});

export const cancelRegistration = mutation({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const reg = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id),
      )
      .unique();
    if (!reg || reg.status === "cancelled") return null;
    await ctx.db.patch(reg._id, { status: "cancelled" });
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      await ctx.db.patch(args.sessionId, {
        registeredCount: Math.max(0, session.registeredCount - 1),
      });
    }
    return null;
  },
});

export const markAttendance = mutation({
  args: {
    sessionId: v.id("trainingSessions"),
    userId: v.id("users"),
    // "attended" | "absent"
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const reg = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", args.userId),
      )
      .unique();
    if (!reg) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pendaftaran tidak ditemukan",
      });
    }
    await ctx.db.patch(reg._id, {
      status: args.status,
      attendedAt:
        args.status === "attended" ? new Date().toISOString() : undefined,
    });
    return null;
  },
});

export const listUpcomingForUser = query({
  args: {},
  handler: async (ctx): Promise<Array<SessionWithMeta>> => {
    const user = await requireUser(ctx);
    const regs = await ctx.db
      .query("trainingSessionRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const now = new Date().toISOString();
    const out: Array<SessionWithMeta> = [];
    for (const r of regs) {
      if (r.status === "cancelled") continue;
      const s = await ctx.db.get(r.sessionId);
      if (!s) continue;
      if (s.endAt < now) continue;
      const course = await ctx.db.get(s.courseId);
      out.push({
        ...s,
        courseTitle: course?.title ?? "Kelas terhapus",
        registration: { ...r, isSelf: true },
        canJoin: true,
      });
    }
    out.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return out;
  },
});
