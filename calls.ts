import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant, assertSameTenant } from "./lib/tenant";
import { isAdminRole } from "./roles";
import { notifyUser } from "./notifications";
import {
  assertQuotaAvailable,
  addUsedMinutes,
  getQuotaState,
  type QuotaState,
} from "./lib/callQuota";

export type CallSessionListItem = Doc<"callSessions"> & {
  createdByName: string | null;
  createdByAvatar: string | null;
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

async function enrichSessions(
  ctx: QueryCtx,
  sessions: Array<Doc<"callSessions">>,
): Promise<Array<CallSessionListItem>> {
  return await Promise.all(
    sessions.map(async (s) => {
      const creator = await ctx.db.get(s.createdBy);
      return {
        ...s,
        createdByName: creator?.name ?? null,
        createdByAvatar: creator?.avatarUrl ?? null,
      };
    }),
  );
}

/**
 * List all currently active calls within the caller's organization so users
 * can see and join ongoing calls.
 */
export const listActiveCalls = query({
  args: {},
  handler: async (ctx): Promise<Array<CallSessionListItem>> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) return [];

    const active = await ctx.db
      .query("callSessions")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active"),
      )
      .collect();

    active.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return await enrichSessions(ctx, active);
  },
});

/** Recent ended calls (history) for the org. */
export const listRecentCalls = query({
  args: {},
  handler: async (ctx): Promise<Array<CallSessionListItem>> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) return [];

    const ended = await ctx.db
      .query("callSessions")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "ended"),
      )
      .order("desc")
      .take(20);

    return await enrichSessions(ctx, ended);
  },
});

/** Read a single call session by id (tenant-guarded). */
export const getCall = query({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args): Promise<CallSessionListItem | null> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    assertSameTenant(organizationId, session.organizationId, "panggilan");
    const enriched = await enrichSessions(ctx, [session]);
    return enriched[0] ?? null;
  },
});

/**
 * Lists the caller's organization members (excluding themselves) so they can be
 * picked to invite to a call. Only active accounts are returned. Tenant-scoped.
 */
export const listOrgMembersForInvite = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      _id: Id<"users">;
      name: string | null;
      jobTitle: string | null;
      department: string | null;
      avatarUrl: string | null;
    }>
  > => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) return [];

    const members = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    return members
      .filter(
        (m) =>
          m._id !== userId &&
          m.accountStatus !== "pending_approval" &&
          m.accountStatus !== "suspended" &&
          m.accountStatus !== "rejected" &&
          !m.onboardingAbandonedAt,
      )
      .map((m) => ({
        _id: m._id,
        name: m.name ?? null,
        jobTitle: m.jobTitle ?? null,
        department: m.department ?? null,
        avatarUrl: m.avatarUrl ?? null,
      }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  },
});

/**
 * Sends an in-app invite notification to each selected member, linking them to
 * auto-join the given call. Tenant-guarded: the caller must own the session and
 * each invitee must belong to the same organization. Called from the create-call
 * action after a session is recorded.
 */
export const inviteMembersToCall = internalMutation({
  args: {
    sessionId: v.id("callSessions"),
    inviterId: v.id("users"),
    inviteeIds: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<number> => {
    if (args.inviteeIds.length === 0) return 0;

    const session = await ctx.db.get(args.sessionId);
    if (!session) return 0;

    const inviter = await ctx.db.get(args.inviterId);
    const inviterName = inviter?.name ?? "Seseorang";
    const modeLabel = session.mode === "video" ? "video" : "suara";
    const link = `/calls?join=${args.sessionId}`;

    let sent = 0;
    // De-duplicate invitee ids in case the client sent repeats.
    const uniqueIds = Array.from(new Set(args.inviteeIds));
    for (const inviteeId of uniqueIds) {
      const invitee = await ctx.db.get(inviteeId);
      if (!invitee) continue;
      // Enforce same-organization isolation for every invitee.
      if (invitee.organizationId !== session.organizationId) continue;

      await notifyUser(ctx, {
        userId: inviteeId,
        type: "call_invite",
        title: `Undangan panggilan ${modeLabel}`,
        message: `${inviterName} mengundang Anda ke "${session.title}". Ketuk untuk bergabung.`,
        link,
        actorId: args.inviterId,
      });
      sent += 1;
    }
    return sent;
  },
});

/**
 * Returns the currently active call linked to a specific room booking, or null.
 * Used by the Rooms page to show a "join call" link on a booking. Tenant-guarded.
 */
export const getActiveCallForBooking = query({
  args: { bookingId: v.id("roomBookings") },
  handler: async (ctx, args): Promise<CallSessionListItem | null> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const linked = await ctx.db
      .query("callSessions")
      .withIndex("by_booking", (q) => q.eq("roomBookingId", args.bookingId))
      .collect();
    const active = linked.find((c) => c.status === "active");
    if (!active) return null;
    // Ensure the session belongs to the caller's organization.
    if (active.organizationId !== organizationId) return null;
    const enriched = await enrichSessions(ctx, [active]);
    return enriched[0] ?? null;
  },
});

// ---- Quota ---------------------------------------------------------------

/**
 * Returns the caller org's monthly call-minute quota state (limit, used,
 * remaining) plus whether the caller may edit the limit. Used by the Calls page.
 */
export const getQuota = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    (QuotaState & { canManage: boolean; hasOrg: boolean }) | null
  > => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) {
      return null;
    }
    const org = await ctx.db.get(organizationId);
    const state = await getQuotaState(ctx, organizationId, org);
    const user = await ctx.db.get(userId);
    return {
      ...state,
      canManage: isAdminRole(user?.role),
      hasOrg: true,
    };
  },
});

/**
 * Sets (or clears) the monthly call-minute limit for the caller's organization.
 * Only org admins / super admins may change it. Pass null/0 to make it unlimited.
 */
export const setQuotaLimit = mutation({
  args: { limitMinutes: v.union(v.number(), v.null()) },
  handler: async (ctx, args): Promise<void> => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const user = await ctx.db.get(userId);
    if (!isAdminRole(user?.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin yang dapat mengatur kuota panggilan",
      });
    }
    if (!organizationId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak ada organisasi aktif",
      });
    }
    if (args.limitMinutes !== null) {
      if (!Number.isFinite(args.limitMinutes) || args.limitMinutes < 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Batas menit tidak valid",
        });
      }
      if (args.limitMinutes > 1_000_000) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Batas menit terlalu besar",
        });
      }
    }
    // 0 or null → unlimited (stored as undefined).
    const value =
      args.limitMinutes === null || args.limitMinutes === 0
        ? undefined
        : Math.floor(args.limitMinutes);
    await ctx.db.patch(organizationId, {
      callQuotaMinutesPerMonth: value,
      updatedAt: new Date().toISOString(),
    });
  },
});

// ---- Internal helpers used by the Daily.co action -----------------------

/**
 * Verifies a booking belongs to the caller's org and returns the caller context,
 * the booking title, and any already-active call linked to the booking. Used by
 * the action that starts or joins a booking call.
 */
export const getBookingCallContext = internalQuery({
  args: { bookingId: v.id("roomBookings") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: Id<"users">;
    organizationId: Id<"organizations"> | null;
    userName: string | null;
    bookingTitle: string;
    existing: {
      sessionId: Id<"callSessions">;
      roomUrl: string;
      mode: string;
      title: string;
    } | null;
  }> => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pemesanan tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, booking.organizationId, "pemesanan");
    const user = await ctx.db.get(userId);

    const linked = await ctx.db
      .query("callSessions")
      .withIndex("by_booking", (q) => q.eq("roomBookingId", args.bookingId))
      .collect();
    const active = linked.find((c) => c.status === "active") ?? null;

    // Block starting a NEW call when the org quota is exhausted. Joining an
    // already-active booking call is still allowed via the existing session.
    if (!active) {
      await assertQuotaAvailable(ctx, organizationId);
    }

    return {
      userId,
      organizationId,
      userName: user?.name ?? null,
      bookingTitle: booking.title,
      existing: active
        ? {
            sessionId: active._id,
            roomUrl: active.dailyRoomUrl,
            mode: active.mode,
            title: active.title,
          }
        : null,
    };
  },
});

/** Records a newly created call session (called from the action). */
export const recordCallSession = internalMutation({
  args: {
    title: v.string(),
    mode: v.string(),
    dailyRoomName: v.string(),
    dailyRoomUrl: v.string(),
    createdBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    roomBookingId: v.optional(v.id("roomBookings")),
  },
  handler: async (ctx, args): Promise<Id<"callSessions">> => {
    return await ctx.db.insert("callSessions", {
      title: args.title,
      mode: args.mode,
      status: "active",
      dailyRoomName: args.dailyRoomName,
      dailyRoomUrl: args.dailyRoomUrl,
      createdBy: args.createdBy,
      organizationId: args.organizationId ?? undefined,
      roomBookingId: args.roomBookingId,
      startedAt: new Date().toISOString(),
    });
  },
});

/** Returns the current authenticated user + org for the action. */
export const getCallerContext = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    userId: Id<"users">;
    organizationId: Id<"organizations"> | null;
    userName: string | null;
  }> => {
    const { userId, organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    // Enforce the monthly quota before a brand-new standalone call is created.
    await assertQuotaAvailable(ctx, organizationId);
    const user = await ctx.db.get(userId);
    return {
      userId,
      organizationId,
      userName: user?.name ?? null,
    };
  },
});

/**
 * Ends a call: marks the session ended. Only the creator or an org admin/super
 * admin may end it.
 */
export const endCall = mutation({
  args: { sessionId: v.id("callSessions") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Panggilan tidak ditemukan" });
    }
    assertSameTenant(user.organizationId, session.organizationId, "panggilan");

    const isPrivileged =
      user.role === "admin" || user.role === "super_admin";
    if (session.createdBy !== user._id && !isPrivileged) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pembuat panggilan atau admin yang dapat mengakhiri panggilan",
      });
    }

    if (session.status === "ended") return;

    const endedAtIso = new Date().toISOString();

    // Record consumed minutes toward the org's monthly quota. Duration is the
    // wall-clock time from start to end, rounded up to a whole minute (min 1).
    if (session.organizationId) {
      const startMs = new Date(session.startedAt).getTime();
      const endMs = new Date(endedAtIso).getTime();
      const durationMin = Math.max(
        1,
        Math.ceil((endMs - startMs) / 60000),
      );
      await addUsedMinutes(ctx, session.organizationId, durationMin);
    }

    await ctx.db.patch(args.sessionId, {
      status: "ended",
      endedAt: endedAtIso,
    });
  },
});
