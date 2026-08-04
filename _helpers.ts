import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel.d.ts";
import { canManageTeam, isAdminRole } from "../roles";
import { requireTenant } from "../lib/tenant";

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const { userId } = await requireTenant(ctx, { allowSuperAdmin: true });
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}

// Admins and supervisors (who act as hiring managers) can manage recruitment.
export function canManageRecruitment(
  role: string | undefined | null,
): boolean {
  return isAdminRole(role) || canManageTeam(role);
}

export async function requireRecruiter(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!canManageRecruitment(user.role)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message:
        "Hanya admin, bendahara, atau atasan yang dapat mengelola rekrutmen",
    });
  }
  return user;
}

export const RECRUITMENT_STAGES = [
  "sourced",
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export type RecruitmentStage = (typeof RECRUITMENT_STAGES)[number];

export const ACTIVE_STAGES: ReadonlyArray<RecruitmentStage> = [
  "sourced",
  "applied",
  "screening",
  "interview",
  "offer",
];

export const JOB_STATUSES = ["draft", "open", "on_hold", "closed"] as const;

export const CANDIDATE_SOURCES = [
  "referral",
  "linkedin",
  "jobsite",
  "event",
  "agency",
  "website",
  "other",
] as const;

export const EMPLOYMENT_TYPES = [
  "fulltime",
  "parttime",
  "contract",
  "internship",
  "temporary",
] as const;

export const LEVELS = ["entry", "mid", "senior", "lead", "manager"] as const;
