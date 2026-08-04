import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { USER_SCOPED_TABLES } from "./lib/userTables";

// How many rows to delete per transaction. Kept well under Convex's per-mutation
// write limit (8192) so a single batch always fits, with headroom for the
// scheduler bookkeeping.
const BATCH_SIZE = 500;

/**
 * Permanently purge every personal record belonging to a single user across all
 * user-scoped tables, then delete the user document itself.
 *
 * Runs one bounded batch per invocation and re-schedules itself (from the
 * current table + cursor) until everything is gone, keeping each transaction
 * within Convex limits.
 *
 * NOTE: This only removes database rows. Uploaded files in Convex File Storage
 * are not deleted here.
 */
export const purgeUserBatch = internalMutation({
  args: {
    userId: v.id("users"),
    // Index into USER_SCOPED_TABLES marking which table we're currently draining.
    tableIndex: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    let tableIndex = args.tableIndex;

    // Find the next table that still has rows for this user and delete a batch.
    while (tableIndex < USER_SCOPED_TABLES.length) {
      const table = USER_SCOPED_TABLES[tableIndex];
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .take(BATCH_SIZE);

      if (rows.length > 0) {
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
        // There may be more rows in this same table. Re-run on the SAME index.
        await ctx.scheduler.runAfter(0, internal.userPurge.purgeUserBatch, {
          userId: args.userId,
          tableIndex,
        });
        return;
      }

      // This table is empty for the user — move to the next one.
      tableIndex += 1;
    }

    // All user-scoped tables drained. Finally remove the user itself.
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.delete(args.userId);
    }
  },
});
