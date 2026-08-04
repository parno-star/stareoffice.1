import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

/**
 * Hook to get the current organisation's plan access info.
 * Returns plan details, blocked menus, and limit usage.
 */
export function usePlanAccess() {
  const orgPlan = useQuery(api.planAccess.getMyOrgPlan, {});
  const usage = useQuery(api.planAccess.getOrgUsage, {});

  const isLoading = orgPlan === undefined || usage === undefined;

  return {
    plan: orgPlan?.plan ?? null,
    blockedMenus: orgPlan?.blockedMenus ?? [],
    org: orgPlan?.org ?? null,
    usage,
    isLoading,
  };
}
