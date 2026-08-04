import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";

export type BirthdayItem = {
  userId: Doc<"users">["_id"];
  name: string;
  jobTitle: string | null;
  department: string | null;
  avatarUrl: string | null;
  birthday: string; // MM-DD
  daysUntil: number; // 0 = today
  nextDate: string; // YYYY-MM-DD (next occurrence)
};

export type AnniversaryItem = {
  userId: Doc<"users">["_id"];
  name: string;
  jobTitle: string | null;
  department: string | null;
  avatarUrl: string | null;
  startDate: string; // YYYY-MM-DD
  years: number; // number of years on the next occurrence
  daysUntil: number;
  nextDate: string;
};

// Date helpers (year-agnostic, UTC to avoid locale drift)
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function todayUtc(): Date {
  return startOfUtcDay(new Date());
}

function formatIsoUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nextBirthdayOccurrence(
  mmdd: string,
  today: Date,
): { date: Date; daysUntil: number } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const year = today.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, month - 1, day));
  // Handle Feb 29 for non-leap years by falling back to Feb 28
  if (candidate.getUTCMonth() !== month - 1) {
    candidate = new Date(Date.UTC(year, month - 1, day - 1));
  }
  if (candidate.getTime() < today.getTime()) {
    candidate = new Date(Date.UTC(year + 1, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1) {
      candidate = new Date(Date.UTC(year + 1, month - 1, day - 1));
    }
  }
  const daysUntil = Math.round(
    (candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return { date: candidate, daysUntil };
}

function nextAnniversaryOccurrence(
  isoStart: string,
  today: Date,
): { date: Date; daysUntil: number; years: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoStart);
  if (!match) return null;
  const startYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const currentYear = today.getUTCFullYear();
  let year = currentYear;
  let candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) {
    candidate = new Date(Date.UTC(year, month - 1, day - 1));
  }
  if (candidate.getTime() < today.getTime()) {
    year = currentYear + 1;
    candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1) {
      candidate = new Date(Date.UTC(year, month - 1, day - 1));
    }
  }
  const years = year - startYear;
  if (years < 1) return null; // anniversary only starts after year 1

  const daysUntil = Math.round(
    (candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return { date: candidate, daysUntil, years };
}

export const listUpcomingBirthdays = query({
  args: {},
  handler: async (ctx): Promise<Array<BirthdayItem>> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    let users: Array<Doc<"users">>;
    if (isSuperAdmin && !organizationId) {
      users = await ctx.db.query("users").collect();
    } else if (organizationId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    } else {
      return [];
    }

    const today = todayUtc();
    const items: Array<BirthdayItem> = [];
    for (const user of users) {
      if (!user.birthday) continue;
      const next = nextBirthdayOccurrence(user.birthday, today);
      if (!next) continue;
      // Include within next 60 days
      if (next.daysUntil > 60) continue;
      items.push({
        userId: user._id,
        name: user.name ?? "Tanpa Nama",
        jobTitle: user.jobTitle ?? null,
        department: user.department ?? null,
        avatarUrl: user.avatarUrl ?? null,
        birthday: user.birthday,
        daysUntil: next.daysUntil,
        nextDate: formatIsoUtc(next.date),
      });
    }
    items.sort((a, b) => a.daysUntil - b.daysUntil);
    return items;
  },
});

export const listUpcomingAnniversaries = query({
  args: {},
  handler: async (ctx): Promise<Array<AnniversaryItem>> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    let users: Array<Doc<"users">>;
    if (isSuperAdmin && !organizationId) {
      users = await ctx.db.query("users").collect();
    } else if (organizationId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    } else {
      return [];
    }

    const today = todayUtc();
    const items: Array<AnniversaryItem> = [];
    for (const user of users) {
      if (!user.startDate) continue;
      const next = nextAnniversaryOccurrence(user.startDate, today);
      if (!next) continue;
      if (next.daysUntil > 60) continue;
      items.push({
        userId: user._id,
        name: user.name ?? "Tanpa Nama",
        jobTitle: user.jobTitle ?? null,
        department: user.department ?? null,
        avatarUrl: user.avatarUrl ?? null,
        startDate: user.startDate,
        years: next.years,
        daysUntil: next.daysUntil,
        nextDate: formatIsoUtc(next.date),
      });
    }
    items.sort((a, b) => a.daysUntil - b.daysUntil);
    return items;
  },
});

export const todayCelebrations = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    birthdays: Array<BirthdayItem>;
    anniversaries: Array<AnniversaryItem>;
  }> => {
    const { organizationId, isSuperAdmin } = await requireTenant(ctx, { allowSuperAdmin: true });

    let users: Array<Doc<"users">>;
    if (isSuperAdmin && !organizationId) {
      users = await ctx.db.query("users").collect();
    } else if (organizationId) {
      users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    } else {
      return { birthdays: [], anniversaries: [] };
    }

    const today = todayUtc();
    const birthdays: Array<BirthdayItem> = [];
    const anniversaries: Array<AnniversaryItem> = [];

    for (const user of users) {
      if (user.birthday) {
        const next = nextBirthdayOccurrence(user.birthday, today);
        if (next && next.daysUntil === 0) {
          birthdays.push({
            userId: user._id,
            name: user.name ?? "Tanpa Nama",
            jobTitle: user.jobTitle ?? null,
            department: user.department ?? null,
            avatarUrl: user.avatarUrl ?? null,
            birthday: user.birthday,
            daysUntil: 0,
            nextDate: formatIsoUtc(next.date),
          });
        }
      }
      if (user.startDate) {
        const next = nextAnniversaryOccurrence(user.startDate, today);
        if (next && next.daysUntil === 0) {
          anniversaries.push({
            userId: user._id,
            name: user.name ?? "Tanpa Nama",
            jobTitle: user.jobTitle ?? null,
            department: user.department ?? null,
            avatarUrl: user.avatarUrl ?? null,
            startDate: user.startDate,
            years: next.years,
            daysUntil: 0,
            nextDate: formatIsoUtc(next.date),
          });
        }
      }
    }
    return { birthdays, anniversaries };
  },
});
