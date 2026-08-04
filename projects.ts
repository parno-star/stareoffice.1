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
import {
  getCompletedStatusKeys,
  getDefaultStatusKey,
  getPriorityOrderMap,
  resolveStatusesForOrg,
} from "./operationsSettings";

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

function isProjectMember(project: Doc<"projects">, userId: Id<"users">) {
  if (project.ownerId === userId) return true;
  return project.memberIds.some((id) => id === userId);
}

// ============ PROJECTS ============

export type ProjectWithStats = Doc<"projects"> & {
  owner: Doc<"users"> | null;
  taskCount: number;
  completedTaskCount: number;
  memberCount: number;
};

export const listProjects = query({
  args: {},
  handler: async (ctx): Promise<Array<ProjectWithStats>> => {
    const user = await requireUser(ctx);
    const orgId = user.organizationId;
    const completedKeys = await getCompletedStatusKeys(ctx, orgId ?? null);
    const all = await ctx.db.query("projects").collect();
    // Scope to the user's organization (super admins with no org see all)
    const orgScoped = orgId
      ? all.filter((p) => p.organizationId === orgId)
      : all;
    // Only show projects where the user is owner or member
    const visible = orgScoped.filter((p) => isProjectMember(p, user._id));

    const results: Array<ProjectWithStats> = [];
    for (const project of visible) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      const owner = await ctx.db.get(project.ownerId);
      results.push({
        ...project,
        owner,
        taskCount: tasks.length,
        completedTaskCount: tasks.filter((t) => completedKeys.has(t.status))
          .length,
        memberCount: project.memberIds.length + 1, // +1 for owner
      });
    }
    // Sort active first, then by name
    results.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      return a.name.localeCompare(b.name);
    });
    return results;
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    project: Doc<"projects">;
    owner: Doc<"users"> | null;
    members: Array<Doc<"users">>;
  } | null> => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    if (!isProjectMember(project, user._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan anggota proyek ini",
      });
    }
    const owner = await ctx.db.get(project.ownerId);
    const members: Array<Doc<"users">> = [];
    for (const id of project.memberIds) {
      const m = await ctx.db.get(id);
      if (m) members.push(m);
    }
    return { project, owner, members };
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args): Promise<Id<"projects">> => {
    const user = await requireUser(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama proyek tidak boleh kosong",
      });
    }
    // Dedupe + exclude owner from memberIds
    const memberSet = new Set<Id<"users">>();
    for (const id of args.memberIds) {
      if (id !== user._id) memberSet.add(id);
    }
    const projectId = await ctx.db.insert("projects", {
      name,
      description: args.description?.trim() || undefined,
      status: "active",
      ownerId: user._id,
      memberIds: Array.from(memberSet),
      color: args.color,
      organizationId: user.organizationId,
    });
    // Notify members they were added
    for (const id of memberSet) {
      await notifyUser(ctx, {
        userId: id,
        type: "task_assigned",
        title: `Ditambahkan ke proyek: ${name}`,
        message: `${user.name ?? "Seseorang"} menambahkan Anda ke proyek.`,
        link: `/projects/${projectId}`,
        actorId: user._id,
      });
    }
    return projectId;
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    color: v.optional(v.string()),
    memberIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Proyek tidak ditemukan",
      });
    }
    if (project.ownerId !== user._id && user.role !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pemilik proyek yang dapat mengubah",
      });
    }
    const patch: Partial<Doc<"projects">> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Nama proyek tidak boleh kosong",
        });
      }
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.status !== undefined) patch.status = args.status;
    if (args.color !== undefined) patch.color = args.color;
    if (args.memberIds !== undefined) {
      const existing = new Set(project.memberIds);
      const newSet = new Set<Id<"users">>();
      for (const id of args.memberIds) {
        if (id !== project.ownerId) newSet.add(id);
      }
      patch.memberIds = Array.from(newSet);
      // Notify new members
      for (const id of newSet) {
        if (!existing.has(id)) {
          await notifyUser(ctx, {
            userId: id,
            type: "task_assigned",
            title: `Ditambahkan ke proyek: ${project.name}`,
            message: `${user.name ?? "Seseorang"} menambahkan Anda ke proyek.`,
            link: `/projects/${project._id}`,
            actorId: user._id,
          });
        }
      }
    }
    await ctx.db.patch(args.projectId, patch);
    return null;
  },
});

export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    if (project.ownerId !== user._id && user.role !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya pemilik proyek yang dapat menghapus",
      });
    }
    // Delete all tasks in project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }
    await ctx.db.delete(args.projectId);
    return null;
  },
});

// ============ TASKS ============

export type TaskWithPeople = Doc<"tasks"> & {
  assignee: Doc<"users"> | null;
  author: Doc<"users"> | null;
};

export const listProjectTasks = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<Array<TaskWithPeople>> => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];
    if (!isProjectMember(project, user._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan anggota proyek ini",
      });
    }
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    tasks.sort((a, b) => a.order - b.order);
    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    const getUser = async (id: Id<"users"> | undefined) => {
      if (!id) return null;
      if (!cache.has(id)) cache.set(id, await ctx.db.get(id));
      return cache.get(id) ?? null;
    };
    const enriched: Array<TaskWithPeople> = [];
    for (const t of tasks) {
      enriched.push({
        ...t,
        assignee: await getUser(t.assigneeId),
        author: await getUser(t.authorId),
      });
    }
    return enriched;
  },
});

export const listMyTasks = query({
  args: { status: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<
      TaskWithPeople & {
        project: Doc<"projects"> | null;
      }
    >
  > => {
    const user = await requireUser(ctx);
    const prioOrder = await getPriorityOrderMap(
      ctx,
      user.organizationId ?? null,
    );
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))
      .collect();
    const filtered =
      args.status && args.status !== "all"
        ? tasks.filter((t) => t.status === args.status)
        : tasks;
    // Sort due date asc (nulls last), then priority (higher order = more urgent)
    filtered.sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (prioOrder[b.priority] ?? 0) - (prioOrder[a.priority] ?? 0);
    });
    const cache = new Map<Id<"users">, Doc<"users"> | null>();
    const pcache = new Map<Id<"projects">, Doc<"projects"> | null>();
    const getUser = async (id: Id<"users"> | undefined) => {
      if (!id) return null;
      if (!cache.has(id)) cache.set(id, await ctx.db.get(id));
      return cache.get(id) ?? null;
    };
    const getProject = async (id: Id<"projects">) => {
      if (!pcache.has(id)) pcache.set(id, await ctx.db.get(id));
      return pcache.get(id) ?? null;
    };
    const enriched = [];
    for (const t of filtered) {
      enriched.push({
        ...t,
        assignee: await getUser(t.assigneeId),
        author: await getUser(t.authorId),
        project: await getProject(t.projectId),
      });
    }
    return enriched;
  },
});

// Lightweight sidebar badge count for "Tugas & Proyek".
// Counts tasks assigned to the current user that are NOT in a completed status
// (per the org's task-status configuration). Never throws.
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

    const completed = await getCompletedStatusKeys(
      ctx,
      user.organizationId ?? null,
    );
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))
      .take(1000);
    return tasks.filter((t) => !completed.has(t.status)).length;
  },
});

export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    priority: v.string(),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"tasks">> => {
    const user = await requireUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Proyek tidak ditemukan",
      });
    }
    if (!isProjectMember(project, user._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan anggota proyek ini",
      });
    }
    const title = args.title.trim();
    if (title.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Judul tugas tidak boleh kosong",
      });
    }
    if (args.dueDate !== undefined && args.dueDate !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal tidak valid",
        });
      }
    }
    // Determine next order
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.order), 0);

    const defaultStatus = await getDefaultStatusKey(
      ctx,
      user.organizationId ?? null,
    );

    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      title,
      description: args.description?.trim() || undefined,
      assigneeId: args.assigneeId,
      status: defaultStatus,
      priority: args.priority,
      dueDate: args.dueDate || undefined,
      authorId: user._id,
      order: maxOrder + 1,
    });

    if (args.assigneeId && args.assigneeId !== user._id) {
      await notifyUser(ctx, {
        userId: args.assigneeId,
        type: "task_assigned",
        title: `Tugas baru: ${title}`,
        message: `Di proyek ${project.name}`,
        link: `/projects/${project._id}`,
        actorId: user._id,
      });
    }
    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Tugas tidak ditemukan",
      });
    }
    const project = await ctx.db.get(task.projectId);
    if (!project || !isProjectMember(project, user._id)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda bukan anggota proyek ini",
      });
    }

    const patch: Partial<Doc<"tasks">> = {};
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (title.length === 0) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Judul tugas tidak boleh kosong",
        });
      }
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.assigneeId !== undefined) {
      patch.assigneeId = args.assigneeId ?? undefined;
    }
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.dueDate !== undefined) {
      if (args.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Format tanggal tidak valid",
        });
      }
      patch.dueDate = args.dueDate || undefined;
    }
    const statusChanged =
      args.status !== undefined && args.status !== task.status;
    let resolvedStatuses: Awaited<ReturnType<typeof resolveStatusesForOrg>> | null =
      null;
    if (args.status !== undefined) {
      resolvedStatuses = await resolveStatusesForOrg(
        ctx,
        user.organizationId ?? null,
      );
      const completedKeys = new Set(
        resolvedStatuses.filter((s) => s.isCompleted).map((s) => s.key),
      );
      patch.status = args.status;
      const nowCompleted = completedKeys.has(args.status);
      const wasCompleted = completedKeys.has(task.status);
      if (nowCompleted && !wasCompleted) {
        patch.completedAt = new Date().toISOString();
      } else if (!nowCompleted && wasCompleted) {
        patch.completedAt = undefined;
      }
    }

    await ctx.db.patch(args.taskId, patch);

    // Notifications
    if (
      args.assigneeId !== undefined &&
      args.assigneeId &&
      args.assigneeId !== task.assigneeId &&
      args.assigneeId !== user._id
    ) {
      await notifyUser(ctx, {
        userId: args.assigneeId,
        type: "task_assigned",
        title: `Tugas ditugaskan: ${patch.title ?? task.title}`,
        message: `Di proyek ${project.name}`,
        link: `/projects/${project._id}`,
        actorId: user._id,
      });
    }
    if (statusChanged && task.assigneeId && task.assigneeId !== user._id) {
      const label =
        resolvedStatuses?.find((s) => s.key === args.status)?.label ??
        args.status;
      await notifyUser(ctx, {
        userId: task.assigneeId,
        type: "task_status",
        title: `Status tugas diubah: ${task.title}`,
        message: `Menjadi "${label}"`,
        link: `/projects/${project._id}`,
        actorId: user._id,
      });
    }
    return null;
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    const project = await ctx.db.get(task.projectId);
    if (!project) return null;
    const canDelete =
      task.authorId === user._id ||
      project.ownerId === user._id ||
      user.role === "admin";
    if (!canDelete) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Tidak dapat menghapus tugas ini",
      });
    }
    await ctx.db.delete(args.taskId);
    return null;
  },
});

// ============ BULK TASK ACTIONS ============

// Move several tasks to a new status at once. Caller must be a member of each
// task's project. Tasks in a different status transition and (un)stamp
// completedAt just like the single-task update. Invalid/forbidden rows are
// skipped so one bad row never blocks the batch.
export const bulkSetTaskStatus = mutation({
  args: {
    taskIds: v.array(v.id("tasks")),
    status: v.string(),
  },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (args.taskIds.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 tugas per aksi",
      });
    }
    const resolvedStatuses = await resolveStatusesForOrg(
      ctx,
      user.organizationId ?? null,
    );
    // The target status must be a real, active stage for this org.
    const target = resolvedStatuses.find((s) => s.key === args.status);
    if (!target) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tahapan tidak valid",
      });
    }
    const completedKeys = new Set(
      resolvedStatuses.filter((s) => s.isCompleted).map((s) => s.key),
    );
    const now = new Date().toISOString();
    // Cache project membership lookups to keep the loop cheap.
    const projectCache = new Map<Id<"projects">, Doc<"projects"> | null>();
    let count = 0;
    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      if (task.status === args.status) continue;
      let project = projectCache.get(task.projectId);
      if (project === undefined) {
        project = await ctx.db.get(task.projectId);
        projectCache.set(task.projectId, project);
      }
      if (!project || !isProjectMember(project, user._id)) continue;

      const patch: Partial<Doc<"tasks">> = { status: args.status };
      const nowCompleted = completedKeys.has(args.status);
      const wasCompleted = completedKeys.has(task.status);
      if (nowCompleted && !wasCompleted) {
        patch.completedAt = now;
      } else if (!nowCompleted && wasCompleted) {
        patch.completedAt = undefined;
      }
      await ctx.db.patch(taskId, patch);

      if (task.assigneeId && task.assigneeId !== user._id) {
        await notifyUser(ctx, {
          userId: task.assigneeId,
          type: "task_status",
          title: `Status tugas diubah: ${task.title}`,
          message: `Menjadi "${target.label}"`,
          link: `/projects/${project._id}`,
          actorId: user._id,
        });
      }
      count += 1;
    }
    return { count };
  },
});

// Delete several tasks at once. Same permission rules as deleteTask: the task
// author, the project owner, or an admin. Forbidden rows are skipped.
export const bulkDeleteTasks = mutation({
  args: { taskIds: v.array(v.id("tasks")) },
  handler: async (ctx, args): Promise<{ count: number }> => {
    const user = await requireUser(ctx);
    if (args.taskIds.length > 100) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Maksimal 100 tugas per aksi",
      });
    }
    const projectCache = new Map<Id<"projects">, Doc<"projects"> | null>();
    let count = 0;
    for (const taskId of args.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task) continue;
      let project = projectCache.get(task.projectId);
      if (project === undefined) {
        project = await ctx.db.get(task.projectId);
        projectCache.set(task.projectId, project);
      }
      if (!project) continue;
      const canDelete =
        task.authorId === user._id ||
        project.ownerId === user._id ||
        user.role === "admin";
      if (!canDelete) continue;
      await ctx.db.delete(taskId);
      count += 1;
    }
    return { count };
  },
});
