import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";

/**
 * Automated deadline reminder — runs daily.
 * Scans for tasks due within 2 days and sends a reminder notification.
 * Also checks leave requests that are still pending and events happening tomorrow.
 */
export const sendDeadlineReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().slice(0, 10);

    let remindersSent = 0;

    // 1. Tasks with upcoming deadlines (due today or tomorrow)
    const allTasks = await ctx.db.query("tasks").collect();
    const urgentTasks = allTasks.filter((t) => {
      if (t.status === "done" || t.status === "cancelled") return false;
      if (!t.dueDate) return false;
      return t.dueDate === todayStr || t.dueDate === tomorrowStr || t.dueDate === dayAfterStr;
    });

    for (const task of urgentTasks) {
      if (!task.assigneeId) continue;
      const isToday = task.dueDate === todayStr;
      const isTomorrow = task.dueDate === tomorrowStr;
      const urgencyLabel = isToday ? "hari ini" : isTomorrow ? "besok" : "dalam 2 hari";

      await notifyUser(ctx, {
        userId: task.assigneeId,
        type: "task_deadline_reminder",
        title: `Deadline ${urgencyLabel}: ${task.title}`,
        message: `Tugas "${task.title}" jatuh tempo ${urgencyLabel} (${task.dueDate}). Segera selesaikan!`,
        link: "/projects",
      });
      remindersSent++;
    }

    // 2. Events happening tomorrow
    const tomorrowEvents = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.eq("startDate", tomorrowStr))
      .collect();

    for (const event of tomorrowEvents) {
      // Notify all users in the same org
      if (event.organizationId) {
        const orgUsers = await ctx.db
          .query("users")
          .withIndex("by_organization", (q) => q.eq("organizationId", event.organizationId!))
          .take(500);

        for (const user of orgUsers) {
          await notifyUser(ctx, {
            userId: user._id,
            type: "event_reminder",
            title: `Pengingat: ${event.title} besok`,
            message: `Event "${event.title}" akan berlangsung besok${event.startTime ? ` pukul ${event.startTime}` : ""}${event.location ? ` di ${event.location}` : ""}.`,
            link: "/calendar",
          });
          remindersSent++;
        }
      }
    }

    // 3. Pending leave requests older than 3 days.
    // Remind each COMPANY's own admins only. Platform super admins must NOT be
    // notified here: they own no organization, and pushing tenant leave data to
    // them would bypass the data-privacy consent gate ("Akses Berbasis Lingkup
    // Data") and spam them with every org's requests.
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoTs = threeDaysAgo.getTime();

    const pendingLeaves = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const stalePending = pendingLeaves.filter(
      (lr) => lr._creationTime < threeDaysAgoTs,
    );

    if (stalePending.length > 0) {
      // Count stale pending requests per organization.
      const staleCountByOrg = new Map<Id<"organizations">, number>();
      for (const lr of stalePending) {
        if (!lr.organizationId) continue; // skip records with no company
        const key = lr.organizationId;
        staleCountByOrg.set(key, (staleCountByOrg.get(key) ?? 0) + 1);
      }

      const allUsers = await ctx.db.query("users").collect();
      for (const [orgId, count] of staleCountByOrg) {
        // Only that company's own admins (never platform super admins).
        const orgAdmins = allUsers.filter(
          (u) =>
            u.organizationId === orgId &&
            u.role !== "super_admin" &&
            (u.role === "admin" ||
              u.role === "hr_admin" ||
              u.role === "hr_manager"),
        );
        for (const admin of orgAdmins) {
          await notifyUser(ctx, {
            userId: admin._id,
            type: "leave_pending_reminder",
            title: `${count} pengajuan cuti menunggu review`,
            message: `Ada ${count} pengajuan cuti yang sudah menunggu lebih dari 3 hari. Mohon segera ditinjau.`,
            link: "/leave",
          });
          remindersSent++;
        }
      }
    }

    return { remindersSent };
  },
});

/**
 * Weekly activity digest — runs once a week.
 * Creates a summary notification for each user about their weekly activity.
 */
export const sendWeeklyDigest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoTs = weekAgo.getTime();

    const allUsers = await ctx.db.query("users").take(500);
    let digestsSent = 0;

    for (const user of allUsers) {
      if (!user.role) continue; // Skip users without roles (inactive)

      // Count recent notifications
      const recentNotifs = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(100);

      const thisWeekNotifs = recentNotifs.filter((n) => n._creationTime >= weekAgoTs);
      const unreadCount = thisWeekNotifs.filter((n) => !n.readAt).length;

      // Count completed tasks this week
      const userTasks = await ctx.db
        .query("tasks")
        .withIndex("by_assignee_and_status", (q) =>
          q.eq("assigneeId", user._id).eq("status", "done"),
        )
        .take(50);

      const completedThisWeek = userTasks.filter((t) => t._creationTime >= weekAgoTs).length;

      // Only send digest if there's something to report
      if (thisWeekNotifs.length === 0 && completedThisWeek === 0) continue;

      const messageParts: string[] = [];
      if (thisWeekNotifs.length > 0) {
        messageParts.push(`${thisWeekNotifs.length} notifikasi minggu ini`);
      }
      if (unreadCount > 0) {
        messageParts.push(`${unreadCount} belum dibaca`);
      }
      if (completedThisWeek > 0) {
        messageParts.push(`${completedThisWeek} tugas selesai`);
      }

      await notifyUser(ctx, {
        userId: user._id,
        type: "weekly_digest",
        title: "Ringkasan Aktivitas Mingguan",
        message: `Minggu ini: ${messageParts.join(", ")}. Terus semangat!`,
        link: "/dashboard",
      });
      digestsSent++;
    }

    return { digestsSent };
  },
});
