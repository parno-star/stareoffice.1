import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily deadline & event reminders — runs every day at 07:00 UTC (14:00 WIB)
crons.daily(
  "deadline reminders",
  { hourUTC: 7, minuteUTC: 0 },
  internal.notificationReminders.sendDeadlineReminders,
);

// Daily subscription reminders — runs every day at 06:00 UTC (13:00 WIB).
// Notifies org admins when their subscription is due soon, overdue, or expired.
crons.daily(
  "subscription reminders",
  { hourUTC: 6, minuteUTC: 0 },
  internal.subscriptionReminders.sendSubscriptionReminders,
);

// Weekly activity digest — runs every Monday at 01:00 UTC (08:00 WIB)
crons.weekly(
  "weekly digest",
  { dayOfWeek: "monday", hourUTC: 1, minuteUTC: 0 },
  internal.notificationReminders.sendWeeklyDigest,
);

// Weekly cleanup of abandoned onboarding stub accounts — runs every Sunday at
// 18:00 UTC (Monday 01:00 WIB). Flags long-inactive incomplete signups, then
// purges those that stay abandoned past the grace period. Fully reversible:
// a user who returns and logs in is automatically un-flagged.
crons.weekly(
  "cleanup abandoned onboarding",
  { dayOfWeek: "sunday", hourUTC: 18, minuteUTC: 0 },
  internal.onboardingCleanup.cleanupAbandonedOnboarding,
);

export default crons;
