import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant, assertSameTenant } from "./lib/tenant";
import { notifyUser } from "./notifications";

export type ZoomMeetingListItem = Doc<"zoomMeetings"> & {
  createdByName: string | null;
  createdByAvatar: string | null;
};

async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

async function enrich(
  ctx: QueryCtx,
  meetings: Array<Doc<"zoomMeetings">>,
): Promise<Array<ZoomMeetingListItem>> {
  return await Promise.all(
    meetings.map(async (m) => {
      const creator = await ctx.db.get(m.createdBy);
      return {
        ...m,
        createdByName: creator?.name ?? null,
        createdByAvatar: creator?.avatarUrl ?? null,
      };
    }),
  );
}

// Basic Zoom URL validation. We accept common Zoom domains and any subdomain
// (e.g. company.zoom.us) so custom vanity/enterprise links still work.
function isValidZoomUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    return /(^|\.)zoom\.(us|com)$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** Lists scheduled (non-cancelled) Zoom meetings for the caller's org. */
export const listZoomMeetings = query({
  args: {},
  handler: async (ctx): Promise<Array<ZoomMeetingListItem>> => {
    const { organizationId } = await requireTenant(ctx, {
      allowSuperAdmin: true,
    });
    if (!organizationId) return [];

    const meetings = await ctx.db
      .query("zoomMeetings")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "scheduled"),
      )
      .collect();

    // Sort by scheduled time (soonest first); meetings without a time go last.
    meetings.sort((a, b) => {
      const at = a.scheduledAt ?? "\uffff";
      const bt = b.scheduledAt ?? "\uffff";
      return at.localeCompare(bt);
    });

    return await enrich(ctx, meetings);
  },
});

/**
 * Creates a Zoom meeting entry and optionally notifies selected org members.
 * Tenant-scoped: the meeting is stamped with the caller's organization and every
 * invitee must belong to it.
 */
export const createZoomMeeting = mutation({
  args: {
    title: v.string(),
    joinUrl: v.string(),
    meetingId: v.optional(v.string()),
    passcode: v.optional(v.string()),
    scheduledAt: v.optional(v.string()),
    notes: v.optional(v.string()),
    inviteeIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<Id<"zoomMeetings">> => {
    const user = await requireUser(ctx);
    if (args.title.trim().length < 2) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul meeting minimal 2 karakter",
      });
    }
    if (!isValidZoomUrl(args.joinUrl)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Link Zoom tidak valid. Contoh: https://zoom.us/j/1234567890",
      });
    }

    const meetingId = await ctx.db.insert("zoomMeetings", {
      organizationId: user.organizationId ?? undefined,
      createdBy: user._id,
      title: args.title.trim(),
      joinUrl: args.joinUrl.trim(),
      meetingId: args.meetingId?.trim() || undefined,
      passcode: args.passcode?.trim() || undefined,
      scheduledAt: args.scheduledAt || undefined,
      notes: args.notes?.trim() || undefined,
      status: "scheduled",
      createdAt: new Date().toISOString(),
    });

    // Notify invited members with a link to the Zoom tab.
    const inviteeIds = Array.from(new Set(args.inviteeIds ?? []));
    for (const inviteeId of inviteeIds) {
      const invitee = await ctx.db.get(inviteeId);
      if (!invitee) continue;
      if (invitee.organizationId !== user.organizationId) continue;
      await notifyUser(ctx, {
        userId: inviteeId,
        type: "zoom_invite",
        title: "Undangan Zoom Meeting",
        message: `${user.name ?? "Seseorang"} mengundang Anda ke "${args.title.trim()}" via Zoom.`,
        link: `/calls?tab=zoom`,
        actorId: user._id,
      });
    }

    return meetingId;
  },
});

/** Cancels a Zoom meeting. Only the creator or an org admin may cancel. */
export const cancelZoomMeeting = mutation({
  args: { meetingId: v.id("zoomMeetings") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUser(ctx);
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Meeting tidak ditemukan",
      });
    }
    assertSameTenant(user.organizationId, meeting.organizationId, "meeting");

    const isPrivileged =
      user.role === "admin" || user.role === "super_admin";
    if (meeting.createdBy !== user._id && !isPrivileged) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pembuat meeting atau admin yang dapat membatalkan",
      });
    }

    await ctx.db.patch(args.meetingId, { status: "cancelled" });
  },
});
