import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Receipt, Eye, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import PayslipDetailDialog from "./PayslipDetailDialog.tsx";
import {
  formatIDR,
  formatISODate,
} from "../_lib/payroll-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function MyPayslipsTab() {
  const slips = useQuery(api.payroll.periods.listMyPayslips, {});
  const [openSlip, setOpenSlip] = useState<Id<"payslips"> | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Slip Gaji Saya</h2>
        <p className="text-sm text-muted-foreground">
          Daftar slip gaji yang telah diterbitkan untuk Anda.
        </p>
      </div>

      {slips === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : slips.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>Belum ada slip gaji</EmptyTitle>
            <EmptyDescription>
              Slip gaji akan muncul di sini setelah HR/bendahara menerbitkannya.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {slips.map((s) => (
            <Card key={s._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Periode
                    </p>
                    <p className="text-lg font-bold truncate">
                      {s.periodLabel}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dibayar: {formatISODate(s.payDate)}
                    </p>
                  </div>
                  {s.acknowledgedAt ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shrink-0"
                    >
                      <CheckCircle2 className="size-3" />
                      Diterima
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 shrink-0"
                    >
                      Baru
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Penerimaan</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatIDR(s.totalEarnings)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Take home</p>
                    <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatIDR(s.netSalary)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full cursor-pointer"
                  onClick={() => setOpenSlip(s._id)}
                >
                  <Eye className="size-4" />
                  Lihat Rincian
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PayslipDetailDialog
        payslipId={openSlip}
        open={openSlip !== null}
        onOpenChange={(o) => {
          if (!o) setOpenSlip(null);
        }}
        canAcknowledge
      />
    </div>
  );
}
