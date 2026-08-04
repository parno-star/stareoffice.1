import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { TenantContext, type TenantContextValue } from "@/hooks/use-tenant.ts";
import { useMemo } from "react";

/**
 * TenantProvider fetches the current user's organization and provides
 * tenant context to all descendants.
 *
 * IMPORTANT: This component must only be rendered inside an <Authenticated>
 * boundary so that Convex queries succeed.
 */
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const myOrg = useQuery(api.organizations.getMyOrganization, {});

  const value = useMemo<TenantContextValue>(() => {
    if (currentUser === undefined || myOrg === undefined) {
      return {
        organization: null,
        isLoading: true,
        isSuperAdmin: false,
        organizationId: null,
      };
    }

    const isSuperAdmin = currentUser?.role === "super_admin";

    return {
      organization: myOrg,
      isLoading: false,
      isSuperAdmin,
      organizationId: myOrg?._id ?? null,
    };
  }, [currentUser, myOrg]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}
