import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole } from "./roles";
import { requireTenant, assertSameTenant } from "./lib/tenant";

export type BookingListItem = Doc<"roomBookings"> & {
  roomName: string | null;
  roomLocation: string | null;
  userName: string | null;
  userAvatar: string | null;
};

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

const ALLOWED_AMENITIES = new Set([
  "projector",
  "whiteboard",
  "videoCall",
  "tv",
  "ac",
  "coffee",
]);

// ========== Rooms ==========

export const listRooms = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Array<Doc<"rooms">>> => {
    await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    let rooms: Array<Doc<"rooms">>;
    if (args.includeInactive) {
      rooms = await ctx.db.query("rooms").order("asc").collect();
    } else {
      rooms = await ctx.db
        .query("rooms")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect();
    }
    // Scope to the caller's org (super admin without grant → empty).
    return rooms.filter((r) => r.organizationId === organizationId);
  },
});

export const getRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args): Promise<Doc<"rooms"> | null> => {
    await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;
    // A super admin without an active grant cannot read an org-scoped room.
    if (room.organizationId && room.organizationId !== organizationId) {
      return null;
    }
    return room;
  },
});

export const createRoom = mutation({
  args: {
    name: v.string(),
    location: v.optional(v.string()),
    capacity: v.number(),
    description: v.optional(v.string()),
    amenities: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"rooms">> => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat menambah ruangan",
      });
    }
    const name = args.name.trim();
    if (name.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama ruangan minimal 2 karakter",
      });
    }
    if (args.capacity < 1 || args.capacity > 1000) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kapasitas harus antara 1 dan 1000",
      });
    }
    const amenities = args.amenities.filter((a) => ALLOWED_AMENITIES.has(a));
    return await ctx.db.insert("rooms", {
      name,
      location: args.location?.trim() || undefined,
      capacity: args.capacity,
      description: args.description?.trim() || undefined,
      amenities,
      isActive: true,
      organizationId: user.organizationId,
    });
  },
});

export const updateRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.string(),
    location: v.optional(v.string()),
    capacity: v.number(),
    description: v.optional(v.string()),
    amenities: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat mengubah ruangan",
      });
    }
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Ruangan tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, room.organizationId);
    const name = args.name.trim();
    if (name.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama ruangan minimal 2 karakter",
      });
    }
    const amenities = args.amenities.filter((a) => ALLOWED_AMENITIES.has(a));
    await ctx.db.patch(args.roomId, {
      name,
      location: args.location?.trim() || undefined,
      capacity: args.capacity,
      description: args.description?.trim() || undefined,
      amenities,
      isActive: args.isActive,
    });
    return null;
  },
});

export const removeRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat menghapus ruangan",
      });
    }
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Ruangan tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, room.organizationId);
    // Delete all future bookings for the room
    const bookings = await ctx.db
      .query("roomBookings")
      .filter((q) => q.eq(q.field("roomId"), args.roomId))
      .collect();
    for (const b of bookings) {
      await ctx.db.delete(b._id);
    }
    await ctx.db.delete(args.roomId);
    return null;
  },
});

// ========== Bookings ==========

async function enrichBookings(
  ctx: QueryCtx,
  bookings: Array<Doc<"roomBookings">>,
): Promise<Array<BookingListItem>> {
  const roomCache = new Map<Id<"rooms">, Doc<"rooms"> | null>();
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getRoomDoc = async (id: Id<"rooms">) => {
    let cached = roomCache.get(id);
    if (cached === undefined) {
      cached = await ctx.db.get(id);
      roomCache.set(id, cached);
    }
    return cached;
  };
  const getUserDoc = async (id: Id<"users">) => {
    let cached = userCache.get(id);
    if (cached === undefined) {
      cached = await ctx.db.get(id);
      userCache.set(id, cached);
    }
    return cached;
  };
  const results: Array<BookingListItem> = [];
  for (const b of bookings) {
    const room = await getRoomDoc(b.roomId);
    const u = await getUserDoc(b.userId);
    results.push({
      ...b,
      roomName: room?.name ?? null,
      roomLocation: room?.location ?? null,
      userName: u?.name ?? null,
      userAvatar: u?.avatarUrl ?? null,
    });
  }
  return results;
}

export const listBookingsOnDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD
    roomId: v.optional(v.id("rooms")),
  },
  handler: async (ctx, args): Promise<Array<BookingListItem>> => {
    await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    let bookings: Array<Doc<"roomBookings">>;
    if (args.roomId) {
      bookings = await ctx.db
        .query("roomBookings")
        .withIndex("by_room_and_date", (q) =>
          q.eq("roomId", args.roomId!).eq("date", args.date),
        )
        .collect();
    } else {
      bookings = await ctx.db
        .query("roomBookings")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect();
    }
    const tenantBookings = bookings.filter(
      (b) => b.organizationId === organizationId,
    );
    tenantBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return await enrichBookings(ctx, tenantBookings);
  },
});

export const listMyBookings = query({
  args: { upcomingOnly: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<Array<BookingListItem>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const mine = await ctx.db
      .query("roomBookings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const tenantMine = mine.filter(
      (b) => b.organizationId === organizationId,
    );
    const now = new Date().toISOString();
    const filtered = args.upcomingOnly
      ? tenantMine.filter((b) => b.endTime >= now)
      : tenantMine;
    filtered.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return await enrichBookings(ctx, filtered);
  },
});

export const createBooking = mutation({
  args: {
    roomId: v.id("rooms"),
    title: v.string(),
    purpose: v.optional(v.string()),
    attendeeCount: v.optional(v.number()),
    startTime: v.string(), // ISO timestamp
    endTime: v.string(),
    date: v.string(), // YYYY-MM-DD local
  },
  handler: async (ctx, args): Promise<Id<"roomBookings">> => {
    const user = await requireUser(ctx);

    const title = args.title.trim();
    if (title.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul minimal 2 karakter",
      });
    }

    const startMs = new Date(args.startTime).getTime();
    const endMs = new Date(args.endTime).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Waktu tidak valid",
      });
    }
    if (endMs <= startMs) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Waktu selesai harus setelah waktu mulai",
      });
    }
    if (endMs - startMs > 12 * 60 * 60 * 1000) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Durasi maksimal 12 jam",
      });
    }
    if (endMs < Date.now()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pemesanan tidak dapat dilakukan untuk waktu yang sudah lewat",
      });
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || !room.isActive) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Ruangan tidak tersedia",
      });
    }
    assertSameTenant(user.organizationId, room.organizationId);

    if (args.attendeeCount !== undefined && args.attendeeCount > room.capacity) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Kapasitas ruangan hanya ${room.capacity} orang`,
      });
    }

    // Conflict check on the same date
    const existing = await ctx.db
      .query("roomBookings")
      .withIndex("by_room_and_date", (q) =>
        q.eq("roomId", args.roomId).eq("date", args.date),
      )
      .collect();
    for (const b of existing) {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      if (startMs < bEnd && endMs > bStart) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Ruangan sudah dipesan pada waktu tersebut",
        });
      }
    }

    return await ctx.db.insert("roomBookings", {
      roomId: args.roomId,
      userId: user._id,
      title,
      purpose: args.purpose?.trim() || undefined,
      attendeeCount: args.attendeeCount,
      startTime: args.startTime,
      endTime: args.endTime,
      date: args.date,
      organizationId: user.organizationId,
    });
  },
});

export const cancelBooking = mutation({
  args: { bookingId: v.id("roomBookings") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pemesanan tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, booking.organizationId);
    if (booking.userId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk membatalkan pemesanan ini",
      });
    }
    await ctx.db.delete(args.bookingId);
    return null;
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    totalRooms: number;
    activeRooms: number;
    todayBookings: number;
    myUpcoming: number;
  }> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });

    const allRooms = await ctx.db.query("rooms").collect();
    const rooms = allRooms.filter(
      (r) => r.organizationId === organizationId,
    );
    const activeRooms = rooms.filter((r) => r.isActive).length;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayBookingsRaw = await ctx.db
      .query("roomBookings")
      .withIndex("by_date", (q) => q.eq("date", todayStr))
      .collect();
    const todayBookings = todayBookingsRaw.filter(
      (b) => b.organizationId === organizationId,
    );

    const mine = await ctx.db
      .query("roomBookings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const now = new Date().toISOString();
    const myUpcoming = mine.filter((b) => b.endTime >= now).length;

    return {
      totalRooms: rooms.length,
      activeRooms,
      todayBookings: todayBookings.length,
      myUpcoming,
    };
  },
});
