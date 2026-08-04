import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  formatCurrency,
  categoryDisplayFromRecord,
  type ExpenseCategoryRecord,
} from "../_lib/expense-utils.ts";

type PolicyForm = {
  maxAmountPerRequest: string;
  monthlyLimitPerUser: string;
  receiptRequiredAbove: string;
  requireDescription: boolean;
  isActive: boolean;
  note: string;
};

function emptyForm(): PolicyForm {
  return {
    maxAmountPerRequest: "",
    monthlyLimitPerUser: "",
    receiptRequiredAbove: "",
    requireDescription: true,
    isActive: true,
    note: "",
  };
}

function PolicyEditor({ cat }: { cat: ExpenseCategoryRecord }) {
  const category = cat.key;
  const policies = useQuery(api.expensePolicies.list, {});
  const upsert = useMutation(api.expensePolicies.upsert);
  const remove = useMutation(api.expensePolicies.remove);

  const existing = policies?.find((p) => p.category === category) ?? null;
  const cfg = categoryDisplayFromRecord(cat);
  const Icon = cfg.icon;

  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        maxAmountPerRequest: existing.maxAmountPerRequest
          ? String(existing.maxAmountPerRequest)
          : "",
        monthlyLimitPerUser: existing.monthlyLimitPerUser
          ? String(existing.monthlyLimitPerUser)
          : "",
        receiptRequiredAbove: existing.receiptRequiredAbove
          ? String(existing.receiptRequiredAbove)
          : "",
        requireDescription: existing.requireDescription,
        isActive: existing.isActive,
        note: existing.note ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [existing]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await upsert({
        category,
        maxAmountPerRequest:
          form.maxAmountPerRequest.length > 0
            ? Number(form.maxAmountPerRequest)
            : undefined,
        monthlyLimitPerUser:
          form.monthlyLimitPerUser.length > 0
            ? Number(form.monthlyLimitPerUser)
            : undefined,
        receiptRequiredAbove:
          form.receiptRequiredAbove.length > 0
            ? Number(form.receiptRequiredAbove)
            : undefined,
        requireDescription: form.requireDescription,
        isActive: form.isActive,
        note: form.note.trim() || undefined,
      });
      toast.success("Kebijakan tersimpan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    try {
      await remove({ category });
      toast.success("Kebijakan dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{cfg.label}</CardTitle>
              <CardDescription className="text-xs">
                {existing
                  ? form.isActive
                    ? "Kebijakan aktif"
                    : "Kebijakan non-aktif"
                  : "Belum ada kebijakan"}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={form.isActive ? cfg.badge : "text-muted-foreground"}
            >
              {form.isActive ? "Aktif" : "Non-aktif"}
            </Badge>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Maks. per pengajuan (IDR)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="5000000"
              value={form.maxAmountPerRequest}
              onChange={(e) =>
                setForm({ ...form, maxAmountPerRequest: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Batas bulanan per karyawan (IDR)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="20000000"
              value={form.monthlyLimitPerUser}
              onChange={(e) =>
                setForm({ ...form, monthlyLimitPerUser: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Kuitansi wajib di atas (IDR)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="500000"
              value={form.receiptRequiredAbove}
              onChange={(e) =>
                setForm({ ...form, receiptRequiredAbove: e.target.value })
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="text-sm">
            <p className="font-medium">Deskripsi wajib</p>
            <p className="text-xs text-muted-foreground">
              Paksa karyawan mengisi deskripsi pengeluaran.
            </p>
          </div>
          <Switch
            checked={form.requireDescription}
            onCheckedChange={(v) =>
              setForm({ ...form, requireDescription: v })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Catatan internal (opsional)</Label>
          <Textarea
            rows={2}
            placeholder="Panduan singkat untuk reviewer..."
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            maxLength={300}
          />
        </div>

        {(form.maxAmountPerRequest ||
          form.monthlyLimitPerUser ||
          form.receiptRequiredAbove) && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Shield className="size-3.5" /> Ringkasan
            </p>
            <ul className="mt-1 space-y-0.5">
              {form.maxAmountPerRequest ? (
                <li>
                  Maks. {formatCurrency(Number(form.maxAmountPerRequest))} per
                  pengajuan
                </li>
              ) : null}
              {form.monthlyLimitPerUser ? (
                <li>
                  Batas bulanan:{" "}
                  {formatCurrency(Number(form.monthlyLimitPerUser))}
                </li>
              ) : null}
              {form.receiptRequiredAbove ? (
                <li>
                  Kuitansi wajib di atas{" "}
                  {formatCurrency(Number(form.receiptRequiredAbove))}
                </li>
              ) : null}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {existing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="cursor-pointer text-destructive"
            >
              Hapus
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={submitting}
            className="gap-2 cursor-pointer"
          >
            <Save className="size-4" />
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExpensePoliciesPanel() {
  const policies = useQuery(api.expensePolicies.list, {});
  const categories = useQuery(api.expenseCategories.list, {});
  if (policies === undefined || categories === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }
  const activeCategories = categories.filter((c) => c.isActive);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Atur Kebijakan Reimbursement</p>
        <p className="mt-1 text-muted-foreground">
          Kebijakan dipakai untuk memvalidasi pengajuan karyawan secara
          otomatis. Aktifkan kebijakan untuk memberlakukan batasan.
        </p>
      </div>
      {activeCategories.map((c) => (
        <PolicyEditor key={c.key} cat={c} />
      ))}
    </div>
  );
}
