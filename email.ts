import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Normalize an email for comparison and storage.
 * Emails are case-insensitive, so we lowercase and trim to make duplicate
 * detection reliable ("John@X.com" and "john@x.com" are the same account).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Ensure no other user already uses `email`. Throws a ConvexError with code
 * CONFLICT when a duplicate is found.
 *
 * @param ctx      Query or mutation context
 * @param email    The raw email being set (may be empty/whitespace)
 * @param excludeUserId  When editing an existing user, pass their id so their
 *                       own row is not treated as a clash.
 */
export async function assertEmailIsUnique(
  ctx: QueryCtx | MutationCtx,
  email: string,
  excludeUserId?: Id<"users">,
): Promise<void> {
  const normalized = normalizeEmail(email);
  // Empty email is allowed (email is optional); nothing to check.
  if (normalized === "") return;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalized))
    .collect();

  const clash = existing.find(
    (u: Doc<"users">) => u._id !== excludeUserId,
  );

  if (clash) {
    throw new ConvexError({
      code: "CONFLICT",
      message: `Email "${normalized}" sudah digunakan oleh akun lain. Gunakan email yang berbeda.`,
    });
  }
}
