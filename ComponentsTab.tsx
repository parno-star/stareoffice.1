import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
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
import { Plus, Coins, Pencil, Trash2, Power } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ComponentFormDialog from "./ComponentFormDialog.tsx";
import { formatIDR } from "../_lib/payroll-utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

export default function ComponentsTab() {
  const components = useQuery(api.payroll.components.listComponents, {
    includeInactive: true,
  });
  const updateComponent = useMutation(api.payroll.components.updateComponent);
  const deleteComponent = useMutation(api.payroll.components.deleteComponent);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"payrollComponents"> | null>(null);
  const [confirmDelete, setConfirmDelete] =
    useState<Doc<"payrollComponents"> | null>(null);

  const earnings = components?.filter((c) => c.type === "earning") ?? [];
  const deductions = components?.filter((c) => c.type === "deduction") ?? [];

  const handleToggleActive = async (comp: Doc<"payrollComponents">) => {
    try {
      await updateComponent({
        id: comp._id,
        isActive: !comp.isActive,
      });
      toast.success(
        !comp.isActive ? "Komponen diaktifkan" : "Komponen dinonaktifkan",
      );
    } catch {
      toast.error("Gagal memperbarui status");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteComponent({ id: confirmDelete._id });
      toast.success("Komponen dihapus");
      setConfirmDelete(null);
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const renderRow = (c: Doc<"payrollComponents">) => (
    <TableRow key={c._id} className={!c.isActive ? "opacity-60" : ""}>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {c.code}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-normal">
          {c.calculation === "percent_of_basic"
            ? "% dari gaji pokok"
            : "Nominal"}
        </Badge>
      </TableCell>
      <TableCell className="font-medium tabular-nums">
        {c.calculation === "percent_of_basic"
          ? `${c.defaultAmount}%`
          : formatIDR(c.defaultAmount)}
      </TableCell>
      <TableCell>
        {c.type === "earning" && c.isTaxable ? (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
          >
            Kena pajak
          </Badge>
        ) : null}
      </TableCell>
      <TableCell>
        {c.isActive ? (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
          >
            Aktif
          </Badge>
        ) : (
          <Badge variant="secondary">Nonaktif</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => handleToggleActive(c)}
            title={c.isActive ? "Nonaktifkan" : "Aktifkan"}
          >
            <Power className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setEditing(c);
              setFormOpen(true);
            }}
            title="Edit"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setConfirmDelete(c)}
            title="Hapus"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Komponen Gaji</h2>
          <p className="text-sm text-muted-foreground">
            Definisikan komponen penerimaan dan potongan yang membentuk slip gaji.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="cursor-pointer"
        >
          <Plus className="size-4" />
          Tambah Komponen
        </Button>
      </div>

      {components === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : components.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Coins />
            </EmptyMedia>
            <EmptyTitle>Belum ada komponen</EmptyTitle>
            <EmptyDescription>
              Mulai dengan menambahkan komponen Gaji Pokok (kode BASIC), lalu
              tunjangan dan potongan lainnya.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Tambah Komponen
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Penerimaan</CardTitle>
            </CardHeader>
            <CardContent>
              {earnings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada komponen penerimaan.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Komponen</TableHead>
                      <TableHead>Perhitungan</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Pajak</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{earnings.map(renderRow)}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Potongan</CardTitle>
            </CardHeader>
            <CardContent>
              {deductions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada komponen potongan.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Komponen</TableHead>
                      <TableHead>Perhitungan</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Pajak</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{deductions.map(renderRow)}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ComponentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        component={editing}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus komponen?</AlertDialogTitle>
            <AlertDialogDescription>
              Komponen "{confirmDelete?.name}" beserta semua overridenya akan
              dihapus permanen. Slip gaji yang sudah diterbitkan tidak akan
              terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
