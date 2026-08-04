import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";

/**
 * Scheduled cleanup for abandoned onboarding stub accounts.
 *
 * When someone logs in via Hercules Auth, a `users` row is created immediately
 * (see users.updateCurrentUser) — even before they finish onboarding. If they
 * never complete onboarding (no role, no accountStatus, no organization) the row
 * lingers forever. This cron performs a safe, reversible two-phase cleanup:
 *
 *   Phase 1 (flag): a stub inactive for >= FLAG_AFTER_DAYS is marked with
 *     `onboardingAbandonedAt`. Nothing is deleted. If the user logs in again,
 *     users.updateCurrentUser clears this flag automatically (revives it).
 *
 *   Phase 2 (purge): a stub that has stayed flagged for >= PURGE_AFTER_DAYS is
 *     permanently removed, along with any orphaned role requests it may have.
 *
 * A stub is defined strictly as: no role AND no accountStatus AND no
 * organizationId. Real employees (admin-created placeholders included, which
 * always carry an organizationId) are never touched.
 */

// How long a stub must be inactive before we flag it as abandoned.
const FLAG_AFTER_DAYS = 14;
// How long a flagged stub is kept before permanent deletion.
const PURGE_AFTER_DAYS = 7;
// Upper bound on rows processed per run to stay well within Convex limits.
const SCAN_LIMIT = 4096;

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the account is an incomplete onboarding stub (never finished). */
function isOnboardingStub(user: Doc<"users">): boolean {
  return (
    !user.role &&
    !user.accountStatus &&
    !user.organizationId &&
    // Never touch admin-created placeholder profiles awaiting a claim.
    !user.tokenIdentifier.startsWith("placeholder:")
  );
}

/** Timestamp (ms) of the account's most recent activity. */
function lastActivityMs(user: Doc<"users">): number {
  if (user.lastLoginAt) {
    const parsed = Date.parse(user.lastLoginAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return user._creationTime;
}

export const cleanupAbandonedOnboarding = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ flagged: number; purged: number }> => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const users = await ctx.db.query("users").take(SCAN_LIMIT);

    let flagged = 0;
    let purged = 0;

    for (const user of users) {
      if (!isOnboardingStub(user)) continue;

      if (user.onboardingAbandonedAt) {
        // Phase 2: purge once the flag has aged past the grace window.
        const flaggedAt = Date.parse(user.onboardingAbandonedAt);
        const flaggedAgeMs = Number.isNaN(flaggedAt)
          ? Infinity
          : now - flaggedAt;
        if (flaggedAgeMs >= PURGE_AFTER_DAYS * DAY_MS) {
          // Remove any orphaned role requests tied to this stub first.
          const roleRequests = await ctx.db
            .query("roleRequests")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();
          for (const req of roleRequests) {
            await ctx.db.delete(req._id);
          }
          await ctx.db.delete(user._id);
          purged++;
        }
        continue;
      }

      // Phase 1: flag stubs that have been inactive long enough.
      if (now - lastActivityMs(user) >= FLAG_AFTER_DAYS * DAY_MS) {
        await ctx.db.patch(user._id, { onboardingAbandonedAt: nowIso });
        flagged++;
      }
    }

    return { flagged, purged };
  },
});
