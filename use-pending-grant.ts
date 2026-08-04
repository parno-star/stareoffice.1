import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

/**
 * Reports whether the current super admin has SELECTED a company to view but
 * does NOT yet have an active access grant for it. In that state the backend
 * scopes all tenant data to empty, so affected pages should show the
 * "Menunggu izin akses dari organisasi ini" notice instead of empty lists.
 *
 * Returns `pending: false` for normal users, super admins viewing platform-wide,
 * and super admins that already hold a live grant.
 */
export function usePendingGrant(): {
  pending: boolean;
  organizationName: string | null;
} {
  const state = useQuery(api.dataAccess.getMyViewingAccessState, {});
  return {
    pending: state?.pendingGrant ?? false,
    organizationName: state?.organizationName ?? null,
  };
}
