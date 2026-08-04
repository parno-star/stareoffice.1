import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  CalendarRange,
  Calculator,
  CheckCircle2,
  Eye,
  Lock,
  Trash2,
  Send,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import CreatePeriodDialog from "./CreatePeriodDialog.tsx";
import PeriodPayslipsDialog from "./PeriodPayslipsDialog.tsx";
import {
  formatIDR,
  formatISODate,
  PERIOD_STATUS_CONFIG,
} from "../_lib/payroll-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function PeriodsTab() {
  const periods = useQuery(api.payroll.periods.listPeriods, {});
  const generate = useMutation(api.payroll.periods.generatePayslips);
  const publish = useMutation(api.payroll.periods.publishPeriod);
  const closePeriod = useMutation(api.payroll.periods.closePeriod);
  const deletePeriod = useMutation(api.payroll.periods.deletePeriod);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{
    id: Id<"payrollPeriods">;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    id: Id<"payrollPeriods">;
    label: string;
  } | null>(null);

  const handleGenerate = async (id: Id<"payrollPeriods">) => {
    setBusy(id);
    try {
      const res = await generate({ periodId: id });
      toast.success(
        `Dihasilkan ${res.created} slip (${res.skipped} dilewati). Total netto ${formatIDR(res.totalNet)}`,
      );
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal generate slip");
      } else {
        toast.error("Gagal generate slip");
      }
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async (id: Id<"payrollPeriods">) => {
    setBusy(id);
    try {
      const res = await publish({ periodId: id });
      toast.success(`${res.published} slip diterbitkan dan karyawan diberi tahu`);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menerbitkan");
      } else {
        toast.error("Gagal menerbitkan");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async (id: Id<"payrollPeriods">) => {
    setBusy(id);
    try {
      await closePeriod({ periodId: id });
      toast.success("Periode ditutup");
    } catch {
      toast.error("Gagal menutup periode");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deletePeriod({ periodId: deleting.id });
      toast.success("Periode dihapus");
      setDeleting(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Periode Payroll</h2>
          <p className="text-sm text-muted-foreground">
            Buat periode bulanan, generate slip, terbitkan ke karyawan, lalu
            kunci.
          </p>
        </div>
        <CreatePeriodDialog />
      </div>

      {periods === undefined ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : periods.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarRange />
            </EmptyMedia>
            <EmptyTitle>Belum ada periode payroll</EmptyTitle>
            <EmptyDescription>
              Buat periode payroll pertama untuk mulai menghasilkan slip gaji.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreatePeriodDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {periods.map((p) => {
            const cfg =
              PERIOD_STATUS_CONFIG[p.status] ?? PERIOD_STATUS_CONFIG.draft;
            const canGenerate = p.status === "draft" || p.status === "processing";
            const canPublish = p.status === "processing";
            const canClose = p.status === "published";
            const canDelete = p.status === "draft" || p.status === "processing";
            return (
              <Card key={p._id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {p.periodLabel}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatISODate(p.startDate)} -{" "}
                        {formatISODate(p.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dibayar: {formatISODate(p.payDate)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cfg.badge}>
                      {cfg.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Karyawan</p>
                      <p className="font-semibold">{p.employeeCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gross</p>
                      <p className="font-semibold tabular-nums">
                        {formatIDR(p.totalGross)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Netto</p>
                      <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatIDR(p.totalNet)}
                      </p>
                    </div>
                  </div>
                  {p.publishedCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {p.publishedCount} slip diterbitkan
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {canGenerate ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerate(p._id)}
                        disabled={busy === p._id}
                        className="cursor-pointer"
                      >
                        <Calculator className="size-4" />
                        Generate Slip
                      </Button>
                    ) : null}
                    {canPublish ? (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(p._id)}
                        disabled={busy === p._id}
                        className="cursor-pointer"
                      >
                        <Send className="size-4" />
                        Terbitkan
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setViewing({ id: p._id, label: p.periodLabel })
                      }
                      className="cursor-pointer"
                    >
                      <Eye className="size-4" />
                      Lihat Slip
                    </Button>
                    {canClose ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleClose(p._id)}
                        disabled={busy === p._id}
                        className="cursor-pointer"
                      >
                        <Lock className="size-4" />
                        Tutup
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() =>
                          setDeleting({ id: p._id, label: p.periodLabel })
                        }
                        className="cursor-pointer text-destructive hover:text-destructive"
                        title="Hapus periode"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                    {p.status === "closed" ? (
                      <Badge
                        variant="outline"
                        className="ml-auto bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                      >
                        <CheckCircle2 className="size-3" />
                        Final
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PeriodPayslipsDialog
        periodId={viewing?.id ?? null}
        periodLabel={viewing?.label ?? ""}
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus periode?</AlertDialogTitle>
            <AlertDialogDescription>
              Periode "{deleting?.label}" dan semua slip didalamnya akan dihapus
              permanen. Tindakan ini hanya bisa dilakukan untuk periode draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
