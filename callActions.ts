import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

const DAILY_API_BASE = "https://api.daily.co/v1";

type DailyRoom = {
  name: string;
  url: string;
};

/**
 * Creates a Daily.co room via the REST API and records a call session in the
 * database scoped to the caller's organization. `fetch` runs in the default
 * Convex V8 runtime, so no Node runtime is required.
 *
 * Default mode is "audio" (cheapest). "video" enables the camera by default.
 */
export const createCall = action({
  args: {
    title: v.string(),
    mode: v.union(v.literal("audio"), v.literal("video")),
    roomBookingId: v.optional(v.id("roomBookings")),
    inviteeIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sessionId: Id<"callSessions">; roomUrl: string }> => {
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      throw new ConvexError({
        code: "NOT_IMPLEMENTED",
        message:
          "Fitur panggilan belum aktif. Admin perlu menyimpan kunci DAILY_API_KEY di tab Secrets.",
      });
    }

    const title = args.title.trim();
    if (title.length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul panggilan minimal 2 karakter",
      });
    }

    // Resolve the current user + organization server-side (never trust client).
    const caller = await ctx.runQuery(internal.calls.getCallerContext, {});

    // Create a Daily room. It auto-expires after 4 hours so orphaned rooms are
    // cleaned up by Daily even if a client never calls endCall.
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 4 * 60 * 60;

    const res = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy: "public",
        properties: {
          exp: expSec,
          eject_at_room_exp: true,
          // Start with camera off; for audio-only calls this keeps video off
          // by default. Users can still turn the camera on in "video" mode.
          start_video_off: true,
          start_audio_off: false,
          enable_screenshare: true,
          enable_chat: true,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Gagal membuat ruang panggilan (Daily.co): ${res.status} ${text.slice(0, 200)}`,
      });
    }

    const room = (await res.json()) as DailyRoom;

    const sessionId: Id<"callSessions"> = await ctx.runMutation(
      internal.calls.recordCallSession,
      {
        title,
        mode: args.mode,
        dailyRoomName: room.name,
        dailyRoomUrl: room.url,
        createdBy: caller.userId,
        organizationId: caller.organizationId ?? undefined,
        roomBookingId: args.roomBookingId,
      },
    );

    // Notify any selected members so they get an in-app invite with a join link.
    if (args.inviteeIds && args.inviteeIds.length > 0) {
      await ctx.runMutation(internal.calls.inviteMembersToCall, {
        sessionId,
        inviterId: caller.userId,
        inviteeIds: args.inviteeIds,
      });
    }

    return { sessionId, roomUrl: room.url };
  },
});

/**
 * Starts a call for a specific room booking, or joins the existing active call
 * already linked to that booking. This lets meeting participants share one call
 * per booking. Tenant isolation is enforced via the internal context query.
 */
export const startBookingCall = action({
  args: {
    bookingId: v.id("roomBookings"),
    mode: v.union(v.literal("audio"), v.literal("video")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sessionId: Id<"callSessions">; roomUrl: string }> => {
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      throw new ConvexError({
        code: "NOT_IMPLEMENTED",
        message:
          "Fitur panggilan belum aktif. Admin perlu menyimpan kunci DAILY_API_KEY di tab Secrets.",
      });
    }

    const context = await ctx.runQuery(internal.calls.getBookingCallContext, {
      bookingId: args.bookingId,
    });

    // Reuse the active call if one already exists for this booking.
    if (context.existing) {
      return {
        sessionId: context.existing.sessionId,
        roomUrl: context.existing.roomUrl,
      };
    }

    const title = context.bookingTitle.trim() || "Rapat";

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 4 * 60 * 60;

    const res = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy: "public",
        properties: {
          exp: expSec,
          eject_at_room_exp: true,
          start_video_off: true,
          start_audio_off: false,
          enable_screenshare: true,
          enable_chat: true,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: `Gagal membuat ruang panggilan (Daily.co): ${res.status} ${text.slice(0, 200)}`,
      });
    }

    const room = (await res.json()) as DailyRoom;

    const sessionId: Id<"callSessions"> = await ctx.runMutation(
      internal.calls.recordCallSession,
      {
        title,
        mode: args.mode,
        dailyRoomName: room.name,
        dailyRoomUrl: room.url,
        createdBy: context.userId,
        organizationId: context.organizationId ?? undefined,
        roomBookingId: args.bookingId,
      },
    );

    return { sessionId, roomUrl: room.url };
  },
});

/**
 * Verifies the caller can join a given session (same org) and returns the
 * Daily room URL. Guards tenant isolation server-side.
 */
export const getJoinInfo = action({
  args: { sessionId: v.id("callSessions") },
  handler: async (
    ctx,
    args,
  ): Promise<{ roomUrl: string; mode: string; title: string }> => {
    const session = await ctx.runQuery(api.calls.getCall, {
      sessionId: args.sessionId,
    });
    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Panggilan tidak ditemukan atau sudah berakhir",
      });
    }
    if (session.status === "ended") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Panggilan ini sudah berakhir",
      });
    }
    return {
      roomUrl: session.dailyRoomUrl,
      mode: session.mode,
      title: session.title,
    };
  },
});
