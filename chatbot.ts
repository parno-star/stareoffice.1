import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
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

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("aiChatSessions")
      .withIndex("by_user_and_last", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    return rows;
  },
});

export const getSession = query({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      return null;
    }
    return session;
  },
});

export const listMessages = query({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      return [];
    }
    const msgs = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return msgs.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const createSession = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = new Date().toISOString();
    const sessionId = await ctx.db.insert("aiChatSessions", {
      userId: user._id,
      title: args.title?.trim() || "Percakapan baru",
      lastMessageAt: now,
      messageCount: 0,
    });
    return sessionId;
  },
});

export const renameSession = mutation({
  args: { sessionId: v.id("aiChatSessions"), title: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sesi tidak ditemukan" });
    }
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Judul tidak boleh kosong" });
    }
    await ctx.db.patch(args.sessionId, { title: title.slice(0, 120) });
  },
});

export const togglePin = mutation({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sesi tidak ditemukan" });
    }
    await ctx.db.patch(args.sessionId, { isPinned: !session.isPinned });
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sesi tidak ditemukan" });
    }
    const msgs = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const m of msgs) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.sessionId);
  },
});

// ---- Internal helpers used by the AI action ---------------------------

export const appendUserMessage = internalMutation({
  args: {
    sessionId: v.id("aiChatSessions"),
    userId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const messageId = await ctx.db.insert("aiChatMessages", {
      sessionId: args.sessionId,
      userId: args.userId,
      role: "user",
      content: args.content,
      status: "ok",
    });
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      const patch: Partial<Doc<"aiChatSessions">> = {
        lastMessageAt: now,
        lastMessagePreview: truncate(args.content, 120),
        messageCount: session.messageCount + 1,
      };
      // Auto-title based on first user message
      if (session.messageCount === 0 || session.title === "Percakapan baru") {
        patch.title = truncate(args.content, 60);
      }
      await ctx.db.patch(args.sessionId, patch);
    }
    return messageId;
  },
});

export const appendAssistantPending = internalMutation({
  args: {
    sessionId: v.id("aiChatSessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const messageId = await ctx.db.insert("aiChatMessages", {
      sessionId: args.sessionId,
      userId: args.userId,
      role: "assistant",
      content: "",
      status: "pending",
    });
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
    });
    return messageId;
  },
});

export const finalizeAssistantMessage = internalMutation({
  args: {
    messageId: v.id("aiChatMessages"),
    sessionId: v.id("aiChatSessions"),
    content: v.string(),
    suggestions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "ok",
      suggestions: args.suggestions,
    });
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      await ctx.db.patch(args.sessionId, {
        lastMessagePreview: truncate(args.content, 120),
        lastMessageAt: new Date().toISOString(),
        messageCount: session.messageCount + 1,
      });
    }
  },
});

export const failAssistantMessage = internalMutation({
  args: {
    messageId: v.id("aiChatMessages"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content:
        "Maaf, terjadi kendala saat menghubungi layanan AI. Silakan coba lagi sebentar lagi.",
      status: "error",
      errorMessage: args.errorMessage,
    });
  },
});

// Load chat history as plain JSON for the action.
export const loadHistory = internalQuery({
  args: { sessionId: v.id("aiChatSessions"), limit: v.number() },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    msgs.sort((a, b) => a._creationTime - b._creationTime);
    // Drop still-pending messages so we don't feed empty content to the LLM
    return msgs
      .filter((m) => m.status !== "pending")
      .slice(-args.limit)
      .map((m) => ({ role: m.role, content: m.content }));
  },
});

// Collect rich context from the user's HR data that the AI can use to
// answer grounded questions.
export const buildContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const year = today.getFullYear();

    // Leave balance (current year) + leave requests (last 10)
    const balance = await ctx.db
      .query("leaveBalances")
      .withIndex("by_user_and_year", (q) =>
        q.eq("userId", user._id).eq("year", year),
      )
      .unique();

    const leaveRequests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);

    const approvedThisYear = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "approved"),
      )
      .collect();
    const usedDaysThisYear = approvedThisYear
      .filter((r) => r.startDate.startsWith(String(year)))
      .reduce((acc, r) => acc + (r.dayCount || 0), 0);
    const annualQuota = balance?.annualQuota ?? 12;
    const remainingDays = Math.max(0, annualQuota - usedDaysThisYear);

    // Today's attendance
    const todayAttendance = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", todayStr),
      )
      .unique();

    // Upcoming events (next 30 days, top 5)
    const upcomingEventsAll = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.gte("startDate", todayStr))
      .take(20);
    const upcomingEvents = upcomingEventsAll.slice(0, 5);

    // Active announcements
    const announcements = await ctx.db
      .query("announcements")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(5);

    // Active published policies
    const policies = await ctx.db
      .query("policies")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(20);

    // Pending expense approvals / open advances
    const myExpensesPending = await ctx.db
      .query("expenseReports")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .collect();

    // Assigned open tasks
    const myOpenTasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee_and_status", (q) =>
        q.eq("assigneeId", user._id).eq("status", "todo"),
      )
      .take(10);

    // Unread notifications count
    const allNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);
    const unreadCount = allNotifs.filter((n) => !n.readAt).length;

    // Latest payslip
    const latestPayslip = await ctx.db
      .query("payslips")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();

    // My active OKRs (owner + current periods)
    const myObjectives = await ctx.db
      .query("objectives")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .take(10);

    // My in-progress courses
    const myEnrollments = await ctx.db
      .query("courseEnrollments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(20);

    const courseTitles: Record<string, string> = {};
    for (const en of myEnrollments) {
      const c = await ctx.db.get(en.courseId);
      if (c) courseTitles[String(en.courseId)] = c.title;
    }

    // Manager
    let managerName: string | null = null;
    if (user.managerId) {
      const mgr = await ctx.db.get(user.managerId);
      managerName = mgr?.name ?? null;
    }

    return {
      user: {
        id: String(user._id),
        name: user.name ?? "",
        email: user.email ?? "",
        jobTitle: user.jobTitle ?? "",
        department: user.department ?? "",
        location: user.location ?? "",
        role: user.role ?? "employee",
        managerName,
        startDate: user.startDate ?? null,
      },
      todayStr,
      leave: {
        annualQuota,
        usedDaysThisYear,
        remainingDays,
        recent: leaveRequests.map((r) => ({
          type: r.type,
          startDate: r.startDate,
          endDate: r.endDate,
          dayCount: r.dayCount,
          status: r.status,
          reason: r.reason,
        })),
      },
      attendance: {
        hasClockedInToday: Boolean(todayAttendance?.clockInAt),
        clockInAt: todayAttendance?.clockInAt ?? null,
        clockOutAt: todayAttendance?.clockOutAt ?? null,
        isLate: todayAttendance?.isLate ?? false,
      },
      upcomingEvents: upcomingEvents.map((e) => ({
        title: e.title,
        startDate: e.startDate,
        startTime: e.startTime ?? null,
        location: e.location ?? null,
        category: e.category,
      })),
      announcements: announcements.map((a) => ({
        title: a.title,
        summary: a.summary ?? "",
        priority: a.priority,
        publishedAt: a.publishedAt,
      })),
      policies: policies.map((p) => ({
        title: p.title,
        summary: p.summary,
        category: p.category,
      })),
      expenses: {
        pendingCount: myExpensesPending.length,
        pendingTotalIdr: myExpensesPending.reduce(
          (acc, e) => acc + (e.amount || 0),
          0,
        ),
      },
      tasks: myOpenTasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ?? null,
      })),
      notifications: {
        unreadCount,
      },
      payroll: latestPayslip
        ? {
            period: latestPayslip.period,
            netSalary: latestPayslip.netSalary,
            grossSalary: latestPayslip.grossSalary,
            status: latestPayslip.status,
          }
        : null,
      objectives: myObjectives.map((o) => ({
        title: o.title,
        progress: o.progress,
        health: o.health,
        status: o.status,
        period: o.periodLabel,
      })),
      enrollments: myEnrollments.map((en) => ({
        title: courseTitles[String(en.courseId)] ?? "Kursus",
        progress: en.progress,
        completed: Boolean(en.completedAt),
      })),
    };
  },
});

// Public action is defined in chatbotActions.ts (Node runtime).
// Forward-compat: expose a tiny public mutation the UI can call after the
// action finishes to mark a session as read by updating lastMessageAt.
export const touchSession = mutation({
  args: { sessionId: v.id("aiChatSessions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) return;
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: new Date().toISOString(),
    });
  },
});

// Helper re-exported so the action file can use it without importing roles.
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const sessions = await ctx.db
      .query("aiChatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const messages = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return {
      sessionCount: sessions.length,
      messageCount: messages.filter((m) => m.role === "user").length,
    };
  },
});
