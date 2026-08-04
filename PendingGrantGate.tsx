import { useLocation } from "react-router-dom";
import PendingGrantNotice from "@/components/PendingGrantNotice.tsx";
import { usePendingGrant } from "@/hooks/use-pending-grant.ts";

/**
 * When a super admin has selected a company to view but the company has NOT yet
 * granted an active access grant, the backend scopes every tenant-data page to
 * empty. Rather than showing confusing empty lists, this gate replaces the page
 * body with a clear "Menunggu izin akses dari organisasi ini" notice.
 *
 * Platform-management and personal pages stay fully functional so the super
 * admin can still manage organizations, request/track access grants, handle
 * billing, and use their own account while access is pending.
 */

// Route prefixes that must keep working even without an active grant. These are
// platform-management screens (org list, access grants, billing) and the super
// admin's own personal/self-service pages — none of which expose a company's
// confidential tenant data.
const ALLOWED_PREFIXES: ReadonlyArray<string> = [
  "/super-admin",
  "/data-privacy",
  "/billing",
  "/home",
  "/my-profile",
  "/notifications",
  "/chatbot",
  "/settings",
];

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export default function PendingGrantGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { pending, organizationName } = usePendingGrant();

  if (pending && !isAllowedPath(location.pathname)) {
    return (
      <div className="p-4 lg:p-6">
        <PendingGrantNotice organizationName={organizationName} />
      </div>
    );
  }

  return <>{children}</>;
}
