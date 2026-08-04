import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  STORAGE_METRIC,
  getOrgMetricLimit,
  wouldExceedLimit,
  evaluateAndAlert,
} from "./planLimits";

/**
 * Per-organization storage usage tracking.
 *
 * Convex File Storage has no native per-tenant accounting, so we keep a
 * denormalized byte counter per organization in `orgStorageUsage`. It is
 * updated at write time whenever a file is added or removed, which keeps the
 * dashboard banner read cheap (a single indexed row) even as the app grows.
 *
 * Sizes are read from Convex's `_storage` system table (authoritative byte
 * size) so the client never needs to be trusted for the amount.
 */

const BYTES_PER_MB = 1024 * 1024;

/** Convert a byte count to whole megabytes (rounded up, min 0). */
export function bytesToMb(bytes: number): number {
  if (bytes <= 0) return 0;
  return Math.ceil(bytes / BYTES_PER_MB);
}

/** Look up the authoritative byte size of a stored file (0 if unknown). */
export async function getStorageSizeBytes(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
): Promise<number> {
  const meta = await ctx.db.system.get(storageId);
  return meta?.size ?? 0;
}

/** Read the current stored byte total for an organization (0 if none yet). */
export async function getOrgStorageBytes(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  const row = await ctx.db
    .query("orgStorageUsage")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  return row?.bytes ?? 0;
}

/** Read current storage usage in whole MB for an organization. */
export async function getOrgStorageMb(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  return bytesToMb(await getOrgStorageBytes(ctx, organizationId));
}

/** Upsert the org's byte counter by `delta` (can be negative). Clamps at 0. */
async function adjustOrgStorageBytes(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  delta: number,
): Promise<number> {
  const now = new Date().toISOString();
  const row = await ctx.db
    .query("orgStorageUsage")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (row) {
    const next = Math.max(0, row.bytes + delta);
    await ctx.db.patch(row._id, { bytes: next, updatedAt: now });
    return next;
  }
  const next = Math.max(0, delta);
  await ctx.db.insert("orgStorageUsage", {
    organizationId,
    bytes: next,
    updatedAt: now,
  });
  return next;
}

/**
 * Guard called BEFORE persisting a new file. Throws FORBIDDEN when adding the
 * file would push the org past its plan storage limit. No-op for orgs without
 * a limit (unlimited plans, or super-admin uploads with no org).
 */
export async function assertStorageWithinLimit(
  ctx: MutationCtx,
  organizationId: Id<"organizations"> | null | undefined,
  incomingBytes: number,
): Promise<void> {
  if (!organizationId) return;
  const { max, planName } = await getOrgMetricLimit(
    ctx,
    organizationId,
    STORAGE_METRIC,
  );
  if (max <= 0) return; // unlimited

  const currentMb = await getOrgStorageMb(ctx, organizationId);
  const incomingMb = bytesToMb(incomingBytes);
  // Block when already at/over the cap, or when this file would tip it over.
  if (wouldExceedLimit(currentMb, max) || currentMb + incomingMb > max) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Batas penyimpanan paket ${planName ?? ""} tercapai (${currentMb} MB/${max} MB). Tingkatkan paket untuk mengunggah file baru.`,
    });
  }
}

/**
 * Record that a file was ADDED for an org: bumps the counter using the file's
 * authoritative size and fires graduated 80/90/95/100% alerts if a new
 * threshold is crossed. Call AFTER the document insert succeeds.
 */
export async function trackStorageAdded(
  ctx: MutationCtx,
  organizationId: Id<"organizations"> | null | undefined,
  storageId: Id<"_storage">,
): Promise<void> {
  if (!organizationId) return;
  const bytes = await getStorageSizeBytes(ctx, storageId);
  if (bytes <= 0) return;
  const totalBytes = await adjustOrgStorageBytes(ctx, organizationId, bytes);
  await alertOnStorage(ctx, organizationId, totalBytes);
}

/**
 * Record that a file was REMOVED for an org: decrements the counter. Call with
 * the storageId BEFORE `ctx.storage.delete` (so its size is still readable) or
 * pass the known byte size directly.
 */
export async function trackStorageRemoved(
  ctx: MutationCtx,
  organizationId: Id<"organizations"> | null | undefined,
  storageIdOrBytes: Id<"_storage"> | number,
): Promise<void> {
  if (!organizationId) return;
  const bytes =
    typeof storageIdOrBytes === "number"
      ? storageIdOrBytes
      : await getStorageSizeBytes(ctx, storageIdOrBytes);
  if (bytes <= 0) return;
  const totalBytes = await adjustOrgStorageBytes(ctx, organizationId, -bytes);
  // Re-evaluate so dropping below a threshold re-arms future warnings.
  await alertOnStorage(ctx, organizationId, totalBytes);
}

/** Shared: run the graduated storage alert evaluation for a byte total. */
async function alertOnStorage(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  totalBytes: number,
): Promise<void> {
  const { max, planId, planName } = await getOrgMetricLimit(
    ctx,
    organizationId,
    STORAGE_METRIC,
  );
  await evaluateAndAlert(ctx, {
    organizationId,
    metric: STORAGE_METRIC,
    currentUsage: bytesToMb(totalBytes),
    max,
    planId,
    planName,
  });
}

/**
 * Authoritative recompute backstop: scans every file-bearing table for an
 * organization, sums the true byte sizes, and overwrites the counter. Used to
 * self-heal drift and to backfill the counter for orgs that predate tracking.
 */
export async function recomputeOrgStorageBytes(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  let total = 0;

  const addFromStorageId = async (
    storageId: Id<"_storage"> | undefined | null,
  ) => {
    if (!storageId) return;
    total += await getStorageSizeBytes(ctx, storageId);
  };

  // documents
  for (const d of await ctx.db
    .query("documents")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.storageId);
  }
  // employeeDocuments
  for (const d of await ctx.db
    .query("employeeDocuments")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.storageId);
  }
  // galleryPhotos
  for (const d of await ctx.db
    .query("galleryPhotos")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.storageId);
  }
  // expenseReports (receipt)
  for (const d of await ctx.db
    .query("expenseReports")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.receiptStorageId);
  }
  // announcements (cover image)
  for (const d of await ctx.db
    .query("announcements")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.coverImageStorageId);
  }
  // events (banner)
  for (const d of await ctx.db
    .query("events")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.bannerStorageId);
  }
  // awards (certificate)
  for (const d of await ctx.db
    .query("awards")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.certificateStorageId);
  }
  // onboardingResources (document)
  for (const d of await ctx.db
    .query("onboardingResources")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect()) {
    await addFromStorageId(d.storageId);
  }

  const now = new Date().toISOString();
  const row = await ctx.db
    .query("orgStorageUsage")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (row) {
    await ctx.db.patch(row._id, { bytes: total, updatedAt: now });
  } else {
    await ctx.db.insert("orgStorageUsage", {
      organizationId,
      bytes: total,
      updatedAt: now,
    });
  }
  return total;
}
