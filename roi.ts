import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireAdmin, requireUser } from "./_helpers";

// ---- Course benefit CRUD (admin) ----

export const getCourseBenefit = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args): Promise<Doc<"courseBenefits"> | null> => {
    await requireUser(ctx);
    return await ctx.db
      .query("courseBenefits")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
  },
});

export const setCourseBenefit = mutation({
  args: {
    courseId: v.id("courses"),
    benefitPerLearner: v.number(),
    benefitType: v.string(),
    confidence: v.string(),
    benefitDurationMonths: v.optional(v.number()),
    assumptions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("courseBenefits")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .first();
    const payload: Omit<Doc<"courseBenefits">, "_id" | "_creationTime"> = {
      courseId: args.courseId,
      benefitPerLearner: Math.max(0, Math.round(args.benefitPerLearner)),
      benefitType: args.benefitType,
      confidence: args.confidence,
      benefitDurationMonths: args.benefitDurationMonths,
      assumptions: args.assumptions?.trim() || undefined,
      updatedBy: admin._id,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("courseBenefits", payload);
    }
    return null;
  },
});

// ---- Training outcomes CRUD ----

export const listOutcomesByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<Doc<"trainingOutcomes"> & { userName: string | null }>
  > => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("trainingOutcomes")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    rows.sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
    const out: Array<Doc<"trainingOutcomes"> & { userName: string | null }> =
      [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({ ...r, userName: u?.name ?? null });
    }
    return out;
  },
});

export const recordOutcome = mutation({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
    metricType: v.string(),
    metricName: v.string(),
    baselineValue: v.optional(v.number()),
    postValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    realizedBenefit: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"trainingOutcomes">> => {
    const admin = await requireAdmin(ctx);
    return await ctx.db.insert("trainingOutcomes", {
      userId: args.userId,
      courseId: args.courseId,
      metricType: args.metricType,
      metricName: args.metricName.trim(),
      baselineValue: args.baselineValue,
      postValue: args.postValue,
      unit: args.unit?.trim() || undefined,
      realizedBenefit:
        args.realizedBenefit !== undefined
          ? Math.max(0, Math.round(args.realizedBenefit))
          : undefined,
      note: args.note?.trim() || undefined,
      recordedAt: new Date().toISOString(),
      recordedById: admin._id,
    });
  },
});

export const deleteOutcome = mutation({
  args: { id: v.id("trainingOutcomes") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

// ---- ROI per course ----

type CourseRoi = {
  courseId: Id<"courses">;
  title: string;
  category: string;
  enrollmentCount: number;
  completedCount: number;
  completionRate: number;
  // spend
  costPerEnrollment: number;
  costModel: string;
  totalSpend: number;
  externalSpend: number;
  realizedBenefit: number;
  // benefit assumptions
  benefitPerLearner: number;
  benefitType: string | null;
  confidence: string | null;
  // computed
  expectedBenefit: number;
  totalBenefit: number;
  netBenefit: number;
  roi: number | null; // percent; null when no spend
  paybackMonths: number | null;
};

export const getCourseRoiBreakdown = query({
  args: {},
  handler: async (ctx): Promise<Array<CourseRoi>> => {
    await requireAdmin(ctx);
    const courses = await ctx.db.query("courses").collect();
    const enrollments = await ctx.db.query("courseEnrollments").collect();
    const courseCosts = await ctx.db.query("courseCosts").collect();
    const benefits = await ctx.db.query("courseBenefits").collect();
    const approvedExternal = await ctx.db
      .query("externalTrainings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const outcomes = await ctx.db.query("trainingOutcomes").collect();

    const costByCourse = new Map<Id<"courses">, Doc<"courseCosts">>();
    for (const c of courseCosts) costByCourse.set(c.courseId, c);
    const benefitByCourse = new Map<Id<"courses">, Doc<"courseBenefits">>();
    for (const b of benefits) benefitByCourse.set(b.courseId, b);

    // External training spend keyed by provider+title-like key is not linked
    // to a course; we instead return total external spend as a separate
    // "externalSpend" metric associated with the course that shares the
    // (lowercase) title, when present.
    const externalByCourseTitle = new Map<string, number>();
    for (const e of approvedExternal) {
      const key = e.title.trim().toLowerCase();
      externalByCourseTitle.set(
        key,
        (externalByCourseTitle.get(key) ?? 0) + (e.cost ?? 0),
      );
    }

    const realizedByCourse = new Map<Id<"courses">, number>();
    for (const o of outcomes) {
      realizedByCourse.set(
        o.courseId,
        (realizedByCourse.get(o.courseId) ?? 0) + (o.realizedBenefit ?? 0),
      );
    }

    const out: Array<CourseRoi> = [];
    for (const c of courses) {
      const forCourse = enrollments.filter((e) => e.courseId === c._id);
      const completedCount = forCourse.filter((e) => e.completedAt).length;
      const cost = costByCourse.get(c._id);
      const benefit = benefitByCourse.get(c._id);
      const costPerEnrollment = cost?.amount ?? 0;
      const costModel = cost?.model ?? "per_enrollment";
      const totalInternalSpend =
        costModel === "flat"
          ? costPerEnrollment
          : costPerEnrollment * forCourse.length;
      const externalSpend =
        externalByCourseTitle.get(c.title.trim().toLowerCase()) ?? 0;
      const totalSpend = totalInternalSpend + externalSpend;
      const benefitPerLearner = benefit?.benefitPerLearner ?? 0;
      const expectedBenefit = benefitPerLearner * completedCount;
      const realizedBenefit = realizedByCourse.get(c._id) ?? 0;
      const totalBenefit =
        realizedBenefit > 0
          ? realizedBenefit + expectedBenefit * 0.2 // blend realized with forecast
          : expectedBenefit;
      const netBenefit = totalBenefit - totalSpend;
      const roi =
        totalSpend === 0
          ? null
          : Math.round((netBenefit / totalSpend) * 100);
      const monthlyBenefit =
        benefit?.benefitDurationMonths && benefit.benefitDurationMonths > 0
          ? totalBenefit / benefit.benefitDurationMonths
          : totalBenefit / 12;
      const paybackMonths =
        totalSpend === 0 || monthlyBenefit <= 0
          ? null
          : Math.max(1, Math.round(totalSpend / monthlyBenefit));

      out.push({
        courseId: c._id,
        title: c.title,
        category: c.category,
        enrollmentCount: forCourse.length,
        completedCount,
        completionRate:
          forCourse.length === 0
            ? 0
            : Math.round((completedCount / forCourse.length) * 100),
        costPerEnrollment,
        costModel,
        totalSpend,
        externalSpend,
        realizedBenefit,
        benefitPerLearner,
        benefitType: benefit?.benefitType ?? null,
        confidence: benefit?.confidence ?? null,
        expectedBenefit,
        totalBenefit,
        netBenefit,
        roi,
        paybackMonths,
      });
    }
    out.sort((a, b) => b.netBenefit - a.netBenefit);
    return out;
  },
});

// ---- ROI dashboard totals ----

type RoiSummary = {
  totals: {
    totalSpend: number;
    totalBenefit: number;
    netBenefit: number;
    roi: number | null;
    coveredCourses: number; // courses with cost + benefit set
    totalEnrollments: number;
    totalCompletions: number;
  };
  byCategory: Array<{
    category: string;
    spend: number;
    benefit: number;
    netBenefit: number;
    roi: number | null;
  }>;
  byDepartment: Array<{
    department: string;
    spend: number;
    benefit: number;
    netBenefit: number;
    roi: number | null;
  }>;
  topCourses: Array<{
    courseId: Id<"courses">;
    title: string;
    roi: number | null;
    netBenefit: number;
    totalSpend: number;
  }>;
};

export const getRoiSummary = query({
  args: {},
  handler: async (ctx): Promise<RoiSummary> => {
    await requireAdmin(ctx);
    const courses = await ctx.db.query("courses").collect();
    const enrollments = await ctx.db.query("courseEnrollments").collect();
    const courseCosts = await ctx.db.query("courseCosts").collect();
    const benefits = await ctx.db.query("courseBenefits").collect();
    const approvedExternal = await ctx.db
      .query("externalTrainings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const outcomes = await ctx.db.query("trainingOutcomes").collect();

    const costByCourse = new Map<Id<"courses">, Doc<"courseCosts">>();
    for (const c of courseCosts) costByCourse.set(c.courseId, c);
    const benefitByCourse = new Map<Id<"courses">, Doc<"courseBenefits">>();
    for (const b of benefits) benefitByCourse.set(b.courseId, b);
    const realizedByCourse = new Map<Id<"courses">, number>();
    for (const o of outcomes) {
      realizedByCourse.set(
        o.courseId,
        (realizedByCourse.get(o.courseId) ?? 0) + (o.realizedBenefit ?? 0),
      );
    }

    const byCategoryMap = new Map<
      string,
      { spend: number; benefit: number }
    >();
    const byDeptMap = new Map<
      string,
      { spend: number; benefit: number }
    >();
    const topCourses: Array<{
      courseId: Id<"courses">;
      title: string;
      roi: number | null;
      netBenefit: number;
      totalSpend: number;
    }> = [];

    let totalSpend = 0;
    let totalBenefit = 0;
    let totalEnrollments = 0;
    let totalCompletions = 0;
    let coveredCourses = 0;

    // userId -> department
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users">) => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };

    for (const c of courses) {
      const forCourse = enrollments.filter((e) => e.courseId === c._id);
      const completed = forCourse.filter((e) => e.completedAt).length;
      totalEnrollments += forCourse.length;
      totalCompletions += completed;
      const cost = costByCourse.get(c._id);
      const benefit = benefitByCourse.get(c._id);
      const costPerEnrollment = cost?.amount ?? 0;
      const courseSpend =
        cost?.model === "flat"
          ? costPerEnrollment
          : costPerEnrollment * forCourse.length;
      const benefitPerLearner = benefit?.benefitPerLearner ?? 0;
      const expectedBenefit = benefitPerLearner * completed;
      const realized = realizedByCourse.get(c._id) ?? 0;
      const courseBenefit =
        realized > 0 ? realized + expectedBenefit * 0.2 : expectedBenefit;

      totalSpend += courseSpend;
      totalBenefit += courseBenefit;
      if (cost && benefit) coveredCourses += 1;

      // By category
      const catCur = byCategoryMap.get(c.category) ?? { spend: 0, benefit: 0 };
      catCur.spend += courseSpend;
      catCur.benefit += courseBenefit;
      byCategoryMap.set(c.category, catCur);

      // By department: split spend per completed learner's department
      if (forCourse.length > 0) {
        const perSpend = courseSpend / forCourse.length;
        const perBenefit =
          completed > 0 ? courseBenefit / forCourse.length : 0;
        for (const e of forCourse) {
          const u = await getUser(e.userId);
          const dept = u?.department ?? "Tanpa Departemen";
          const cur = byDeptMap.get(dept) ?? { spend: 0, benefit: 0 };
          cur.spend += perSpend;
          if (e.completedAt) cur.benefit += perBenefit;
          byDeptMap.set(dept, cur);
        }
      }

      const net = courseBenefit - courseSpend;
      const roiPct =
        courseSpend === 0 ? null : Math.round((net / courseSpend) * 100);
      topCourses.push({
        courseId: c._id,
        title: c.title,
        roi: roiPct,
        netBenefit: net,
        totalSpend: courseSpend,
      });
    }

    // Add approved external trainings spend to department buckets
    for (const e of approvedExternal) {
      if (!e.cost) continue;
      const u = await getUser(e.userId);
      const dept = u?.department ?? "Tanpa Departemen";
      const cur = byDeptMap.get(dept) ?? { spend: 0, benefit: 0 };
      cur.spend += e.cost;
      byDeptMap.set(dept, cur);
      totalSpend += e.cost;
    }

    const byCategory = Array.from(byCategoryMap.entries())
      .map(([category, v2]) => ({
        category,
        spend: Math.round(v2.spend),
        benefit: Math.round(v2.benefit),
        netBenefit: Math.round(v2.benefit - v2.spend),
        roi:
          v2.spend === 0
            ? null
            : Math.round(((v2.benefit - v2.spend) / v2.spend) * 100),
      }))
      .sort((a, b) => b.netBenefit - a.netBenefit);

    const byDepartment = Array.from(byDeptMap.entries())
      .map(([department, v2]) => ({
        department,
        spend: Math.round(v2.spend),
        benefit: Math.round(v2.benefit),
        netBenefit: Math.round(v2.benefit - v2.spend),
        roi:
          v2.spend === 0
            ? null
            : Math.round(((v2.benefit - v2.spend) / v2.spend) * 100),
      }))
      .sort((a, b) => b.netBenefit - a.netBenefit);

    topCourses.sort((a, b) => b.netBenefit - a.netBenefit);
    const net = totalBenefit - totalSpend;
    return {
      totals: {
        totalSpend: Math.round(totalSpend),
        totalBenefit: Math.round(totalBenefit),
        netBenefit: Math.round(net),
        roi:
          totalSpend === 0 ? null : Math.round((net / totalSpend) * 100),
        coveredCourses,
        totalEnrollments,
        totalCompletions,
      },
      byCategory,
      byDepartment,
      topCourses: topCourses.slice(0, 8),
    };
  },
});

// ---- Training demand & completion forecast (next period) ----

type Forecast = {
  // Rolling monthly history used for the forecast
  history: Array<{
    period: string; // YYYY-MM
    enrollments: number;
    completions: number;
    spend: number;
  }>;
  // Next 3 months predicted
  forecast: Array<{
    period: string;
    predictedEnrollments: number;
    predictedCompletions: number;
    predictedSpend: number;
    lowerBound: number; // 80% band
    upperBound: number;
  }>;
  // Predicted risk: courses likely to be under-completed
  atRiskCourses: Array<{
    courseId: Id<"courses">;
    title: string;
    completionRate: number;
    enrollmentCount: number;
    reason: string;
  }>;
};

function monthKey(ts: number | string): string {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(period: string, step: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + step, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const getTrainingForecast = query({
  args: {},
  handler: async (ctx): Promise<Forecast> => {
    await requireAdmin(ctx);
    const enrollments = await ctx.db.query("courseEnrollments").collect();
    const courseCosts = await ctx.db.query("courseCosts").collect();
    const approvedExternal = await ctx.db
      .query("externalTrainings")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const courses = await ctx.db.query("courses").collect();

    const costByCourse = new Map<Id<"courses">, Doc<"courseCosts">>();
    for (const c of courseCosts) costByCourse.set(c.courseId, c);

    // Build last 6 months history
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      months.push(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      );
    }
    const historyMap = new Map<
      string,
      { enrollments: number; completions: number; spend: number }
    >();
    for (const m of months)
      historyMap.set(m, { enrollments: 0, completions: 0, spend: 0 });

    for (const e of enrollments) {
      const ek = monthKey(e.enrolledAt);
      if (historyMap.has(ek)) {
        const cur = historyMap.get(ek);
        if (cur) cur.enrollments += 1;
        const cost = costByCourse.get(e.courseId);
        if (cost) {
          if (historyMap.get(ek)) {
            historyMap.get(ek)!.spend += cost.amount;
          }
        }
      }
      if (e.completedAt) {
        const ck = monthKey(e.completedAt);
        if (historyMap.has(ck)) {
          historyMap.get(ck)!.completions += 1;
        }
      }
    }
    for (const ex of approvedExternal) {
      const k = monthKey(ex.completedDate);
      if (historyMap.has(k)) {
        historyMap.get(k)!.spend += ex.cost ?? 0;
      }
    }

    const history = months.map((m) => ({
      period: m,
      enrollments: historyMap.get(m)?.enrollments ?? 0,
      completions: historyMap.get(m)?.completions ?? 0,
      spend: Math.round(historyMap.get(m)?.spend ?? 0),
    }));

    // Linear regression on enrollments (x = index 0..n-1, y = enrollments)
    function regression(
      values: number[],
    ): { slope: number; intercept: number; stdErr: number } {
      const n = values.length;
      if (n === 0) return { slope: 0, intercept: 0, stdErr: 0 };
      const xs = values.map((_, i) => i);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = values.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (values[i] - meanY);
        den += (xs[i] - meanX) ** 2;
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = meanY - slope * meanX;
      // standard error of residuals
      let sse = 0;
      for (let i = 0; i < n; i++) {
        const pred = intercept + slope * xs[i];
        sse += (values[i] - pred) ** 2;
      }
      const stdErr = n <= 2 ? 0 : Math.sqrt(sse / (n - 2));
      return { slope, intercept, stdErr };
    }

    const enrollReg = regression(history.map((h) => h.enrollments));
    const complReg = regression(history.map((h) => h.completions));
    const spendReg = regression(history.map((h) => h.spend));

    const lastPeriod = months[months.length - 1];
    const forecast: Forecast["forecast"] = [];
    for (let i = 1; i <= 3; i++) {
      const period = nextMonth(lastPeriod, i);
      const x = history.length - 1 + i;
      const predEnroll = Math.max(
        0,
        Math.round(enrollReg.intercept + enrollReg.slope * x),
      );
      const predCompl = Math.max(
        0,
        Math.round(complReg.intercept + complReg.slope * x),
      );
      const predSpend = Math.max(
        0,
        Math.round(spendReg.intercept + spendReg.slope * x),
      );
      // 80% band ~ 1.28 * stdErr
      const band = Math.round(enrollReg.stdErr * 1.28);
      forecast.push({
        period,
        predictedEnrollments: predEnroll,
        predictedCompletions: predCompl,
        predictedSpend: predSpend,
        lowerBound: Math.max(0, predEnroll - band),
        upperBound: predEnroll + band,
      });
    }

    // At-risk courses: low completion rate (<40%) with >=3 enrollments
    const atRiskCourses: Forecast["atRiskCourses"] = [];
    for (const c of courses) {
      const forCourse = enrollments.filter((e) => e.courseId === c._id);
      const completedCount = forCourse.filter((e) => e.completedAt).length;
      if (forCourse.length < 3) continue;
      const rate = Math.round((completedCount / forCourse.length) * 100);
      if (rate >= 40) continue;
      // Reason: stalled enrollments with low last-access > 21 days
      const now = Date.now();
      const stalled = forCourse.filter((e) => {
        const last = new Date(e.lastAccessedAt).getTime();
        return !e.completedAt && now - last > 21 * 24 * 60 * 60 * 1000;
      }).length;
      const reason =
        stalled > forCourse.length * 0.5
          ? `${stalled} peserta pasif > 21 hari`
          : `Tingkat penyelesaian rendah (${rate}%)`;
      atRiskCourses.push({
        courseId: c._id,
        title: c.title,
        completionRate: rate,
        enrollmentCount: forCourse.length,
        reason,
      });
    }
    atRiskCourses.sort((a, b) => a.completionRate - b.completionRate);

    return {
      history,
      forecast,
      atRiskCourses: atRiskCourses.slice(0, 8),
    };
  },
});
