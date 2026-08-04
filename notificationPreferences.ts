import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

/** All category toggles default to true (enabled) */
const DEFAULT_PREFS = {
  catLeave: true,
  catAttendance: true,
  catExpenses: true,
  catTasks: true,
  catForum: true,
  catAnnouncements: true,
  catPolicies: true,
  catEvents: true,
  catRecognitions: true,
  catAwards: true,
  catTraining: true,
  catPayroll: true,
  catOkr: true,
  catTickets: true,
  catMessages: true,
  catSystem: true,
  quietHoursEnabled: false,
} as const;

/** Map notification type prefixes to category field names */
const TYPE_TO_CATEGORY: Record<string, keyof typeof DEFAULT_PREFS> = {
  leave: "catLeave",
  attendance: "catAttendance",
  expense: "catExpenses",
  task: "catTasks",
  forum: "catForum",
  announcement: "catAnnouncements",
  policy: "catPolicies",
  event: "catEvents",
  recognition: "catRecognitions",
  award: "catAwards",
  course: "catTraining",
  training: "catTraining",
  payslip: "catPayroll",
  payroll: "catPayroll",
  okr: "catOkr",
  ticket: "catTickets",
  direct_message: "catMessages",
  message: "catMessages",
  suggestion: "catSystem",
  onboarding: "catSystem",
  asset: "catSystem",
  system: "catSystem",
};

/**
 * Resolve which category a notification type belongs to.
 * Uses prefix matching against known type prefixes.
 */
export function getCategoryForType(type: string): keyof typeof DEFAULT_PREFS | null {
  // Direct match first
  if (type in TYPE_TO_CATEGORY) return TYPE_TO_CATEGORY[type];
  // Prefix match (e.g. "leave_new" → "leave")
  const prefix = type.split("_")[0];
  if (prefix in TYPE_TO_CATEGORY) return TYPE_TO_CATEGORY[prefix];
  return null;
}

export const getMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!existing) {
      // Return defaults with a null _id so the UI knows to create on first save
      return { ...DEFAULT_PREFS, quietHoursStart: "22:00", quietHoursEnd: "07:00", _id: null };
    }

    return {
      catLeave: existing.catLeave,
      catAttendance: existing.catAttendance,
      catExpenses: existing.catExpenses,
      catTasks: existing.catTasks,
      catForum: existing.catForum,
      catAnnouncements: existing.catAnnouncements,
      catPolicies: existing.catPolicies,
      catEvents: existing.catEvents,
      catRecognitions: existing.catRecognitions,
      catAwards: existing.catAwards,
      catTraining: existing.catTraining,
      catPayroll: existing.catPayroll,
      catOkr: existing.catOkr,
      catTickets: existing.catTickets,
      catMessages: existing.catMessages,
      catSystem: existing.catSystem,
      quietHoursEnabled: existing.quietHoursEnabled,
      quietHoursStart: existing.quietHoursStart ?? "22:00",
      quietHoursEnd: existing.quietHoursEnd ?? "07:00",
      _id: existing._id,
    };
  },
});

export const updateMyPreferences = mutation({
  args: {
    catLeave: v.boolean(),
    catAttendance: v.boolean(),
    catExpenses: v.boolean(),
    catTasks: v.boolean(),
    catForum: v.boolean(),
    catAnnouncements: v.boolean(),
    catPolicies: v.boolean(),
    catEvents: v.boolean(),
    catRecognitions: v.boolean(),
    catAwards: v.boolean(),
    catTraining: v.boolean(),
    catPayroll: v.boolean(),
    catOkr: v.boolean(),
    catTickets: v.boolean(),
    catMessages: v.boolean(),
    catSystem: v.boolean(),
    quietHoursEnabled: v.boolean(),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const data = {
      ...args,
      userId: user._id,
      organizationId: user.organizationId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("notificationPreferences", data);
    }
  },
});
