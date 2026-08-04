import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Pencil, Users2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type BalanceRow = {
  userId: Id<"users">;
  name: string;
  department: string;
  jobTitle: string;
  avatarUrl: string | null;
  year: number;
  annualQuota: number;
  annualUsed: number;
  annualRemaining: number;
};

function EditQuotaDialog({
  row,
  open,
  onOpenChange,
}: {
  row: BalanceRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setQuota = useMutation(api.leaveRequests.setQuota);
  const [value, setValue] = useState<string>(String(row.annualQuota));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Kuota harus berupa angka positif");
      return;
    }
    setSaving(true);
    try {
      await setQuota({
        userId: row.userId,
        year: row.year,
        annualQuota: Math.floor(parsed),
      });
      toast.success(`Kuota ${row.name} diperbarui`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memperbarui kuota");
      } else {
        toast.error("Gagal memperbarui kuota");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atur kuota cuti tahunan</DialogTitle>
          <DialogDescription>
            {row.name} · tahun {row.year}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="quota">Kuota hari per tahun</Label>
          <Input
            id="quota"
            type="number"
            min={0}
            max={365}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Sudah terpakai: {row.annualUsed} hari
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BalanceRowCard({ row }: { row: BalanceRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const pct =
    row.annualQuota > 0
      ? Math.min(100, Math.round((row.annualUsed / row.annualQuota) * 100))
      : 0;

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Avatar className="size-10">
          {row.avatarUrl ? (
            <AvatarImage src={row.avatarUrl} alt={row.name} />
          ) : null}
          <AvatarFallback>{initials(row.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="truncate text-sm font-semibold">{row.name}</p>
            {row.jobTitle ? (
              <span className="truncate text-xs text-muted-foreground">
                {row.jobTitle}
              </span>
            ) : null}
            {row.department ? (
              <Badge variant="outline" className="ml-auto">
                {row.department}
              </Badge>
            ) : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {row.annualRemaining}
            </span>{" "}
            tersisa dari {row.annualQuota} hari · {row.annualUsed} terpakai
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-3.5" />
          Atur
        </Button>
      </CardContent>
      <EditQuotaDialog row={row} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}

export default function BalancesTab() {
  const year = new Date().getUTCFullYear();
  const balances = useQuery(api.leaveRequests.listBalances, { year });

  if (balances === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users2 />
          </EmptyMedia>
          <EmptyTitle>Belum ada karyawan</EmptyTitle>
          <EmptyDescription>
            Data karyawan akan otomatis muncul di sini setelah mereka masuk ke
            portal.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Saldo cuti tahunan · {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Kuota default adalah 12 hari per karyawan. Ubah angka sesuai
            kebijakan perusahaan Anda.
          </p>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {balances.map((row) => (
          <BalanceRowCard key={row.userId} row={row} />
        ))}
      </div>
    </div>
  );
}
