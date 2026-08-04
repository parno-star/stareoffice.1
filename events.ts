import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { notifyAllUsers, notifyUser } from "./notifications";
import { requireTenant, assertSameTenant } from "./lib/tenant";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
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
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }
  return user;
}

const ALLOWED_CATEGORIES = new Set([
  "meeting",
  "holiday",
  "training",
  "event",
  "deadline",
]);

const ALLOWED_EVENT_TYPES = new Set([
  "gathering",
  "townhall",
  "workshop",
  "anniversary",
  "launch",
  "social",
  "ceremony",
  "other",
]);

const ALLOWED_RSVP = new Set(["going", "maybe", "not_going"]);

export type EnrichedEvent = Doc<"events"> & {
  authorName: string;
  authorAvatar: string | null;
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  myRsvp: "going" | "maybe" | "not_going" | null;
  bannerUrl: string | null;
  capacityRemaining: number | null; // null when unlimited
  rsvpClosed: boolean;
};

async function enrich(
  ctx: QueryCtx,
  ev: Doc<"events">,
  userId: Id<"users">,
): Promise<EnrichedEvent> {
  const author = await ctx.db.get(ev.authorId);
  const myRsvp = await ctx.db
    .query("eventRsvps")
    .withIndex("by_event_and_user", (q) =>
      q.eq("eventId", ev._id).eq("userId", userId),
    )
    .unique();
  const status =
    myRsvp && ALLOWED_RSVP.has(myRsvp.status)
      ? (myRsvp.status as "going" | "maybe" | "not_going")
      : null;
  const bannerUrl = ev.bannerStorageId
    ? await ctx.storage.getUrl(ev.bannerStorageId)
    : null;
  const going = ev.goingCount ?? 0;
  const capacityRemaining =
    typeof ev.capacity === "number" ? Math.max(0, ev.capacity - going) : null;
  const today = new Date().toISOString().slice(0, 10);
  const rsvpClosed =
    (typeof ev.rsvpDeadline === "string" && ev.rsvpDeadline < today) ||
    ev.endDate < today;
  return {
    ...ev,
    authorName: author?.name ?? "Admin",
    authorAvatar: author?.avatarUrl ?? null,
    goingCount: going,
    maybeCount: ev.maybeCount ?? 0,
    notGoingCount: ev.notGoingCount ?? 0,
    myRsvp: status,
    bannerUrl,
    capacityRemaining,
    rsvpClosed,
  };
}

// List all events that overlap a given date range [rangeStart, rangeEnd] (ISO dates).
export const listInRange = query({
  args: {
    rangeStart: v.string(),
    rangeEnd: v.string(),
  },
  handler: async (ctx, args): Promise<Array<EnrichedEvent>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const candidates = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.lte("startDate", args.rangeEnd))
      .collect();

    // Scope to the caller's org. A super admin without an active grant has
    // organizationId === null and therefore sees no events.
    const tenantFiltered = candidates.filter(
      (e) => e.organizationId === organizationId,
    );

    const filtered = tenantFiltered.filter((e) => e.endDate >= args.rangeStart);
    filtered.sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
      const aTime = a.startTime ?? "";
      const bTime = b.startTime ?? "";
      return aTime.localeCompare(bTime);
    });
    return await Promise.all(filtered.map((e) => enrich(ctx, e, user._id)));
  },
});

export const listUpcoming = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<EnrichedEvent>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const today = new Date().toISOString().slice(0, 10);
    const limit = args.limit ?? 5;
    const upcoming = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.gte("startDate", today))
      .order("asc")
      .take(limit * 10); // over-fetch to allow tenant filtering
    // Scope to the caller's org (super admin without grant → empty).
    const tenantFiltered = upcoming.filter(
      (e) => e.organizationId === organizationId,
    );
    return await Promise.all(
      tenantFiltered.slice(0, limit).map((e) => enrich(ctx, e, user._id)),
    );
  },
});

export const listAll = query({
  args: {
    category: v.optional(v.string()),
    scope: v.optional(v.string()), // "upcoming" | "past" | "all"
  },
  handler: async (ctx, args): Promise<Array<EnrichedEvent>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const today = new Date().toISOString().slice(0, 10);
    let events: Array<Doc<"events">>;
    if (args.scope === "past") {
      events = await ctx.db
        .query("events")
        .withIndex("by_start_date", (q) => q.lt("startDate", today))
        .order("desc")
        .take(200);
    } else if (args.scope === "all") {
      events = await ctx.db.query("events").order("desc").take(500);
    } else {
      // default: upcoming (includes today)
      events = await ctx.db
        .query("events")
        .withIndex("by_start_date", (q) => q.gte("startDate", today))
        .order("asc")
        .take(500);
      // Also include ongoing events that started earlier but haven't ended
      const ongoing = (
        await ctx.db
          .query("events")
          .withIndex("by_start_date", (q) => q.lt("startDate", today))
          .order("desc")
          .take(100)
      ).filter((e) => e.endDate >= today);
      events = [...ongoing, ...events];
    }

    // Scope to the caller's org (super admin without grant → empty).
    const tenantFiltered = events.filter(
      (e) => e.organizationId === organizationId,
    );

    const filtered =
      args.category && args.category !== "all"
        ? tenantFiltered.filter((e) => e.category === args.category)
        : tenantFiltered;
    return await Promise.all(filtered.map((e) => enrich(ctx, e, user._id)));
  },
});

// Focused listing for the Event Perusahaan & RSVP page.
// Only returns events relevant to employees (excludes "deadline").
export const listCompanyEvents = query({
  args: {
    scope: v.optional(v.string()), // "upcoming" | "past" | "all"
    category: v.optional(v.string()),
    eventType: v.optional(v.string()),
    myRsvp: v.optional(v.string()), // "going" | "maybe" | "not_going" | "any"
  },
  handler: async (ctx, args): Promise<Array<EnrichedEvent>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const today = new Date().toISOString().slice(0, 10);
    let events: Array<Doc<"events">>;
    if (args.scope === "past") {
      events = await ctx.db
        .query("events")
        .withIndex("by_start_date", (q) => q.lt("startDate", today))
        .order("desc")
        .take(300);
    } else if (args.scope === "all") {
      events = await ctx.db.query("events").order("desc").take(500);
    } else {
      events = await ctx.db
        .query("events")
        .withIndex("by_start_date", (q) => q.gte("startDate", today))
        .order("asc")
        .take(500);
      const ongoing = (
        await ctx.db
          .query("events")
          .withIndex("by_start_date", (q) => q.lt("startDate", today))
          .order("desc")
          .take(100)
      ).filter((e) => e.endDate >= today);
      events = [...ongoing, ...events];
    }

    // Apply tenant filter (super admin without grant → empty).
    const tenantFiltered = events.filter(
      (e) => e.organizationId === organizationId,
    );

    // Exclude deadlines - those belong to the calendar only
    let filtered = tenantFiltered.filter((e) => e.category !== "deadline");
    if (args.category && args.category !== "all") {
      filtered = filtered.filter((e) => e.category === args.category);
    }
    if (args.eventType && args.eventType !== "all") {
      filtered = filtered.filter((e) => e.eventType === args.eventType);
    }
    const enriched = await Promise.all(
      filtered.map((e) => enrich(ctx, e, user._id)),
    );
    if (args.myRsvp && args.myRsvp !== "any") {
      return enriched.filter((e) => e.myRsvp === args.myRsvp);
    }
    return enriched;
  },
});

export const getById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args): Promise<EnrichedEvent | null> => {
    const user = await requireUser(ctx);
    const ev = await ctx.db.get(args.id);
    if (!ev) return null;
    return await enrich(ctx, ev, user._id);
  },
});

export type EventAttendee = {
  _id: Id<"eventRsvps">;
  status: "going" | "maybe" | "not_going";
  userId: Id<"users">;
  userName: string;
  userAvatar: string | null;
  jobTitle: string | null;
  department: string | null;
  note: string | null;
};

export const listAttendees = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<Array<EventAttendee>> => {
    await requireUser(ctx);
    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const results: Array<EventAttendee> = [];
    for (const r of rsvps) {
      const u = await ctx.db.get(r.userId);
      if (!u) continue;
      const status = ALLOWED_RSVP.has(r.status)
        ? (r.status as "going" | "maybe" | "not_going")
        : "going";
      results.push({
        _id: r._id,
        status,
        userId: r.userId,
        userName: u.name ?? "Tanpa nama",
        userAvatar: u.avatarUrl ?? null,
        jobTitle: u.jobTitle ?? null,
        department: u.department ?? null,
        note: r.note ?? null,
      });
    }
    // Order: going > maybe > not_going
    const weight: Record<string, number> = {
      going: 0,
      maybe: 1,
      not_going: 2,
    };
    results.sort((a, b) => {
      if (a.status !== b.status) return weight[a.status] - weight[b.status];
      return a.userName.localeCompare(b.userName);
    });
    return results;
  },
});

export type CalendarStats = {
  totalUpcoming: number;
  thisMonth: number;
  thisWeek: number;
  holidaysThisMonth: number;
  myRsvpGoing: number;
};

export const getStats = query({
  args: {},
  handler: async (ctx): Promise<CalendarStats> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    const weekStart = new Date(now);
    const offset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - offset);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);

    const upcomingRaw = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.gte("startDate", today))
      .take(500);
    const upcoming =
      organizationId === null
        ? []
        : upcomingRaw.filter((e) => e.organizationId === organizationId);

    const thisMonthEvents = upcoming.filter(
      (e) => e.startDate >= monthStart && e.startDate <= monthEnd,
    );
    const thisWeekEvents = upcoming.filter(
      (e) => e.startDate >= weekStartIso && e.startDate <= weekEndIso,
    );
    const holidays = thisMonthEvents.filter((e) => e.category === "holiday");

    // My RSVPs with status="going" for upcoming events
    const myRsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    let myGoing = 0;
    for (const r of myRsvps) {
      if (r.status !== "going") continue;
      const ev = await ctx.db.get(r.eventId);
      if (ev && ev.endDate >= today) myGoing += 1;
    }

    return {
      totalUpcoming: upcoming.length,
      thisMonth: thisMonthEvents.length,
      thisWeek: thisWeekEvents.length,
      holidaysThisMonth: holidays.length,
      myRsvpGoing: myGoing,
    };
  },
});

export type CompanyEventStats = {
  totalUpcoming: number;
  totalPast: number;
  myRsvpGoing: number;
  myRsvpMaybe: number;
  featuredCount: number;
};

export const getCompanyEventStats = query({
  args: {},
  handler: async (ctx): Promise<CompanyEventStats> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const today = new Date().toISOString().slice(0, 10);

    const upcomingRaw = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.gte("startDate", today))
      .take(500);
    const upcoming =
      organizationId === null
        ? []
        : upcomingRaw.filter((e) => e.organizationId === organizationId);
    const relevantUpcoming = upcoming.filter((e) => e.category !== "deadline");

    const pastRaw = await ctx.db
      .query("events")
      .withIndex("by_start_date", (q) => q.lt("startDate", today))
      .order("desc")
      .take(200);
    const past =
      organizationId === null
        ? []
        : pastRaw.filter((e) => e.organizationId === organizationId);
    const relevantPast = past.filter((e) => e.category !== "deadline");

    const myRsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    let myGoing = 0;
    let myMaybe = 0;
    for (const r of myRsvps) {
      const ev = await ctx.db.get(r.eventId);
      if (!ev || ev.endDate < today) continue;
      if (ev.category === "deadline") continue;
      if (r.status === "going") myGoing += 1;
      else if (r.status === "maybe") myMaybe += 1;
    }

    return {
      totalUpcoming: relevantUpcoming.length,
      totalPast: relevantPast.length,
      myRsvpGoing: myGoing,
      myRsvpMaybe: myMaybe,
      featuredCount: relevantUpcoming.filter((e) => e.isFeatured).length,
    };
  },
});

// Upload URL for event banner images.
export const generateBannerUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat mengunggah banner",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    allDay: v.boolean(),
    bannerStorageId: v.optional(v.id("_storage")),
    capacity: v.optional(v.number()),
    rsvpDeadline: v.optional(v.string()),
    eventType: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"events">> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat membuat acara",
      });
    }
    if (!ALLOWED_CATEGORIES.has(args.category)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kategori tidak valid",
      });
    }
    if (args.eventType && !ALLOWED_EVENT_TYPES.has(args.eventType)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jenis acara tidak valid",
      });
    }
    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul wajib diisi",
      });
    }
    if (args.endDate < args.startDate) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai",
      });
    }
    if (args.rsvpDeadline && args.rsvpDeadline > args.startDate) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Batas RSVP tidak boleh melewati tanggal mulai acara",
      });
    }
    if (typeof args.capacity === "number" && args.capacity < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kapasitas tidak boleh negatif",
      });
    }
    // Enforce plan storage limit when a banner image is attached.
    if (args.bannerStorageId) {
      const incomingBytes = await getStorageSizeBytes(ctx, args.bannerStorageId);
      await assertStorageWithinLimit(ctx, user.organizationId, incomingBytes);
    }
    const id = await ctx.db.insert("events", {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      category: args.category,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.allDay ? undefined : args.startTime || undefined,
      endTime: args.allDay ? undefined : args.endTime || undefined,
      location: args.location?.trim() || undefined,
      allDay: args.allDay,
      goingCount: 0,
      maybeCount: 0,
      notGoingCount: 0,
      authorId: user._id,
      bannerStorageId: args.bannerStorageId,
      capacity:
        typeof args.capacity === "number" && args.capacity > 0
          ? args.capacity
          : undefined,
      rsvpDeadline: args.rsvpDeadline || undefined,
      eventType: args.eventType || undefined,
      isFeatured: args.isFeatured ?? false,
      organizationId: user.organizationId,
    });

    if (args.bannerStorageId) {
      await trackStorageAdded(ctx, user.organizationId, args.bannerStorageId);
    }

    // Notify everyone about the new event
    await notifyAllUsers(ctx, {
      type: "event_new",
      title: "Acara baru di kalender",
      message: `${args.title.trim()} · ${args.startDate}`,
      link: `/calendar/${id}`,
      actorId: user._id,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    location: v.optional(v.string()),
    allDay: v.boolean(),
    bannerStorageId: v.optional(v.id("_storage")),
    clearBanner: v.optional(v.boolean()),
    capacity: v.optional(v.number()),
    rsvpDeadline: v.optional(v.string()),
    eventType: v.optional(v.string()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const ev = await ctx.db.get(args.id);
    if (!ev) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Acara tidak ditemukan" });
    }
    assertSameTenant(user.organizationId, ev.organizationId);
    if (!isAdminRole(user.role) && ev.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak ada izin untuk mengubah acara ini",
      });
    }
    if (!ALLOWED_CATEGORIES.has(args.category)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Kategori tidak valid" });
    }
    if (args.eventType && !ALLOWED_EVENT_TYPES.has(args.eventType)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jenis acara tidak valid",
      });
    }
    if (args.title.trim().length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Judul wajib diisi" });
    }
    if (args.endDate < args.startDate) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal akhir harus setelah atau sama dengan tanggal mulai",
      });
    }
    if (args.rsvpDeadline && args.rsvpDeadline > args.startDate) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Batas RSVP tidak boleh melewati tanggal mulai acara",
      });
    }
    if (typeof args.capacity === "number" && args.capacity < 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kapasitas tidak boleh negatif",
      });
    }

    // Decide how to update banner field
    let bannerStorageId: Id<"_storage"> | undefined = ev.bannerStorageId;
    if (args.clearBanner) {
      if (ev.bannerStorageId) {
        await trackStorageRemoved(ctx, ev.organizationId, ev.bannerStorageId);
        try {
          await ctx.storage.delete(ev.bannerStorageId);
        } catch {
          // ignore missing storage object
        }
      }
      bannerStorageId = undefined;
    } else if (args.bannerStorageId) {
      // Enforce limit before attaching the replacement banner.
      const incomingBytes = await getStorageSizeBytes(ctx, args.bannerStorageId);
      await assertStorageWithinLimit(ctx, ev.organizationId, incomingBytes);
      // Replacing the banner - clean up the previous file if any
      if (ev.bannerStorageId && ev.bannerStorageId !== args.bannerStorageId) {
        await trackStorageRemoved(ctx, ev.organizationId, ev.bannerStorageId);
        try {
          await ctx.storage.delete(ev.bannerStorageId);
        } catch {
          // ignore
        }
      }
      bannerStorageId = args.bannerStorageId;
      if (ev.bannerStorageId !== args.bannerStorageId) {
        await trackStorageAdded(ctx, ev.organizationId, args.bannerStorageId);
      }
    }

    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      category: args.category,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.allDay ? undefined : args.startTime || undefined,
      endTime: args.allDay ? undefined : args.endTime || undefined,
      location: args.location?.trim() || undefined,
      allDay: args.allDay,
      bannerStorageId,
      capacity:
        typeof args.capacity === "number" && args.capacity > 0
          ? args.capacity
          : undefined,
      rsvpDeadline: args.rsvpDeadline || undefined,
      eventType: args.eventType || undefined,
      isFeatured: args.isFeatured ?? ev.isFeatured ?? false,
    });

    // Notify attendees (going / maybe) about the update
    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.id))
      .collect();
    for (const r of rsvps) {
      if (r.status === "not_going") continue;
      if (r.userId === user._id) continue;
      await notifyUser(ctx, {
        userId: r.userId,
        type: "event_updated",
        title: "Acara diperbarui",
        message: `${args.title.trim()} · ${args.startDate}`,
        link: `/calendar/${args.id}`,
        actorId: user._id,
      });
    }
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const ev = await ctx.db.get(args.id);
    if (!ev) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Acara tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, ev.organizationId);
    if (!isAdminRole(user.role) && ev.authorId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak ada izin untuk menghapus acara ini",
      });
    }
    // Clean up banner
    if (ev.bannerStorageId) {
      await trackStorageRemoved(ctx, ev.organizationId, ev.bannerStorageId);
      try {
        await ctx.storage.delete(ev.bannerStorageId);
      } catch {
        // ignore
      }
    }
    // Clean up RSVPs first
    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.id))
      .collect();
    for (const r of rsvps) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.id);
  },
});

// Submit / change an RSVP. Passing status=null removes the RSVP.
export const setRsvp = mutation({
  args: {
    eventId: v.id("events"),
    status: v.string(), // "going" | "maybe" | "not_going"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    if (!ALLOWED_RSVP.has(args.status)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status RSVP tidak valid",
      });
    }
    const ev = await ctx.db.get(args.eventId);
    if (!ev) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Acara tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, ev.organizationId);

    // Guard: can't RSVP after the deadline or past events
    const today = new Date().toISOString().slice(0, 10);
    if (ev.endDate < today) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Acara sudah selesai, RSVP tidak dapat diubah",
      });
    }
    if (ev.rsvpDeadline && ev.rsvpDeadline < today) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Batas waktu RSVP sudah lewat",
      });
    }

    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id),
      )
      .unique();

    // Capacity check (only for "going" status and when capacity is set)
    if (
      args.status === "going" &&
      typeof ev.capacity === "number" &&
      ev.capacity > 0
    ) {
      const currentGoing = ev.goingCount ?? 0;
      const alreadyGoing = existing?.status === "going";
      if (!alreadyGoing && currentGoing >= ev.capacity) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Kapasitas acara sudah penuh",
        });
      }
    }

    const trimmedNote = args.note?.trim() || undefined;

    // Update denormalized counts
    const deltas = { going: 0, maybe: 0, not_going: 0 };
    if (existing) {
      if (existing.status === args.status && existing.note === trimmedNote) {
        return null;
      }
      if (existing.status !== args.status && existing.status in deltas) {
        deltas[existing.status as keyof typeof deltas] -= 1;
      }
      await ctx.db.patch(existing._id, {
        status: args.status,
        note: trimmedNote,
      });
      if (existing.status === args.status) {
        // Only the note changed - no count update needed
        return null;
      }
    } else {
      await ctx.db.insert("eventRsvps", {
        eventId: args.eventId,
        userId: user._id,
        status: args.status,
        note: trimmedNote,
        organizationId: user.organizationId,
      });
    }
    deltas[args.status as keyof typeof deltas] += 1;

    await ctx.db.patch(args.eventId, {
      goingCount: Math.max(0, (ev.goingCount ?? 0) + deltas.going),
      maybeCount: Math.max(0, (ev.maybeCount ?? 0) + deltas.maybe),
      notGoingCount: Math.max(0, (ev.notGoingCount ?? 0) + deltas.not_going),
    });

    return null;
  },
});
