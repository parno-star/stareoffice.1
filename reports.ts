import { ConvexError } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { isSuperAdminBlocked } from "./superAdminDataAccess";

/**
 * Returns the admin user together with the EFFECTIVE organizationId that all
 * report queries must scope to. For a super admin this is the organization
 * currently selected in the header (null only when viewing "all orgs"), so
 * reports never aggregate across organizations that aren't being viewed.
 */
async function requireAdminScoped(
  ctx: QueryCtx,
): Promise<{ user: Doc<"users">; organizationId: Doc<"organizations">["_id"] | null }> {
  const { userId, organizationId } = await requireTenant(ctx, {
    allowSuperAdmin: true,
  });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengakses laporan HR",
    });
  }
  return { user, organizationId };
}

/**
 * Filters a list of tenant-scoped documents to the effective organization.
 * A super admin without an active grant has organizationId === null and gets
 * an empty result, so cross-org data is never exposed.
 */
function scopeToOrg<T extends { organizationId?: Doc<"organizations">["_id"] | null }>(
  rows: Array<T>,
  organizationId: Doc<"organizations">["_id"] | null,
): Array<T> {
  // Always scope to the caller's organization. A super admin without an active
  // grant has organizationId === null and therefore sees no rows.
  return rows.filter((r) => r.organizationId === organizationId);
}

// Super admin data-access gate for cross-organization reports & statistics.
// Returns true when the caller is a super admin who has not enabled the
// "reports" data category, in which case report queries return empty data.
async function reportsBlocked(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<boolean> {
  return isSuperAdminBlocked(ctx, user.role === "super_admin", "reports");
}

// ---------------------------------------------------------------------------
// Headline KPI summary
// ---------------------------------------------------------------------------

export type HrReportSummary = {
  totalEmployees: number;
  activeToday: number;
  onLeaveToday: number;
  lateToday: number;
  avgWorkHours30d: number; // average work hours per clock-in in last 30 days
  attendanceRate30d: number; // attendance records / (employees * working days approx)
  pendingLeave: number;
  pendingExpenses: number;
  openTickets: number;
  newHires30d: number;
  upcomingAnniversaries: number;
  recognitionsThisMonth: number;
  trainingCompletions30d: number;
};

function todayIsoUtc(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}

export const getSummary = query({
  args: {},
  handler: async (ctx): Promise<HrReportSummary> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) {
      return {
        totalEmployees: 0,
        activeToday: 0,
        onLeaveToday: 0,
        lateToday: 0,
        avgWorkHours30d: 0,
        attendanceRate30d: 0,
        pendingLeave: 0,
        pendingExpenses: 0,
        openTickets: 0,
        newHires30d: 0,
        upcomingAnniversaries: 0,
        recognitionsThisMonth: 0,
        trainingCompletions30d: 0,
      };
    }

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const threshold30 = now - thirtyDaysMs;
    const today = todayIsoUtc();

    const [
      usersAll,
      attendanceTodayAll,
      leaveRequestsAll,
      expensesAll,
      ticketsAll,
      recognitionsAll,
      attendanceRecentAllRaw,
      enrollmentsAll,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db
        .query("attendanceRecords")
        .withIndex("by_date", (q) => q.eq("date", today))
        .collect(),
      ctx.db.query("leaveRequests").collect(),
      ctx.db.query("expenseReports").collect(),
      ctx.db.query("tickets").collect(),
      ctx.db.query("recognitions").collect(),
      ctx.db.query("attendanceRecords").collect(),
      ctx.db.query("courseEnrollments").collect(),
    ]);

    // Scope every dataset to the organization currently being viewed so a super
    // admin viewing one company never sees another company's data.
    const users = scopeToOrg(usersAll, organizationId);
    const attendanceToday = scopeToOrg(attendanceTodayAll, organizationId);
    const leaveRequests = scopeToOrg(leaveRequestsAll, organizationId);
    const expenses = scopeToOrg(expensesAll, organizationId);
    const tickets = scopeToOrg(ticketsAll, organizationId);
    const recognitions = scopeToOrg(recognitionsAll, organizationId);
    const attendanceRecentAll = scopeToOrg(attendanceRecentAllRaw, organizationId);
    const enrollments = scopeToOrg(enrollmentsAll, organizationId);

    const totalEmployees = users.length;
    const activeToday = attendanceToday.length;
    const lateToday = attendanceToday.filter((a) => a.isLate).length;

    const onLeaveToday = leaveRequests.filter(
      (l) =>
        l.status === "approved" && l.startDate <= today && l.endDate >= today,
    ).length;

    const pendingLeave = leaveRequests.filter(
      (l) => l.status === "pending",
    ).length;
    const pendingExpenses = expenses.filter(
      (e) => e.status === "pending",
    ).length;
    const openTickets = tickets.filter(
      (t) => t.status === "open" || t.status === "in_progress",
    ).length;

    // New hires in last 30 days based on startDate
    const thirtyAgoIso = new Date(threshold30).toISOString().slice(0, 10);
    const newHires30d = users.filter(
      (u) => u.startDate && u.startDate >= thirtyAgoIso && u.startDate <= today,
    ).length;

    // Upcoming work anniversaries in next 30 days
    const todayDate = new Date(`${today}T00:00:00Z`);
    const in30Date = new Date(todayDate.getTime() + thirtyDaysMs);
    const mmddToday =
      `${String(todayDate.getUTCMonth() + 1).padStart(2, "0")}-` +
      `${String(todayDate.getUTCDate()).padStart(2, "0")}`;
    const mmddFuture =
      `${String(in30Date.getUTCMonth() + 1).padStart(2, "0")}-` +
      `${String(in30Date.getUTCDate()).padStart(2, "0")}`;
    const upcomingAnniversaries = users.filter((u) => {
      if (!u.startDate) return false;
      const mmdd = u.startDate.slice(5); // MM-DD
      if (mmddToday <= mmddFuture) {
        return mmdd >= mmddToday && mmdd <= mmddFuture;
      }
      // wrap over year-end
      return mmdd >= mmddToday || mmdd <= mmddFuture;
    }).length;

    const recognitionsThisMonth = recognitions.filter(
      (r) => r._creationTime >= threshold30,
    ).length;

    const trainingCompletions30d = enrollments.filter(
      (e) =>
        e.completedAt && new Date(e.completedAt).getTime() >= threshold30,
    ).length;

    // Average work hours from completed attendance records (with workMinutes) in last 30 days
    const recent30 = attendanceRecentAll.filter(
      (a) => a._creationTime >= threshold30,
    );
    const withMinutes = recent30.filter(
      (a) => typeof a.workMinutes === "number" && a.workMinutes! > 0,
    );
    const avgMinutes =
      withMinutes.length === 0
        ? 0
        : withMinutes.reduce((acc, a) => acc + (a.workMinutes ?? 0), 0) /
          withMinutes.length;
    const avgWorkHours30d = Math.round((avgMinutes / 60) * 10) / 10;

    // Attendance rate: records in last 30 days / (employees * ~22 working days)
    const expectedDays = Math.max(1, totalEmployees * 22);
    const attendanceRate30d = Math.min(
      100,
      Math.round((recent30.length / expectedDays) * 100),
    );

    return {
      totalEmployees,
      activeToday,
      onLeaveToday,
      lateToday,
      avgWorkHours30d,
      attendanceRate30d,
      pendingLeave,
      pendingExpenses,
      openTickets,
      newHires30d,
      upcomingAnniversaries,
      recognitionsThisMonth,
      trainingCompletions30d,
    };
  },
});

// ---------------------------------------------------------------------------
// Attendance trend: last 30 days clock-ins & lateness
// ---------------------------------------------------------------------------

export type AttendanceTrendPoint = {
  date: string; // YYYY-MM-DD (UTC)
  present: number;
  late: number;
};

function utcDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export const getAttendanceTrend = query({
  args: {},
  handler: async (ctx): Promise<Array<AttendanceTrendPoint>> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const days = 30;
    const now = new Date();
    const startOfTodayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const cutoff = startOfTodayUtc - (days - 1) * 24 * 60 * 60 * 1000;

    const buckets = new Map<string, AttendanceTrendPoint>();
    for (let i = 0; i < days; i++) {
      const k = utcDayKey(cutoff + i * 24 * 60 * 60 * 1000);
      buckets.set(k, { date: k, present: 0, late: 0 });
    }

    const records = scopeToOrg(
      await ctx.db.query("attendanceRecords").collect(),
      organizationId,
    );
    for (const r of records) {
      const b = buckets.get(r.date);
      if (!b) continue;
      b.present += 1;
      if (r.isLate) b.late += 1;
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  },
});

// ---------------------------------------------------------------------------
// Leave breakdown by type (last 180 days)
// ---------------------------------------------------------------------------

export type LeaveBreakdownItem = {
  type: string;
  approved: number;
  pending: number;
  rejected: number;
  totalDays: number;
};

export const getLeaveBreakdown = query({
  args: {},
  handler: async (ctx): Promise<Array<LeaveBreakdownItem>> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const rows = scopeToOrg(
      await ctx.db.query("leaveRequests").collect(),
      organizationId,
    );
    const map = new Map<string, LeaveBreakdownItem>();
    for (const r of rows) {
      const cur =
        map.get(r.type) ??
        ({
          type: r.type,
          approved: 0,
          pending: 0,
          rejected: 0,
          totalDays: 0,
        } satisfies LeaveBreakdownItem);
      if (r.status === "approved") {
        cur.approved += 1;
        cur.totalDays += r.dayCount;
      } else if (r.status === "pending") {
        cur.pending += 1;
      } else if (r.status === "rejected") {
        cur.rejected += 1;
      }
      map.set(r.type, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.totalDays - a.totalDays);
  },
});

// ---------------------------------------------------------------------------
// Headcount by department (with leader info)
// ---------------------------------------------------------------------------

export type HeadcountItem = {
  department: string;
  count: number;
};

export const getHeadcountByDepartment = query({
  args: {},
  handler: async (ctx): Promise<Array<HeadcountItem>> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const users = scopeToOrg(
      await ctx.db.query("users").collect(),
      organizationId,
    );
    const map = new Map<string, number>();
    for (const u of users) {
      const d =
        u.department && u.department.trim().length > 0
          ? u.department
          : "Tanpa Departemen";
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    const items: Array<HeadcountItem> = [];
    for (const [department, count] of map.entries()) {
      items.push({ department, count });
    }
    items.sort((a, b) => {
      if (a.department === "Tanpa Departemen") return 1;
      if (b.department === "Tanpa Departemen") return -1;
      return b.count - a.count;
    });
    return items;
  },
});

// ---------------------------------------------------------------------------
// Expenses: monthly totals for last 6 months
// ---------------------------------------------------------------------------

export type ExpenseMonthPoint = {
  month: string; // YYYY-MM
  label: string; // human-readable short label
  approved: number; // IDR total
  pending: number;
  rejected: number;
};

const MONTH_LABELS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const getExpensesMonthly = query({
  args: {},
  handler: async (ctx): Promise<Array<ExpenseMonthPoint>> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const rows = scopeToOrg(
      await ctx.db.query("expenseReports").collect(),
      organizationId,
    );

    const now = new Date();
    const buckets = new Map<string, ExpenseMonthPoint>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_LABELS_ID[d.getUTCMonth()]} ${String(
        d.getUTCFullYear(),
      ).slice(2)}`;
      buckets.set(key, {
        month: key,
        label,
        approved: 0,
        pending: 0,
        rejected: 0,
      });
    }

    for (const r of rows) {
      if (!r.expenseDate) continue;
      const key = r.expenseDate.slice(0, 7);
      const b = buckets.get(key);
      if (!b) continue;
      if (r.status === "approved" || r.status === "paid") {
        b.approved += r.amount;
      } else if (r.status === "pending") {
        b.pending += r.amount;
      } else if (r.status === "rejected") {
        b.rejected += r.amount;
      }
    }

    return Array.from(buckets.values());
  },
});

// ---------------------------------------------------------------------------
// Tickets status breakdown
// ---------------------------------------------------------------------------

export type TicketStatusItem = {
  status: string;
  count: number;
};

export const getTicketStatusBreakdown = query({
  args: {},
  handler: async (ctx): Promise<Array<TicketStatusItem>> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const tickets = scopeToOrg(
      await ctx.db.query("tickets").collect(),
      organizationId,
    );
    const map = new Map<string, number>();
    for (const t of tickets) {
      map.set(t.status, (map.get(t.status) ?? 0) + 1);
    }
    const order = ["open", "in_progress", "resolved", "closed"];
    const out: Array<TicketStatusItem> = order.map((s) => ({
      status: s,
      count: map.get(s) ?? 0,
    }));
    // append any unknown statuses
    for (const [s, count] of map.entries()) {
      if (!order.includes(s)) out.push({ status: s, count });
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// Top recognized employees (last 90 days)
// ---------------------------------------------------------------------------

export type TopEmployeeItem = {
  userId: string;
  name: string;
  department: string | undefined;
  avatarUrl: string | undefined;
  count: number;
};

export const getTopRecognizedEmployees = query({
  args: {},
  handler: async (ctx): Promise<Array<TopEmployeeItem>> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const rows = scopeToOrg(
      await ctx.db.query("recognitions").collect(),
      organizationId,
    );
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r._creationTime < ninetyDaysAgo) continue;
      const key = r.toUserId as unknown as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const items: Array<TopEmployeeItem> = [];
    for (const [id, count] of top) {
      const u = await ctx.db.get(id as Doc<"users">["_id"]);
      if (!u) continue;
      items.push({
        userId: id,
        name: u.name ?? "Karyawan",
        department: u.department,
        avatarUrl: u.avatarUrl,
        count,
      });
    }
    return items;
  },
});

// ---------------------------------------------------------------------------
// Training progress snapshot
// ---------------------------------------------------------------------------

export type TrainingSnapshot = {
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  avgProgress: number;
};

export const getTrainingSnapshot = query({
  args: {},
  handler: async (ctx): Promise<TrainingSnapshot> => {
    const { user, organizationId } = await requireAdminScoped(ctx);
    if (await reportsBlocked(ctx, user)) {
      return {
        totalCourses: 0,
        publishedCourses: 0,
        totalEnrollments: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        avgProgress: 0,
      };
    }
    const [coursesAll, enrollmentsAll] = await Promise.all([
      ctx.db.query("courses").collect(),
      ctx.db.query("courseEnrollments").collect(),
    ]);
    const courses = scopeToOrg(coursesAll, organizationId);
    const enrollments = scopeToOrg(enrollmentsAll, organizationId);
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let sumProgress = 0;
    for (const e of enrollments) {
      sumProgress += e.progress ?? 0;
      if (e.completedAt) completed += 1;
      else if ((e.progress ?? 0) > 0) inProgress += 1;
      else notStarted += 1;
    }
    const avgProgress =
      enrollments.length === 0
        ? 0
        : Math.round(sumProgress / enrollments.length);
    return {
      totalCourses: courses.length,
      publishedCourses: courses.filter((c) => c.isPublished).length,
      totalEnrollments: enrollments.length,
      completed,
      inProgress,
      notStarted,
      avgProgress,
    };
  },
});
