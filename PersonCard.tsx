import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Users as UsersIcon, Pencil, Shield } from "lucide-react";
import { isAdminRole } from "@/convex/roles.ts";
import { getInitials, colorClasses, type PositionLevelInfo } from "../_lib/org-utils.ts";

export default function PersonCard({
  user,
  directReportCount,
  onClick,
  isAdmin,
  onEditManager,
  compact,
  highlight,
  positionLevel,
}: {
  user: Doc<"users">;
  directReportCount: number;
  onClick?: () => void;
  isAdmin?: boolean;
  onEditManager?: () => void;
  compact?: boolean;
  highlight?: boolean;
  positionLevel?: PositionLevelInfo;
}) {
  const levelColor = positionLevel ? colorClasses(positionLevel.color) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-md",
        highlight && "border-primary/50 ring-2 ring-primary/20",
        compact && "p-2.5",
      )}
    >
      <Avatar className={cn(compact ? "size-10" : "size-12")}>
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} />
        ) : null}
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.name ?? "Tanpa Nama"}
          </p>
          {isAdminRole(user.role) ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Admin
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {user.jobTitle ?? "Belum ada jabatan"}
        </p>
        {!compact && user.department ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
            {user.department}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {/* Position level badge */}
        {positionLevel && levelColor ? (
          <Badge
            variant="outline"
            className={cn(
              "gap-1 px-1.5 text-[10px]",
              levelColor.border,
              levelColor.bg,
              levelColor.text,
            )}
          >
            <Shield className="size-2.5" />
            {positionLevel.code}
          </Badge>
        ) : null}
        {directReportCount > 0 ? (
          <Badge
            variant="outline"
            className="gap-1 border-primary/30 bg-primary/5 text-[10px] text-primary"
          >
            <UsersIcon className="size-3" />
            {directReportCount}
          </Badge>
        ) : null}
        {isAdmin && onEditManager ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEditManager();
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
