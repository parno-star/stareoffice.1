import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "./_helpers";

export const getStats = query({
  args: { period: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    let objectives;
    if (args.period) {
      objectives = await ctx.db
        .query("objectives")
        .withIndex("by_period", (q) => q.eq("period", args.period as string))
        .collect();
    } else {
      objectives = await ctx.db.query("objectives").collect();
    }
    const total = objectives.length;
    let active = 0;
    let completed = 0;
    let onTrack = 0;
    let atRisk = 0;
    let offTrack = 0;
    let totalProgress = 0;
    const scopeCounts: Record<string, number> = {
      company: 0,
      department: 0,
      team: 0,
      individual: 0,
    };
    for (const o of objectives) {
      if (o.status === "active") active += 1;
      if (o.status === "completed") completed += 1;
      if (o.health === "on_track") onTrack += 1;
      else if (o.health === "at_risk") atRisk += 1;
      else if (o.health === "off_track") offTrack += 1;
      totalProgress += o.progress;
      if (scopeCounts[o.scope] !== undefined) scopeCounts[o.scope] += 1;
    }
    const averageProgress = total > 0 ? Math.round(totalProgress / total) : 0;
    return {
      total,
      active,
      completed,
      onTrack,
      atRisk,
      offTrack,
      averageProgress,
      scopeCounts,
    };
  },
});

export const getMyStats = query({
  args: { period: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    let objectives;
    if (args.period) {
      objectives = await ctx.db
        .query("objectives")
        .withIndex("by_owner_and_period", (q) =>
          q.eq("ownerId", user._id).eq("period", args.period as string),
        )
        .collect();
    } else {
      objectives = await ctx.db
        .query("objectives")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
    }
    // Key results owned by the user regardless of objective
    const krs = await ctx.db
      .query("keyResults")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    let averageProgress = 0;
    if (objectives.length > 0) {
      const sum = objectives.reduce((acc, o) => acc + o.progress, 0);
      averageProgress = Math.round(sum / objectives.length);
    }
    const activeKrs = krs.filter((k) => k.status !== "achieved").length;
    const achievedKrs = krs.filter((k) => k.status === "achieved").length;
    return {
      objectives: objectives.length,
      activeObjectives: objectives.filter((o) => o.status === "active").length,
      averageProgress,
      keyResults: krs.length,
      activeKeyResults: activeKrs,
      achievedKeyResults: achievedKrs,
    };
  },
});
