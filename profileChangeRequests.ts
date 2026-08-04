import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { requireTenant } from "./lib/tenant";
import { notifyUser } from "./notifications";

// Roles that can review profile change requests
const REVIEWER_ROLES = ["super_admin", "admin", "hr_manager"];

// Resolve human-readable labels for any custom ("custom:<id>") change keys so
// the UI can show field names instead of raw directoryFields ids.
async function resolveCustomFieldLabels(
  ctx: QueryCtx,
  changes: Record<string, string>,
): Promise<Record<string, string>> {
  const labels: Record<string, string> = {};
  for (const k of Object.keys(changes)) {
    if (k.startsWith("custom:")) {
      const def = await ctx.db.get(
        k.slice("custom:".length) as Id<"directoryFields">,
      );
      if (def) labels[k] = def.label;
    }
  }
  return labels;
}

// List all pending profile change requests for the organization
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireTenant(ctx);

    // Get identity to fetch caller details
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
    }
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya HR Manager atau Admin yang dapat melihat permintaan perubahan profil",
      });
    }

    let requests: Array<Doc<"profileChangeRequests">>;
    if (organizationId) {
      requests = await ctx.db
        .query("profileChangeRequests")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "pending"),
        )
        .order("desc")
        .collect();
    } else {
      // Super admin without an active grant (organizationId === null): none.
      requests = [];
    }

    // Enrich with user data
    const enriched = await Promise.all(
      requests.map(async (req) => {
        const user = await ctx.db.get(req.userId);
        const changes = JSON.parse(req.changes) as Record<string, string>;
        // Fallback: if the requesting account was deleted, try to match an
        // active employee by the submitted name, else use the submitted name.
        let fallbackUser: Doc<"users"> | null = null;
        if (!user && changes.name && req.organizationId) {
          const submittedName = changes.name.trim().toLowerCase();
          const candidates = await ctx.db
            .query("users")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", req.organizationId),
            )
            .collect();
          fallbackUser =
            candidates.find(
              (u) => (u.name ?? "").trim().toLowerCase() === submittedName,
            ) ?? null;
        }
        const resolved = user ?? fallbackUser;
        return {
          ...req,
          changes,
          fieldLabels: await resolveCustomFieldLabels(ctx, changes),
          userName:
            resolved?.name ?? changes.name ?? "Tidak diketahui",
          userEmail: resolved?.email ?? "",
          userDepartment: resolved?.department ?? "",
          userJobTitle: resolved?.jobTitle ?? "",
        };
      }),
    );

    return enriched;
  },
});

// List all profile change requests (all statuses) for the organization
export const listAll = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireTenant(ctx);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
    }
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya HR Manager atau Admin yang dapat melihat permintaan perubahan profil",
      });
    }

    let requests: Array<Doc<"profileChangeRequests">>;

    if (args.status) {
      if (organizationId) {
        requests = await ctx.db
          .query("profileChangeRequests")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", organizationId).eq("status", args.status!),
          )
          .order("desc")
          .take(100);
      } else {
        // Super admin without an active grant (organizationId === null): none.
        requests = [];
      }
    } else {
      // All statuses - get all for org
      if (organizationId) {
        requests = await ctx.db
          .query("profileChangeRequests")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", organizationId),
          )
          .order("desc")
          .take(100);
      } else {
        requests = [];
      }
    }

    // Enrich with user data
    const enriched = await Promise.all(
      requests.map(async (req) => {
        const user = await ctx.db.get(req.userId);
        const reviewer = req.reviewedBy ? await ctx.db.get(req.reviewedBy) : null;
        const changes = JSON.parse(req.changes) as Record<string, string>;
        // Fallback: if the requesting account was deleted, try to match an
        // active employee by the submitted name, else use the submitted name.
        let fallbackUser: Doc<"users"> | null = null;
        if (!user && changes.name && req.organizationId) {
          const submittedName = changes.name.trim().toLowerCase();
          const candidates = await ctx.db
            .query("users")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", req.organizationId),
            )
            .collect();
          fallbackUser =
            candidates.find(
              (u) => (u.name ?? "").trim().toLowerCase() === submittedName,
            ) ?? null;
        }
        const resolved = user ?? fallbackUser;
        return {
          ...req,
          changes,
          fieldLabels: await resolveCustomFieldLabels(ctx, changes),
          userName: resolved?.name ?? changes.name ?? "Tidak diketahui",
          userEmail: resolved?.email ?? "",
          userDepartment: resolved?.department ?? "",
          userJobTitle: resolved?.jobTitle ?? "",
          reviewerName: reviewer?.name ?? undefined,
        };
      }),
    );

    return enriched;
  },
});

// Approve a profile change request - applies changes to the user
export const approve = mutation({
  args: {
    requestId: v.id("profileChangeRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
    }
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya HR Manager atau Admin yang dapat menyetujui perubahan profil",
      });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Permintaan tidak ditemukan" });
    }
    if (request.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan sudah diproses sebelumnya",
      });
    }

    // Apply changes to user profile
    const changes = JSON.parse(request.changes) as Record<string, string>;
    let targetUser = await ctx.db.get(request.userId);
    // Fallback: if the requesting account was deleted, match an active
    // employee in the same organization by the submitted name.
    if (!targetUser && changes.name && request.organizationId) {
      const submittedName = changes.name.trim().toLowerCase();
      const candidates = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", request.organizationId),
        )
        .collect();
      targetUser =
        candidates.find(
          (u) => (u.name ?? "").trim().toLowerCase() === submittedName,
        ) ?? null;
    }
    if (!targetUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Karyawan tidak ditemukan" });
    }

    const patch: Partial<Doc<"users">> = {};
    const customUpdates: Record<string, string> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (key.startsWith("custom:")) {
        // Custom directory field change, keyed by directoryFields._id.
        customUpdates[key.slice("custom:".length)] = value;
        continue;
      }
      const fieldKey = key as keyof Doc<"users">;
      if (fieldKey === "name") patch.name = value || undefined;
      else if (fieldKey === "department") patch.department = value || undefined;
      else if (fieldKey === "jobTitle") patch.jobTitle = value || undefined;
      else if (fieldKey === "phone") patch.phone = value || undefined;
      else if (fieldKey === "location") patch.location = value || undefined;
      else if (fieldKey === "bio") patch.bio = value || undefined;
      else if (fieldKey === "birthday") patch.birthday = value || undefined;
      else if (fieldKey === "dateOfBirth") patch.dateOfBirth = value || undefined;
      else if (fieldKey === "startDate") patch.startDate = value || undefined;
    }

    // Merge custom field updates into the target user's customFields record.
    if (Object.keys(customUpdates).length > 0) {
      const merged: Record<string, string> = { ...(targetUser.customFields ?? {}) };
      for (const [fieldId, value] of Object.entries(customUpdates)) {
        if (value === "") delete merged[fieldId];
        else merged[fieldId] = value;
      }
      patch.customFields = merged;
    }

    await ctx.db.patch(targetUser._id, patch);

    // Mark request as approved
    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedBy: currentUser._id,
      reviewedAt: new Date().toISOString(),
    });

    // Notify the employee that their changes were approved
    await notifyUser(ctx, {
      userId: targetUser._id,
      type: "profile_change_approved",
      title: "Perubahan profil disetujui",
      message: `Perubahan data profil Anda telah disetujui oleh ${currentUser.name ?? "HR Manager"} dan sudah diterapkan.`,
      link: "/profile",
      actorId: currentUser._id,
    });
  },
});

// Reject a profile change request
export const reject = mutation({
  args: {
    requestId: v.id("profileChangeRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
    }
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya HR Manager atau Admin yang dapat menolak perubahan profil",
      });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Permintaan tidak ditemukan" });
    }
    if (request.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Permintaan sudah diproses sebelumnya",
      });
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      rejectionReason: args.reason || undefined,
      reviewedBy: currentUser._id,
      reviewedAt: new Date().toISOString(),
    });

    // Resolve recipient: original account, else active employee by submitted name
    const changes = JSON.parse(request.changes) as Record<string, string>;
    let targetUser = await ctx.db.get(request.userId);
    if (!targetUser && changes.name && request.organizationId) {
      const submittedName = changes.name.trim().toLowerCase();
      const candidates = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", request.organizationId),
        )
        .collect();
      targetUser =
        candidates.find(
          (u) => (u.name ?? "").trim().toLowerCase() === submittedName,
        ) ?? null;
    }

    // Notify the employee that their changes were rejected
    if (targetUser) {
      await notifyUser(ctx, {
        userId: targetUser._id,
        type: "profile_change_rejected",
        title: "Perubahan profil ditolak",
        message: args.reason
          ? `Perubahan data profil Anda ditolak oleh ${currentUser.name ?? "HR Manager"}. Alasan: ${args.reason}`
          : `Perubahan data profil Anda ditolak oleh ${currentUser.name ?? "HR Manager"}. Silakan edit ulang dan kirim kembali.`,
        link: "/profile",
        actorId: currentUser._id,
      });
    }
  },
});

// Delete a profile change request permanently
export const remove = mutation({
  args: {
    requestId: v.id("profileChangeRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Belum masuk" });
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pengguna tidak ditemukan" });
    }
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya HR Manager atau Admin yang dapat menghapus permintaan perubahan profil",
      });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Permintaan tidak ditemukan" });
    }

    await ctx.db.delete(args.requestId);
  },
});

// Count pending requests (for badge/notification)
export const countPending = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const { organizationId } = await requireTenant(ctx);

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!currentUser) return 0;
    if (!REVIEWER_ROLES.includes(currentUser.role ?? "")) return 0;

    if (organizationId) {
      const all = await ctx.db
        .query("profileChangeRequests")
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
