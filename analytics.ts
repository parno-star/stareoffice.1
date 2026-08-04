import { ConvexError } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { isCountableEmployee } from "./lib/countableUsers";
import { isSuperAdminBlocked } from "./superAdminDataAccess";

async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminRole(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya admin yang dapat mengakses dashboard analitik",
    });
  }
  return user;
}

// Super admin data-access gate for cross-organization analytics/statistics.
// Returns true when the caller is a super admin who has not enabled the
// "reports" data category, in which case analytics queries return empty data.
async function reportsBlocked(
  ctx: QueryCtx,
  user: Doc<"users">,
): Promise<boolean> {
  return isSuperAdminBlocked(ctx, user.role === "super_admin", "reports");
}

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

// ---------------------------------------------------------------------------
// Executive KPI summary
// ---------------------------------------------------------------------------

export type AnalyticsKpis = {
  totalEmployees: number;
  activeEmployees: number;
  newHires90d: number;
  newHiresYtd: number;
  openPositions: number;
  totalDepartments: number;
  averageTenureYears: number;
  // Engagement
  avgEngagementScore: number | null; // 0..100
  engagementResponses: number;
  // Performance
  avgPerformanceRating: number | null; // 1..5
  performanceReviews90d: number;
  // Training
  trainingCompletionRate: number; // percent
  certificatesIssued90d: number;
  // Compensation
  avgMonthlySalary: number | null; // IDR
  payrollCostLastPeriod: number | null; // IDR total net
  // Recognition
  recognitions90d: number;
  // Absence
  absenceRate30d: number; // percent of approved leave days vs working days
  // Recruitment
  openRequisitions: number;
  candidatesInPipeline: number;
};

function todayIsoUtc(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}

export const getKpis = query({
  args: {},
  handler: async (ctx): Promise<AnalyticsKpis> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) {
      return {
        totalEmployees: 0,
        activeEmployees: 0,
        newHires90d: 0,
        newHiresYtd: 0,
        openPositions: 0,
        totalDepartments: 0,
        averageTenureYears: 0,
        avgEngagementScore: null,
        engagementResponses: 0,
        avgPerformanceRating: null,
        performanceReviews90d: 0,
        trainingCompletionRate: 0,
        certificatesIssued90d: 0,
        avgMonthlySalary: null,
        payrollCostLastPeriod: null,
        recognitions90d: 0,
        absenceRate30d: 0,
        openRequisitions: 0,
        candidatesInPipeline: 0,
      };
    }
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const threshold90 = now - ninetyDaysMs;
    const threshold30 = now - thirtyDaysMs;
    const today = todayIsoUtc();
    const ninetyAgoIso = new Date(threshold90).toISOString().slice(0, 10);
    const thirtyAgoIso = new Date(threshold30).toISOString().slice(0, 10);
    const yearStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), 0, 1),
    ).toISOString().slice(0, 10);

    const [
      users,
      departments,
      headcountPositions,
      engagementResponses,
      performanceReviews,
      courses,
      enrollments,
      certificates,
      payslips,
      payrollPeriods,
      recognitions,
      leaveRequests,
      recruitmentJobs,
      candidateApplications,
    ] = await Promise.all([
      ctx.db
        .query("users")
        .collect()
        .then((all) => all.filter(isCountableEmployee)),
      ctx.db.query("departments").collect(),
      ctx.db.query("headcountPositions").collect(),
      ctx.db.query("engagementResponses").collect(),
      ctx.db.query("performanceReviews").collect(),
      ctx.db.query("courses").collect(),
      ctx.db.query("courseEnrollments").collect(),
      ctx.db.query("courseCertificates").collect(),
      ctx.db.query("payslips").collect(),
      ctx.db.query("payrollPeriods").collect(),
      ctx.db.query("recognitions").collect(),
      ctx.db.query("leaveRequests").collect(),
      ctx.db.query("recruitmentJobs").collect(),
      ctx.db.query("candidateApplications").collect(),
    ]);

    const totalEmployees = users.length;
    const activeEmployees = users.filter((u) => u.role !== undefined).length;

    // New hires based on startDate
    const newHires90d = users.filter(
      (u) => u.startDate && u.startDate >= ninetyAgoIso && u.startDate <= today,
    ).length;
    const newHiresYtd = users.filter(
      (u) => u.startDate && u.startDate >= yearStart && u.startDate <= today,
    ).length;

    const totalDepartments = new Set(
      departments
        .map((d) => d.name)
        .concat(users.map((u) => u.department ?? "").filter((d) => d !== "")),
    ).size;

    // Average tenure in years
    const tenures = users
      .map((u) => {
        if (!u.startDate) return null;
        const start = new Date(`${u.startDate}T00:00:00Z`).getTime();
        if (Number.isNaN(start)) return null;
        return (now - start) / (365.25 * 24 * 60 * 60 * 1000);
      })
      .filter((t): t is number => t !== null && t >= 0);
    const averageTenureYears =
      tenures.length === 0
        ? 0
        : Math.round((tenures.reduce((a, b) => a + b, 0) / tenures.length) * 10) /
          10;

    // Open positions
    const openPositions = headcountPositions.filter(
      (p) => p.status === "planned" || p.status === "approved" || p.status === "posted",
    ).length;

    // Engagement avg
    const recentEngagement = engagementResponses.filter(
      (r) => new Date(r.submittedAt).getTime() >= threshold90,
    );
    const engWithScore = recentEngagement.filter(
      (r) => typeof r.overallScore === "number",
    );
    const avgEngagementScore =
      engWithScore.length === 0
        ? null
        : Math.round(
            (engWithScore.reduce((acc, r) => acc + (r.overallScore ?? 0), 0) /
              engWithScore.length) *
              20, // convert 1..5 to 0..100
          );

    // Performance avg
    const recentReviews = performanceReviews.filter(
      (r) => r._creationTime >= threshold90,
    );
    const reviewsWithRating = recentReviews.filter(
      (r) => typeof r.overallRating === "number",
    );
    const avgPerformanceRating =
      reviewsWithRating.length === 0
        ? null
        : Math.round(
            (reviewsWithRating.reduce(
              (acc, r) => acc + (r.overallRating ?? 0),
              0,
            ) /
              reviewsWithRating.length) *
              10,
          ) / 10;

    // Training
    const publishedCourses = courses.filter((c) => c.isPublished).length;
    const trainingCompletionRate =
      enrollments.length === 0
        ? 0
        : Math.round(
            (enrollments.filter((e) => e.completedAt).length /
              enrollments.length) *
              100,
          );
    const certificatesIssued90d = certificates.filter(
      (c) => new Date(c.issuedAt).getTime() >= threshold90,
    ).length;

    // Compensation
    const publishedPayslips = payslips.filter((p) => p.status === "published");
    const lastPeriod = payrollPeriods
      .slice()
      .sort((a, b) => b.period.localeCompare(a.period))
      .find((p) => p.status === "published" || p.status === "closed");
    const avgMonthlySalary =
      lastPeriod === undefined
        ? null
        : (() => {
            const lastPeriodSlips = publishedPayslips.filter(
              (p) => p.periodId === lastPeriod._id,
            );
            if (lastPeriodSlips.length === 0) return null;
            const total = lastPeriodSlips.reduce(
              (acc, p) => acc + p.netSalary,
              0,
            );
            return Math.round(total / lastPeriodSlips.length);
          })();
    const payrollCostLastPeriod = lastPeriod?.totalNet ?? null;

    // Recognition
    const recognitions90d = recognitions.filter(
      (r) => r._creationTime >= threshold90,
    ).length;

    // Absence rate: approved leave days in last 30 days divided by 22 working days per employee
    const approvedLeaveDays30 = leaveRequests
      .filter(
        (l) =>
          l.status === "approved" &&
          l.endDate >= thirtyAgoIso &&
          l.startDate <= today,
      )
      .reduce((acc, l) => acc + l.dayCount, 0);
    const expectedDays = Math.max(1, totalEmployees * 22);
    const absenceRate30d = Math.min(
      100,
      Math.round((approvedLeaveDays30 / expectedDays) * 100),
    );

    // Recruitment
    const openRequisitions = recruitmentJobs.filter(
      (j) => j.status === "open",
    ).length;
    const candidatesInPipeline = candidateApplications.filter(
      (a) =>
        a.stage !== "hired" &&
        a.stage !== "rejected" &&
        a.stage !== "withdrawn",
    ).length;

    // Ensure publishedCourses variable not unused
    void publishedCourses;

    return {
      totalEmployees,
      activeEmployees,
      newHires90d,
      newHiresYtd,
      openPositions,
      totalDepartments,
      averageTenureYears,
      avgEngagementScore,
      engagementResponses: recentEngagement.length,
      avgPerformanceRating,
      performanceReviews90d: recentReviews.length,
      trainingCompletionRate,
      certificatesIssued90d,
      avgMonthlySalary,
      payrollCostLastPeriod,
      recognitions90d,
      absenceRate30d,
      openRequisitions,
      candidatesInPipeline,
    };
  },
});

// ---------------------------------------------------------------------------
// Workforce composition: by department, by level, by role, by location
// ---------------------------------------------------------------------------

export type CompositionItem = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export type WorkforceComposition = {
  byDepartment: Array<CompositionItem>;
  byLevel: Array<CompositionItem>;
  byLocation: Array<CompositionItem>;
  byRole: Array<CompositionItem>;
};

function buildComposition(
  labels: Array<string>,
): Array<CompositionItem> {
  const map = new Map<string, number>();
  for (const label of labels) {
    const key = label.trim().length === 0 ? "Tidak Ditentukan" : label.trim();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const total = labels.length || 1;
  return Array.from(map.entries())
    .map(([label, count]) => ({
      key: label,
      label,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export const getWorkforceComposition = query({
  args: {},
  handler: async (ctx): Promise<WorkforceComposition> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) {
      return { byDepartment: [], byLevel: [], byLocation: [], byRole: [] };
    }
    const users = (await ctx.db.query("users").collect()).filter(
      isCountableEmployee,
    );

    const byDepartment = buildComposition(
      users.map((u) => u.department ?? ""),
    );
    const byLocation = buildComposition(users.map((u) => u.location ?? ""));
    const byRole = buildComposition(users.map((u) => u.role ?? "employee"));

    // Infer level from jobTitle keyword; fallback to "Karyawan"
    const byLevel = buildComposition(
      users.map((u) => {
        const title = (u.jobTitle ?? "").toLowerCase();
        if (title.includes("director") || title.includes("direktur"))
          return "Direktur";
        if (
          title.includes("manager") ||
          title.includes("head") ||
          title.includes("kepala")
        )
          return "Manager";
        if (title.includes("lead") || title.includes("ketua")) return "Lead";
        if (title.includes("senior")) return "Senior";
        if (title.includes("junior") || title.includes("intern"))
          return "Junior";
        return "Staff";
      }),
    );

    return { byDepartment, byLevel, byLocation, byRole };
  },
});

// ---------------------------------------------------------------------------
// Headcount trend: last 12 months based on startDate
// ---------------------------------------------------------------------------

export type HeadcountTrendPoint = {
  month: string; // YYYY-MM
  label: string;
  hires: number;
  cumulative: number;
};

export const getHeadcountTrend = query({
  args: {},
  handler: async (ctx): Promise<Array<HeadcountTrendPoint>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const users = (await ctx.db.query("users").collect()).filter(
      isCountableEmployee,
    );

    const now = new Date();
    const buckets = new Map<string, HeadcountTrendPoint>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
        2,
        "0",
      )}`;
      const label = `${MONTH_LABELS_ID[d.getUTCMonth()]} ${String(
        d.getUTCFullYear(),
      ).slice(2)}`;
      buckets.set(key, { month: key, label, hires: 0, cumulative: 0 });
    }

    const earliestKey = Array.from(buckets.keys())[0];
    let baselineBefore = 0;
    for (const u of users) {
      if (!u.startDate) continue;
      const key = u.startDate.slice(0, 7);
      if (key < earliestKey) {
        baselineBefore += 1;
        continue;
      }
      const b = buckets.get(key);
      if (b) b.hires += 1;
    }

    let running = baselineBefore;
    for (const entry of buckets.values()) {
      running += entry.hires;
      entry.cumulative = running;
    }
    return Array.from(buckets.values());
  },
});

// ---------------------------------------------------------------------------
// Tenure distribution buckets
// ---------------------------------------------------------------------------

export type TenureBucket = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export const getTenureDistribution = query({
  args: {},
  handler: async (ctx): Promise<Array<TenureBucket>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const users = (await ctx.db.query("users").collect()).filter(
      isCountableEmployee,
    );
    const now = Date.now();
    const yearMs = 365.25 * 24 * 60 * 60 * 1000;

    const buckets: Array<{ key: string; label: string; min: number; max: number }> = [
      { key: "lt1", label: "< 1 tahun", min: 0, max: 1 },
      { key: "1-3", label: "1 - 3 tahun", min: 1, max: 3 },
      { key: "3-5", label: "3 - 5 tahun", min: 3, max: 5 },
      { key: "5-10", label: "5 - 10 tahun", min: 5, max: 10 },
      { key: "gt10", label: "> 10 tahun", min: 10, max: 200 },
    ];

    const counts = new Map<string, number>(
      buckets.map((b) => [b.key, 0]),
    );
    let totalWithTenure = 0;
    for (const u of users) {
      if (!u.startDate) continue;
      const start = new Date(`${u.startDate}T00:00:00Z`).getTime();
      if (Number.isNaN(start)) continue;
      const years = (now - start) / yearMs;
      if (years < 0) continue;
      const bucket = buckets.find((b) => years >= b.min && years < b.max);
      if (bucket) {
        counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
        totalWithTenure += 1;
      }
    }
    const total = totalWithTenure || 1;
    return buckets.map((b) => {
      const count = counts.get(b.key) ?? 0;
      return {
        key: b.key,
        label: b.label,
        count,
        percent: Math.round((count / total) * 1000) / 10,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// Department performance & engagement scorecard
// ---------------------------------------------------------------------------

export type DepartmentScorecard = {
  department: string;
  headcount: number;
  avgTenureYears: number;
  avgPerformance: number | null; // 1..5
  avgEngagement: number | null; // 0..100
  trainingCompletions: number;
  recognitionCount: number; // last 90 days
  absenceDays: number; // last 30 days approved leave
  openPositions: number;
};

export const getDepartmentScorecard = query({
  args: {},
  handler: async (ctx): Promise<Array<DepartmentScorecard>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const now = Date.now();
    const ninetyAgo = now - 90 * 24 * 60 * 60 * 1000;
    const thirtyAgo = now - 30 * 24 * 60 * 60 * 1000;
    const thirtyAgoIso = new Date(thirtyAgo).toISOString().slice(0, 10);

    const [
      users,
      performanceReviews,
      engagementResponses,
      certificates,
      recognitions,
      leaveRequests,
      headcountPositions,
    ] = await Promise.all([
      ctx.db
        .query("users")
        .collect()
        .then((all) => all.filter(isCountableEmployee)),
      ctx.db.query("performanceReviews").collect(),
      ctx.db.query("engagementResponses").collect(),
      ctx.db.query("courseCertificates").collect(),
      ctx.db.query("recognitions").collect(),
      ctx.db.query("leaveRequests").collect(),
      ctx.db.query("headcountPositions").collect(),
    ]);

    const yearMs = 365.25 * 24 * 60 * 60 * 1000;
    const userById = new Map<string, Doc<"users">>();
    for (const u of users) {
      userById.set(u._id, u);
    }

    type DeptAgg = {
      department: string;
      headcount: number;
      tenureSum: number;
      tenureCount: number;
      perfSum: number;
      perfCount: number;
      engSum: number;
      engCount: number;
      trainingCompletions: number;
      recognitionCount: number;
      absenceDays: number;
      openPositions: number;
    };

    const agg = new Map<string, DeptAgg>();
    const getDept = (name: string | undefined): string =>
      name && name.trim().length > 0 ? name.trim() : "Tanpa Departemen";

    const ensure = (name: string): DeptAgg => {
      const existing = agg.get(name);
      if (existing) return existing;
      const created: DeptAgg = {
        department: name,
        headcount: 0,
        tenureSum: 0,
        tenureCount: 0,
        perfSum: 0,
        perfCount: 0,
        engSum: 0,
        engCount: 0,
        trainingCompletions: 0,
        recognitionCount: 0,
        absenceDays: 0,
        openPositions: 0,
      };
      agg.set(name, created);
      return created;
    };

    for (const u of users) {
      const dept = getDept(u.department);
      const a = ensure(dept);
      a.headcount += 1;
      if (u.startDate) {
        const t =
          (now - new Date(`${u.startDate}T00:00:00Z`).getTime()) / yearMs;
        if (t >= 0) {
          a.tenureSum += t;
          a.tenureCount += 1;
        }
      }
    }

    for (const r of performanceReviews) {
      if (r._creationTime < ninetyAgo) continue;
      if (typeof r.overallRating !== "number") continue;
      const user = userById.get(r.revieweeId);
      const a = ensure(getDept(user?.department));
      a.perfSum += r.overallRating;
      a.perfCount += 1;
    }

    for (const r of engagementResponses) {
      if (new Date(r.submittedAt).getTime() < ninetyAgo) continue;
      if (typeof r.overallScore !== "number") continue;
      const dept = getDept(r.userDepartment);
      const a = ensure(dept);
      a.engSum += r.overallScore * 20; // 1..5 -> 0..100
      a.engCount += 1;
    }

    for (const c of certificates) {
      if (new Date(c.issuedAt).getTime() < ninetyAgo) continue;
      const user = userById.get(c.userId);
      const a = ensure(getDept(user?.department));
      a.trainingCompletions += 1;
    }

    for (const r of recognitions) {
      if (r._creationTime < ninetyAgo) continue;
      const user = userById.get(r.toUserId);
      const a = ensure(getDept(user?.department));
      a.recognitionCount += 1;
    }

    for (const l of leaveRequests) {
      if (l.status !== "approved") continue;
      if (l.endDate < thirtyAgoIso) continue;
      const user = userById.get(l.userId);
      const a = ensure(getDept(user?.department));
      a.absenceDays += l.dayCount;
    }

    for (const p of headcountPositions) {
      if (
        p.status !== "planned" &&
        p.status !== "approved" &&
        p.status !== "posted"
      )
        continue;
      const a = ensure(getDept(p.department));
      a.openPositions += 1;
    }

    return Array.from(agg.values())
      .map((a) => ({
        department: a.department,
        headcount: a.headcount,
        avgTenureYears:
          a.tenureCount === 0
            ? 0
            : Math.round((a.tenureSum / a.tenureCount) * 10) / 10,
        avgPerformance:
          a.perfCount === 0
            ? null
            : Math.round((a.perfSum / a.perfCount) * 10) / 10,
        avgEngagement:
          a.engCount === 0 ? null : Math.round(a.engSum / a.engCount),
        trainingCompletions: a.trainingCompletions,
        recognitionCount: a.recognitionCount,
        absenceDays: a.absenceDays,
        openPositions: a.openPositions,
      }))
      .sort((a, b) => b.headcount - a.headcount);
  },
});

// ---------------------------------------------------------------------------
// Performance rating distribution
// ---------------------------------------------------------------------------

export type PerformanceRatingBucket = {
  rating: number; // 1..5
  label: string;
  count: number;
  percent: number;
};

export const getPerformanceDistribution = query({
  args: {},
  handler: async (ctx): Promise<Array<PerformanceRatingBucket>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const reviews = await ctx.db.query("performanceReviews").collect();
    const filtered = reviews.filter(
      (r) =>
        typeof r.overallRating === "number" &&
        (r.status === "submitted" || r.status === "acknowledged"),
    );
    const counts = [0, 0, 0, 0, 0];
    for (const r of filtered) {
      const idx = Math.max(
        0,
        Math.min(4, Math.round(r.overallRating ?? 0) - 1),
      );
      counts[idx] += 1;
    }
    const total = filtered.length || 1;
    const labels = [
      "Perlu Perbaikan",
      "Dibawah Standar",
      "Memenuhi Standar",
      "Melebihi Standar",
      "Luar Biasa",
    ];
    return counts.map((count, i) => ({
      rating: i + 1,
      label: labels[i],
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }));
  },
});

// ---------------------------------------------------------------------------
// Compensation insights
// ---------------------------------------------------------------------------

export type CompensationByDepartment = {
  department: string;
  headcount: number;
  avgSalary: number;
  minSalary: number;
  maxSalary: number;
  totalCost: number;
};

export const getCompensationByDepartment = query({
  args: {},
  handler: async (ctx): Promise<Array<CompensationByDepartment>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const [payslips, payrollPeriods] = await Promise.all([
      ctx.db.query("payslips").collect(),
      ctx.db.query("payrollPeriods").collect(),
    ]);
    const lastPeriod = payrollPeriods
      .slice()
      .sort((a, b) => b.period.localeCompare(a.period))
      .find((p) => p.status === "published" || p.status === "closed");
    if (lastPeriod === undefined) return [];

    const lastSlips = payslips.filter((p) => p.periodId === lastPeriod._id);

    type Agg = {
      department: string;
      headcount: number;
      total: number;
      min: number;
      max: number;
    };
    const map = new Map<string, Agg>();
    for (const p of lastSlips) {
      const d =
        p.userDepartment && p.userDepartment.trim().length > 0
          ? p.userDepartment
          : "Tanpa Departemen";
      const cur =
        map.get(d) ??
        ({
          department: d,
          headcount: 0,
          total: 0,
          min: Number.POSITIVE_INFINITY,
          max: 0,
        } satisfies Agg);
      cur.headcount += 1;
      cur.total += p.netSalary;
      cur.min = Math.min(cur.min, p.netSalary);
      cur.max = Math.max(cur.max, p.netSalary);
      map.set(d, cur);
    }
    return Array.from(map.values())
      .map((a) => ({
        department: a.department,
        headcount: a.headcount,
        avgSalary: Math.round(a.total / Math.max(1, a.headcount)),
        minSalary: a.min === Number.POSITIVE_INFINITY ? 0 : a.min,
        maxSalary: a.max,
        totalCost: a.total,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  },
});

export type PayrollTrendPoint = {
  period: string;
  label: string;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  employeeCount: number;
};

export const getPayrollTrend = query({
  args: {},
  handler: async (ctx): Promise<Array<PayrollTrendPoint>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const periods = await ctx.db.query("payrollPeriods").collect();
    const recent = periods
      .filter((p) => p.status === "published" || p.status === "closed")
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12);
    return recent.map((p) => ({
      period: p.period,
      label: p.periodLabel,
      totalGross: p.totalGross,
      totalNet: p.totalNet,
      totalDeductions: p.totalDeductions,
      employeeCount: p.employeeCount,
    }));
  },
});

// ---------------------------------------------------------------------------
// Recruitment pipeline funnel
// ---------------------------------------------------------------------------

export type PipelineStageItem = {
  stage: string;
  label: string;
  count: number;
};

export const getRecruitmentPipeline = query({
  args: {},
  handler: async (ctx): Promise<Array<PipelineStageItem>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const apps = await ctx.db.query("candidateApplications").collect();
    const stages: Array<{ key: string; label: string }> = [
      { key: "sourced", label: "Sourced" },
      { key: "applied", label: "Aplikasi" },
      { key: "screening", label: "Screening" },
      { key: "interview", label: "Interview" },
      { key: "offer", label: "Offer" },
      { key: "hired", label: "Hired" },
    ];
    const counts = new Map<string, number>();
    for (const a of apps) counts.set(a.stage, (counts.get(a.stage) ?? 0) + 1);
    return stages.map((s) => ({
      stage: s.key,
      label: s.label,
      count: counts.get(s.key) ?? 0,
    }));
  },
});

// ---------------------------------------------------------------------------
// Engagement pulse: mood trend last 12 weeks
// ---------------------------------------------------------------------------

export type EngagementPulsePoint = {
  weekStart: string; // YYYY-MM-DD
  label: string;
  avgScore: number | null; // 0..100
  responses: number;
};

function getWeekStart(isoString: string): string {
  const d = new Date(isoString);
  const day = d.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday),
  );
  return start.toISOString().slice(0, 10);
}

export const getEngagementPulse = query({
  args: {},
  handler: async (ctx): Promise<Array<EngagementPulsePoint>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const responses = await ctx.db.query("engagementResponses").collect();
    const now = new Date();
    const weeks: Array<EngagementPulsePoint> = [];
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const day = todayUtc.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const thisMonday = new Date(todayUtc.getTime() - diffToMonday * 24 * 60 * 60 * 1000);

    const buckets = new Map<
      string,
      { weekStart: string; label: string; sum: number; count: number }
    >();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(thisMonday.getTime() - i * weekMs);
      const key = start.toISOString().slice(0, 10);
      const mm = String(start.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(start.getUTCDate()).padStart(2, "0");
      buckets.set(key, {
        weekStart: key,
        label: `${dd}/${mm}`,
        sum: 0,
        count: 0,
      });
      weeks.push({
        weekStart: key,
        label: `${dd}/${mm}`,
        avgScore: null,
        responses: 0,
      });
    }

    for (const r of responses) {
      if (typeof r.overallScore !== "number") continue;
      const wk = getWeekStart(r.submittedAt);
      const b = buckets.get(wk);
      if (!b) continue;
      b.sum += r.overallScore * 20;
      b.count += 1;
    }

    return weeks.map((w) => {
      const b = buckets.get(w.weekStart);
      if (!b || b.count === 0) return w;
      return {
        ...w,
        avgScore: Math.round(b.sum / b.count),
        responses: b.count,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// Top skills gap (from competencyAssessments & competencies)
// ---------------------------------------------------------------------------

export type SkillItem = {
  skill: string;
  category: string;
  count: number;
  avgLevel: number; // 1..5
};

export const getTopSkills = query({
  args: {},
  handler: async (ctx): Promise<Array<SkillItem>> => {
    const user = await requireAdmin(ctx);
    if (await reportsBlocked(ctx, user)) return [];
    const skills = await ctx.db.query("employeeSkills").collect();
    const map = new Map<
      string,
      { skill: string; category: string; count: number; sum: number }
    >();
    for (const s of skills) {
      const key = `${s.skill}|${s.category}`;
      const cur =
        map.get(key) ??
        {
          skill: s.skill,
          category: s.category,
          count: 0,
          sum: 0,
        };
      cur.count += 1;
      cur.sum += s.level;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((s) => ({
        skill: s.skill,
        category: s.category,
        count: s.count,
        avgLevel: Math.round((s.sum / s.count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  },
});
