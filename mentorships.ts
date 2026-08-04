import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireUser } from "./_helpers";

// Mentorship relationships between mentor and mentee, plus 1:1 sessions.

export type EnrichedMentorship = Doc<"mentorships"> & {
  mentor: Doc<"users"> | null;
  mentee: Doc<"users"> | null;
  sessionCount: number;
  upcomingSessionAt: string | null;
};

async function enrichMentorship(
  ctx: QueryCtx,
  m: Doc<"mentorships">,
): Promise<EnrichedMentorship> {
  const mentor = await ctx.db.get(m.mentorId);
  const mentee = await ctx.db.get(m.menteeId);
  const sessions = await ctx.db
    .query("mentorshipSessions")
    .withIndex("by_mentorship", (q) => q.eq("mentorshipId", m._id))
    .collect();
  const nowIso = new Date().toISOString();
  const upcoming = sessions
    .filter((s) => s.status === "scheduled" && s.scheduledAt >= nowIso)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return {
    ...m,
    mentor,
    mentee,
    sessionCount: sessions.length,
    upcomingSessionAt: upcoming[0]?.scheduledAt ?? null,
  };
}

// ---- Requests / relationships ---------------------------------------

export const requestMentorship = mutation({
  args: {
    mentorId: v.id("users"),
    goal: v.string(),
    topics: v.array(v.string()),
    cadence: v.optional(v.string()),
    targetEndDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"mentorships">> => {
    const user = await requireUser(ctx);
    if (user._id === args.mentorId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak bisa mendaftar diri sendiri sebagai mentor",
      });
    }
    if (args.goal.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tujuan wajib diisi",
      });
    }
    const profile = await ctx.db
      .query("mentorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.mentorId))
      .unique();
    if (!profile || !profile.isPublished) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Mentor tidak ditemukan",
      });
    }
    if (!profile.isAcceptingRequests) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Mentor sedang tidak menerima permintaan baru",
      });
    }
    // Prevent duplicate pending/active request between same mentor-mentee
    const existing = await ctx.db
      .query("mentorships")
      .withIndex("by_mentee_and_status", (q) =>
        q.eq("menteeId", user._id).eq("status", "pending"),
      )
      .collect();
    if (existing.some((e) => e.mentorId === args.mentorId)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Permintaan ke mentor ini sudah terkirim",
      });
    }
    const active = await ctx.db
      .query("mentorships")
      .withIndex("by_mentee_and_status", (q) =>
        q.eq("menteeId", user._id).eq("status", "active"),
      )
      .collect();
    if (active.some((e) => e.mentorId === args.mentorId)) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Anda sudah aktif bersama mentor ini",
      });
    }
    const now = new Date().toISOString();
    const id = await ctx.db.insert("mentorships", {
      mentorId: args.mentorId,
      menteeId: user._id,
      mentorProfileId: profile._id,
      goal: args.goal.trim(),
      topics: args.topics,
      status: "pending",
      cadence: args.cadence,
      targetEndDate: args.targetEndDate,
      requestedAt: now,
    });
    // Notify mentor
    await ctx.db.insert("notifications", {
      userId: args.mentorId,
      type: "mentorship_request",
      title: "Permintaan mentorship baru",
      message: `${user.name ?? "Karyawan"} ingin Anda menjadi mentornya`,
      link: "/mentorship?tab=requests",
      actorId: user._id,
    });
    return id;
  },
});

export const respondToRequest = mutation({
  args: {
    mentorshipId: v.id("mentorships"),
    accept: v.boolean(),
    declineReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(args.mentorshipId);
    if (!m) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (m.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya mentor yang dapat merespons permintaan ini",
      });
    }
    if (m.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan ini sudah diproses",
      });
    }
    const now = new Date().toISOString();
    if (args.accept) {
      const profile = await ctx.db.get(m.mentorProfileId);
      if (profile && profile.activeMentees >= profile.capacity) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kapasitas mentee sudah penuh",
        });
      }
      await ctx.db.patch(m._id, {
        status: "active",
        startDate: now.slice(0, 10),
        decidedAt: now,
      });
      if (profile) {
        await ctx.db.patch(profile._id, {
          activeMentees: profile.activeMentees + 1,
          totalMentees: profile.totalMentees + 1,
          updatedAt: now,
        });
      }
      await ctx.db.insert("notifications", {
        userId: m.menteeId,
        type: "mentorship_accepted",
        title: "Permintaan mentorship diterima",
        message: `${user.name ?? "Mentor"} menerima Anda sebagai mentee`,
        link: "/mentorship?tab=my",
        actorId: user._id,
      });
    } else {
      await ctx.db.patch(m._id, {
        status: "rejected",
        declineReason: args.declineReason,
        decidedAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: m.menteeId,
        type: "mentorship_rejected",
        title: "Permintaan mentorship ditolak",
        message: args.declineReason
          ? args.declineReason
          : "Mentor tidak dapat menerima permintaan saat ini",
        link: "/mentorship?tab=my",
        actorId: user._id,
      });
    }
    return null;
  },
});

export const completeMentorship = mutation({
  args: {
    mentorshipId: v.id("mentorships"),
    menteeRating: v.optional(v.number()),
    menteeFeedback: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(args.mentorshipId);
    if (!m) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (m.menteeId !== user._id && m.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak menyelesaikan mentorship ini",
      });
    }
    if (m.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya mentorship aktif yang dapat diselesaikan",
      });
    }
    const now = new Date().toISOString();
    const patch: Partial<Doc<"mentorships">> = {
      status: "completed",
      endedAt: now,
    };
    if (m.menteeId === user._id && args.menteeRating !== undefined) {
      if (args.menteeRating < 1 || args.menteeRating > 5) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Rating 1..5",
        });
      }
      patch.menteeRating = args.menteeRating;
      patch.menteeFeedback = args.menteeFeedback;
    }
    await ctx.db.patch(m._id, patch);

    // Update mentor profile stats
    const profile = await ctx.db.get(m.mentorProfileId);
    if (profile) {
      const newActive = Math.max(0, profile.activeMentees - 1);
      let avg = profile.averageRating;
      let count = profile.ratingCount;
      if (args.menteeRating !== undefined && m.menteeId === user._id) {
        const prevTotal = (avg ?? 0) * count;
        count += 1;
        avg = (prevTotal + args.menteeRating) / count;
      }
      await ctx.db.patch(profile._id, {
        activeMentees: newActive,
        averageRating: avg,
        ratingCount: count,
        updatedAt: now,
      });
    }
    // Notify the other party
    const otherId = m.menteeId === user._id ? m.mentorId : m.menteeId;
    await ctx.db.insert("notifications", {
      userId: otherId,
      type: "mentorship_completed",
      title: "Mentorship diselesaikan",
      message: `${user.name ?? "Karyawan"} menandai mentorship selesai`,
      link: "/mentorship?tab=my",
      actorId: user._id,
    });
    return null;
  },
});

export const cancelMentorship = mutation({
  args: { mentorshipId: v.id("mentorships"), note: v.optional(v.string()) },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(args.mentorshipId);
    if (!m) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (m.menteeId !== user._id && m.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak membatalkan mentorship ini",
      });
    }
    if (m.status === "completed" || m.status === "cancelled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Mentorship sudah berakhir",
      });
    }
    const now = new Date().toISOString();
    await ctx.db.patch(m._id, {
      status: "cancelled",
      endedAt: now,
      mentorNote: args.note,
    });
    if (m.status === "active") {
      const profile = await ctx.db.get(m.mentorProfileId);
      if (profile) {
        await ctx.db.patch(profile._id, {
          activeMentees: Math.max(0, profile.activeMentees - 1),
          updatedAt: now,
        });
      }
    }
    return null;
  },
});

export const listMyMentorships = query({
  args: {
    role: v.optional(v.string()), // "mentor" | "mentee" | "all"
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedMentorship>> => {
    const user = await requireUser(ctx);
    const role = args.role ?? "all";
    let rows: Array<Doc<"mentorships">> = [];
    if (role === "mentor" || role === "all") {
      const asMentor = await ctx.db
        .query("mentorships")
        .withIndex("by_mentor", (q) => q.eq("mentorId", user._id))
        .collect();
      rows = rows.concat(asMentor);
    }
    if (role === "mentee" || role === "all") {
      const asMentee = await ctx.db
        .query("mentorships")
        .withIndex("by_mentee", (q) => q.eq("menteeId", user._id))
        .collect();
      rows = rows.concat(asMentee);
    }
    if (args.status && args.status !== "all") {
      rows = rows.filter((r) => r.status === args.status);
    }
    rows.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    const enriched: Array<EnrichedMentorship> = [];
    for (const r of rows) {
      enriched.push(await enrichMentorship(ctx, r));
    }
    return enriched;
  },
});

export const getMentorship = query({
  args: { mentorshipId: v.id("mentorships") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (EnrichedMentorship & {
        sessions: Array<Doc<"mentorshipSessions">>;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(args.mentorshipId);
    if (!m) return null;
    if (m.menteeId !== user._id && m.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak melihat mentorship ini",
      });
    }
    const enriched = await enrichMentorship(ctx, m);
    const sessions = await ctx.db
      .query("mentorshipSessions")
      .withIndex("by_mentorship", (q) => q.eq("mentorshipId", m._id))
      .collect();
    sessions.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return { ...enriched, sessions };
  },
});

// ---- Sessions -------------------------------------------------------

export const scheduleSession = mutation({
  args: {
    mentorshipId: v.id("mentorships"),
    title: v.string(),
    agenda: v.optional(v.string()),
    scheduledAt: v.string(),
    durationMinutes: v.number(),
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"mentorshipSessions">> => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(args.mentorshipId);
    if (!m) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (m.menteeId !== user._id && m.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak menjadwalkan sesi",
      });
    }
    if (m.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Hanya mentorship aktif yang dapat menjadwalkan sesi",
      });
    }
    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    if (args.durationMinutes < 15 || args.durationMinutes > 480) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Durasi 15..480 menit",
      });
    }
    const id = await ctx.db.insert("mentorshipSessions", {
      mentorshipId: m._id,
      mentorId: m.mentorId,
      menteeId: m.menteeId,
      title: args.title.trim(),
      agenda: args.agenda,
      scheduledAt: args.scheduledAt,
      durationMinutes: args.durationMinutes,
      meetingUrl: args.meetingUrl,
      location: args.location,
      status: "scheduled",
      createdById: user._id,
    });
    const otherId = user._id === m.mentorId ? m.menteeId : m.mentorId;
    await ctx.db.insert("notifications", {
      userId: otherId,
      type: "mentorship_session_scheduled",
      title: "Sesi mentorship dijadwalkan",
      message: `${user.name ?? "Karyawan"} menjadwalkan: ${args.title.trim()}`,
      link: `/mentorship/${m._id}`,
      actorId: user._id,
    });
    return id;
  },
});

export const updateSession = mutation({
  args: {
    sessionId: v.id("mentorshipSessions"),
    title: v.optional(v.string()),
    agenda: v.optional(v.string()),
    scheduledAt: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    meetingUrl: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (s.menteeId !== user._id && s.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak mengubah sesi ini",
      });
    }
    if (s.status !== "scheduled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sesi tidak dapat diubah",
      });
    }
    const patch: Partial<Doc<"mentorshipSessions">> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.agenda !== undefined) patch.agenda = args.agenda;
    if (args.scheduledAt !== undefined) patch.scheduledAt = args.scheduledAt;
    if (args.durationMinutes !== undefined)
      patch.durationMinutes = args.durationMinutes;
    if (args.meetingUrl !== undefined) patch.meetingUrl = args.meetingUrl;
    if (args.location !== undefined) patch.location = args.location;
    await ctx.db.patch(s._id, patch);
    return null;
  },
});

export const completeSession = mutation({
  args: {
    sessionId: v.id("mentorshipSessions"),
    mentorNotes: v.optional(v.string()),
    menteeNotes: v.optional(v.string()),
    actionItems: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (s.menteeId !== user._id && s.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak",
      });
    }
    const patch: Partial<Doc<"mentorshipSessions">> = {
      status: "completed",
      completedAt: new Date().toISOString(),
    };
    if (user._id === s.mentorId && args.mentorNotes !== undefined) {
      patch.mentorNotes = args.mentorNotes;
    }
    if (user._id === s.menteeId && args.menteeNotes !== undefined) {
      patch.menteeNotes = args.menteeNotes;
    }
    if (args.actionItems !== undefined) {
      patch.actionItems = args.actionItems;
    }
    await ctx.db.patch(s._id, patch);

    // Bump session count on mentor profile
    const m = await ctx.db.get(s.mentorshipId);
    if (m) {
      const profile = await ctx.db.get(m.mentorProfileId);
      if (profile) {
        await ctx.db.patch(profile._id, {
          sessionCount: profile.sessionCount + 1,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return null;
  },
});

export const cancelSession = mutation({
  args: { sessionId: v.id("mentorshipSessions") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const s = await ctx.db.get(args.sessionId);
    if (!s) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (s.menteeId !== user._id && s.mentorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak",
      });
    }
    if (s.status !== "scheduled") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sesi tidak dapat dibatalkan",
      });
    }
    await ctx.db.patch(s._id, { status: "cancelled" });
    return null;
  },
});

export const listMyUpcomingSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<
      Doc<"mentorshipSessions"> & {
        counterpart: Doc<"users"> | null;
        iAmMentor: boolean;
      }
    >
  > => {
    const user = await requireUser(ctx);
    const nowIso = new Date().toISOString();
    const mine = await ctx.db
      .query("mentorshipSessions")
      .withIndex("by_mentor_and_scheduled", (q) =>
        q.eq("mentorId", user._id).gte("scheduledAt", nowIso),
      )
      .collect();
    const asMentee = await ctx.db
      .query("mentorshipSessions")
      .withIndex("by_mentee_and_scheduled", (q) =>
        q.eq("menteeId", user._id).gte("scheduledAt", nowIso),
      )
      .collect();
    const all = [...mine, ...asMentee].filter(
      (s) => s.status === "scheduled",
    );
    all.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const limit = args.limit ?? 20;
    const capped = all.slice(0, limit);
    const result: Array<
      Doc<"mentorshipSessions"> & {
        counterpart: Doc<"users"> | null;
        iAmMentor: boolean;
      }
    > = [];
    for (const s of capped) {
      const iAmMentor = s.mentorId === user._id;
      const counterpart = await ctx.db.get(
        iAmMentor ? s.menteeId : s.mentorId,
      );
      result.push({ ...s, counterpart, iAmMentor });
    }
    return result;
  },
});
