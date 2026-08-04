import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { notifyUser } from "./notifications";
import {
  applyCreateEducation,
  applyUpdateEducation,
  applyCreateTraining,
  applyUpdateTraining,
  applyCreateOrganization,
  applyUpdateOrganization,
  applyCreateAward,
  applyUpdateAward,
} from "./employeeHistory";
import { trackStorageRemoved } from "./lib/planStorage";

// Roles that can review history change requests.
const REVIEWER_ROLES = ["super_admin", "admin", "hr_manager"];

// Human-readable label for a history category.
const KIND_LABEL: Record<string, string> = {
  education: "Pendidikan",
  training: "Pelatihan",
  organization: "Organisasi",
  award: "Penghargaan",
};

const ACTION_LABEL: Record<string, string> = {
  create: "Tambah",
  update: "Ubah",
  delete: "Hapus",
};

type EnrichedRequest = Doc<"historyChangeRequests"> & {
  userName: string;
  userEmail: string;
  userDepartment: string;
  kindLabel: string;
  actionLabel: string;
  reviewerName?: string;
};

async function requireReviewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
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
      message: "Pengguna tidak ditemukan",
    });
  }
  if (!REVIEWER_ROLES.includes(user.role ?? "")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Hanya HR Manager atau Admin yang dapat mengelola permintaan ini",
    });
  }
  return user;
}

async function enrich(
  ctx: QueryCtx,
  req: Doc<"historyChangeRequests">,
): Promise<EnrichedRequest> {
  const user = await ctx.db.get(req.userId);
  const reviewer = req.reviewedBy ? await ctx.db.get(req.reviewedBy) : null;
  return {
    ...req,
    userName: user?.name ?? "Tidak diketahui",
    userEmail: user?.email ?? "",
    userDepartment: user?.department ?? "",
    kindLabel: KIND_LABEL[req.kind] ?? req.kind,
    actionLabel: ACTION_LABEL[req.action] ?? req.action,
    reviewerName: reviewer?.name ?? undefined,
  };
}

// List history change requests for the org (optionally filtered by status).
export const listAll = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Array<EnrichedRequest>> => {
    const { organizationId } = await requireTenant(ctx);
    await requireReviewer(ctx);

    let requests: Array<Doc<"historyChangeRequests">>;
    if (organizationId) {
      requests = args.status
        ? await ctx.db
            .query("historyChangeRequests")
            .withIndex("by_organization_and_status", (q) =>
              q.eq("organizationId", organizationId).eq("status", args.status!),
            )
            .order("desc")
            .take(100)
        : await ctx.db
            .query("historyChangeRequests")
            .withIndex("by_organization_and_status", (q) =>
              q.eq("organizationId", organizationId),
            )
            .order("desc")
            .take(100);
    } else {
      // Super admin without an active grant (organizationId === null): none.
      requests = [];
    }

    return await Promise.all(requests.map((r) => enrich(ctx, r)));
  },
});

// Count pending history change requests (for the verification badge).
export const countPending = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const { organizationId } = await requireTenant(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!currentUser) return 0;
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) return 0;

    if (organizationId) {
      const all = await ctx.db
        .query("historyChangeRequests")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "pending"),
        )
        .collect();
      return all.length;
    }
    // Super admin without an active grant (organizationId === null): none.
    return 0;
  },
});

// The current employee's own pending history requests (to show a badge on their
// riwayat entries / "menunggu verifikasi" list).
export const listMinePending = query({
  args: {},
  handler: async (ctx): Promise<Array<Doc<"historyChangeRequests">>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("historyChangeRequests")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});

// Apply an approved request's payload to the real history tables.
type ApplyCtx = Parameters<typeof applyCreateEducation>[0];

async function applyApprovedRequest(
  ctx: ApplyCtx,
  req: Doc<"historyChangeRequests">,
): Promise<void> {
  const payload = JSON.parse(req.payload) as Record<string, unknown>;
  const orgId = req.organizationId;
  const userId = req.userId;

  if (req.action === "delete") {
    if (!req.targetId) return;
    if (req.kind === "education") {
      const row = await ctx.db.get(req.targetId as Id<"employeeEducation">);
      if (row) {
        if (row.attachmentStorageId) {
          await trackStorageRemoved(ctx, row.organizationId, row.attachmentStorageId);
          await ctx.storage.delete(row.attachmentStorageId);
        }
        await ctx.db.delete(row._id);
      }
    } else if (req.kind === "training") {
      const row = await ctx.db.get(
        req.targetId as Id<"employeeTrainingHistory">,
      );
      if (row) {
        if (row.attachmentStorageId) {
          await trackStorageRemoved(ctx, row.organizationId, row.attachmentStorageId);
          await ctx.storage.delete(row.attachmentStorageId);
        }
        await ctx.db.delete(row._id);
      }
    } else if (req.kind === "organization") {
      const row = await ctx.db.get(
        req.targetId as Id<"employeeOrganizationHistory">,
      );
      if (row) {
        if (row.attachmentStorageId) {
          await trackStorageRemoved(ctx, row.organizationId, row.attachmentStorageId);
          await ctx.storage.delete(row.attachmentStorageId);
        }
        await ctx.db.delete(row._id);
      }
    } else if (req.kind === "award") {
      const row = await ctx.db.get(req.targetId as Id<"employeeAwardHistory">);
      if (row) {
        if (row.attachmentStorageId) {
          await trackStorageRemoved(ctx, row.organizationId, row.attachmentStorageId);
          await ctx.storage.delete(row.attachmentStorageId);
        }
        await ctx.db.delete(row._id);
      }
    }
    return;
  }

  // create / update
  if (req.kind === "education") {
    const p = payload as Parameters<typeof applyCreateEducation>[4];
    if (req.action === "create") {
      await applyCreateEducation(ctx, userId, userId, orgId, p);
    } else if (req.targetId) {
      const row = await ctx.db.get(req.targetId as Id<"employeeEducation">);
      if (row) await applyUpdateEducation(ctx, row, p);
    }
  } else if (req.kind === "training") {
    const p = payload as Parameters<typeof applyCreateTraining>[4];
    if (req.action === "create") {
      await applyCreateTraining(ctx, userId, userId, orgId, p);
    } else if (req.targetId) {
      const row = await ctx.db.get(
        req.targetId as Id<"employeeTrainingHistory">,
      );
      if (row) await applyUpdateTraining(ctx, row, p);
    }
  } else if (req.kind === "organization") {
    const p = payload as Parameters<typeof applyCreateOrganization>[4];
    if (req.action === "create") {
      await applyCreateOrganization(ctx, userId, userId, orgId, p);
    } else if (req.targetId) {
      const row = await ctx.db.get(
        req.targetId as Id<"employeeOrganizationHistory">,
      );
      if (row) await applyUpdateOrganization(ctx, row, p);
    }
  } else if (req.kind === "award") {
    const p = payload as Parameters<typeof applyCreateAward>[4];
    if (req.action === "create") {
      await applyCreateAward(ctx, userId, userId, orgId, p);
    } else if (req.targetId) {
      const row = await ctx.db.get(req.targetId as Id<"employeeAwardHistory">);
      if (row) await applyUpdateAward(ctx, row, p);
    }
  }
}

// Approve a pending request: applies the change and notifies the employee.
export const approve = mutation({
  args: { requestId: v.id("historyChangeRequests") },
  handler: async (ctx, args): Promise<null> => {
    const reviewer = await requireReviewer(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Permintaan tidak ditemukan",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan sudah diproses sebelumnya",
      });
    }

    await applyApprovedRequest(ctx, req);

    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedBy: reviewer._id,
      reviewedAt: new Date().toISOString(),
    });

    await notifyUser(ctx, {
      userId: req.userId,
      type: "history_change_approved",
      title: "Perubahan riwayat disetujui",
      message: `Perubahan ${req.summary} telah disetujui oleh ${reviewer.name ?? "HR"} dan sudah diterapkan.`,
      link: "/my-profile",
      actorId: reviewer._id,
    });
    return null;
  },
});

// Reject a pending request: cleans up any staged attachment and notifies.
export const reject = mutation({
  args: {
    requestId: v.id("historyChangeRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const reviewer = await requireReviewer(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Permintaan tidak ditemukan",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan sudah diproses sebelumnya",
      });
    }

    // The staged attachment was never attached to a real row, so delete it.
    if (req.attachmentStorageId) {
      await trackStorageRemoved(ctx, req.organizationId, req.attachmentStorageId);
      await ctx.storage.delete(req.attachmentStorageId);
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      rejectionReason: args.reason || undefined,
      reviewedBy: reviewer._id,
      reviewedAt: new Date().toISOString(),
    });

    await notifyUser(ctx, {
      userId: req.userId,
      type: "history_change_rejected",
      title: "Perubahan riwayat ditolak",
      message: args.reason
        ? `Perubahan ${req.summary} ditolak oleh ${reviewer.name ?? "HR"}. Alasan: ${args.reason}`
        : `Perubahan ${req.summary} ditolak oleh ${reviewer.name ?? "HR"}.`,
      link: "/my-profile",
      actorId: reviewer._id,
    });
    return null;
  },
});

// Employee cancels their own still-pending request.
export const cancelMine = mutation({
  args: { requestId: v.id("historyChangeRequests") },
  handler: async (ctx, args): Promise<null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
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
        message: "Pengguna tidak ditemukan",
      });
    }
    const req = await ctx.db.get(args.requestId);
    if (!req) return null;
    if (req.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Anda hanya dapat membatalkan permintaan Anda sendiri",
      });
    }
    if (req.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan sudah diproses",
      });
    }
    if (req.attachmentStorageId) {
      await trackStorageRemoved(ctx, req.organizationId, req.attachmentStorageId);
      await ctx.storage.delete(req.attachmentStorageId);
    }
    await ctx.db.patch(args.requestId, { status: "cancelled" });
    return null;
  },
});

// Permanently remove a request row (reviewer housekeeping).
export const remove = mutation({
  args: { requestId: v.id("historyChangeRequests") },
  handler: async (ctx, args): Promise<null> => {
    await requireReviewer(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req) return null;
    // If still pending, clean up its staged attachment first.
    if (req.status === "pending" && req.attachmentStorageId) {
      await trackStorageRemoved(ctx, req.organizationId, req.attachmentStorageId);
      await ctx.storage.delete(req.attachmentStorageId);
    }
    await ctx.db.delete(args.requestId);
    return null;
  },
});
