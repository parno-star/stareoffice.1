import type { Doc } from "@/convex/_generated/dataModel.d.ts";

/**
 * Derives a human-friendly account status for an employee record so admins can
 * tell, at a glance, whether a person has actually started using the system.
 *
 * Three states matter in the directory:
 *  - "active"   → the person has a real account and access (has logged in).
 *  - "invited"  → admin pre-registered them; they have not logged in yet. Their
 *                 record still carries a placeholder token identifier.
 *  - "pending"  → they signed up themselves and are awaiting admin approval.
 *
 * A record is treated as "invited" when its login identifier is still a
 * placeholder (created by an admin, never claimed by a real login) OR when the
 * account status was explicitly set to "invited".
 */
export type EmployeeAccountStatus = "active" | "invited" | "pending";

export function getEmployeeAccountStatus(
  user: Pick<Doc<"users">, "tokenIdentifier" | "accountStatus" | "lastLoginAt">,
): EmployeeAccountStatus {
  const isPlaceholder = user.tokenIdentifier?.startsWith("placeholder:") ?? false;

  // Awaiting the admin's approval after self-signup.
  if (user.accountStatus === "pending_approval") return "pending";

  // Pre-registered by an admin and not yet claimed by a real login.
  if (user.accountStatus === "invited" || isPlaceholder) {
    // Safety net: if somehow a login was recorded, treat as active.
    return user.lastLoginAt ? "active" : "invited";
  }

  return "active";
}

export const ACCOUNT_STATUS_LABEL: Record<EmployeeAccountStatus, string> = {
  active: "Aktif",
  invited: "Menunggu login",
  pending: "Menunggu persetujuan",
};
