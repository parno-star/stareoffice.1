import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatIDR } from "../_lib/payroll-utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { RotateCcw, Save } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users"> | null;
};

export default function StructureEditorDialog({
  open,
  onOpenChange,
  userId,
}: Props) {
  const structure = useQuery(
    api.payroll.structures.getUserStructure,
    open && userId ? { userId } : "skip",
  );
  const setOverride = useMutation(api.payroll.structures.setOverride);
  const clearOverride = useMutation(api.payroll.structures.clearOverride);
  const [values, setValues] = useState<
    Record<string, { amount: string; isOverride: boolean }>
  >({});

  useEffect(() => {
    if (structure?.lines) {
      const next: Record<string, { amount: string; isOverride: boolean }> = {};
      for (const line of structure.lines) {
        next[line.componentId] = {
          amount: String(line.configuredValue),
          isOverride: line.isOverride,
        };
      }
      setValues(next);
    }
  }, [structure]);

  const handleSave = async (componentId: Id<"payrollComponents">) => {
    if (!userId) return;
    const entry = values[componentId];
    if (!entry) return;
    const amt = Number(entry.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("Nilai tidak valid");
      return;
    }
    try {
      await setOverride({ userId, componentId, amount: amt });
      toast.success("Override disimpan");
    } catch {
      toast.error("Gagal menyimpan");
    }
  };

  const handleReset = async (
    overrideId: Id<"employeeSalaryComponents"> | null,
  ) => {
    if (!overrideId) return;
    try {
      await clearOverride({ overrideId });
      toast.success("Kembali ke nilai default");
    } catch {
      toast.error("Gagal mereset");
    }
  };

  const loading = open && userId && structure === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Struktur Gaji Karyawan</DialogTitle>
          <DialogDescription>
            Sesuaikan nominal setiap komponen untuk karyawan ini. Kosongkan
            override untuk menggunakan nilai default.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : structure?.user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border p-3 bg-muted/40">
              <Avatar className="size-10">
                <AvatarImage src={structure.user.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {structure.user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{structure.user.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {structure.user.jobTitle ?? "-"} •{" "}
                  {structure.user.department ?? "-"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Take home</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatIDR(structure.totals.netSalary)}
                </p>
              </div>
            </div>

            {structure.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Belum ada komponen gaji. Tambahkan komponen di tab Komponen
                terlebih dahulu.
              </p>
            ) : (
              <div className="space-y-2">
                {structure.lines.map((line) => {
                  const entry = values[line.componentId] ?? {
                    amount: String(line.defaultAmount),
                    isOverride: false,
                  };
                  return (
                    <div
                      key={line.componentId}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {line.componentName}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                line.componentType === "earning"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px]"
                                  : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 text-[10px]"
                              }
                            >
                              {line.componentType === "earning"
                                ? "Masuk"
                                : "Potongan"}
                            </Badge>
                            {line.isOverride ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[10px]"
                              >
                                Override
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {line.componentCode} •{" "}
                            {line.calculation === "percent_of_basic"
                              ? `% gaji pokok`
                              : "nominal"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            Efektif
                          </p>
                          <p className="font-semibold tabular-nums">
                            {formatIDR(line.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1 grid gap-1">
                          <Label className="text-xs">
                            {line.calculation === "percent_of_basic"
                              ? "Persen (%)"
                              : "Nominal (IDR)"}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step={
                              line.calculation === "percent_of_basic"
                                ? "0.01"
                                : "1000"
                            }
                            value={entry.amount}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                [line.componentId]: {
                                  ...(prev[line.componentId] ?? {
                                    isOverride: false,
                                  }),
                                  amount: e.target.value,
                                  isOverride: true,
                                },
                              }))
                            }
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSave(line.componentId)}
                          className="cursor-pointer"
                        >
                          <Save className="size-4" />
                          Simpan
                        </Button>
                        {line.isOverride && line.overrideId ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReset(line.overrideId)}
                            className="cursor-pointer"
                            title="Kembali ke default"
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Penerimaan</p>
                <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatIDR(structure.totals.totalEarnings)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Potongan</p>
                <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {formatIDR(structure.totals.totalDeductions)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Take home</p>
                <p className="font-bold tabular-nums">
                  {formatIDR(structure.totals.netSalary)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            Karyawan tidak ditemukan.
          </p>
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
