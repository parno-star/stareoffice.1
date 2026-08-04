import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyUser } from "./notifications";
import { requireTenant } from "./lib/tenant";
import { isSuperAdminBlocked } from "./superAdminDataAccess";

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

// Deterministic key so any pair of users maps to exactly one conversation
function conversationKey(a: Id<"users">, b: Id<"users">): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export type ConversationPreview = {
  _id: Id<"conversations">;
  _creationTime: number;
  otherUser: {
    _id: Id<"users">;
    name: string | null;
    avatarUrl: string | null;
    jobTitle: string | null;
    department: string | null;
  };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageSenderId: Id<"users"> | null;
  unreadCount: number;
};

export type MessageWithSender = Doc<"directMessages"> & {
  senderName: string | null;
  senderAvatar: string | null;
};

/** List all conversations the current user is part of, newest first. */
export const listConversations = query({
  args: {},
  handler: async (ctx): Promise<Array<ConversationPreview>> => {
    const me = await requireUser(ctx);
    // Super admin data-access gate: when blocked, return no conversations.
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "messages")) {
      return [];
    }

    const asA = await ctx.db
      .query("conversations")
      .withIndex("by_userA_and_last", (q) => q.eq("userAId", me._id))
      .order("desc")
      .take(100);
    const asB = await ctx.db
      .query("conversations")
      .withIndex("by_userB_and_last", (q) => q.eq("userBId", me._id))
      .order("desc")
      .take(100);

    const conversations = [...asA, ...asB].sort((x, y) =>
      y.lastMessageAt.localeCompare(x.lastMessageAt),
    );

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (
      id: Id<"users">,
    ): Promise<Doc<"users"> | null> => {
      const cached = userCache.get(id);
      if (cached !== undefined) return cached;
      const u = await ctx.db.get(id);
      userCache.set(id, u);
      return u;
    };

    const results: Array<ConversationPreview> = [];
    for (const c of conversations) {
      const otherId = c.userAId === me._id ? c.userBId : c.userAId;
      const other = await getUser(otherId);

      // Count unread messages (where I'm the recipient and not yet read)
      const unreadMessages = await ctx.db
        .query("directMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .collect();
      const unreadCount = unreadMessages.filter(
        (m) => m.recipientId === me._id && !m.readAt,
      ).length;

      results.push({
        _id: c._id,
        _creationTime: c._creationTime,
        otherUser: {
          _id: otherId,
          name: other?.name ?? null,
          avatarUrl: other?.avatarUrl ?? null,
          jobTitle: other?.jobTitle ?? null,
          department: other?.department ?? null,
        },
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview ?? null,
        lastMessageSenderId: c.lastMessageSenderId ?? null,
        unreadCount,
      });
    }
    return results;
  },
});

/** Total unread count across all my conversations (for badges). */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!me) return 0;

    // Super admin data-access gate: blocked super admins see no unread count.
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "messages")) {
      return 0;
    }

    const unread = await ctx.db
      .query("directMessages")
      .withIndex("by_recipient_and_read", (q) =>
        q.eq("recipientId", me._id).eq("readAt", undefined),
      )
      .take(500);
    return unread.length;
  },
});

/**
 * Newest unread incoming message (for a pop-up alert on the frontend).
 * Returns null when there is nothing unread.
 */
export const getLatestUnread = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    messageId: Id<"directMessages">;
    conversationId: Id<"conversations">;
    senderId: Id<"users">;
    senderName: string | null;
    senderAvatar: string | null;
    preview: string;
    createdAt: number;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!me) return null;

    // Super admin data-access gate: no unread pop-up when blocked.
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "messages")) {
      return null;
    }

    // Most recent unread message where I'm the recipient.
    const unread = await ctx.db
      .query("directMessages")
      .withIndex("by_recipient_and_read", (q) =>
        q.eq("recipientId", me._id).eq("readAt", undefined),
      )
      .order("desc")
      .first();
    if (!unread) return null;

    const sender = await ctx.db.get(unread.senderId);
    return {
      messageId: unread._id,
      conversationId: unread.conversationId,
      senderId: unread.senderId,
      senderName: sender?.name ?? null,
      senderAvatar: sender?.avatarUrl ?? null,
      preview: unread.content,
      createdAt: unread._creationTime,
    };
  },
});

/** Get a conversation by id (only if the current user is a participant). */
export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    conversation: Doc<"conversations">;
    otherUser: Doc<"users"> | null;
  } | null> => {
    const me = await requireUser(ctx);
    // Super admin data-access gate: blocked super admins see nothing.
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "messages")) {
      return null;
    }
    const c = await ctx.db.get(args.conversationId);
    // Return null (instead of throwing) when the conversation no longer exists
    // or is not the current user's. Throwing here would crash the React render
    // when a conversation is deleted while its view is still subscribed.
    if (!c) return null;
    if (c.userAId !== me._id && c.userBId !== me._id) return null;
    const otherId = c.userAId === me._id ? c.userBId : c.userAId;
    const otherUser = await ctx.db.get(otherId);
    return { conversation: c, otherUser };
  },
});

/** List messages in a conversation (chronological, newest at the bottom). */
export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<MessageWithSender>> => {
    const me = await requireUser(ctx);
    // Super admin data-access gate: blocked super admins see no messages.
    if (await isSuperAdminBlocked(ctx, me.role === "super_admin", "messages")) {
      return [];
    }
    const c = await ctx.db.get(args.conversationId);
    // Return an empty list (instead of throwing) when the conversation is gone
    // or not the current user's, so a deleted conversation doesn't crash render.
    if (!c) return [];
    if (c.userAId !== me._id && c.userBId !== me._id) return [];
    const limit = Math.min(args.limit ?? 200, 500);
    const latest = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(limit);

    const ordered = latest.slice().reverse();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<MessageWithSender> = [];
    for (const m of ordered) {
      let sender = userCache.get(m.senderId);
      if (sender === undefined) {
        sender = await ctx.db.get(m.senderId);
        userCache.set(m.senderId, sender);
      }
      results.push({
        ...m,
        senderName: sender?.name ?? null,
        senderAvatar: sender?.avatarUrl ?? null,
      });
    }
    return results;
  },
});

/**
 * Start (or get existing) conversation with another user, then return its id.
 * Used when clicking "Kirim Pesan" on a profile / directory card.
 */
export const startConversation = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args): Promise<Id<"conversations">> => {
    const me = await requireUser(ctx);
    if (args.otherUserId === me._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak bisa mengirim pesan ke diri sendiri",
      });
    }
    const other = await ctx.db.get(args.otherUserId);
    if (!other) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Pengguna tidak ditemukan",
      });
    }

    const key = conversationKey(me._id, args.otherUserId);
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) return existing._id;

    // Deterministic A/B ordering so indexes resolve consistently
    const [userAId, userBId] =
      me._id < args.otherUserId
        ? [me._id, args.otherUserId]
        : [args.otherUserId, me._id];

    return await ctx.db.insert("conversations", {
      key,
      userAId,
      userBId,
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: undefined,
      lastMessageSenderId: undefined,
    });
  },
});

/** Send a message in a conversation. */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"directMessages">> => {
    const me = await requireUser(ctx);
    const trimmed = args.content.trim();
    if (trimmed.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pesan tidak boleh kosong",
      });
    }
    if (trimmed.length > 4000) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pesan terlalu panjang (maks 4000 karakter)",
      });
    }
    const c = await ctx.db.get(args.conversationId);
    if (!c) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Percakapan tidak ditemukan",
      });
    }
    if (c.userAId !== me._id && c.userBId !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan percakapan Anda",
      });
    }
    const recipientId = c.userAId === me._id ? c.userBId : c.userAId;

    const now = new Date().toISOString();
    const messageId = await ctx.db.insert("directMessages", {
      conversationId: args.conversationId,
      senderId: me._id,
      recipientId,
      content: trimmed,
      readAt: undefined,
    });

    const preview = trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      lastMessageSenderId: me._id,
    });

    // Notification to the recipient (in-app bell)
    await notifyUser(ctx, {
      userId: recipientId,
      type: "direct_message",
      title: "Pesan baru",
      message: `${me.name ?? "Seseorang"}: ${preview}`,
      link: `/messages/${args.conversationId}`,
      actorId: me._id,
    });

    return messageId;
  },
});

/** Mark all unread messages in a conversation as read (for the current user). */
export const markConversationRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const me = await requireUser(ctx);
    const c = await ctx.db.get(args.conversationId);
    if (!c) return { count: 0 };
    if (c.userAId !== me._id && c.userBId !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan percakapan Anda",
      });
    }
    const messages = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    const now = new Date().toISOString();
    let count = 0;
    for (const m of messages) {
      if (m.recipientId === me._id && !m.readAt) {
        await ctx.db.patch(m._id, { readAt: now });
        count += 1;
      }
    }
    return { count };
  },
});

/** Delete a message (sender only). */
export const deleteMessage = mutation({
  args: { messageId: v.id("directMessages") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const m = await ctx.db.get(args.messageId);
    if (!m) return null;
    if (m.senderId !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pengirim yang dapat menghapus pesan",
      });
    }
    await ctx.db.delete(args.messageId);
    return null;
  },
});

/**
 * Delete several messages at once (sender only). Skips any message that is not
 * owned by the current user so a partial selection still succeeds. Returns the
 * number of messages actually deleted.
 */
export const deleteMessages = mutation({
  args: { messageIds: v.array(v.id("directMessages")) },
  handler: async (ctx, args): Promise<number> => {
    const me = await requireUser(ctx);
    let deleted = 0;
    for (const messageId of args.messageIds) {
      const m = await ctx.db.get(messageId);
      if (!m) continue;
      if (m.senderId !== me._id) continue;
      await ctx.db.delete(messageId);
      deleted++;
    }
    return deleted;
  },
});

/**
 * Delete an entire conversation and all of its messages.
 * Only a participant of the conversation may do this. This removes the
 * conversation for both people since a direct chat is shared.
 */
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args): Promise<null> => {
    const me = await requireUser(ctx);
    const c = await ctx.db.get(args.conversationId);
    if (!c) return null;
    if (c.userAId !== me._id && c.userBId !== me._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Bukan percakapan Anda",
      });
    }

    // Delete all messages in this conversation, then the conversation itself.
    const messages = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.conversationId);
    return null;
  },
});
