import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { isAdminRole } from "./roles";

/** List all job titles for current org */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"jobTitles">>> => {
    const { organizationId } = await requireTenant(ctx);
    const all = await ctx.db.query("jobTitles").collect();
    // A super admin without an active grant has organizationId === null and
    // sees nothing; real records always have a non-null organizationId.
    return all.filter((j) => j.organizationId === organizationId);
  },
});

/** Create a new job title */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireTenant(ctx);
    const me = await ctx.db.get(userId);
    if (!me || !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat menambah jabatan",
      });
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama jabatan tidak boleh kosong",
      });
    }
    // Check for duplicates within org
    const all = await ctx.db.query("jobTitles").collect();
    const orgItems = all.filter((j) => j.organizationId === organizationId);
    const exists = orgItems.some(
      (j) => j.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Jabatan dengan nama tersebut sudah ada",
      });
    }
    return await ctx.db.insert("jobTitles", {
      name,
      organizationId: me.organizationId,
    });
  },
});

/** Delete a job title */
export const remove = mutation({
  args: { id: v.id("jobTitles") },
  handler: async (ctx, args) => {
    const { userId } = await requireTenant(ctx);
    const me = await ctx.db.get(userId);
    if (!me || !isAdminRole(me.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat menghapus jabatan",
      });
    }
    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Jabatan tidak ditemukan" });
    }
    await ctx.db.delete(args.id);
  },
});
