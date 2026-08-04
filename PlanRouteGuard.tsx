import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { MENU_ITEMS } from "@/convex/roles";
import type { MenuKey } from "@/convex/roles";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Lock, ArrowUpCircle } from "lucide-react";

/**
 * Resolves the menu key that owns a given pathname. Longest path prefix wins so
 * that nested routes (e.g. /training/:id) resolve to their parent menu.
 */
function resolveMenuKey(pathname: string): MenuKey | null {
  let match: { key: MenuKey; length: number } | null = null;
  for (const item of MENU_ITEMS) {
    if (pathname === item.path || pathname.startsWith(item.path + "/")) {
      if (!match || item.path.length > match.length) {
        match = { key: item.key, length: item.path.length };
      }
    }
  }
  return match?.key ?? null;
}

/**
 * Blocks direct access to pages whose feature is not included in the
 * organisation's membership plan (and not unlocked via an add-on). The sidebar
 * already hides these menus, but this guards direct URL navigation.
 */
export default function PlanRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const menuKey = resolveMenuKey(location.pathname);

  const result = useQuery(
    api.planAccess.isFeatureBlocked,
    menuKey ? { menuKey } : "skip",
  );

  // No mapped menu, still loading, or not blocked → render normally.
  if (!menuKey || result === undefined || !result.blocked) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock />
          </EmptyMedia>
          <EmptyTitle>Fitur Tidak Tersedia</EmptyTitle>
          <EmptyDescription>
            {result.upgradeMessage ??
              "Fitur ini tidak termasuk dalam paket keanggotaan Anda."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowUpCircle className="size-4" />
            Kembali ke Dashboard
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
