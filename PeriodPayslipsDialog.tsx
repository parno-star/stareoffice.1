import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatIDR, SLIP_STATUS_CONFIG } from "../_lib/payroll-utils.ts";

type Props = {
  periodId: Id<"payrollPeriods"> | null;
  periodLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function PeriodPayslipsDialog({
  periodId,
  periodLabel,
  open,
  onOpenChange,
}: Props) {
  const slips = useQuery(
    api.payroll.periods.listPeriodPayslips,
    open && periodId ? { periodId } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Slip Gaji - {periodLabel}</DialogTitle>
          <DialogDescription>
            Daftar slip gaji yang dihasilkan untuk periode ini.
          </DialogDescription>
        </DialogHeader>

        {slips === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : slips.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Belum ada slip. Generate slip gaji terlebih dahulu.
          </p>
        ) : (
          <div className="space-y-2">
            {slips.map((s) => {
              const cfg =
                SLIP_STATUS_CONFIG[s.status] ?? SLIP_STATUS_CONFIG.draft;
              return (
                <div
                  key={s._id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar className="size-9">
                    <AvatarImage src={s.userAvatar ?? undefined} />
                    <AvatarFallback>
                      {s.userName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.userJobTitle ?? "-"} • {s.userDepartment ?? "-"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums">
                      {formatIDR(s.netSalary)}
                    </p>
                    <Badge variant="outline" className={cfg.badge}>
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
