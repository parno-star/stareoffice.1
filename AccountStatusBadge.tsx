import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { CheckCircle2, Clock, LogIn } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  ACCOUNT_STATUS_LABEL,
  getEmployeeAccountStatus,
} from "../_lib/account-status.ts";

/**
 * Compact badge that shows whether an employee has started using the system.
 * Only meaningful for admins managing the directory. "Aktif" is intentionally
 * subtle so the eye is drawn to accounts that still need attention.
 */
export default function AccountStatusBadge({
  user,
  className,
}: {
  user: Pick<Doc<"users">, "tokenIdentifier" | "accountStatus" | "lastLoginAt">;
  className?: string;
}) {
  const status = getEmployeeAccountStatus(user);
  const label = ACCOUNT_STATUS_LABEL[status];

  if (status === "active") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
          className,
        )}
      >
        <CheckCircle2 className="size-3" />
        {label}
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30",
          className,
        )}
      >
        <Clock className="size-3" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
        className,
      )}
    >
      <LogIn className="size-3" />
      {label}
    </Badge>
  );
}
