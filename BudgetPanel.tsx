import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Plus, Trash2, Wallet, DollarSign, Pencil } from "lucide-react";
import { formatIdr } from "../_lib/advanced-utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { getCategoryConfig } from "../_lib/training-utils.ts";

function BudgetDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: {
    id: Id<"trainingBudgets">;
    plannedAmount: number;
    description?: string;
    periodLabel: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(
    initial?.periodLabel ?? String(new Date().getFullYear()),
  );
  const [amount, setAmount] = useState(
    initial ? String(initial.plannedAmount) : "",
  );
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);
  const create = useMutation(api.training.budget.createBudget);
  const update = useMutation(api.training.budget.updateBudget);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) < 0) {
      toast.error("Anggaran tidak valid");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await update({
          id: initial.id,
          plannedAmount: Number(amount),
          description: description.trim() || undefined,
        });
      } else {
        const key = period.match(/\d{4}/)?.[0] ?? period;
        await create({
          period: key,
          periodLabel: period,
          department: department.trim() || undefined,
          plannedAmount: Number(amount),
          description: description.trim() || undefined,
        });
      }
      toast.success("Tersimpan");
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {initial ? "Ubah anggaran" : "Tambah anggaran"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {!initial ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="p">Periode</Label>
                  <Input
                    id="p"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="2026, 2026 Q1"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept">Departemen</Label>
                  <Input
                    id="dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Kosongkan untuk perusahaan"
                  />
                </div>
              </>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="a">Anggaran (IDR)</Label>
              <Input
                id="a"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d">Catatan</Label>
              <Textarea
                id="d"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button type="submit" disabled={busy} className="cursor-pointer">
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BudgetPanel() {
  const budgets = useQuery(api.training.budget.listBudgets, {});
  const summary = useQuery(api.training.budget.getSpendSummary, {});
  const deleteBudget = useMutation(api.training.budget.deleteBudget);

  const handleDelete = async (id: Id<"trainingBudgets">) => {
    try {
      await deleteBudget({ id });
      toast.success("Dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Wallet className="size-8 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Anggaran</p>
              <p className="text-lg font-bold">
                {summary ? formatIdr(summary.totalPlanned) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="size-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total Terpakai</p>
              <p className="text-lg font-bold">
                {summary ? formatIdr(summary.totalSpent) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="size-8 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">Sisa</p>
              <p className="text-lg font-bold">
                {summary
                  ? formatIdr(
                      Math.max(0, summary.totalPlanned - summary.totalSpent),
                    )
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget list */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Anggaran Pelatihan</h3>
            <BudgetDialog
              trigger={
                <Button size="sm" className="cursor-pointer gap-1">
                  <Plus className="size-4" /> Tambah anggaran
                </Button>
              }
            />
          </div>
          {budgets === undefined ? (
            <Skeleton className="h-20 w-full" />
          ) : budgets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada anggaran pelatihan.
            </p>
          ) : (
            <ul className="space-y-2">
              {budgets.map((b) => {
                const pct =
                  b.plannedAmount === 0
                    ? 0
                    : Math.min(
                        100,
                        Math.round((b.actualSpent / b.plannedAmount) * 100),
                      );
                return (
                  <li
                    key={b._id}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {b.periodLabel}
                          {b.department ? ` · ${b.department}` : ""}
                        </p>
                        {b.description ? (
                          <p className="text-xs text-muted-foreground">
                            {b.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <BudgetDialog
                          initial={{
                            id: b._id,
                            plannedAmount: b.plannedAmount,
                            description: b.description,
                            periodLabel: b.periodLabel,
                          }}
                          trigger={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="cursor-pointer"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="cursor-pointer text-destructive"
                          onClick={() => handleDelete(b._id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>
                          {formatIdr(b.actualSpent)} /{" "}
                          {formatIdr(b.plannedAmount)}
                        </span>
                        <span
                          className={
                            pct >= 100 ? "font-semibold text-red-600" : ""
                          }
                        >
                          {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Spend breakdown */}
      {summary && (summary.byDepartment.length > 0 || summary.byCategory.length > 0) ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-2 p-5">
              <h4 className="font-semibold">Pengeluaran per Departemen</h4>
              <ul className="space-y-1.5 text-sm">
                {summary.byDepartment.map((d) => (
                  <li
                    key={d.department}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{d.department}</span>
                    <span className="font-mono font-medium">
                      {formatIdr(d.spent)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5">
              <h4 className="font-semibold">Pengeluaran per Kategori</h4>
              <ul className="space-y-1.5 text-sm">
                {summary.byCategory.map((c) => (
                  <li
                    key={c.category}
                    className="flex items-center justify-between"
                  >
                    <span>{getCategoryConfig(c.category).label}</span>
                    <span className="font-mono font-medium">
                      {formatIdr(c.spent)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
