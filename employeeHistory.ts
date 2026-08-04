// Backend for employee history: education, training, and position history.
// Each entry belongs to a specific user (employee). Employees can manage their
// own records; admins can manage anyone's.

import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import { isAdminRole, normalizeRole } from "./roles";
import { requireTenant } from "./lib/tenant";
import { notifyProfileReviewers, notifyUser } from "./notifications";
import {
  assertStorageWithinLimit,
  getStorageSizeBytes,
  trackStorageAdded,
  trackStorageRemoved,
} from "./lib/planStorage";

async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Pengguna tidak ditemukan",
    });
  }
  return user;
}

function canManageFor(current: Doc<"users">, targetUserId: Id<"users">) {
  if (current._id === targetUserId) return true;
  return isAdminRole(normalizeRole(current.role));
}

function assertCanManage(current: Doc<"users">, targetUserId: Id<"users">) {
  if (!canManageFor(current, targetUserId)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Anda tidak memiliki akses untuk mengubah data karyawan ini",
    });
  }
}

// Optional file attachment shared by education/training/organization/award
// history entries (e.g. ijazah, sertifikat, piagam). Stored in Convex File
// Storage; only the storage id + basic metadata is kept on the row.
const attachmentArgs = {
  attachmentStorageId: v.optional(v.id("_storage")),
  attachmentName: v.optional(v.string()),
  attachmentSize: v.optional(v.number()),
  attachmentType: v.optional(v.string()),
  // When true on update: drop the existing attachment (and delete the file).
  removeAttachment: v.optional(v.boolean()),
};

type AttachmentInput = {
  attachmentStorageId?: Id<"_storage">;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
  removeAttachment?: boolean;
};

type AttachmentFields = {
  attachmentStorageId?: Id<"_storage">;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
};

// For inserts: validate the storage limit and return the attachment fields to
// persist. Storage counter tracking is done by the caller after insert.
async function buildAttachmentForCreate(
  ctx: MutationCtx,
  organizationId: Id<"organizations"> | undefined,
  args: AttachmentInput,
): Promise<AttachmentFields> {
  if (!args.attachmentStorageId) return {};
  const bytes = await getStorageSizeBytes(ctx, args.attachmentStorageId);
  await assertStorageWithinLimit(ctx, organizationId, bytes);
  return {
    attachmentStorageId: args.attachmentStorageId,
    attachmentName: args.attachmentName?.trim() || undefined,
    attachmentSize: args.attachmentSize,
    attachmentType: args.attachmentType || undefined,
  };
}

// Shared attachment reconciliation for updates. Mutates `patch` with the new
// attachment fields and performs storage add/remove tracking + file deletion.
async function reconcileAttachmentForUpdate(
  ctx: MutationCtx,
  existing: {
    organizationId?: Id<"organizations">;
    attachmentStorageId?: Id<"_storage">;
  },
  args: AttachmentInput,
  patch: Record<string, unknown>,
): Promise<void> {
  const org = existing.organizationId;
  if (args.removeAttachment) {
    if (existing.attachmentStorageId) {
      await trackStorageRemoved(ctx, org, existing.attachmentStorageId);
      await ctx.storage.delete(existing.attachmentStorageId);
    }
    patch.attachmentStorageId = undefined;
    patch.attachmentName = undefined;
    patch.attachmentSize = undefined;
    patch.attachmentType = undefined;
    return;
  }
  if (
    args.attachmentStorageId &&
    args.attachmentStorageId !== existing.attachmentStorageId
  ) {
    const bytes = await getStorageSizeBytes(ctx, args.attachmentStorageId);
    await assertStorageWithinLimit(ctx, org, bytes);
    if (existing.attachmentStorageId) {
      await trackStorageRemoved(ctx, org, existing.attachmentStorageId);
      await ctx.storage.delete(existing.attachmentStorageId);
    }
    patch.attachmentStorageId = args.attachmentStorageId;
    patch.attachmentName = args.attachmentName?.trim() || undefined;
    patch.attachmentSize = args.attachmentSize;
    patch.attachmentType = args.attachmentType || undefined;
    await trackStorageAdded(ctx, org, args.attachmentStorageId);
  }
}

// Attach a fresh, temporary download URL to a history row's attachment (if any).
async function withAttachmentUrl<
  T extends { attachmentStorageId?: Id<"_storage"> },
>(ctx: QueryCtx, row: T): Promise<T & { attachmentUrl: string | null }> {
  const url = row.attachmentStorageId
    ? await ctx.storage.getUrl(row.attachmentStorageId)
    : null;
  return { ...row, attachmentUrl: url };
}

// Generate a short-lived upload URL for history attachments. Any authenticated
// user may request one; the create/update mutations enforce ownership.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// True when the current user may apply history changes DIRECTLY (no HR review).
// Admins/HR/super_admin always can. A regular employee editing their own
// riwayat must go through verification, so this returns false for them.
function canEditDirectly(current: Doc<"users">): boolean {
  return isAdminRole(normalizeRole(current.role));
}

// Result returned by the public create/update/delete mutations. `queued` is
// true when the change was sent to HR for verification instead of applied.
export type HistoryMutationResult = { queued: boolean };

// Queue a history change for HR verification instead of applying it. Returns a
// sentinel so callers can short-circuit. Notifies reviewers.
async function queueHistoryChange(
  ctx: MutationCtx,
  current: Doc<"users">,
  input: {
    kind: "education" | "training" | "organization" | "award";
    action: "create" | "update" | "delete";
    targetId?: string;
    payload: AttachmentInput & Record<string, unknown>;
    summary: string;
  },
): Promise<void> {
  if (!current.organizationId) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Organisasi tidak ditemukan untuk pengguna ini",
    });
  }
  // The staged attachment (if any) is uploaded already; remember it so we can
  // clean it up on rejection and reference it on approval.
  const attachmentStorageId = input.payload.attachmentStorageId;
  const attachmentName = input.payload.attachmentName;

  await ctx.db.insert("historyChangeRequests", {
    userId: current._id,
    organizationId: current.organizationId,
    kind: input.kind,
    action: input.action,
    targetId: input.targetId,
    payload: JSON.stringify(input.payload),
    summary: input.summary,
    attachmentStorageId,
    attachmentName,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  const actionLabel =
    input.action === "create"
      ? "menambah"
      : input.action === "update"
        ? "mengubah"
        : "menghapus";
  await notifyProfileReviewers(ctx, {
    organizationId: current.organizationId,
    type: "history_change_request",
    title: "Permintaan perubahan riwayat",
    message: `${current.name ?? "Seorang karyawan"} ${actionLabel} ${input.summary}.`,
    link: "/profile-verification",
    actorId: current._id,
  });
}

// ---- Direct apply helpers ----
// These perform the actual database writes + storage tracking. They are used
// both by the public mutations (when the caller is admin/HR) and by the HR
// approval flow in historyChangeRequests.ts. They assume authorization and
// validation already happened.

type EducationPayload = {
  level: string;
  institution: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  gpa?: number;
  description?: string;
  isCurrent?: boolean;
} & AttachmentInput;

export async function applyCreateEducation(
  ctx: MutationCtx,
  userId: Id<"users">,
  createdBy: Id<"users">,
  orgId: Id<"organizations"> | undefined,
  args: EducationPayload,
): Promise<Id<"employeeEducation">> {
  const attachment = await buildAttachmentForCreate(ctx, orgId, args);
  const id = await ctx.db.insert("employeeEducation", {
    userId,
    level: args.level,
    institution: args.institution.trim(),
    fieldOfStudy: args.fieldOfStudy?.trim() || undefined,
    startYear: args.startYear,
    endYear: args.isCurrent ? undefined : args.endYear,
    gpa: args.gpa,
    description: args.description?.trim() || undefined,
    isCurrent: args.isCurrent ?? false,
    ...attachment,
    createdBy,
    updatedAt: new Date().toISOString(),
  });
  if (attachment.attachmentStorageId) {
    await trackStorageAdded(ctx, orgId, attachment.attachmentStorageId);
  }
  return id;
}

export async function applyUpdateEducation(
  ctx: MutationCtx,
  existing: Doc<"employeeEducation">,
  args: EducationPayload,
): Promise<void> {
  const patch: Record<string, unknown> = {
    level: args.level,
    institution: args.institution.trim(),
    fieldOfStudy: args.fieldOfStudy?.trim() || undefined,
    startYear: args.startYear,
    endYear: args.isCurrent ? undefined : args.endYear,
    gpa: args.gpa,
    description: args.description?.trim() || undefined,
    isCurrent: args.isCurrent ?? false,
    updatedAt: new Date().toISOString(),
  };
  await reconcileAttachmentForUpdate(ctx, existing, args, patch);
  await ctx.db.patch(existing._id, patch);
}

type TrainingPayload = {
  title: string;
  provider?: string;
  category: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  durationHours?: number;
  result?: string;
  hasCertificate?: boolean;
  certificateNumber?: string;
  description?: string;
} & AttachmentInput;

export async function applyCreateTraining(
  ctx: MutationCtx,
  userId: Id<"users">,
  createdBy: Id<"users">,
  orgId: Id<"organizations"> | undefined,
  args: TrainingPayload,
): Promise<Id<"employeeTrainingHistory">> {
  const attachment = await buildAttachmentForCreate(ctx, orgId, args);
  const id = await ctx.db.insert("employeeTrainingHistory", {
    userId,
    title: args.title.trim(),
    provider: args.provider?.trim() || undefined,
    category: args.category,
    location: args.location?.trim() || undefined,
    startDate: args.startDate || undefined,
    endDate: args.endDate || undefined,
    durationHours: args.durationHours,
    result: args.result?.trim() || undefined,
    hasCertificate: args.hasCertificate ?? false,
    certificateNumber: args.certificateNumber?.trim() || undefined,
    description: args.description?.trim() || undefined,
    ...attachment,
    createdBy,
    updatedAt: new Date().toISOString(),
  });
  if (attachment.attachmentStorageId) {
    await trackStorageAdded(ctx, orgId, attachment.attachmentStorageId);
  }
  return id;
}

export async function applyUpdateTraining(
  ctx: MutationCtx,
  existing: Doc<"employeeTrainingHistory">,
  args: TrainingPayload,
): Promise<void> {
  const patch: Record<string, unknown> = {
    title: args.title.trim(),
    provider: args.provider?.trim() || undefined,
    category: args.category,
    location: args.location?.trim() || undefined,
    startDate: args.startDate || undefined,
    endDate: args.endDate || undefined,
    durationHours: args.durationHours,
    result: args.result?.trim() || undefined,
    hasCertificate: args.hasCertificate ?? false,
    certificateNumber: args.certificateNumber?.trim() || undefined,
    description: args.description?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  await reconcileAttachmentForUpdate(ctx, existing, args, patch);
  await ctx.db.patch(existing._id, patch);
}

type OrganizationPayload = {
  organizationName: string;
  role: string;
  category?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  achievements?: string;
} & AttachmentInput;

export async function applyCreateOrganization(
  ctx: MutationCtx,
  userId: Id<"users">,
  createdBy: Id<"users">,
  orgId: Id<"organizations"> | undefined,
  args: OrganizationPayload,
): Promise<Id<"employeeOrganizationHistory">> {
  const attachment = await buildAttachmentForCreate(ctx, orgId, args);
  const id = await ctx.db.insert("employeeOrganizationHistory", {
    userId,
    organizationName: args.organizationName.trim(),
    role: args.role.trim(),
    category: args.category,
    location: args.location?.trim() || undefined,
    startDate: args.startDate || undefined,
    endDate: args.isCurrent ? undefined : args.endDate || undefined,
    isCurrent: args.isCurrent ?? false,
    description: args.description?.trim() || undefined,
    achievements: args.achievements?.trim() || undefined,
    ...attachment,
    createdBy,
    updatedAt: new Date().toISOString(),
  });
  if (attachment.attachmentStorageId) {
    await trackStorageAdded(ctx, orgId, attachment.attachmentStorageId);
  }
  return id;
}

export async function applyUpdateOrganization(
  ctx: MutationCtx,
  existing: Doc<"employeeOrganizationHistory">,
  args: OrganizationPayload,
): Promise<void> {
  const patch: Record<string, unknown> = {
    organizationName: args.organizationName.trim(),
    role: args.role.trim(),
    category: args.category,
    location: args.location?.trim() || undefined,
    startDate: args.startDate || undefined,
    endDate: args.isCurrent ? undefined : args.endDate || undefined,
    isCurrent: args.isCurrent ?? false,
    description: args.description?.trim() || undefined,
    achievements: args.achievements?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  await reconcileAttachmentForUpdate(ctx, existing, args, patch);
  await ctx.db.patch(existing._id, patch);
}

type AwardPayload = {
  title: string;
  issuer: string;
  category?: string;
  level?: string;
  awardDate?: string;
  location?: string;
  description?: string;
  certificateNumber?: string;
  hasCertificate?: boolean;
} & AttachmentInput;

export async function applyCreateAward(
  ctx: MutationCtx,
  userId: Id<"users">,
  createdBy: Id<"users">,
  orgId: Id<"organizations"> | undefined,
  args: AwardPayload,
): Promise<Id<"employeeAwardHistory">> {
  const attachment = await buildAttachmentForCreate(ctx, orgId, args);
  const id = await ctx.db.insert("employeeAwardHistory", {
    userId,
    title: args.title.trim(),
    issuer: args.issuer.trim(),
    category: args.category,
    level: args.level,
    awardDate: args.awardDate || undefined,
    location: args.location?.trim() || undefined,
    description: args.description?.trim() || undefined,
    certificateNumber: args.certificateNumber?.trim() || undefined,
    hasCertificate: args.hasCertificate ?? false,
    ...attachment,
    createdBy,
    updatedAt: new Date().toISOString(),
  });
  if (attachment.attachmentStorageId) {
    await trackStorageAdded(ctx, orgId, attachment.attachmentStorageId);
  }
  return id;
}

export async function applyUpdateAward(
  ctx: MutationCtx,
  existing: Doc<"employeeAwardHistory">,
  args: AwardPayload,
): Promise<void> {
  const patch: Record<string, unknown> = {
    title: args.title.trim(),
    issuer: args.issuer.trim(),
    category: args.category,
    level: args.level,
    awardDate: args.awardDate || undefined,
    location: args.location?.trim() || undefined,
    description: args.description?.trim() || undefined,
    certificateNumber: args.certificateNumber?.trim() || undefined,
    hasCertificate: args.hasCertificate ?? false,
    updatedAt: new Date().toISOString(),
  };
  await reconcileAttachmentForUpdate(ctx, existing, args, patch);
  await ctx.db.patch(existing._id, patch);
}

// -------------------- Education --------------------

export const listEducation = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"employeeEducation"> & { attachmentUrl: string | null }>> => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("employeeEducation")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => {
      const ay = a.endYear ?? a.startYear ?? 0;
      const by = b.endYear ?? b.startYear ?? 0;
      if (by !== ay) return by - ay;
      return b._creationTime - a._creationTime;
    });
    return await Promise.all(rows.map((r) => withAttachmentUrl(ctx, r)));
  },
});

export const createEducation = mutation({
  args: {
    userId: v.id("users"),
    level: v.string(),
    institution: v.string(),
    fieldOfStudy: v.optional(v.string()),
    startYear: v.optional(v.number()),
    endYear: v.optional(v.number()),
    gpa: v.optional(v.number()),
    description: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    assertCanManage(current, args.userId);

    if (args.institution.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama institusi wajib diisi",
      });
    }

    const { userId, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "education",
        action: "create",
        payload,
        summary: `riwayat pendidikan "${args.institution.trim()}"`,
      });
      return { queued: true };
    }

    await applyCreateEducation(ctx, userId, current._id, current.organizationId, payload);
    return { queued: false };
  },
});

export const updateEducation = mutation({
  args: {
    id: v.id("employeeEducation"),
    level: v.string(),
    institution: v.string(),
    fieldOfStudy: v.optional(v.string()),
    startYear: v.optional(v.number()),
    endYear: v.optional(v.number()),
    gpa: v.optional(v.number()),
    description: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data tidak ditemukan",
      });
    }
    assertCanManage(current, existing.userId);

    if (args.institution.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama institusi wajib diisi",
      });
    }

    const { id, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "education",
        action: "update",
        targetId: id,
        payload,
        summary: `riwayat pendidikan "${args.institution.trim()}"`,
      });
      return { queued: true };
    }

    await applyUpdateEducation(ctx, existing, payload);
    return { queued: false };
  },
});

export const deleteEducation = mutation({
  args: { id: v.id("employeeEducation") },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return { queued: false };
    assertCanManage(current, existing.userId);

    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "education",
        action: "delete",
        targetId: args.id,
        payload: {},
        summary: `penghapusan riwayat pendidikan "${existing.institution}"`,
      });
      return { queued: true };
    }

    if (existing.attachmentStorageId) {
      await trackStorageRemoved(
        ctx,
        existing.organizationId,
        existing.attachmentStorageId,
      );
      await ctx.storage.delete(existing.attachmentStorageId);
    }
    await ctx.db.delete(args.id);
    return { queued: false };
  },
});

// -------------------- Training history --------------------

export const listTraining = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<Doc<"employeeTrainingHistory"> & { attachmentUrl: string | null }>
  > => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("employeeTrainingHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => {
      const ad = a.startDate ?? "";
      const bd = b.startDate ?? "";
      if (bd !== ad) return bd.localeCompare(ad);
      return b._creationTime - a._creationTime;
    });
    return await Promise.all(rows.map((r) => withAttachmentUrl(ctx, r)));
  },
});

export const createTraining = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    provider: v.optional(v.string()),
    category: v.string(),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    result: v.optional(v.string()),
    hasCertificate: v.optional(v.boolean()),
    certificateNumber: v.optional(v.string()),
    description: v.optional(v.string()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    assertCanManage(current, args.userId);

    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama pelatihan wajib diisi",
      });
    }

    const { userId, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "training",
        action: "create",
        payload,
        summary: `riwayat pelatihan "${args.title.trim()}"`,
      });
      return { queued: true };
    }

    await applyCreateTraining(ctx, userId, current._id, current.organizationId, payload);
    return { queued: false };
  },
});

export const updateTraining = mutation({
  args: {
    id: v.id("employeeTrainingHistory"),
    title: v.string(),
    provider: v.optional(v.string()),
    category: v.string(),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    result: v.optional(v.string()),
    hasCertificate: v.optional(v.boolean()),
    certificateNumber: v.optional(v.string()),
    description: v.optional(v.string()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data tidak ditemukan",
      });
    }
    assertCanManage(current, existing.userId);

    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama pelatihan wajib diisi",
      });
    }

    const { id, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "training",
        action: "update",
        targetId: id,
        payload,
        summary: `riwayat pelatihan "${args.title.trim()}"`,
      });
      return { queued: true };
    }

    await applyUpdateTraining(ctx, existing, payload);
    return { queued: false };
  },
});

export const deleteTraining = mutation({
  args: { id: v.id("employeeTrainingHistory") },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return { queued: false };
    assertCanManage(current, existing.userId);

    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "training",
        action: "delete",
        targetId: args.id,
        payload: {},
        summary: `penghapusan riwayat pelatihan "${existing.title}"`,
      });
      return { queued: true };
    }

    if (existing.attachmentStorageId) {
      await trackStorageRemoved(
        ctx,
        existing.organizationId,
        existing.attachmentStorageId,
      );
      await ctx.storage.delete(existing.attachmentStorageId);
    }
    await ctx.db.delete(args.id);
    return { queued: false };
  },
});

// -------------------- Position history --------------------

export const listPositions = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"employeePositionHistory">>> => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("employeePositionHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    // Newest first by start date
    rows.sort((a, b) => {
      if (b.startDate !== a.startDate) return b.startDate.localeCompare(a.startDate);
      return b._creationTime - a._creationTime;
    });
    return rows;
  },
});

export const createPosition = mutation({
  args: {
    userId: v.id("users"),
    jobTitle: v.string(),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    changeType: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    referenceNumber: v.optional(v.string()),
    description: v.optional(v.string()),
    managerName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"employeePositionHistory">> => {
    const current = await requireUser(ctx);
    assertCanManage(current, args.userId);
    // Riwayat Jabatan is HR-managed only. Employees cannot add/change it.
    if (!canEditDirectly(current)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Riwayat jabatan hanya dapat dikelola oleh HR",
      });
    }

    if (args.jobTitle.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jabatan wajib diisi",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal mulai tidak valid",
      });
    }

    // If this is marked as current, unset other current positions for this user
    if (args.isCurrent) {
      const existing = await ctx.db
        .query("employeePositionHistory")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const row of existing) {
        if (row.isCurrent) {
          await ctx.db.patch(row._id, { isCurrent: false });
        }
      }
    }

    return await ctx.db.insert("employeePositionHistory", {
      userId: args.userId,
      jobTitle: args.jobTitle.trim(),
      department: args.department?.trim() || undefined,
      location: args.location?.trim() || undefined,
      changeType: args.changeType,
      startDate: args.startDate,
      endDate: args.isCurrent ? undefined : args.endDate || undefined,
      isCurrent: args.isCurrent ?? false,
      referenceNumber: args.referenceNumber?.trim() || undefined,
      description: args.description?.trim() || undefined,
      managerName: args.managerName?.trim() || undefined,
      createdBy: current._id,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updatePosition = mutation({
  args: {
    id: v.id("employeePositionHistory"),
    jobTitle: v.string(),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    changeType: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    referenceNumber: v.optional(v.string()),
    description: v.optional(v.string()),
    managerName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data tidak ditemukan",
      });
    }
    assertCanManage(current, existing.userId);
    // Riwayat Jabatan is HR-managed only.
    if (!canEditDirectly(current)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Riwayat jabatan hanya dapat dikelola oleh HR",
      });
    }

    if (args.jobTitle.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jabatan wajib diisi",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Tanggal mulai tidak valid",
      });
    }

    if (args.isCurrent) {
      const siblings = await ctx.db
        .query("employeePositionHistory")
        .withIndex("by_user", (q) => q.eq("userId", existing.userId))
        .collect();
      for (const row of siblings) {
        if (row._id !== args.id && row.isCurrent) {
          await ctx.db.patch(row._id, { isCurrent: false });
        }
      }
    }

    await ctx.db.patch(args.id, {
      jobTitle: args.jobTitle.trim(),
      department: args.department?.trim() || undefined,
      location: args.location?.trim() || undefined,
      changeType: args.changeType,
      startDate: args.startDate,
      endDate: args.isCurrent ? undefined : args.endDate || undefined,
      isCurrent: args.isCurrent ?? false,
      referenceNumber: args.referenceNumber?.trim() || undefined,
      description: args.description?.trim() || undefined,
      managerName: args.managerName?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const deletePosition = mutation({
  args: { id: v.id("employeePositionHistory") },
  handler: async (ctx, args): Promise<null> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    assertCanManage(current, existing.userId);
    // Riwayat Jabatan is HR-managed only.
    if (!canEditDirectly(current)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Riwayat jabatan hanya dapat dikelola oleh HR",
      });
    }
    await ctx.db.delete(args.id);
    return null;
  },
});

// Lightweight query to determine if the current user can manage a target's
// history (self or admin). Used by the UI to show/hide edit actions.
export const canManageHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<boolean> => {
    const current = await requireUser(ctx);
    return canManageFor(current, args.userId);
  },
});

// Returns detailed per-category permissions for the target's history so the UI
// can render the right controls:
// - canManage: may add/edit at all (self or admin)
// - requiresApproval: edits go through HR verification (employee editing self)
// - canManagePosition: may edit Riwayat Jabatan (HR/admin only)
export const historyPermissions = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    canManage: boolean;
    requiresApproval: boolean;
    canManagePosition: boolean;
  }> => {
    const current = await requireUser(ctx);
    const canManage = canManageFor(current, args.userId);
    const isAdmin = canEditDirectly(current);
    return {
      canManage,
      requiresApproval: canManage && !isAdmin,
      canManagePosition: isAdmin && canManage,
    };
  },
});

// -------------------- Organization history --------------------

export const listOrganizations = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<Doc<"employeeOrganizationHistory"> & { attachmentUrl: string | null }>
  > => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("employeeOrganizationHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => {
      const ad = a.startDate ?? "";
      const bd = b.startDate ?? "";
      if (bd !== ad) return bd.localeCompare(ad);
      return b._creationTime - a._creationTime;
    });
    return await Promise.all(rows.map((r) => withAttachmentUrl(ctx, r)));
  },
});

export const createOrganization = mutation({
  args: {
    userId: v.id("users"),
    organizationName: v.string(),
    role: v.string(),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    description: v.optional(v.string()),
    achievements: v.optional(v.string()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    assertCanManage(current, args.userId);

    if (args.organizationName.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama organisasi wajib diisi",
      });
    }
    if (args.role.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jabatan di organisasi wajib diisi",
      });
    }

    const { userId, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "organization",
        action: "create",
        payload,
        summary: `riwayat organisasi "${args.organizationName.trim()}"`,
      });
      return { queued: true };
    }

    await applyCreateOrganization(ctx, userId, current._id, current.organizationId, payload);
    return { queued: false };
  },
});

export const updateOrganization = mutation({
  args: {
    id: v.id("employeeOrganizationHistory"),
    organizationName: v.string(),
    role: v.string(),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    isCurrent: v.optional(v.boolean()),
    description: v.optional(v.string()),
    achievements: v.optional(v.string()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data tidak ditemukan",
      });
    }
    assertCanManage(current, existing.userId);

    if (args.organizationName.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama organisasi wajib diisi",
      });
    }
    if (args.role.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Jabatan di organisasi wajib diisi",
      });
    }

    const { id, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "organization",
        action: "update",
        targetId: id,
        payload,
        summary: `riwayat organisasi "${args.organizationName.trim()}"`,
      });
      return { queued: true };
    }

    await applyUpdateOrganization(ctx, existing, payload);
    return { queued: false };
  },
});

export const deleteOrganization = mutation({
  args: { id: v.id("employeeOrganizationHistory") },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return { queued: false };
    assertCanManage(current, existing.userId);

    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "organization",
        action: "delete",
        targetId: args.id,
        payload: {},
        summary: `penghapusan riwayat organisasi "${existing.organizationName}"`,
      });
      return { queued: true };
    }

    if (existing.attachmentStorageId) {
      await trackStorageRemoved(
        ctx,
        existing.organizationId,
        existing.attachmentStorageId,
      );
      await ctx.storage.delete(existing.attachmentStorageId);
    }
    await ctx.db.delete(args.id);
    return { queued: false };
  },
});

// -------------------- Award history --------------------

export const listAwards = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<Doc<"employeeAwardHistory"> & { attachmentUrl: string | null }>
  > => {
    await requireUser(ctx);
    const rows = await ctx.db
      .query("employeeAwardHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => {
      const ad = a.awardDate ?? "";
      const bd = b.awardDate ?? "";
      if (bd !== ad) return bd.localeCompare(ad);
      return b._creationTime - a._creationTime;
    });
    return await Promise.all(rows.map((r) => withAttachmentUrl(ctx, r)));
  },
});

export const createAward = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    issuer: v.string(),
    category: v.optional(v.string()),
    level: v.optional(v.string()),
    awardDate: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    hasCertificate: v.optional(v.boolean()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    assertCanManage(current, args.userId);

    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama penghargaan wajib diisi",
      });
    }
    if (args.issuer.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pemberi penghargaan wajib diisi",
      });
    }

    const { userId, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "award",
        action: "create",
        payload,
        summary: `riwayat penghargaan "${args.title.trim()}"`,
      });
      return { queued: true };
    }

    await applyCreateAward(ctx, userId, current._id, current.organizationId, payload);
    return { queued: false };
  },
});

export const updateAward = mutation({
  args: {
    id: v.id("employeeAwardHistory"),
    title: v.string(),
    issuer: v.string(),
    category: v.optional(v.string()),
    level: v.optional(v.string()),
    awardDate: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    hasCertificate: v.optional(v.boolean()),
    ...attachmentArgs,
  },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data tidak ditemukan",
      });
    }
    assertCanManage(current, existing.userId);

    if (args.title.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Nama penghargaan wajib diisi",
      });
    }
    if (args.issuer.trim().length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pemberi penghargaan wajib diisi",
      });
    }

    const { id, ...payload } = args;
    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "award",
        action: "update",
        targetId: id,
        payload,
        summary: `riwayat penghargaan "${args.title.trim()}"`,
      });
      return { queued: true };
    }

    await applyUpdateAward(ctx, existing, payload);
    return { queued: false };
  },
});

export const deleteAward = mutation({
  args: { id: v.id("employeeAwardHistory") },
  handler: async (ctx, args): Promise<HistoryMutationResult> => {
    const current = await requireUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return { queued: false };
    assertCanManage(current, existing.userId);

    if (!canEditDirectly(current)) {
      await queueHistoryChange(ctx, current, {
        kind: "award",
        action: "delete",
        targetId: args.id,
        payload: {},
        summary: `penghapusan riwayat penghargaan "${existing.title}"`,
      });
      return { queued: true };
    }

    if (existing.attachmentStorageId) {
      await trackStorageRemoved(
        ctx,
        existing.organizationId,
        existing.attachmentStorageId,
      );
      await ctx.storage.delete(existing.attachmentStorageId);
    }
    await ctx.db.delete(args.id);
    return { queued: false };
  },
});
