import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  isAdminRole,
  isSuperAdminRole,
  normalizeRole,
  type Role,
  type MenuKey,
} from "@/convex/roles.ts";

export function useCurrentRole(): {
  role: Role | undefined;
  userId: string | undefined;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedMenus: ReadonlyArray<MenuKey> | undefined;
  isLoading: boolean;
} {
  const user = useQuery(api.users.getCurrentUser, {});
  const menus = useQuery(api.userSettings.getMyAllowedMenus, {});
  if (user === undefined) {
    return {
      role: undefined,
      userId: undefined,
      isAdmin: false,
      isSuperAdmin: false,
      allowedMenus: undefined,
      isLoading: true,
    };
  }
  const role = user ? normalizeRole(user.role) : undefined;
  return {
    role,
    userId: user?._id,
    isAdmin: isAdminRole(user?.role),
    isSuperAdmin: isSuperAdminRole(user?.role),
    allowedMenus: menus,
    isLoading: menus === undefined,
  };
}
