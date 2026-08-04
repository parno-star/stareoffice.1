import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import { notifyUser } from "../notifications";
import { requireUser, requireAdmin } from "./_helpers";

export type AssignmentWithMeta = Doc<"courseAssignments"> & {
  assignedByName: string | null;
  targetLabel: string;
};

export const listAssignmentsForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    args,
  ): Promise<Array<AssignmentWithMeta>> => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("courseAssignments")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    const out: Array<AssignmentWithMeta> = [];
    for (const r of rows) {
      const by = await ctx.db.get(r.assignedById);
      let targetLabel = "Semua karyawan";
      if (r.targetType === "user" && r.targetValue) {
        const u = await ctx.db.get(
          r.targetValue as unknown as Id<"users">,
        );
        targetLabel = u?.name ?? "Karyawan";
      } else if (r.targetType === "department") {
        targetLabel = `Departemen: ${r.targetValue ?? "-"}`;
      }
      out.push({
        ...r,
        assignedByName: by?.name ?? null,
        targetLabel,
      });
    }
    return out;
  },
});

export const createAssignment = mutation({
  args: {
    courseId: v.id("courses"),
    // "user" | "department" | "all"
    targetType: v.string(),
    targetValue: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"courseAssignments">> => {
    const admin = await requireAdmin(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Kelas tidak ditemukan",
      });
    }
    if (!["user", "department", "all"].includes(args.targetType)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Target tidak valid",
      });
    }
    if (
      (args.targetType === "user" || args.targetType === "department") &&
      !args.targetValue
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Pilih target penugasan",
      });
    }
    const assignmentId = await ctx.db.insert("courseAssignments", {
      courseId: args.courseId,
      targetType: args.targetType,
      targetValue:
        args.targetType === "all" ? undefined : args.targetValue,
      dueDate: args.dueDate,
      note: args.note?.trim() || undefined,
      assignedById: admin._id,
    });

    // Notify target users
    const recipients = await resolveRecipients(ctx, args);
    for (const u of recipients) {
      await notifyUser(ctx, {
        userId: u._id,
        type: "course_assigned",
        title: "Kelas wajib diberikan",
        message: args.dueDate
          ? `Anda ditugaskan menyelesaikan "${course.title}" sebelum ${args.dueDate}.`
          : `Anda ditugaskan menyelesaikan "${course.title}".`,
        link: `/training/${course._id}`,
        actorId: admin._id,
      });
    }
    return assignmentId;
  },
});

export const removeAssignment = mutation({
  args: { id: v.id("courseAssignments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
    return null;
  },
});

async function resolveRecipients(
  ctx: MutationCtx,
  args: { targetType: string; targetValue?: string },
): Promise<Array<Doc<"users">>> {
  const all = await ctx.db.query("users").collect();
  if (args.targetType === "all") return all;
  if (args.targetType === "user" && args.targetValue) {
    const u = await ctx.db.get(
      args.targetValue as unknown as Id<"users">,
    );
    return u ? [u] : [];
  }
  if (args.targetType === "department" && args.targetValue) {
    return all.filter((u) => u.department === args.targetValue);
  }
  return [];
}

// Assignments for the current user (mandatory to complete)
export const getMyAssignments = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      assignment: Doc<"courseAssignments">;
      course: Doc<"courses"> | null;
      progress: number;
      completedAt: string | null;
    }>
  > => {
    const user = await requireUser(ctx);
    const all = await ctx.db.query("courseAssignments").collect();
    const matches = all.filter((a) => {
      if (a.targetType === "all") return true;
      if (a.targetType === "user" && a.targetValue === String(user._id))
        return true;
      if (
        a.targetType === "department" &&
        user.department &&
        a.targetValue === user.department
      )
        return true;
      return false;
    });
    matches.sort((a, b) => {
      const ad = a.dueDate ?? "9999-12-31";
      const bd = b.dueDate ?? "9999-12-31";
      return ad.localeCompare(bd);
    });
    const out: Array<{
      assignment: Doc<"courseAssignments">;
      course: Doc<"courses"> | null;
      progress: number;
      completedAt: string | null;
    }> = [];
    for (const a of matches) {
      const course = await ctx.db.get(a.courseId);
      const enrollment = await ctx.db
        .query("courseEnrollments")
        .withIndex("by_course_and_user", (q) =>
          q.eq("courseId", a.courseId).eq("userId", user._id),
        )
        .unique();
      out.push({
        assignment: a,
        course,
        progress: enrollment?.progress ?? 0,
        completedAt: enrollment?.completedAt ?? null,
      });
    }
    return out;
  },
});
