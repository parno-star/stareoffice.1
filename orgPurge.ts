import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ORG_SCOPED_TABLES } from "./lib/orgTables";

// How many rows to delete per transaction. Kept well under Convex's per-mutation
// write limit (8192) so a single batch always fits, with headroom for the extra
// reads/writes the scheduler bookkeeping needs.
const BATCH_SIZE = 500;

/**
 * Permanently purge every row belonging to an organization across all
 * org-scoped tables (including the tenant's `users`), then delete the
 * organization document itself.
 *
 * Runs one bounded batch per invocation and re-schedules itself (from the
 * current table + cursor) until everything is gone. This keeps each transaction
 * within Convex limits no matter how much data a tenant accumulated.
 *
 * NOTE: This only removes database rows. Uploaded files in Convex File Storage
 * (logos, letter attachments, documents, etc.) are not deleted here; storage
 * usage for a deleted org is reset separately.
 */
export const purgeOrganizationBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    // Index into ORG_SCOPED_TABLES marking which table we're currently draining.
    tableIndex: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    let tableIndex = args.tableIndex;

    // Find the next table that still has rows for this org and delete a batch.
    while (tableIndex < ORG_SCOPED_TABLES.length) {
      const table = ORG_SCOPED_TABLES[tableIndex];
      const rows = await ctx.db
        .query(table)
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .take(BATCH_SIZE);

      if (rows.length > 0) {
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
        // There may be more rows in this same table. Re-run on the SAME index.
        await ctx.scheduler.runAfter(
          0,
          internal.orgPurge.purgeOrganizationBatch,
          { organizationId: args.organizationId, tableIndex },
        );
        return;
      }

      // This table is empty for the org — move to the next one.
      tableIndex += 1;
    }

    // All org-scoped tables drained. Finally remove the organization itself.
    const org = await ctx.db.get(args.organizationId);
    if (org) {
      await ctx.db.delete(args.organizationId);
    }
  },
});
