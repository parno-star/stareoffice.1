import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Ban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
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
  generateInvoicePdf,
  generateReceiptPdf,
  type InvoiceBankInfo,
} from "@/lib/invoice-pdf.ts";

type EffectiveStatus = "issued" | "paid" | "cancelled" | "overdue";

const STATUS_META: Record<
  EffectiveStatus,
  { label: string; className: string }
> = {
  issued: {
    label: "Belum Dibayar",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  paid: {
    label: "Lunas",
    className:
      "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  },
  overdue: {
    label: "Jatuh Tempo",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-muted text-muted-foreground",
  },
};

const CYCLE_LABELS: Record<number, string> = {
  1: "1 bulan",
  3: "3 bulan",
  6: "6 bulan",
  12: "12 bulan",
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InvoicesTab() {
  const invoices = useQuery(api.invoices.listInvoices, {});
  const summary = useQuery(api.invoices.getInvoiceSummary, {});
  const bankAccounts = useQuery(api.paymentSettings.listActiveBankAccounts, {});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EffectiveStatus>(
    "all",
  );
  const [issueOpen, setIssueOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.effectiveStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        inv.orgName.toLowerCase().includes(q) ||
        inv.number.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  return (
    <div className="space-y-6 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Belum Dibayar"
          value={summary?.unpaid}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
        />
        <SummaryCard
          label="Jatuh Tempo"
          value={summary?.overdue}
          icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        />
        <SummaryCard
          label="Lunas"
          value={summary?.paid}
          icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
        />
        <SummaryCard
          label="Tagihan Beredar"
          value={
            summary ? formatRupiah(summary.outstandingAmount) : undefined
          }
          icon={<FileText className="w-4 h-4 text-primary" />}
          isText
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-primary" />
            Daftar Faktur
          </CardTitle>
          <Button
            className="cursor-pointer gap-1.5"
            onClick={() => setIssueOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Terbitkan Faktur
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari organisasi atau nomor faktur..."
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "all" | EffectiveStatus)
              }
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="issued">Belum Dibayar</SelectItem>
                <SelectItem value="overdue">Jatuh Tempo</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {invoices === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>Belum ada faktur</EmptyTitle>
                <EmptyDescription>
                  {invoices.length === 0
                    ? "Terbitkan faktur pertama untuk sebuah organisasi."
                    : "Tidak ada faktur yang cocok dengan pencarian atau filter."}
                </EmptyDescription>
              </EmptyHeader>
              {invoices.length === 0 && (
                <EmptyContent>
                  <Button
                    size="sm"
                    className="cursor-pointer gap-1.5"
                    onClick={() => setIssueOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Terbitkan Faktur
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="space-y-2">
              {filtered.map((inv) => (
                <InvoiceRowItem
                  key={inv._id}
                  invoice={inv}
                  bankAccounts={bankAccounts ?? []}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IssueInvoiceDialog open={issueOpen} onOpenChange={setIssueOpen} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  isText,
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ReactNode;
  isText?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          {icon}
        </div>
        {value === undefined ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <p
            className={
              isText
                ? "mt-1 text-lg font-bold text-foreground"
                : "mt-1 text-2xl font-bold text-foreground"
            }
          >
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type InvoiceItem = {
  _id: Id<"invoices">;
  orgName: string;
  number: string;
  planName: string | null;
  cycleMonths: number;
  amount: number;
  amountLabel: string | null;
  description: string | null;
  issuedAt: string;
  dueDate: string;
  effectiveStatus: EffectiveStatus;
  paidAt: string | null;
  receiptNumber: string | null;
};

function InvoiceRowItem({
  invoice,
  bankAccounts,
}: {
  invoice: InvoiceItem;
  bankAccounts: InvoiceBankInfo[];
}) {
  const cancelInvoice = useMutation(api.invoices.cancelInvoice);
  const markPaid = useMutation(api.invoices.markInvoicePaidManually);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [busy, setBusy] = useState(false);

  const meta = STATUS_META[invoice.effectiveStatus];
  const canCancel =
    invoice.effectiveStatus === "issued" ||
    invoice.effectiveStatus === "overdue";
  const canMarkPaid = canCancel;
  const isPaid = invoice.effectiveStatus === "paid";

  function downloadInvoice() {
    generateInvoicePdf(
      {
        number: invoice.number,
        orgName: invoice.orgName,
        planName: invoice.planName,
        cycleMonths: invoice.cycleMonths,
        amount: invoice.amount,
        amountLabel: invoice.amountLabel,
        description: invoice.description,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        status: invoice.effectiveStatus,
        paidAt: invoice.paidAt,
        receiptNumber: invoice.receiptNumber,
      },
      bankAccounts,
    );
  }

  function downloadReceipt() {
    generateReceiptPdf({
      number: invoice.number,
      orgName: invoice.orgName,
      planName: invoice.planName,
      cycleMonths: invoice.cycleMonths,
      amount: invoice.amount,
      amountLabel: invoice.amountLabel,
      description: invoice.description,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      status: invoice.effectiveStatus,
      paidAt: invoice.paidAt,
      receiptNumber: invoice.receiptNumber,
    });
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelInvoice({ invoiceId: invoice._id });
      toast.success("Faktur dibatalkan");
      setConfirmCancel(false);
    } catch (error) {
      toast.error(extractError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    setBusy(true);
    try {
      await markPaid({ invoiceId: invoice._id });
      toast.success("Faktur ditandai lunas");
      setConfirmPaid(false);
    } catch (error) {
      toast.error(extractError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">
            {invoice.number}
          </span>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">
          {invoice.orgName}
        </p>
        <p className="text-xs text-muted-foreground">
          {invoice.planName ?? "Tanpa paket"} &middot;{" "}
          {CYCLE_LABELS[invoice.cycleMonths] ?? `${invoice.cycleMonths} bulan`}{" "}
          &middot; Jatuh tempo {formatDate(invoice.dueDate)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-sm font-bold text-foreground">
          {invoice.amountLabel ?? formatRupiah(invoice.amount)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={downloadInvoice}
            >
              <Download className="mr-2 h-4 w-4" />
              Unduh Faktur (PDF)
            </DropdownMenuItem>
            {isPaid && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={downloadReceipt}
              >
                <ReceiptText className="mr-2 h-4 w-4" />
                Unduh Bukti Pelunasan
              </DropdownMenuItem>
            )}
            {canMarkPaid && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setConfirmPaid(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Tandai Lunas
              </DropdownMenuItem>
            )}
            {canCancel && (
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={() => setConfirmCancel(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Batalkan
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan faktur ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Faktur {invoice.number} untuk {invoice.orgName} akan ditandai
              dibatalkan. Tindakan ini tidak dapat diurungkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={busy}>
              Kembali
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-red-600 hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleCancel();
              }}
            >
              Ya, batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPaid} onOpenChange={setConfirmPaid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai faktur lunas?</AlertDialogTitle>
            <AlertDialogDescription>
              Gunakan ini bila pembayaran diterima di luar sistem. Faktur{" "}
              {invoice.number} akan ditandai lunas tanpa memperpanjang masa
              langganan secara otomatis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={busy}>
              Kembali
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleMarkPaid();
              }}
            >
              Ya, tandai lunas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IssueInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const orgs = useQuery(api.organizations.listAll, { includeInactive: true });
  const plans = useQuery(api.membership.listActive, {});
  const issueInvoice = useMutation(api.invoices.issueInvoice);

  const [organizationId, setOrganizationId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("current");
  const [cycleMonths, setCycleMonths] = useState<string>("1");
  const [amountText, setAmountText] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>(defaultDueDate());
  const [description, setDescription] = useState<string>("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOrganizationId("");
    setPlanId("current");
    setCycleMonths("1");
    setAmountText("");
    setDueDate(defaultDueDate());
    setDescription("");
  }

  const amount = Number(amountText.replace(/[^\d]/g, "")) || 0;

  async function handleSubmit() {
    if (!organizationId) {
      toast.error("Pilih organisasi terlebih dahulu");
      return;
    }
    if (amount <= 0) {
      toast.error("Masukkan nominal yang valid");
      return;
    }
    setBusy(true);
    try {
      await issueInvoice({
        organizationId: organizationId as Id<"organizations">,
        membershipPlanId:
          planId === "current"
            ? undefined
            : (planId as Id<"membershipPlans">),
        cycleMonths: Number(cycleMonths) as 1 | 3 | 6 | 12,
        amount,
        description: description.trim() || undefined,
        dueDate: new Date(dueDate).toISOString(),
      });
      toast.success("Faktur berhasil diterbitkan");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(extractError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Terbitkan Faktur</DialogTitle>
          <DialogDescription>
            Buat faktur langganan untuk sebuah organisasi. Nomor faktur dibuat
            otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Organisasi</Label>
            <Select value={organizationId} onValueChange={setOrganizationId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih organisasi" />
              </SelectTrigger>
              <SelectContent>
                {orgs === undefined ? (
                  <SelectItem value="loading" disabled>
                    Memuat...
                  </SelectItem>
                ) : (
                  orgs.map((org) => (
                    <SelectItem key={org._id} value={org._id}>
                      {org.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Paket</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Paket saat ini</SelectItem>
                  {(plans ?? []).map((plan) => (
                    <SelectItem key={plan._id} value={plan._id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Periode</Label>
              <Select value={cycleMonths} onValueChange={setCycleMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 bulan</SelectItem>
                  <SelectItem value="3">3 bulan</SelectItem>
                  <SelectItem value="6">6 bulan</SelectItem>
                  <SelectItem value="12">12 bulan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nominal (IDR)</Label>
              <Input
                inputMode="numeric"
                value={
                  amount > 0
                    ? new Intl.NumberFormat("id-ID").format(amount)
                    : ""
                }
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jatuh Tempo</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Keterangan (opsional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Perpanjangan langganan tahunan"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="cursor-pointer"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="cursor-pointer"
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            Terbitkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function extractError(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | undefined;
    return data?.message ?? "Terjadi kesalahan";
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
}
