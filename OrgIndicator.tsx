import { useTenant } from "@/hooks/use-tenant.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import ProfileAvatarEdit from "@/components/ProfileAvatarEdit.tsx";
import { ROLE_LABELS, type Role } from "@/convex/roles.ts";

/**
 * Displays the current user avatar (clickable to edit), name, email,
 * and organization info in the sidebar.
 * Super admins without an org see "Super Admin — Semua Organisasi".
 */
export default function OrgIndicator() {
  const { organization, isLoading, isSuperAdmin, organizationId } = useTenant();
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    );
  }

  const userEmail = currentUser?.email;

  const userRole = currentUser?.role as Role | undefined;
  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? userRole) : null;

  // Super admin without org assigned
  if (isSuperAdmin && !organizationId) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="relative shrink-0">
          <ProfileAvatarEdit size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">
            {currentUser?.name ?? "Super Admin"}
          </p>
          <p className="truncate text-[10px] text-sidebar-foreground/50">
            {userEmail ?? "Semua Organisasi"}
          </p>
          <p className="truncate text-[10px] font-medium text-primary/80">
            {roleLabel ?? "Super Admin"}
          </p>
        </div>
      </div>
    );
  }

  if (!organization) return null;

  const planLabels: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
    poc: "POC",
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div className="relative shrink-0">
        <ProfileAvatarEdit size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-sidebar-foreground">
          {currentUser?.name ?? organization.name}
        </p>
        <p className="truncate text-[10px] text-sidebar-foreground/50">
          {userEmail ?? (organization.plan ? (planLabels[organization.plan] ?? organization.plan) : organization.name)}
        </p>
        {roleLabel && (
          <p className="truncate text-[10px] font-medium text-primary/80">
            {roleLabel}
          </p>
        )}
      </div>
    </div>
  );
}
