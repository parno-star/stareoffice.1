import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";

// All available stat card keys
export const ALL_STAT_KEYS = [
  "suratMasuk",
  "suratKeluar",
  "suratBulanIni",
  "totalKaryawan",
  "disposisiPending",
  "approvalPending",
  "suratDraft",
  "leaveRequests",
  "attendance",
  "activeProjects",
  "openTickets",
  "unreadMessages",
] as const;

export const DEFAULT_ENABLED_STATS = [
  "suratMasuk",
  "suratKeluar",
  "suratBulanIni",
  "totalKaryawan",
];

export type DashboardSettingsData = {
  enabledStats: string[];
  layout: string;
  colorScheme: string;
  chartType: string;
  showTrends: boolean;
  showGreeting: boolean;
  showQuickAccess: boolean;
  showRecentLetters: boolean;
  showActivityTimeline: boolean;
  showPendingDispositions: boolean;
  showUpcomingEvents: boolean;
  showAnnouncements: boolean;
  showCelebrations: boolean;
  dashboardCaption?: string;
  statsCaption?: string;
  chartCaption?: string;
  customStatLabels?: Record<string, string>;
};

const DEFAULT_SETTINGS: DashboardSettingsData = {
  enabledStats: [...DEFAULT_ENABLED_STATS],
  layout: "default",
  colorScheme: "default",
  chartType: "bar",
  showTrends: true,
  showGreeting: true,
  showQuickAccess: true,
  showRecentLetters: true,
  showActivityTimeline: true,
  showPendingDispositions: true,
  showUpcomingEvents: true,
  showAnnouncements: true,
  showCelebrations: true,
};

export const get = query({
  args: {},
  handler: async (ctx): Promise<DashboardSettingsData> => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) return DEFAULT_SETTINGS;

    const settings = await ctx.db
      .query("dashboardSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    if (!settings) return DEFAULT_SETTINGS;

    return {
      enabledStats: settings.enabledStats,
      layout: settings.layout,
      colorScheme: settings.colorScheme,
      chartType: settings.chartType,
      showTrends: settings.showTrends,
      showGreeting: settings.showGreeting,
      showQuickAccess: settings.showQuickAccess,
      showRecentLetters: settings.showRecentLetters,
      showActivityTimeline: settings.showActivityTimeline,
      showPendingDispositions: settings.showPendingDispositions,
      showUpcomingEvents: settings.showUpcomingEvents,
      showAnnouncements: settings.showAnnouncements,
      showCelebrations: settings.showCelebrations,
      dashboardCaption: settings.dashboardCaption,
      statsCaption: settings.statsCaption,
      chartCaption: settings.chartCaption,
      customStatLabels: settings.customStatLabels,
    };
  },
});

export const save = mutation({
  args: {
    enabledStats: v.array(v.string()),
    layout: v.string(),
    colorScheme: v.string(),
    chartType: v.string(),
    showTrends: v.boolean(),
    showGreeting: v.boolean(),
    showQuickAccess: v.boolean(),
    showRecentLetters: v.boolean(),
    showActivityTimeline: v.boolean(),
    showPendingDispositions: v.boolean(),
    showUpcomingEvents: v.boolean(),
    showAnnouncements: v.boolean(),
    showCelebrations: v.boolean(),
    dashboardCaption: v.optional(v.string()),
    statsCaption: v.optional(v.string()),
    chartCaption: v.optional(v.string()),
    customStatLabels: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args): Promise<void> => {
    const { userId, organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      throw new ConvexError({ message: "No organization found", code: "BAD_REQUEST" });
    }

    // Fetch user to verify admin role (super_admin bypasses the role check)
    if (!isSuperAdmin) {
      const user = await ctx.db.get(userId);
      if (!user || !isAdminRole(user.role)) {
        throw new ConvexError({ message: "Admin access required", code: "FORBIDDEN" });
      }
    }

    const existing = await ctx.db
      .query("dashboardSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    const data = {
      enabledStats: args.enabledStats,
      layout: args.layout,
      colorScheme: args.colorScheme,
      chartType: args.chartType,
      showTrends: args.showTrends,
      showGreeting: args.showGreeting,
      showQuickAccess: args.showQuickAccess,
      showRecentLetters: args.showRecentLetters,
      showActivityTimeline: args.showActivityTimeline,
      showPendingDispositions: args.showPendingDispositions,
      showUpcomingEvents: args.showUpcomingEvents,
      showAnnouncements: args.showAnnouncements,
      showCelebrations: args.showCelebrations,
      dashboardCaption: args.dashboardCaption,
      statsCaption: args.statsCaption,
      chartCaption: args.chartCaption,
      customStatLabels: args.customStatLabels,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("dashboardSettings", {
        organizationId,
        ...data,
      });
    }
  },
});
