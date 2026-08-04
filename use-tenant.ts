import { createContext, useContext } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";

export type TenantContextValue = {
  /** The current user's organization document, or null if none / loading */
  organization: Doc<"organizations"> | null;
  /** Whether the organization data is still loading */
  isLoading: boolean;
  /** Whether current user is a super_admin */
  isSuperAdmin: boolean;
  /** The organizationId shortcut (null for super_admin without org) */
  organizationId: Id<"organizations"> | null;
};

export const TenantContext = createContext<TenantContextValue>({
  organization: null,
  isLoading: true,
  isSuperAdmin: false,
  organizationId: null,
});

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
