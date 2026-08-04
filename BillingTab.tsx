import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale/id";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Receipt,
  Clock,
  Search,
  AlertTriangle,
  AlertOctagon,
  Wallet,
  Users,
  FlaskConical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import {
  SUBSCRIPTION_STATUS_META,
  formatRupiah,
  cycleLabel,
} from "../_lib/subscription-ui.ts";
import ProofViewer from "./ProofViewer.tsx";

const CYCLE_OPTIONS = [1, 3, 6, 12] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy", { locale: idLocale });
}

// ── Record Payment Dialog ──────────────────────────────────────────────────

function RecordPaymentDialog({
  orgId,
  orgName,
  pricePerUserMonth,
  userCount,
  open,
  onOpenChange,
}: {
  orgId: Id<"organizations">;
  orgName: string;
  pricePerUserMonth: number;
  userCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const recordPayment = useMutation(api.subscriptionBilling.recordPayment);
  const [cycle, setCycle] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  // When true, the amount field follows the automatic calculation. Turns off
  // as soon as the super admin edits the nominal manually.
  const [autoAmount, setAutoAmount] = useState(true);

  const seats = Math.max(userCount, 1);
  const hasPrice = pricePerUserMonth > 0;
  // Automatic bill = price/user/month × active users × billing cycle months.
  const computed = hasPrice ? pricePerUserMonth * seats * cycle : 0;

  // Keep the amount in sync with the automatic calculation until the admin
  // overrides it. Recomputes whenever the cycle changes.
  const effectiveAmount =
    autoAmount && hasPrice
      ? String(computed)
      : amount;

  const handleSubmit = async () => {
    const numeric =
      parseInt(effectiveAmount.replace(/\D/g, ""), 10) || 0;
    if (numeric <= 0) {
      toast.error("Masukkan nominal pembayaran");
      return;
    }
    setSaving(true);
    try {
      await recordPayment({
        organizationId: orgId,
        cycleMonths: cycle as 1 | 3 | 6 | 12,
        amount: numeric,
        reference: reference.trim() || undefined,
      });
      toast.success("Pembayaran dicatat & masa langganan diperpanjang");
      onOpenChange(false);
      setAmount("");
      setReference("");
      setCycle(1);
      setAutoAmount(true);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal mencatat pembayaran";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>{orgName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Siklus pembayaran</Label>
            <Select
              value={String(cycle)}
              onValueChange={(v) => setCycle(Number(v))}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLE_OPTIONS.map((c) => (
                  <SelectItem key={c} value={String(c)}>
                    {cycleLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Automatic bill breakdown */}
          {hasPrice ? (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Wallet className="size-3.5" />
                Tagihan otomatis
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Harga per pengguna / bulan</span>
                <span>{formatRupiah(pricePerUserMonth)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Jumlah pengguna aktif</span>
                <span>{seats}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Durasi</span>
                <span>{cycleLabel(cycle)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
                <span>Total</span>
                <span>{formatRupiah(computed)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                {formatRupiah(pricePerUserMonth)} × {seats} pengguna ×{" "}
                {cycle} bulan
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
              Paket organisasi ini belum punya harga per pengguna, jadi tagihan
              tidak dapat dihitung otomatis. Masukkan nominal secara manual.
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Nominal (Rp)</Label>
              {hasPrice && !autoAmount && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline cursor-pointer"
                  onClick={() => {
                    setAutoAmount(true);
                    setAmount("");
                  }}
                >
                  Pakai perhitungan otomatis
                </button>
              )}
            </div>
            <Input
              inputMode="numeric"
              placeholder="0"
              value={
                effectiveAmount
                  ? new Intl.NumberFormat("id-ID").format(
                      parseInt(effectiveAmount.replace(/\D/g, ""), 10) || 0,
                    )
                  : ""
              }
              onChange={(e) => {
                setAutoAmount(false);
                setAmount(e.target.value);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              {hasPrice
                ? autoAmount
                  ? "Terisi otomatis dari tagihan di atas. Anda bisa mengubahnya bila perlu."
                  : "Nominal diubah manual."
                : "Masukkan nominal pembayaran."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Referensi / catatan (opsional)</Label>
            <Textarea
              placeholder="No. referensi transfer, bank, dll"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Catat Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pending Payments Section ─────────────────────────────────────────────────

function PendingPaymentsSection() {
  const pending = useQuery(api.subscriptionBilling.getPendingPayments, {});
  const verify = useMutation(api.subscriptionBilling.verifyPayment);
  const reject = useMutation(api.subscriptionBilling.rejectPayment);
  const [rejectingId, setRejectingId] =
    useState<Id<"subscriptionPayments"> | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<Id<"subscriptionPayments"> | null>(null);

  if (pending === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (pending.length === 0) return null;

  const handleVerify = async (id: Id<"subscriptionPayments">) => {
    setBusyId(id);
    try {
      await verify({ paymentId: id });
      toast.success("Pembayaran diverifikasi & masa langganan diperpanjang");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal memverifikasi";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setBusyId(rejectingId);
    try {
      await reject({ paymentId: rejectingId, reason: reason.trim() || undefined });
      toast.success("Pengajuan pembayaran ditolak");
      setRejectingId(null);
      setReason("");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menolak";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-amber-600" />
        <h3 className="text-sm font-semibold">
          Menunggu verifikasi ({pending.length})
        </h3>
      </div>
      {pending.map((p) => (
        <Card key={p._id} className="border-amber-200 dark:border-amber-800/40">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.orgName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {cycleLabel(p.cycleMonths)}
                  </Badge>
                  {p.targetPlanId && (
                    <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700">
                      Upgrade{p.targetPlanName ? ` ke ${p.targetPlanName}` : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRupiah(p.amount)} · Dibayar {formatDate(p.paidAt)}
                  {p.submittedByName && ` · oleh ${p.submittedByName}`}
                </p>
                {p.reference && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ref: {p.reference}
                  </p>
                )}
                {(p.senderBankName || p.senderAccountNumber) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pengirim: {p.senderBankName}
                    {p.senderAccountNumber && ` · ${p.senderAccountNumber}`}
                    {p.senderAccountHolder && ` · a.n. ${p.senderAccountHolder}`}
                  </p>
                )}
                {p.destinationBankLabel && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tujuan: {p.destinationBankLabel}
                  </p>
                )}
                {p.proofUrl && (
                  <div className="mt-1">
                    <ProofViewer
                      url={p.proofUrl}
                      contentType={p.proofContentType}
                      title="Bukti pembayaran langganan"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-red-600"
                  disabled={busyId === p._id}
                  onClick={() => {
                    setRejectingId(p._id);
                    setReason("");
                  }}
                >
                  <XCircle className="size-4" />
                  Tolak
                </Button>
                <Button
                  size="sm"
                  className="cursor-pointer"
                  disabled={busyId === p._id}
                  onClick={() => void handleVerify(p._id)}
                >
                  <CheckCircle2 className="size-4" />
                  Verifikasi
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={rejectingId !== null}
        onOpenChange={(o) => !o && setRejectingId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak pengajuan pembayaran</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan (opsional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Alasan penolakan"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setRejectingId(null)}
            >
              Batal
            </Button>
            <Button
              className="cursor-pointer"
              onClick={() => void handleReject()}
              disabled={busyId === rejectingId}
            >
              Tolak Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Simulation controls (super-admin demo data) ───────────────────────────────

function SimulationControls() {
  const status = useQuery(api.subscriptionSeed.getSimulationStatus, {});
  const seed = useMutation(api.subscriptionSeed.seedSimulationData);
  const clear = useMutation(api.subscriptionSeed.clearSimulationData);
  const [busy, setBusy] = useState(false);

  const count = status?.count ?? 0;

  async function handleSeed() {
    setBusy(true);
    try {
      const res = await seed({});
      toast.success(
        `${res.created} organisasi simulasi dibuat. Cek status jatuh tempo di bawah.`,
      );
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Gagal membuat data simulasi");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      const res = await clear({});
      toast.success(`${res.removed} organisasi simulasi dihapus.`);
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Gagal menghapus data simulasi");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 p-4 dark:border-indigo-800/50 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
            <FlaskConical className="size-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              Mode Simulasi Jatuh Tempo
            </p>
            <p className="max-w-xl text-xs text-indigo-700/80 dark:text-indigo-300/70">
              Buat organisasi contoh dengan beragam tanggal jatuh tempo (aktif,
              akan jatuh tempo, menunggak, dan kedaluwarsa) untuk menguji kontrol
              penagihan. Data ini terpisah dari data asli dan bisa dihapus kapan
              saja.
            </p>
            {count > 0 && (
              <p className="pt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {count} organisasi simulasi sedang aktif.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-700"
            disabled={busy}
            onClick={() => void handleSeed()}
          >
            <FlaskConical className="size-4" />
            {count > 0 ? "Buat ulang" : "Buat data simulasi"}
          </Button>
          {count > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => void handleClear()}
            >
              <Trash2 className="size-4" />
              Hapus simulasi
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Billing Tab ─────────────────────────────────────────────────────────

export default function BillingTab() {
  const overview = useQuery(api.subscriptionBilling.getBillingOverview, {});
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [recordFor, setRecordFor] = useState<{
    orgId: Id<"organizations">;
    orgName: string;
    pricePerUserMonth: number;
    userCount: number;
  } | null>(null);

  if (overview === undefined) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // Count orgs by billing status for the alert banner.
  const expiredCount = overview.filter(
    (o) => o.subscription.status === "expired",
  ).length;
  const overdueCount = overview.filter(
    (o) => o.subscription.status === "overdue",
  ).length;
  const dueSoonCount = overview.filter(
    (o) => o.subscription.status === "due_soon",
  ).length;
  const attentionCount = expiredCount + overdueCount + dueSoonCount;

  const filtered = overview
    .filter((o) => o.orgName.toLowerCase().includes(search.toLowerCase().trim()))
    .filter(
      (o) =>
        !attentionOnly ||
        o.subscription.status === "expired" ||
        o.subscription.status === "overdue" ||
        o.subscription.status === "due_soon",
    );

  return (
    <div className="space-y-4 mt-4">
      <SimulationControls />

      {/* Attention summary banner */}
      {attentionCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setAttentionOnly(true)}
            className="text-left rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/40 dark:bg-red-900/20 cursor-pointer transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            <div className="flex items-center gap-2">
              <AlertOctagon className="size-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400">
                Kedaluwarsa (read-only)
              </span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
              {expiredCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setAttentionOnly(true)}
            className="text-left rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800/40 dark:bg-orange-900/20 cursor-pointer transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/30"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                Menunggak (masa tenggang)
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">
              {overdueCount}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setAttentionOnly(true)}
            className="text-left rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20 cursor-pointer transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Akan jatuh tempo (≤ 7 hari)
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
              {dueSoonCount}
            </p>
          </button>
        </div>
      )}

      <PendingPaymentsSection />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari organisasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          variant={attentionOnly ? "default" : "secondary"}
          className="cursor-pointer"
          onClick={() => setAttentionOnly((v) => !v)}
        >
          <AlertTriangle className="size-4" />
          {attentionOnly ? "Tampilkan semua" : "Perlu perhatian"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Tidak ada organisasi</EmptyTitle>
            <EmptyDescription>
              {attentionOnly
                ? "Tidak ada organisasi yang perlu perhatian saat ini."
                : "Coba ubah kata kunci pencarian."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((org) => {
            const meta = SUBSCRIPTION_STATUS_META[org.subscription.status];
            const days = org.subscription.daysUntilDue;
            // Monthly bill = price/user/month × active users.
            const monthlyBill =
              org.pricePerUserMonth > 0
                ? org.pricePerUserMonth * Math.max(org.userCount, 1)
                : 0;
            return (
              <Card
                key={org.orgId}
                className={cn(!org.isActive && "opacity-60")}
              >
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="size-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">
                            {org.orgName}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {org.planName}
                          </Badge>
                          <Badge className={cn("text-[10px]", meta.badgeClass)}>
                            {meta.label}
                          </Badge>
                          {org.pendingPaymentCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] text-amber-600"
                            >
                              {org.pendingPaymentCount} menunggu
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="size-3" />
                            {org.subscription.paidUntil
                              ? `s/d ${formatDate(org.subscription.paidUntil)}`
                              : "Belum ada periode"}
                          </span>
                          {days !== null && (
                            <span
                              className={cn(
                                days < 0 && "text-red-600 font-medium",
                                days >= 0 && days <= 7 && "text-amber-600",
                              )}
                            >
                              {days < 0
                                ? `Terlambat ${Math.abs(days)} hari`
                                : days === 0
                                  ? "Jatuh tempo hari ini"
                                  : `${days} hari lagi`}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {org.userCount} pengguna
                          </span>
                          {monthlyBill > 0 && (
                            <span className="flex items-center gap-1">
                              <Wallet className="size-3" />
                              {formatRupiah(monthlyBill)}/bulan
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="cursor-pointer shrink-0"
                      onClick={() =>
                        setRecordFor({
                          orgId: org.orgId,
                          orgName: org.orgName,
                          pricePerUserMonth: org.pricePerUserMonth,
                          userCount: org.userCount,
                        })
                      }
                    >
                      <Receipt className="size-4" />
                      Catat Bayar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recordFor && (
        <RecordPaymentDialog
          orgId={recordFor.orgId}
          orgName={recordFor.orgName}
          pricePerUserMonth={recordFor.pricePerUserMonth}
          userCount={recordFor.userCount}
          open={recordFor !== null}
          onOpenChange={(o) => !o && setRecordFor(null)}
        />
      )}
    </div>
  );
}
