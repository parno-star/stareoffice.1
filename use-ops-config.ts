import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { StatusRecord, PriorityRecord } from "./ops-utils.ts";

export type OpsConfig = {
  statuses: Array<StatusRecord>;
  priorities: Array<PriorityRecord>;
  isLoading: boolean;
};

/**
 * Loads the organization's task stages & priorities (custom or defaults).
 * Returns the raw lists plus convenience derived values.
 */
export function useOpsConfig(): OpsConfig {
  const config = useQuery(api.operationsSettings.getConfig, {});
  return {
    statuses: config?.statuses ?? [],
    priorities: config?.priorities ?? [],
    isLoading: config === undefined,
  };
}
