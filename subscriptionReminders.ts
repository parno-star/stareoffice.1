import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { isAdminRole } from "./roles";
import { computeSubscriptionInfo } from "./lib/subscription";

/**
 * Daily subscription reminder scan.
 *
 * For every organization, derive its subscription status. When an org enters a
 * status that warrants a reminder (due_soon / overdue / expired) AND we have not
 * already reminded for that exact status, notify all of its admins in-app and
 * (best-effort) by email. We record the last reminded status on the org so the
 * cron only fires once per transition instead of every single day.
 *
 * Statuses that don't need reminders (active / no_subscription) clear the marker
 * so a later lapse re-arms the reminder.
 */
export const sendSubscriptionReminders = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ orgsNotified: number }> => {
    const nowIso = new Date().toISOString();
    const orgs = await ctx.db.query("organizations").collect();

    let orgsNotified = 0;

    for (const org of orgs) {
      const info = computeSubscriptionInfo(org, nowIso);
      const status = info.status;

      const needsReminder =
        status === "due_soon" || status === "overdue" || status === "expired";

      if (!needsReminder) {
        // Re-arm: clear any stored marker so the next lapse notifies again.
        if (org.subscriptionLastReminderStatus) {
          await ctx.db.patch(org._id, {
            subscriptionLastReminderStatus: undefined,
            subscriptionLastReminderAt: undefined,
          });
        }
        continue;
      }

      // Already reminded for this exact status — skip to avoid daily spam.
      if (org.subscriptionLastReminderStatus === status) continue;

      // Build the message for this status.
      const days = info.daysUntilDue;
      let title: string;
      let message: string;
      if (status === "due_soon") {
        title = "Langganan akan segera jatuh tempo";
        message =
          days !== null && days > 0
            ? `Langganan "${org.name}" akan jatuh tempo dalam ${days} hari. Segera lakukan pembayaran agar akses tetap penuh.`
            : `Langganan "${org.name}" jatuh tempo hari ini. Segera lakukan pembayaran agar akses tetap penuh.`;
      } else if (status === "overdue") {
        title = "Langganan menunggak";
        message = `Langganan "${org.name}" telah melewati tanggal jatuh tempo dan berada dalam masa tenggang. Selesaikan pembayaran segera untuk menghindari mode hanya-baca.`;
      } else {
        title = "Langganan kedaluwarsa — akses hanya-baca";
        message = `Masa langganan "${org.name}" telah berakhir. Akses organisasi kini dalam mode hanya-baca. Selesaikan pembayaran untuk memulihkan akses penuh.`;
      }

      // Recipients: all admins in this org.
      const orgUsers = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();
      const admins = orgUsers.filter((u) => isAdminRole(u.role));

      const emails: string[] = [];
      for (const admin of admins) {
        await ctx.db.insert("notifications", {
          userId: admin._id,
          type: "subscription_reminder",
          title,
          message,
          link: "/billing",
          organizationId: org._id,
        });
        if (admin.email) emails.push(admin.email);
      }

      // Email reminder (best-effort, reuses the alert email sender).
      if (emails.length > 0) {
        await ctx.scheduler.runAfter(0, internal.planLimitEmails.sendLimitAlert, {
          to: emails,
          subject: title,
          heading: title,
          body: message,
        });
      }

      await ctx.db.patch(org._id, {
        subscriptionLastReminderStatus: status,
        subscriptionLastReminderAt: nowIso,
      });
      orgsNotified += 1;
    }

    return { orgsNotified };
  },
});
