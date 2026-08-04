import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { notifyAdmins, notifyUser, notifySuperAdmins } from "./notifications";
import { isAdminRole, isSuperAdminRole } from "./roles";
import { requireTenant, assertSameTenant } from "./lib/tenant";

export type TicketListItem = Doc<"tickets"> & {
  authorName: string | null;
  authorAvatar: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  commentCount: number;
};

export type TicketCommentWithAuthor = Doc<"ticketComments"> & {
  authorName: string | null;
  authorAvatar: string | null;
};

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
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
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

async function enrichTickets(
  ctx: QueryCtx,
  tickets: Array<Doc<"tickets">>,
): Promise<Array<TicketListItem>> {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const getUser = async (id: Id<"users">) => {
    let u = userCache.get(id);
    if (u === undefined) {
      u = await ctx.db.get(id);
      userCache.set(id, u);
    }
    return u;
  };

  const results: Array<TicketListItem> = [];
  for (const t of tickets) {
    const author = await getUser(t.authorId);
    const assignee = t.assigneeId ? await getUser(t.assigneeId) : null;

    // Count comments (bounded; small per-ticket)
    const comments = await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", t._id))
      .collect();

    results.push({
      ...t,
      authorName: author?.name ?? null,
      authorAvatar: author?.avatarUrl ?? null,
      assigneeName: assignee?.name ?? null,
      assigneeAvatar: assignee?.avatarUrl ?? null,
      commentCount: comments.length,
    });
  }
  return results;
}

export const listTickets = query({
  args: {
    scope: v.optional(v.string()), // "mine" | "all"
    status: v.optional(v.string()), // "all" | "open" | "in_progress" | "resolved" | "closed"
  },
  handler: async (ctx, args): Promise<Array<TicketListItem>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const scope = args.scope ?? "mine";
    const status = args.status ?? "all";

    let tickets: Array<Doc<"tickets">>;
    if (scope === "mine") {
      tickets = await ctx.db
        .query("tickets")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .collect();
    } else {
      // "all" scope is admin-only
      if (!isAdminRole(user.role)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Hanya admin IT yang dapat melihat semua tiket",
        });
      }
      if (status !== "all") {
        tickets = await ctx.db
          .query("tickets")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect();
      } else {
        tickets = await ctx.db
          .query("tickets")
          .withIndex("by_last_activity")
          .order("desc")
          .collect();
      }
    }

    // Apply status filter for "mine" scope (in-memory)
    if (scope === "mine" && status !== "all") {
      tickets = tickets.filter((t) => t.status === status);
    }

    // Multi-tenant isolation: always scope to the caller's org. A super admin
    // without an active grant has organizationId === null and sees no tickets.
    tickets = tickets.filter((t) => t.organizationId === organizationId);

    // Sort by last activity desc if not already
    tickets.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    tickets = tickets.slice(0, 200);

    return await enrichTickets(ctx, tickets);
  },
});

export const getTicket = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args): Promise<TicketListItem | null> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;
    assertSameTenant(organizationId, ticket.organizationId, "ticket");

    // Only owner or admin can view
    if (ticket.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk melihat tiket ini",
      });
    }

    const enriched = await enrichTickets(ctx, [ticket]);
    return enriched[0] ?? null;
  },
});

export const listComments = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args): Promise<Array<TicketCommentWithAuthor>> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tiket tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, ticket.organizationId, "ticket");
    if (ticket.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk melihat komentar tiket ini",
      });
    }

    const comments = await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect();

    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    const results: Array<TicketCommentWithAuthor> = [];
    for (const c of comments) {
      let author = cache.get(c.authorId);
      if (author === undefined) {
        author = await ctx.db.get(c.authorId);
        cache.set(c.authorId, author);
      }
      results.push({
        ...c,
        authorName: author?.name ?? null,
        authorAvatar: author?.avatarUrl ?? null,
      });
    }
    return results;
  },
});

export const getStats = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    myOpen: number;
    myInProgress: number;
    myResolved: number;
    allOpen: number;
    isAdmin: boolean;
  }> => {
    const user = await requireUser(ctx);
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    const isAdmin = isAdminRole(user.role);

    let mine = await ctx.db
      .query("tickets")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .collect();

    // Multi-tenant isolation on own tickets (super admin without grant → none)
    mine = mine.filter((t) => t.organizationId === organizationId);

    let myOpen = 0;
    let myInProgress = 0;
    let myResolved = 0;
    for (const t of mine) {
      if (t.status === "open") myOpen++;
      else if (t.status === "in_progress") myInProgress++;
      else if (t.status === "resolved" || t.status === "closed") myResolved++;
    }

    let allOpen = 0;
    if (isAdmin) {
      let openTickets = await ctx.db
        .query("tickets")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect();
      let inProgress = await ctx.db
        .query("tickets")
        .withIndex("by_status", (q) => q.eq("status", "in_progress"))
        .collect();

      // Multi-tenant isolation on admin counts (super admin without grant → none)
      openTickets = openTickets.filter((t) => t.organizationId === organizationId);
      inProgress = inProgress.filter((t) => t.organizationId === organizationId);

      allOpen = openTickets.length + inProgress.length;
    }

    return { myOpen, myInProgress, myResolved, allOpen, isAdmin };
  },
});

// Lightweight count for the sidebar "Bantuan IT" badge.
// - Admin / super admin: number of tickets still needing attention (open +
//   in_progress) within their scope (all orgs for super admin).
// - Regular users: number of their OWN tickets still open or in progress.
export const getSidebarBadgeCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return 0;

    const organizationId = user.organizationId ?? null;
    const isAdmin = isAdminRole(user.role);
    const isSuperAdmin = isSuperAdminRole(user.role);

    if (isAdmin) {
      let open = await ctx.db
        .query("tickets")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect();
      let inProgress = await ctx.db
        .query("tickets")
        .withIndex("by_status", (q) => q.eq("status", "in_progress"))
        .collect();
      open = open.filter((t) => t.organizationId === organizationId);
      inProgress = inProgress.filter(
        (t) => t.organizationId === organizationId,
      );
      return open.length + inProgress.length;
    }

    let mine = await ctx.db
      .query("tickets")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .collect();
    mine = mine.filter((t) => t.organizationId === organizationId);
    return mine.filter(
      (t) => t.status === "open" || t.status === "in_progress",
    ).length;
  },
});

export const createTicket = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"tickets">> => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    const description = args.description.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul tiket wajib diisi",
      });
    }
    if (description.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Deskripsi tiket wajib diisi",
      });
    }
    if (!user.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User is not assigned to any organization",
      });
    }
    const now = new Date().toISOString();
    const ticketId = await ctx.db.insert("tickets", {
      title,
      description,
      category: args.category,
      priority: args.priority,
      status: "open",
      authorId: user._id,
      organizationId: user.organizationId,
      lastActivityAt: now,
    });

    // Notify IT admins in the same organization about a new ticket
    const notified = await notifyAdmins(ctx, {
      type: "ticket_new",
      title: "Tiket bantuan IT baru",
      message: `${user.name ?? "Seorang karyawan"}: ${title}`,
      link: `/support/${ticketId}`,
      actorId: user._id,
    });

    // Fallback: if the organization has no admin to handle the ticket,
    // notify platform super admins so it is never left unattended.
    if (notified === 0) {
      await notifySuperAdmins(ctx, {
        type: "ticket_new",
        title: "Tiket IT tanpa admin organisasi",
        message: `${user.name ?? "Seorang karyawan"}: ${title}`,
        link: `/support/${ticketId}`,
        actorId: user._id,
      });
    }

    return ticketId;
  },
});

export const addComment = mutation({
  args: {
    ticketId: v.id("tickets"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"ticketComments">> => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const content = args.content.trim();
    if (content.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Komentar tidak boleh kosong",
      });
    }
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tiket tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, ticket.organizationId, "ticket");
    if (ticket.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk berkomentar",
      });
    }
    if (!user.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User is not assigned to any organization",
      });
    }
    const commentId = await ctx.db.insert("ticketComments", {
      ticketId: args.ticketId,
      authorId: user._id,
      organizationId: user.organizationId,
      content,
    });
    await ctx.db.patch(args.ticketId, {
      lastActivityAt: new Date().toISOString(),
    });

    // Notify the other party (author gets notified if admin commented; admins notified if author commented)
    if (ticket.authorId !== user._id) {
      // An admin replied – notify the ticket author
      await notifyUser(ctx, {
        userId: ticket.authorId,
        type: "ticket_comment",
        title: "Komentar baru di tiket Anda",
        message: `${user.name ?? "IT"} membalas "${ticket.title}"`,
        link: `/support/${ticket._id}`,
        actorId: user._id,
      });
    } else {
      // Ticket author commented – notify the assignee if any, otherwise admins
      if (ticket.assigneeId && ticket.assigneeId !== user._id) {
        await notifyUser(ctx, {
          userId: ticket.assigneeId,
          type: "ticket_comment",
          title: "Komentar baru pada tiket",
          message: `${user.name ?? "Pelapor"} menambahkan komentar pada "${ticket.title}"`,
          link: `/support/${ticket._id}`,
          actorId: user._id,
        });
      }
    }

    return commentId;
  },
});

export const updateStatus = mutation({
  args: {
    ticketId: v.id("tickets"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tiket tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, ticket.organizationId, "ticket");
    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (!validStatuses.includes(args.status)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Status tidak valid",
      });
    }
    const isAdmin = isAdminRole(user.role);
    const isAuthor = ticket.authorId === user._id;

    // Only admin can change status freely; author can only close their own ticket
    if (!isAdmin) {
      if (!isAuthor) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Anda tidak memiliki izin untuk mengubah status",
        });
      }
      // Author can only close their ticket
      if (args.status !== "closed") {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Hanya admin IT yang dapat mengubah status ini",
        });
      }
    }

    const patch: Partial<Doc<"tickets">> = {
      status: args.status,
      lastActivityAt: new Date().toISOString(),
    };
    if (args.status === "resolved" || args.status === "closed") {
      patch.resolvedAt = new Date().toISOString();
    }
    // If admin sets in_progress without an assignee, auto-assign themselves
    if (args.status === "in_progress" && isAdmin && !ticket.assigneeId) {
      patch.assigneeId = user._id;
    }

    await ctx.db.patch(args.ticketId, patch);

    // Notify ticket author about status change (if not the one who triggered it)
    if (ticket.authorId !== user._id) {
      const statusLabel: Record<string, string> = {
        open: "dibuka kembali",
        in_progress: "sedang dikerjakan",
        resolved: "diselesaikan",
        closed: "ditutup",
      };
      await notifyUser(ctx, {
        userId: ticket.authorId,
        type: "ticket_status",
        title: "Status tiket diperbarui",
        message: `"${ticket.title}" ${statusLabel[args.status] ?? args.status}`,
        link: `/support/${ticket._id}`,
        actorId: user._id,
      });
    }
    return null;
  },
});

export const assignToMe = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    if (!isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya admin IT yang dapat mengambil tiket",
      });
    }
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tiket tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, ticket.organizationId, "ticket");
    await ctx.db.patch(args.ticketId, {
      assigneeId: user._id,
      status: ticket.status === "open" ? "in_progress" : ticket.status,
      lastActivityAt: new Date().toISOString(),
    });
    return null;
  },
});

export const removeTicket = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tiket tidak ditemukan",
      });
    }
    assertSameTenant(organizationId, ticket.organizationId, "ticket");
    if (ticket.authorId !== user._id && !isAdminRole(user.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin untuk menghapus tiket ini",
      });
    }
    const comments = await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .collect();
    for (const c of comments) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(args.ticketId);
    return null;
  },
});

export const bulkRemoveTickets = mutation({
  args: { ticketIds: v.array(v.id("tickets")) },
  handler: async (ctx, args): Promise<{ deleted: number; skipped: number }> => {
    const user = await requireUser(ctx);
    const organizationId = user.organizationId ?? null;
    const isAdmin = isAdminRole(user.role);
    const isSuperAdmin = isSuperAdminRole(user.role);

    if (args.ticketIds.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tidak ada tiket yang dipilih",
      });
    }
    // Bounded to keep the mutation within transaction limits.
    if (args.ticketIds.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 tiket dapat dihapus sekaligus",
      });
    }

    let deleted = 0;
    let skipped = 0;
    for (const ticketId of args.ticketIds) {
      const ticket = await ctx.db.get(ticketId);
      if (!ticket) {
        skipped++;
        continue;
      }
      // Super admin can delete across all tenants. Everyone else is limited to
      // their own organization's tickets.
      if (
        !isSuperAdmin &&
        organizationId !== null &&
        ticket.organizationId !== organizationId
      ) {
        skipped++;
        continue;
      }
      // Author can delete own; admin/super admin can delete any (within tenant).
      if (ticket.authorId !== user._id && !isAdmin) {
        skipped++;
        continue;
      }
      const comments = await ctx.db
        .query("ticketComments")
        .withIndex("by_ticket", (q) => q.eq("ticketId", ticketId))
        .collect();
      for (const c of comments) {
        await ctx.db.delete(c._id);
      }
      await ctx.db.delete(ticketId);
      deleted++;
    }
    return { deleted, skipped };
  },
});
