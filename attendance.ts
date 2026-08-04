import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

// Consider clock-in after 09:00 local time as late.
const LATE_THRESHOLD_MINUTES = 9 * 60;

function getLocalDate(iso: string): string {
  // Return YYYY-MM-DD in viewer's local timezone but stable by using UTC-ish.
  // We use the server-provided ISO - caller sets based on its clock.
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getLocalMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export const getTodayRecord = query({
  args: { date: v.string() }, // YYYY-MM-DD from client's local tz
  handler: async (ctx, args): Promise<Doc<"attendanceRecords"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", args.date),
      )
      .unique();
  },
});

export const clockIn = mutation({
  args: {
    nowIso: v.string(), // client's local "now" as ISO
    note: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"attendanceRecords">> => {
    const { userId, organizationId } = await requireTenant(ctx);

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const date = getLocalDate(args.nowIso);
    const existing = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", userId).eq("date", date),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Anda sudah melakukan clock-in hari ini",
      });
    }

    const minutes = getLocalMinutes(args.nowIso);
    const isLate = minutes > LATE_THRESHOLD_MINUTES;

    return await ctx.db.insert("attendanceRecords", {
      userId,
      organizationId: user.organizationId,
      date,
      clockInAt: args.nowIso,
      clockInNote: args.note,
      location: args.location,
      isLate,
    });
  },
});

export const clockOut = mutation({
  args: {
    nowIso: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"attendanceRecords">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const date = getLocalDate(args.nowIso);
    const record = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("date", date),
      )
      .unique();
    if (!record) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Anda belum melakukan clock-in hari ini",
      });
    }
    if (record.clockOutAt) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Anda sudah melakukan clock-out hari ini",
      });
    }

    const start = new Date(record.clockInAt).getTime();
    const end = new Date(args.nowIso).getTime();
    const workMinutes = Math.max(0, Math.round((end - start) / 60000));

    await ctx.db.patch(record._id, {
      clockOutAt: args.nowIso,
      clockOutNote: args.note,
      workMinutes,
    });
    return record._id;
  },
});

export const listMyHistory = query({
  args: {
    startDate: v.string(), // inclusive YYYY-MM-DD
    endDate: v.string(), // inclusive
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"attendanceRecords">>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const records = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user_and_date", (q) =>
        q
          .eq("userId", user._id)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .collect();

    records.sort((a, b) => b.date.localeCompare(a.date));
    return records;
  },
});

export const getMyMonthSummary = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    presentDays: number;
    lateDays: number;
    totalMinutes: number;
    avgMinutes: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      return { presentDays: 0, lateDays: 0, totalMinutes: 0, avgMinutes: 0 };
    }

    const records = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_user_and_date", (q) =>
        q
          .eq("userId", user._id)
          .gte("date", args.startDate)
          .lte("date", args.endDate),
      )
      .collect();

    let totalMinutes = 0;
    let countWithHours = 0;
    let lateDays = 0;
    for (const r of records) {
      if (r.isLate) lateDays += 1;
      if (r.workMinutes !== undefined) {
        totalMinutes += r.workMinutes;
        countWithHours += 1;
      }
    }
    const avgMinutes =
      countWithHours > 0 ? Math.round(totalMinutes / countWithHours) : 0;
    return {
      presentDays: records.length,
      lateDays,
      totalMinutes,
      avgMinutes,
    };
  },
});

export const listTodayTeam = query({
  args: { date: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      record: Doc<"attendanceRecords">;
      user: Doc<"users"> | null;
    }>
  > => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const records = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    // Tenant isolation: scope to the effective viewing org. A super admin
    // without an active grant has organizationId === null and sees nothing.
    const filtered = records.filter(
      (record) => record.organizationId === organizationId,
    );

    filtered.sort((a, b) => a.clockInAt.localeCompare(b.clockInAt));
    const enriched = await Promise.all(
      filtered.map(async (record) => ({
        record,
        user: await ctx.db.get(record.userId),
      })),
    );
    return enriched;
  },
});
