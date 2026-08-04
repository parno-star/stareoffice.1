import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { requireUser } from "./_helpers";

// Peer study groups: collaborative learning groups with discussion posts.

export type EnrichedGroup = Doc<"peerGroups"> & {
  owner: Doc<"users"> | null;
  iAmMember: boolean;
  iAmOwner: boolean;
  course: Doc<"courses"> | null;
};

export const listGroups = query({
  args: {
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    joinedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<EnrichedGroup>> => {
    const user = await requireUser(ctx);
    let rows: Array<Doc<"peerGroups">>;
    if (args.status && args.status !== "all") {
      rows = await ctx.db
        .query("peerGroups")
        .withIndex("by_status", (q) => q.eq("status", args.status as string))
        .collect();
    } else {
      rows = await ctx.db.query("peerGroups").collect();
    }
    if (args.category && args.category !== "all") {
      rows = rows.filter((g) => g.category === args.category);
    }
    const myMemberships = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const memberOf = new Set(myMemberships.map((m) => m.groupId));
    const ownerOfSet = new Set(
      myMemberships.filter((m) => m.role === "owner").map((m) => m.groupId),
    );
    if (args.joinedOnly) {
      rows = rows.filter((g) => memberOf.has(g._id));
    }
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const result: Array<EnrichedGroup> = [];
    for (const g of rows) {
      const owner = await ctx.db.get(g.ownerId);
      const course = g.courseId ? await ctx.db.get(g.courseId) : null;
      result.push({
        ...g,
        owner,
        course,
        iAmMember: memberOf.has(g._id),
        iAmOwner: ownerOfSet.has(g._id),
      });
    }
    return result;
  },
});

export const getGroup = query({
  args: { groupId: v.id("peerGroups") },
  handler: async (
    ctx,
    args,
  ): Promise<
    | (EnrichedGroup & {
        members: Array<Doc<"peerGroupMembers"> & { user: Doc<"users"> | null }>;
      })
    | null
  > => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) return null;
    const members = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", g._id))
      .collect();
    const iAmMember = members.some((m) => m.userId === user._id);
    const iAmOwner = members.some(
      (m) => m.userId === user._id && m.role === "owner",
    );
    const owner = await ctx.db.get(g.ownerId);
    const course = g.courseId ? await ctx.db.get(g.courseId) : null;
    const enrichedMembers: Array<
      Doc<"peerGroupMembers"> & { user: Doc<"users"> | null }
    > = [];
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      enrichedMembers.push({ ...m, user: u });
    }
    enrichedMembers.sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
    return {
      ...g,
      owner,
      course,
      iAmMember,
      iAmOwner,
      members: enrichedMembers,
    };
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    joinPolicy: v.string(),
    capacity: v.number(),
    cadence: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"peerGroups">> => {
    const user = await requireUser(ctx);
    if (args.name.trim().length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nama wajib diisi" });
    }
    if (args.capacity < 0 || args.capacity > 500) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Kapasitas 0..500 (0 = tanpa batas)",
      });
    }
    const now = new Date().toISOString();
    const id = await ctx.db.insert("peerGroups", {
      name: args.name.trim(),
      description: args.description,
      category: args.category,
      coverColor: args.coverColor,
      icon: args.icon,
      courseId: args.courseId,
      joinPolicy: args.joinPolicy,
      capacity: args.capacity,
      cadence: args.cadence,
      meetingUrl: args.meetingUrl,
      status: "active",
      ownerId: user._id,
      memberCount: 1,
      postCount: 0,
      updatedAt: now,
    });
    await ctx.db.insert("peerGroupMembers", {
      groupId: id,
      userId: user._id,
      role: "owner",
      joinedAt: now,
    });
    return id;
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id("peerGroups"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    coverColor: v.string(),
    icon: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    joinPolicy: v.string(),
    capacity: v.number(),
    cadence: v.optional(v.string()),
    meetingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (g.ownerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya owner yang bisa mengedit",
      });
    }
    await ctx.db.patch(g._id, {
      name: args.name.trim(),
      description: args.description,
      category: args.category,
      coverColor: args.coverColor,
      icon: args.icon,
      courseId: args.courseId,
      joinPolicy: args.joinPolicy,
      capacity: args.capacity,
      cadence: args.cadence,
      meetingUrl: args.meetingUrl,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const archiveGroup = mutation({
  args: { groupId: v.id("peerGroups") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (g.ownerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya owner yang bisa mengarsipkan",
      });
    }
    await ctx.db.patch(g._id, {
      status: g.status === "archived" ? "active" : "archived",
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("peerGroups") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) return null;
    if (g.ownerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya owner yang bisa menghapus",
      });
    }
    // Delete members, posts, likes
    const members = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", g._id))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }
    const posts = await ctx.db
      .query("peerGroupPosts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id))
      .collect();
    for (const p of posts) {
      const likes = await ctx.db
        .query("peerGroupPostLikes")
        .withIndex("by_post", (q) => q.eq("postId", p._id))
        .collect();
      for (const l of likes) await ctx.db.delete(l._id);
      await ctx.db.delete(p._id);
    }
    await ctx.db.delete(g._id);
    return null;
  },
});

export const joinGroup = mutation({
  args: { groupId: v.id("peerGroups") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (g.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Grup sudah diarsipkan",
      });
    }
    if (g.joinPolicy !== "open") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Grup ini hanya dapat dimasuki via undangan",
      });
    }
    if (g.capacity > 0 && g.memberCount >= g.capacity) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Grup sudah penuh",
      });
    }
    const existing = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", g._id).eq("userId", user._id),
      )
      .unique();
    if (existing) return null;
    await ctx.db.insert("peerGroupMembers", {
      groupId: g._id,
      userId: user._id,
      role: "member",
      joinedAt: new Date().toISOString(),
    });
    await ctx.db.patch(g._id, {
      memberCount: g.memberCount + 1,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("peerGroups") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    const membership = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", g._id).eq("userId", user._id),
      )
      .unique();
    if (!membership) return null;
    if (membership.role === "owner") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Owner tidak dapat keluar. Hapus grup atau pindahkan kepemilikan.",
      });
    }
    await ctx.db.delete(membership._id);
    await ctx.db.patch(g._id, {
      memberCount: Math.max(1, g.memberCount - 1),
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const inviteMember = mutation({
  args: { groupId: v.id("peerGroups"), userId: v.id("users") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (g.ownerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya owner yang dapat menambahkan anggota",
      });
    }
    if (g.capacity > 0 && g.memberCount >= g.capacity) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Grup sudah penuh",
      });
    }
    const existing = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", g._id).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Pengguna sudah menjadi anggota",
      });
    }
    await ctx.db.insert("peerGroupMembers", {
      groupId: g._id,
      userId: args.userId,
      role: "member",
      joinedAt: new Date().toISOString(),
    });
    await ctx.db.patch(g._id, {
      memberCount: g.memberCount + 1,
      updatedAt: new Date().toISOString(),
    });
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "peer_group_invite",
      title: "Anda ditambahkan ke grup belajar",
      message: g.name,
      link: `/mentorship/group/${g._id}`,
      actorId: user._id,
    });
    return null;
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("peerGroups"), userId: v.id("users") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    if (g.ownerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya owner yang dapat mengeluarkan anggota",
      });
    }
    if (args.userId === g.ownerId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Owner tidak dapat dikeluarkan",
      });
    }
    const membership = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", g._id).eq("userId", args.userId),
      )
      .unique();
    if (!membership) return null;
    await ctx.db.delete(membership._id);
    await ctx.db.patch(g._id, {
      memberCount: Math.max(1, g.memberCount - 1),
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

// ---- Posts ----------------------------------------------------------

export type EnrichedPost = Doc<"peerGroupPosts"> & {
  author: Doc<"users"> | null;
  likedByMe: boolean;
  replies?: Array<EnrichedPost>;
};

export const listPosts = query({
  args: { groupId: v.id("peerGroups") },
  handler: async (ctx, args): Promise<Array<EnrichedPost>> => {
    const user = await requireUser(ctx);
    const g = await ctx.db.get(args.groupId);
    if (!g) return [];
    const membership = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", g._id).eq("userId", user._id),
      )
      .unique();
    if (!membership) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya anggota grup yang dapat melihat diskusi",
      });
    }
    const allPosts = await ctx.db
      .query("peerGroupPosts")
      .withIndex("by_group", (q) => q.eq("groupId", g._id))
      .collect();
    const topLevel = allPosts.filter((p) => p.parentId === undefined);
    const repliesByParent = new Map<Id<"peerGroupPosts">, Array<Doc<"peerGroupPosts">>>();
    for (const p of allPosts) {
      if (p.parentId) {
        const arr = repliesByParent.get(p.parentId) ?? [];
        arr.push(p);
        repliesByParent.set(p.parentId, arr);
      }
    }
    topLevel.sort((a, b) => b._creationTime - a._creationTime);
    const myLikes = await ctx.db
      .query("peerGroupPostLikes")
      .withIndex("by_user_and_post", (q) => q.eq("userId", user._id))
      .collect();
    const likedSet = new Set(myLikes.map((l) => l.postId));
    const result: Array<EnrichedPost> = [];
    for (const p of topLevel) {
      const author = await ctx.db.get(p.authorId);
      const replies = repliesByParent.get(p._id) ?? [];
      replies.sort((a, b) => a._creationTime - b._creationTime);
      const enrichedReplies: Array<EnrichedPost> = [];
      for (const r of replies) {
        const rAuthor = await ctx.db.get(r.authorId);
        enrichedReplies.push({
          ...r,
          author: rAuthor,
          likedByMe: likedSet.has(r._id),
        });
      }
      result.push({
        ...p,
        author,
        likedByMe: likedSet.has(p._id),
        replies: enrichedReplies,
      });
    }
    return result;
  },
});

export const createPost = mutation({
  args: {
    groupId: v.id("peerGroups"),
    content: v.string(),
    kind: v.string(),
    parentId: v.optional(v.id("peerGroupPosts")),
  },
  handler: async (ctx, args): Promise<Id<"peerGroupPosts">> => {
    const user = await requireUser(ctx);
    if (args.content.trim().length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Isi kosong" });
    }
    const g = await ctx.db.get(args.groupId);
    if (!g) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    const membership = await ctx.db
      .query("peerGroupMembers")
      .withIndex("by_group_and_user", (q) =>
        q.eq("groupId", g._id).eq("userId", user._id),
      )
      .unique();
    if (!membership) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya anggota grup yang dapat memposting",
      });
    }
    const id = await ctx.db.insert("peerGroupPosts", {
      groupId: g._id,
      authorId: user._id,
      parentId: args.parentId,
      content: args.content,
      kind: args.kind,
      likeCount: 0,
      replyCount: 0,
    });
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (parent) {
        await ctx.db.patch(parent._id, {
          replyCount: parent.replyCount + 1,
        });
      }
    }
    await ctx.db.patch(g._id, {
      postCount: g.postCount + 1,
      updatedAt: new Date().toISOString(),
    });
    return id;
  },
});

export const deletePost = mutation({
  args: { postId: v.id("peerGroupPosts") },
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.postId);
    if (!p) return null;
    const g = await ctx.db.get(p.groupId);
    if (!g) return null;
    if (p.authorId !== user._id && g.ownerId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak berhak menghapus",
      });
    }
    // Delete likes
    const likes = await ctx.db
      .query("peerGroupPostLikes")
      .withIndex("by_post", (q) => q.eq("postId", p._id))
      .collect();
    for (const l of likes) await ctx.db.delete(l._id);
    // Delete replies
    if (!p.parentId) {
      const replies = (
        await ctx.db
          .query("peerGroupPosts")
          .withIndex("by_group", (q) => q.eq("groupId", p.groupId))
          .collect()
      ).filter((r) => r.parentId === p._id);
      for (const r of replies) {
        const rLikes = await ctx.db
          .query("peerGroupPostLikes")
          .withIndex("by_post", (q) => q.eq("postId", r._id))
          .collect();
        for (const l of rLikes) await ctx.db.delete(l._id);
        await ctx.db.delete(r._id);
      }
    } else {
      const parent = await ctx.db.get(p.parentId);
      if (parent) {
        await ctx.db.patch(parent._id, {
          replyCount: Math.max(0, parent.replyCount - 1),
        });
      }
    }
    await ctx.db.delete(p._id);
    await ctx.db.patch(g._id, {
      postCount: Math.max(0, g.postCount - 1),
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const togglePostLike = mutation({
  args: { postId: v.id("peerGroupPosts") },
  handler: async (ctx, args): Promise<{ liked: boolean }> => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.postId);
    if (!p) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tidak ditemukan" });
    }
    const existing = await ctx.db
      .query("peerGroupPostLikes")
      .withIndex("by_user_and_post", (q) =>
        q.eq("userId", user._id).eq("postId", p._id),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(p._id, {
        likeCount: Math.max(0, p.likeCount - 1),
      });
      return { liked: false };
    }
    await ctx.db.insert("peerGroupPostLikes", {
      postId: p._id,
      userId: user._id,
    });
    await ctx.db.patch(p._id, { likeCount: p.likeCount + 1 });
    return { liked: true };
  },
});
