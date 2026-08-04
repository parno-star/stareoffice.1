import { useAuth } from "@/hooks/use-auth.ts";
import { useTenant } from "@/hooks/use-tenant.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Building2, LogOut, Clock } from "lucide-react";

/**
 * Shows a blocking screen when the authenticated user has no organization
 * assigned yet (and is not a super_admin). Super admins can always pass.
 *
 * Returns `null` when the user is OK to proceed.
 */
export default function NoOrganizationGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isSuperAdmin, organizationId } = useTenant();
  const { removeUser } = useAuth();

  // Still loading tenant data
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
      </div>
    );
  }

  // Super admins can always access the platform (even without an org)
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Regular user without an organization
  if (!organizationId) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Building2 className="size-10 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Belum Tergabung Organisasi</h1>
          <p className="text-muted-foreground">
            Akun Anda belum terhubung dengan organisasi manapun.
            Silakan hubungi administrator untuk didaftarkan ke organisasi Anda.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>Menunggu administrator</span>
          </div>
          <Button variant="ghost" className="gap-2" onClick={async () => { try { await removeUser(); } catch { /* ignore */ } window.location.replace("/"); }}>
            <LogOut className="size-4" />
            Keluar
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
