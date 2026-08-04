import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { isAdminRole } from "./roles";

// ── List all custom directory fields for the caller's organization ──────────

export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"directoryFields">[]> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) return [];
    const fields = await ctx.db
      .query("directoryFields")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    return fields.sort((a, b) => a.order - b.order);
  },
});

// ── Create a new custom field ──────────────────────────────────────────────────

export const create = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    type: v.string(),
    options: v.optional(v.string()),
    required: v.optional(v.boolean()),
    showInList: v.optional(v.boolean()),
    employeeEditable: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"directoryFields">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Organisasi belum ditentukan" });
    }

    // Check admin permission
    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengelola field" });
    }

    // Validate key format
    const cleanKey = args.key.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!cleanKey || cleanKey.length < 2) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Key field minimal 2 karakter (huruf kecil, angka, underscore)" });
    }

    // Check for duplicate key in org
    const existing = await ctx.db
      .query("directoryFields")
      .withIndex("by_org_and_key", (q) => q.eq("organizationId", organizationId).eq("key", cleanKey))
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: `Field dengan key "${cleanKey}" sudah ada` });
    }

    // Calculate next order
    const allFields = await ctx.db
      .query("directoryFields")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const maxOrder = allFields.reduce((max, f) => Math.max(max, f.order), 0);

    // Validate type
    const validTypes = ["text", "number", "date", "select"];
    if (!validTypes.includes(args.type)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Tipe field harus salah satu: ${validTypes.join(", ")}` });
    }

    return await ctx.db.insert("directoryFields", {
      organizationId,
      key: cleanKey,
      label: args.label.trim(),
      type: args.type,
      options: args.type === "select" ? args.options?.trim() : undefined,
      required: args.required ?? false,
      order: maxOrder + 1,
      showInList: args.showInList ?? false,
      employeeEditable: args.employeeEditable ?? false,
    });
  },
});

// ── Update an existing custom field ────────────────────────────────────────────

export const update = mutation({
  args: {
    id: v.id("directoryFields"),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
    options: v.optional(v.string()),
    required: v.optional(v.boolean()),
    showInList: v.optional(v.boolean()),
    employeeEditable: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"directoryFields">> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengelola field" });
    }

    const field = await ctx.db.get(args.id);
    if (!field) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Field tidak ditemukan" });
    }

    // Tenant check
    if (organizationId && field.organizationId !== organizationId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Field tidak ditemukan di organisasi Anda" });
    }

    const validTypes = ["text", "number", "date", "select"];
    if (args.type && !validTypes.includes(args.type)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Tipe field harus salah satu: ${validTypes.join(", ")}` });
    }

    const patch: Partial<Doc<"directoryFields">> = {};
    if (args.label !== undefined) patch.label = args.label.trim();
    if (args.type !== undefined) patch.type = args.type;
    if (args.options !== undefined) patch.options = args.options.trim();
    if (args.required !== undefined) patch.required = args.required;
    if (args.showInList !== undefined) patch.showInList = args.showInList;
    if (args.employeeEditable !== undefined) patch.employeeEditable = args.employeeEditable;
    if (args.order !== undefined) patch.order = args.order;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

// ── Delete a custom field ─────────────────────────────────────────────────────

export const remove = mutation({
  args: { id: v.id("directoryFields") },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengelola field" });
    }

    const field = await ctx.db.get(args.id);
    if (!field) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Field tidak ditemukan" });
    }

    if (organizationId && field.organizationId !== organizationId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Field tidak ditemukan di organisasi Anda" });
    }

    await ctx.db.delete(args.id);
  },
});

// ── Reorder fields ────────────────────────────────────────────────────────────

export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("directoryFields")),
  },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengelola field" });
    }

    for (let i = 0; i < args.orderedIds.length; i++) {
      const id = args.orderedIds[i];
      if (!id) continue;
      const field = await ctx.db.get(id);
      if (!field) continue;
      if (organizationId && field.organizationId !== organizationId) continue;
      await ctx.db.patch(id, { order: i + 1 });
    }
  },
});

// ── Directory column order (built-in + custom fields combined) ─────────────────

export const getColumnOrder = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) return [];
    const org = await ctx.db.get(organizationId);
    return org?.directoryColumnOrder ?? [];
  },
});

export const setColumnOrder = mutation({
  args: {
    // Ordered tokens: built-in keys ("no", "nama", ...) and custom field ids
    orderedTokens: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Organisasi belum ditentukan" });
    }

    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity!.tokenIdentifier))
      .unique();
    if (!user || !isAdminRole(user.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Hanya admin yang dapat mengelola field" });
    }

    await ctx.db.patch(organizationId, { directoryColumnOrder: args.orderedTokens });
  },
});
