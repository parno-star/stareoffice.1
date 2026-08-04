import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatIDR, formatISODate, formatTimestamp } from "../_lib/payroll-utils.ts";
import { CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";

type Props = {
  payslipId: Id<"payslips"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAcknowledge?: boolean;
};

export default function PayslipDetailDialog({
  payslipId,
  open,
  onOpenChange,
  canAcknowledge,
}: Props) {
  const slip = useQuery(
    api.payroll.periods.getPayslip,
    open && payslipId ? { payslipId } : "skip",
  );
  const acknowledge = useMutation(api.payroll.periods.acknowledgePayslip);

  const handleAcknowledge = async () => {
    if (!payslipId) return;
    try {
      await acknowledge({ payslipId });
      toast.success("Slip gaji dikonfirmasi");
    } catch {
      toast.error("Gagal konfirmasi");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-full">
        <DialogHeader>
          <DialogTitle>Slip Gaji</DialogTitle>
          <DialogDescription>
            Rincian slip gaji Anda untuk periode ini.
          </DialogDescription>
        </DialogHeader>

        {slip === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : slip === null ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Slip gaji tidak ditemukan.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Periode
                  </p>
                  <p className="text-xl font-bold">{slip.periodLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tanggal bayar: {formatISODate(slip.payDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Take Home
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatIDR(slip.netSalary)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nama:</span>{" "}
                  <span className="font-medium">{slip.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Posisi:</span>{" "}
                  <span className="font-medium">
                    {slip.userJobTitle ?? "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Departemen:</span>{" "}
                  <span className="font-medium">
                    {slip.userDepartment ?? "-"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Penerimaan
              </h3>
              <div className="rounded-lg border divide-y">
                {slip.lines
                  .filter((l) => l.type === "earning")
                  .map((l) => (
                    <div
                      key={l._id}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {l.code}
                        </p>
                      </div>
                      <p className="text-sm font-medium tabular-nums">
                        {formatIDR(l.amount)}
                      </p>
                    </div>
                  ))}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                  <p className="text-sm font-semibold">Total Penerimaan</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatIDR(slip.totalEarnings)}
                  </p>
                </div>
              </div>
            </div>

            {slip.lines.some((l) => l.type === "deduction") ? (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Potongan
                </h3>
                <div className="rounded-lg border divide-y">
                  {slip.lines
                    .filter((l) => l.type === "deduction")
                    .map((l) => (
                      <div
                        key={l._id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{l.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {l.code}
                          </p>
                        </div>
                        <p className="text-sm font-medium tabular-nums text-red-600 dark:text-red-400">
                          - {formatIDR(l.amount)}
                        </p>
                      </div>
                    ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                    <p className="text-sm font-semibold">Total Potongan</p>
                    <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                      - {formatIDR(slip.totalDeductions)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Dibayarkan</p>
                <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatIDR(slip.netSalary)}
                </p>
              </div>
            </div>

            {slip.acknowledgedAt ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              >
                <CheckCircle2 className="size-3" />
                Dikonfirmasi {formatTimestamp(slip.acknowledgedAt)}
              </Badge>
            ) : null}

            {slip.note ? (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Catatan
                </p>
                <p className="text-sm">{slip.note}</p>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="print:hidden">
          <Button variant="ghost" onClick={handlePrint}>
            <Printer className="size-4" />
            Cetak
          </Button>
          {canAcknowledge && slip && !slip.acknowledgedAt ? (
            <Button onClick={handleAcknowledge}>
              <CheckCircle2 className="size-4" />
              Konfirmasi Terima
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
