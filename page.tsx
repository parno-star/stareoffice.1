import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale/id";
import {
  CalendarClock,
  CreditCard,
  Receipt,
  ShieldAlert,
  CheckCircle2,
  Clock,
  XCircle,
  Puzzle,
  Sparkles,
  Upload,
  FileText,
  X,
  ExternalLink,
  ArrowUpCircle,
  Check,
  UserPlus,
  Users,
  HardDrive,
  Landmark,
  Copy,
  Download,
  ReceiptText,
} from "lucide-react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
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
import { useAuth } from "@/hooks/use-auth.ts";
import { isAdminRole } from "@/convex/roles.ts";
import {
  SUBSCRIPTION_STATUS_META,
  PAYMENT_STATUS_META,
  formatRupiah,
  cycleLabel,
} from "@/pages/membership-dashboard/_lib/subscription-ui.ts";
import { menuLabels } from "@/pages/membership-dashboard/_lib/addons-ui.ts";
import {
  generateInvoicePdf,
  generateReceiptPdf,
  type InvoiceBankInfo,
} from "@/lib/invoice-pdf.ts";

const CYCLE_OPTIONS = [1, 3, 6, 12] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMMM yyyy", { locale: idLocale });
}

/**
 * An in-memory copy of a selected proof file.
 *
 * On some devices (especially mobile), the `File` object returned by an
 * <input type="file"> becomes unreadable a short time after selection (the OS
 * releases the underlying temporary file). Reading it at submit time then
 * yields 0 bytes, producing an empty upload. To avoid this we read the bytes
 * into memory the moment the user picks the file and keep this copy around.
 */
type PreparedProof = {
  bytes: ArrayBuffer;
  type: string;
  name: string;
  size: number;
};

/**
 * Reads a freshly-selected file fully into memory and verifies it is not empty.
 * Must be called synchronously in the file input's change handler so the bytes
 * are captured while the File reference is still valid. Throws a user-friendly
 * Error if the file is empty or cannot be read.
 */
async function prepareProofFile(file: File): Promise<PreparedProof> {
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new Error(
      "File bukti tidak terbaca. Coba pilih ulang filenya dari galeri atau file.",
    );
  }
  if (bytes.byteLength === 0) {
    throw new Error(
      "File bukti kosong atau tidak terbaca. Coba pilih ulang filenya.",
    );
  }
  return {
    bytes,
    type: file.type || "application/octet-stream",
    name: file.name,
    size: bytes.byteLength,
  };
}

/**
 * Uploads an already-prepared (in-memory) proof to Convex storage. Because the
 * bytes were captured at selection time, this can never send a 0-byte upload.
 */
async function uploadPreparedProof(
  proof: PreparedProof,
  generateUploadUrl: () => Promise<string>,
): Promise<string> {
  const blob = new Blob([proof.bytes], { type: proof.type });
  const uploadUrl = await generateUploadUrl();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!res.ok) {
    throw new Error("Gagal mengunggah bukti. Periksa koneksi lalu coba lagi.");
  }
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

// ── Billing Summary (plan + cost breakdown) ──────────────────────────────────

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium",
          emphasis && "text-base font-bold text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function BillingSummary({
  planName,
  pricePerUserMonth,
  userCount,
  cycle,
  paidUntil,
  className,
}: {
  planName: string | null;
  pricePerUserMonth: number;
  userCount: number;
  cycle: number;
  paidUntil: string | null;
  className?: string;
}) {
  const users = Math.max(userCount, 1);
  const total = pricePerUserMonth * users * cycle;
  return (
    <div className={cn("rounded-lg border bg-muted/40 px-4 py-3", className)}>
      <SummaryRow label="Paket" value={planName ?? "—"} />
      <SummaryRow
        label="Harga per pengguna"
        value={`${formatRupiah(pricePerUserMonth)} / bulan`}
      />
      <SummaryRow label="Jumlah pengguna" value={`${users} orang`} />
      <SummaryRow label="Siklus pembayaran" value={cycleLabel(cycle)} />
      <SummaryRow
        label="Masa berlaku saat ini"
        value={paidUntil ? `s/d ${formatDate(paidUntil)}` : "Belum aktif"}
      />
      <div className="my-1 border-t" />
      <SummaryRow
        label="Total tagihan"
        value={formatRupiah(total)}
        emphasis
      />
    </div>
  );
}

// ── Submit Payment Proof Dialog ──────────────────────────────────────────────

function SubmitProofDialog({
  planName,
  pricePerUserMonth,
  userCount,
  paidUntil,
  open,
  onOpenChange,
  invoice,
}: {
  planName: string | null;
  pricePerUserMonth: number;
  userCount: number;
  paidUntil: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: {
    _id: Id<"invoices">;
    number: string;
    amount: number;
    cycleMonths: number;
  } | null;
}) {
  const submit = useMutation(api.subscriptionBilling.submitPaymentProof);
  const generateUploadUrl = useMutation(
    api.subscriptionBilling.generateProofUploadUrl,
  );
  const bankAccounts = useQuery(api.paymentSettings.listActiveBankAccounts, {});
  const [cycle, setCycle] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [file, setFile] = useState<PreparedProof | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [senderBankName, setSenderBankName] = useState("");
  const [senderAccountNumber, setSenderAccountNumber] = useState("");
  const [senderAccountHolder, setSenderAccountHolder] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  // Track which invoice we've pre-seeded so the effect-free seeding below only
  // runs once per invoice/open.
  const [seededInvoiceId, setSeededInvoiceId] = useState<string | null>(null);

  const selectedAccount = (bankAccounts ?? []).find(
    (a) => a._id === bankAccountId,
  );

  const suggested =
    pricePerUserMonth > 0
      ? pricePerUserMonth * Math.max(userCount, 1) * cycle
      : 0;

  // Autofill the transfer amount with the computed total whenever the billing
  // cycle changes, while still letting the admin edit it manually.
  const handleCycleChange = (v: string) => {
    const next = Number(v);
    setCycle(next);
    const total =
      pricePerUserMonth > 0
        ? pricePerUserMonth * Math.max(userCount, 1) * next
        : 0;
    if (total > 0) setAmount(String(total));
  };

  // When paying a specific invoice, lock the cycle/amount to the invoice values.
  if (open && invoice && seededInvoiceId !== invoice._id) {
    setCycle(invoice.cycleMonths);
    setAmount(String(invoice.amount));
    setSeededInvoiceId(invoice._id);
  }
  if (!open && seededInvoiceId !== null) setSeededInvoiceId(null);

  // Seed the amount from the total the first time the dialog opens (no invoice).
  if (open && !invoice && amount === "" && suggested > 0) {
    setAmount(String(suggested));
  }

  const resetForm = () => {
    setAmount("");
    setReference("");
    setCycle(1);
    setFile(null);
    setPaidDate(new Date().toISOString().slice(0, 10));
    setBankAccountId("");
    setSenderBankName("");
    setSenderAccountNumber("");
    setSenderAccountHolder("");
    setTermsAccepted(false);
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success("Disalin");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    // Limit to 10MB to keep uploads fast and within reasonable proof sizes.
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }
    const okTypes = ["image/", "application/pdf"];
    if (!okTypes.some((t) => selected.type.startsWith(t))) {
      toast.error("Unggah gambar atau PDF bukti transfer");
      return;
    }
    // Read the bytes into memory immediately while the File reference is valid.
    try {
      setFile(await prepareProofFile(selected));
    } catch (err) {
      setFile(null);
      toast.error(
        err instanceof Error ? err.message : "File bukti tidak terbaca",
      );
    }
  };

  const amountValid = (parseInt(amount.replace(/\D/g, ""), 10) || 0) > 0;
  const destinationValid = bankAccountId.length > 0;
  const senderValid =
    senderBankName.trim().length > 0 &&
    senderAccountNumber.trim().length > 0 &&
    senderAccountHolder.trim().length > 0;
  const canSubmit =
    amountValid &&
    paidDate.length > 0 &&
    destinationValid &&
    senderValid &&
    termsAccepted &&
    file !== null &&
    !saving;

  const handleSubmit = async () => {
    const numeric = parseInt(amount.replace(/\D/g, ""), 10) || 0;
    if (numeric <= 0) {
      toast.error("Masukkan nominal pembayaran");
      return;
    }
    if (!destinationValid) {
      toast.error("Pilih rekening tujuan transfer");
      return;
    }
    if (!senderValid) {
      toast.error("Lengkapi data rekening pengirim");
      return;
    }
    if (!termsAccepted) {
      toast.error("Setujui syarat & ketentuan pembayaran");
      return;
    }
    if (!file) {
      toast.error("Unggah bukti transfer terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      // 1) Upload the proof file to Convex storage, 2) submit with its id.
      const storageId = await uploadPreparedProof(file, () =>
        generateUploadUrl({}),
      );

      await submit({
        cycleMonths: cycle as 1 | 3 | 6 | 12,
        amount: numeric,
        reference: reference.trim() || undefined,
        proofStorageId: storageId as Id<"_storage">,
        paidAt: new Date(paidDate).toISOString(),
        invoiceId: invoice?._id,
        bankAccountId: bankAccountId as Id<"bankAccounts">,
        senderBankName: senderBankName.trim(),
        senderAccountNumber: senderAccountNumber.trim(),
        senderAccountHolder: senderAccountHolder.trim(),
        termsAccepted,
      });
      toast.success("Bukti pembayaran diajukan. Menunggu verifikasi admin.");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : error instanceof Error
            ? error.message
            : "Gagal mengajukan pembayaran";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajukan Bukti Pembayaran</DialogTitle>
          <DialogDescription>
            Setelah transfer, isi detail dan unggah bukti transfer. Admin akan
            memverifikasi dan memperpanjang masa langganan Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {invoice && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <Receipt className="size-4 shrink-0 mt-0.5 text-primary" />
              <span>
                Membayar faktur{" "}
                <span className="font-semibold">{invoice.number}</span> senilai{" "}
                <span className="font-semibold">
                  {formatRupiah(invoice.amount)}
                </span>
                . Nominal dan siklus telah disesuaikan dengan faktur.
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Siklus pembayaran</Label>
            <Select
              value={String(cycle)}
              onValueChange={handleCycleChange}
              disabled={invoice != null}
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

          {/* Confirm plan & cost before submitting */}
          <BillingSummary
            planName={planName}
            pricePerUserMonth={pricePerUserMonth}
            userCount={userCount}
            cycle={cycle}
            paidUntil={paidUntil}
          />

          <div className="space-y-1.5">
            <Label>Nominal ditransfer (Rp)</Label>
            <Input
              inputMode="numeric"
              placeholder="0"
              value={
                amount
                  ? new Intl.NumberFormat("id-ID").format(
                      parseInt(amount.replace(/\D/g, ""), 10) || 0,
                    )
                  : ""
              }
              onChange={(e) => setAmount(e.target.value)}
            />
            {suggested > 0 && (
              <p className="text-xs text-muted-foreground">
                Terisi otomatis dari total tagihan. Anda dapat mengubahnya bila
                nominal transfer berbeda.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal transfer</Label>
            <Input
              type="date"
              value={paidDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPaidDate(e.target.value)}
              className="cursor-pointer"
            />
          </div>

          {/* Destination account selection */}
          <div className="space-y-1.5">
            <Label>
              Rekening tujuan transfer <span className="text-red-600">*</span>
            </Label>
            {bankAccounts === undefined ? (
              <Skeleton className="h-10 w-full" />
            ) : bankAccounts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Belum ada rekening tujuan. Hubungi super admin untuk mengatur
                rekening pembayaran terlebih dahulu.
              </p>
            ) : (
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih rekening tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.bankName} - {a.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedAccount && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Landmark className="size-4 text-primary" />
                  {selectedAccount.bankName}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">No. rekening</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {selectedAccount.accountNumber}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={() => handleCopy(selectedAccount.accountNumber)}
                      aria-label="Salin nomor rekening"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Atas nama</span>
                  <span className="font-medium">
                    {selectedAccount.accountHolder}
                  </span>
                </div>
                {selectedAccount.instructions && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {selectedAccount.instructions}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sender (payer) account details */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Data rekening pengirim</p>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Nama bank pengirim <span className="text-red-600">*</span>
              </Label>
              <Input
                placeholder="Contoh: BCA"
                value={senderBankName}
                onChange={(e) => setSenderBankName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                No. rekening pengirim <span className="text-red-600">*</span>
              </Label>
              <Input
                inputMode="numeric"
                placeholder="Contoh: 1234567890"
                value={senderAccountNumber}
                onChange={(e) => setSenderAccountNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Nama pemilik rekening pengirim{" "}
                <span className="text-red-600">*</span>
              </Label>
              <Input
                placeholder="Contoh: Budi Santoso"
                value={senderAccountHolder}
                onChange={(e) => setSenderAccountHolder(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bukti transfer (gambar / PDF)</Label>
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="truncate text-sm">{file.name}</span>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                  onClick={() => setFile(null)}
                  aria-label="Hapus file"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center transition-colors hover:bg-muted/40">
                <Upload className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Klik untuk mengunggah bukti
                </span>
                <span className="text-xs text-muted-foreground">
                  Gambar atau PDF, maksimal 10MB
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Referensi transfer (opsional)</Label>
            <Textarea
              placeholder="No. referensi, bank pengirim, dll"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={2}
            />
          </div>

          {/* Terms & conditions */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium">
              Syarat &amp; Ketentuan Pembayaran
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                Pembayaran yang sudah dikirim tidak dapat dibatalkan maupun
                dikembalikan (non-refundable).
              </li>
              <li>
                Masa langganan baru diperpanjang setelah bukti transfer
                diverifikasi super admin.
              </li>
              <li>
                Pastikan nominal transfer sama persis dengan total yang tertera
                agar verifikasi tidak tertunda.
              </li>
              <li>
                Data rekening pengirim dan bukti transfer yang Anda kirim benar
                dan dapat dipertanggungjawabkan.
              </li>
              <li>Proses verifikasi dilakukan pada hari kerja.</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-2 pt-1">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs">
                Saya telah membaca dan menyetujui syarat &amp; ketentuan
                pembayaran di atas.
              </span>
            </label>
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
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {saving ? "Mengirim..." : "Ajukan Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Upgrade Plan Dialog (pick plan + submit payment; awaits verification) ─────

function UpgradePlanDialog({
  currentPlanId,
  userCount,
  paidUntil,
  open,
  onOpenChange,
}: {
  currentPlanId: Id<"membershipPlans"> | null;
  userCount: number;
  paidUntil: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const plans = useQuery(api.membership.listActive, {});
  const submit = useMutation(api.subscriptionBilling.submitPaymentProof);
  const generateUploadUrl = useMutation(
    api.subscriptionBilling.generateProofUploadUrl,
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [cycle, setCycle] = useState<number>(1);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [file, setFile] = useState<PreparedProof | null>(null);
  const [saving, setSaving] = useState(false);

  // Offer only active, paid plans the org is not already on. Free (price 0)
  // and custom (price -1) plans can't be self-purchased here.
  const selectablePlans = (plans ?? []).filter(
    (p) => p.pricePerUserMonth > 0 && p._id !== currentPlanId,
  );
  const selectedPlan = selectablePlans.find((p) => p._id === selectedPlanId);
  const pricePerUserMonth = selectedPlan?.pricePerUserMonth ?? 0;
  const users = Math.max(userCount, 1);
  const total = pricePerUserMonth * users * cycle;

  // Keep the transfer amount in sync with the computed total until the admin
  // edits it manually.
  if (open && !amountTouched && total > 0 && amount !== String(total)) {
    setAmount(String(total));
  }

  const resetForm = () => {
    setSelectedPlanId("");
    setCycle(1);
    setAmount("");
    setAmountTouched(false);
    setReference("");
    setFile(null);
    setPaidDate(new Date().toISOString().slice(0, 10));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }
    const okTypes = ["image/", "application/pdf"];
    if (!okTypes.some((t) => selected.type.startsWith(t))) {
      toast.error("Unggah gambar atau PDF bukti transfer");
      return;
    }
    try {
      setFile(await prepareProofFile(selected));
    } catch (err) {
      setFile(null);
      toast.error(
        err instanceof Error ? err.message : "File bukti tidak terbaca",
      );
    }
  };

  const amountValid = (parseInt(amount.replace(/\D/g, ""), 10) || 0) > 0;
  const canSubmit =
    selectedPlan !== null &&
    selectedPlan !== undefined &&
    amountValid &&
    file !== null &&
    !saving;

  const handleSubmit = async () => {
    if (!selectedPlan) {
      toast.error("Pilih paket tujuan terlebih dahulu");
      return;
    }
    const numeric = parseInt(amount.replace(/\D/g, ""), 10) || 0;
    if (numeric <= 0) {
      toast.error("Masukkan nominal pembayaran");
      return;
    }
    if (!file) {
      toast.error("Unggah bukti transfer terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const storageId = await uploadPreparedProof(file, () =>
        generateUploadUrl({}),
      );

      await submit({
        targetPlanId: selectedPlan._id,
        cycleMonths: cycle as 1 | 3 | 6 | 12,
        amount: numeric,
        reference: reference.trim() || undefined,
        proofStorageId: storageId as Id<"_storage">,
        paidAt: new Date(paidDate).toISOString(),
      });
      toast.success(
        "Permintaan upgrade diajukan. Paket akan aktif setelah diverifikasi super admin.",
      );
      onOpenChange(false);
      resetForm();
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : error instanceof Error
            ? error.message
            : "Gagal mengajukan upgrade";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Paket</DialogTitle>
          <DialogDescription>
            Pilih paket tujuan, transfer sesuai total, lalu unggah bukti. Paket
            baru aktif setelah diverifikasi super admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Plan selection */}
          <div className="space-y-1.5">
            <Label>Paket tujuan</Label>
            {plans === undefined ? (
              <Skeleton className="h-20 w-full" />
            ) : selectablePlans.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Tidak ada paket lain yang bisa dipilih saat ini. Hubungi admin
                untuk paket khusus.
              </div>
            ) : (
              <div className="space-y-2">
                {selectablePlans.map((plan) => {
                  const active = selectedPlanId === plan._id;
                  return (
                    <button
                      key={plan._id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan._id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer",
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/50",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          active
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {active && (
                          <Check
                            className="size-3 text-primary-foreground"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{plan.name}</span>
                          {plan.isPopular && (
                            <Badge className="text-[10px] bg-accent/15 text-accent border-accent/20">
                              Populer
                            </Badge>
                          )}
                        </div>
                        {plan.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {plan.description}
                          </p>
                        )}
                        <p className="mt-1 text-sm font-medium">
                          {formatRupiah(plan.pricePerUserMonth)} / pengguna /
                          bulan
                        </p>
                        {/* Batas paket (dibaca dari tab Paket) agar konsisten */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" />
                            {plan.maxEmployees === 0
                              ? "Pengguna tanpa batas"
                              : `Hingga ${plan.maxEmployees} pengguna`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <HardDrive className="size-3.5" />
                            {plan.maxStorageMb === 0
                              ? "Penyimpanan tanpa batas"
                              : plan.maxStorageMb >= 1024
                                ? `${Math.round(plan.maxStorageMb / 1024)} GB`
                                : `${plan.maxStorageMb} MB`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedPlan && (
            <>
              <div className="space-y-1.5">
                <Label>Siklus pembayaran</Label>
                <Select
                  value={String(cycle)}
                  onValueChange={(v) => {
                    setCycle(Number(v));
                    setAmountTouched(false);
                  }}
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

              <BillingSummary
                planName={selectedPlan.name}
                pricePerUserMonth={pricePerUserMonth}
                userCount={userCount}
                cycle={cycle}
                paidUntil={paidUntil}
              />

              <div className="space-y-1.5">
                <Label>Nominal ditransfer (Rp)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    amount
                      ? new Intl.NumberFormat("id-ID").format(
                          parseInt(amount.replace(/\D/g, ""), 10) || 0,
                        )
                      : ""
                  }
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setAmountTouched(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Terisi otomatis dari total tagihan. Anda dapat mengubahnya bila
                  nominal transfer berbeda.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal transfer</Label>
                <Input
                  type="date"
                  value={paidDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bukti transfer (gambar / PDF)</Label>
                {file ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-primary" />
                      <span className="truncate text-sm">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                      onClick={() => setFile(null)}
                      aria-label="Hapus file"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center transition-colors hover:bg-muted/40">
                    <Upload className="size-5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Klik untuk mengunggah bukti
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Gambar atau PDF, maksimal 10MB
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Referensi transfer (opsional)</Label>
                <Textarea
                  placeholder="No. referensi, bank pengirim, dll"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
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
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {saving ? "Mengirim..." : "Ajukan Upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Payment History Item ─────────────────────────────────────────────────────

function PaymentStatusIcon({ status }: { status: string }) {
  if (status === "verified")
    return <CheckCircle2 className="size-4 text-green-600" />;
  if (status === "pending") return <Clock className="size-4 text-amber-600" />;
  return <XCircle className="size-4 text-red-600" />;
}

// ── Billing Content ──────────────────────────────────────────────────────────

type InvoiceToPay = {
  _id: Id<"invoices">;
  number: string;
  amount: number;
  cycleMonths: number;
};

type OrgInvoice = {
  _id: Id<"invoices">;
  number: string;
  planName: string | null;
  cycleMonths: number;
  amount: number;
  amountLabel: string | null;
  description: string | null;
  issuedAt: string;
  dueDate: string;
  effectiveStatus: "issued" | "paid" | "cancelled" | "overdue";
  pendingPayment: boolean;
  paidAt: string | null;
  receiptNumber: string | null;
};

const INVOICE_STATUS_META: Record<
  OrgInvoice["effectiveStatus"],
  { label: string; badgeClass: string }
> = {
  issued: {
    label: "Belum Dibayar",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  paid: {
    label: "Lunas",
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  },
  overdue: {
    label: "Jatuh Tempo",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  },
  cancelled: {
    label: "Dibatalkan",
    badgeClass: "bg-muted text-muted-foreground",
  },
};

function InvoicesSection({
  invoices,
  canPay,
  onPay,
  orgName,
  bankAccounts,
}: {
  invoices: OrgInvoice[] | undefined;
  canPay: boolean;
  onPay: (invoice: InvoiceToPay) => void;
  orgName: string;
  bankAccounts: InvoiceBankInfo[];
}) {
  function downloadInvoice(inv: OrgInvoice) {
    generateInvoicePdf(
      {
        number: inv.number,
        orgName,
        planName: inv.planName,
        cycleMonths: inv.cycleMonths,
        amount: inv.amount,
        amountLabel: inv.amountLabel,
        description: inv.description,
        issuedAt: inv.issuedAt,
        dueDate: inv.dueDate,
        status: inv.effectiveStatus,
        paidAt: inv.paidAt,
        receiptNumber: inv.receiptNumber,
      },
      bankAccounts,
    );
  }

  function downloadReceipt(inv: OrgInvoice) {
    generateReceiptPdf({
      number: inv.number,
      orgName,
      planName: inv.planName,
      cycleMonths: inv.cycleMonths,
      amount: inv.amount,
      amountLabel: inv.amountLabel,
      description: inv.description,
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      status: inv.effectiveStatus,
      paidAt: inv.paidAt,
      receiptNumber: inv.receiptNumber,
    });
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <FileText className="size-4" />
        Faktur
      </h3>
      {invoices === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Belum ada faktur</EmptyTitle>
            <EmptyDescription>
              Faktur langganan dari penyedia akan muncul di sini.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const meta = INVOICE_STATUS_META[inv.effectiveStatus];
            const payable =
              inv.effectiveStatus === "issued" ||
              inv.effectiveStatus === "overdue";
            const isPaid = inv.effectiveStatus === "paid";
            return (
              <Card key={inv._id}>
                <CardContent className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {inv.number}
                        </span>
                        <Badge className={cn("text-[10px]", meta.badgeClass)}>
                          {meta.label}
                        </Badge>
                        {inv.pendingPayment && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                            <Clock className="size-3 mr-1" />
                            Menunggu Verifikasi
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inv.planName ?? "Tanpa paket"} ·{" "}
                        {cycleLabel(inv.cycleMonths)} · Jatuh tempo{" "}
                        {formatDate(inv.dueDate)}
                      </p>
                      {inv.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {inv.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-bold">
                        {inv.amountLabel ?? formatRupiah(inv.amount)}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => downloadInvoice(inv)}
                        >
                          <Download className="size-3.5 mr-1" />
                          Faktur
                        </Button>
                        {isPaid && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => downloadReceipt(inv)}
                          >
                            <ReceiptText className="size-3.5 mr-1" />
                            Bukti Pelunasan
                          </Button>
                        )}
                        {canPay && payable && (
                          <Button
                            size="sm"
                            className="cursor-pointer"
                            disabled={inv.pendingPayment}
                            onClick={() =>
                              onPay({
                                _id: inv._id,
                                number: inv.number,
                                amount: inv.amount,
                                cycleMonths: inv.cycleMonths,
                              })
                            }
                          >
                            {inv.pendingPayment ? "Menunggu" : "Bayar"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BillingContent() {
  const { user } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const data = useQuery(api.subscriptionBilling.getMySubscription, {});
  const invoices = useQuery(api.invoices.getMyInvoices, {});
  const bankAccounts = useQuery(api.paymentSettings.listActiveBankAccounts, {});
  const [proofOpen, setProofOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // The invoice the user chose to pay (drives the proof dialog). Null = a
  // generic payment not tied to any invoice.
  const [payingInvoice, setPayingInvoice] = useState<InvoiceToPay | null>(null);

  if (data === undefined || currentUser === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (data === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CreditCard />
          </EmptyMedia>
          <EmptyTitle>Belum ada informasi langganan</EmptyTitle>
          <EmptyDescription>
            Organisasi Anda belum memiliki periode langganan aktif.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const canPay = isAdminRole(currentUser?.role);
  const meta = SUBSCRIPTION_STATUS_META[data.subscription.status];
  const days = data.subscription.daysUntilDue;
  // A pending payment that targets a different plan = an upgrade awaiting review.
  const pendingUpgrade = data.payments.find(
    (p) => p.status === "pending" && p.targetPlanId !== null,
  );

  return (
    <div className="space-y-5">
      {/* Status card */}
      <Card
        className={cn(
          data.subscription.status === "expired" &&
            "border-red-300 dark:border-red-800/50",
          data.subscription.status === "overdue" &&
            "border-orange-300 dark:border-orange-800/50",
        )}
      >
        <CardContent className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{data.orgName}</h2>
                {data.planName && (
                  <Badge variant="secondary">{data.planName}</Badge>
                )}
                <Badge className={cn(meta.badgeClass)}>{meta.label}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="size-4" />
                {data.subscription.paidUntil ? (
                  <span>
                    Berlaku sampai{" "}
                    <span className="font-medium text-foreground">
                      {formatDate(data.subscription.paidUntil)}
                    </span>
                  </span>
                ) : (
                  <span>Belum ada periode langganan aktif</span>
                )}
              </div>
              {days !== null && (
                <p
                  className={cn(
                    "mt-1 text-sm",
                    days < 0 && "text-red-600 font-medium",
                    days >= 0 && days <= 7 && "text-amber-600 font-medium",
                  )}
                >
                  {days < 0
                    ? `Terlambat ${Math.abs(days)} hari`
                    : days === 0
                      ? "Jatuh tempo hari ini"
                      : `${days} hari lagi menuju jatuh tempo`}
                </p>
              )}
            </div>
          </div>

          {/* Read-only warning */}
          {data.subscription.isReadOnly && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>
                {data.isTrial
                  ? "Masa trial telah berakhir. Akses berada dalam mode hanya-baca. Berlangganan untuk memulihkan akses penuh."
                  : "Masa langganan telah berakhir. Akses berada dalam mode hanya-baca. Selesaikan pembayaran untuk memulihkan akses penuh."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan & cost summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="size-4" />
            Ringkasan Paket &amp; Biaya
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BillingSummary
            planName={data.planName}
            pricePerUserMonth={data.pricePerUserMonth}
            userCount={data.userCount}
            cycle={data.subscription.cycleMonths ?? 1}
            paidUntil={data.subscription.paidUntil}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Total tagihan dihitung untuk siklus{" "}
            {cycleLabel(data.subscription.cycleMonths ?? 1)}. Pilih siklus lain
            saat mengajukan pembayaran untuk melihat totalnya.
          </p>

          {/* Pending upgrade awaiting super admin verification */}
          {pendingUpgrade && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
              <Clock className="size-4 shrink-0 mt-0.5" />
              <span>
                Permintaan upgrade ke{" "}
                <span className="font-semibold">
                  {pendingUpgrade.targetPlanName ?? "paket baru"}
                </span>{" "}
                sedang menunggu verifikasi super admin. Paket baru akan aktif
                setelah disetujui.
              </span>
            </div>
          )}

          {canPay && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full cursor-pointer sm:w-auto"
                onClick={() => {
                  setPayingInvoice(null);
                  setProofOpen(true);
                }}
              >
                <Receipt className="size-4" />
                Ajukan Pembayaran
              </Button>
              <Button
                variant="secondary"
                className="w-full cursor-pointer sm:w-auto"
                disabled={pendingUpgrade !== undefined}
                onClick={() => setUpgradeOpen(true)}
              >
                <ArrowUpCircle className="size-4" />
                {pendingUpgrade ? "Upgrade Menunggu Verifikasi" : "Upgrade Paket"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices (faktur) */}
      <InvoicesSection
        invoices={invoices}
        canPay={canPay}
        onPay={(inv) => {
          setPayingInvoice(inv);
          setProofOpen(true);
        }}
        orgName={data.orgName}
        bankAccounts={bankAccounts ?? []}
      />

      {/* Payment history */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Receipt className="size-4" />
          Riwayat Pembayaran
        </h3>
        {data.payments.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>Belum ada pembayaran</EmptyTitle>
              <EmptyDescription>
                Riwayat pembayaran langganan akan muncul di sini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => {
              const pMeta = PAYMENT_STATUS_META[p.status] ?? {
                label: p.status,
                badgeClass: "bg-muted text-muted-foreground",
              };
              return (
                <Card key={p._id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <PaymentStatusIcon status={p.status} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {formatRupiah(p.amount)}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {cycleLabel(p.cycleMonths)}
                            </Badge>
                            {p.targetPlanId && (
                              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700">
                                <ArrowUpCircle className="size-3 mr-1" />
                                Upgrade{p.targetPlanName ? ` ke ${p.targetPlanName}` : ""}
                              </Badge>
                            )}
                            <Badge
                              className={cn("text-[10px]", pMeta.badgeClass)}
                            >
                              {pMeta.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Dibayar {formatDate(p.paidAt)}
                            {p.periodEnd &&
                              p.status === "verified" &&
                              ` · memperpanjang s/d ${formatDate(p.periodEnd)}`}
                          </p>
                          {p.proofUrl && (
                            <a
                              href={p.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                            >
                              <FileText className="size-3" />
                              Lihat bukti transfer
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                          {p.status === "rejected" && p.rejectionReason && (
                            <p className="text-xs text-red-600 mt-0.5">
                              Alasan: {p.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {canPay && (
        <SubmitProofDialog
          planName={data.planName}
          pricePerUserMonth={data.pricePerUserMonth}
          userCount={data.userCount}
          paidUntil={data.subscription.paidUntil}
          open={proofOpen}
          onOpenChange={setProofOpen}
          invoice={payingInvoice}
        />
      )}
      {canPay && (
        <UpgradePlanDialog
          currentPlanId={data.planId}
          userCount={data.userCount}
          paidUntil={data.subscription.paidUntil}
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
        />
      )}
      {/* Extra user seats */}
      <SeatAddonSection canPay={canPay} />
      {/* Feature add-ons */}
      <AddonsSection canPay={canPay} />
      {/* keep user reference to satisfy auth-gated rendering */}
      <span className="sr-only">{user?.profile.name}</span>
    </div>
  );
}

// ── Add-on Purchase Dialog ────────────────────────────────────────────────────

function PurchaseAddonDialog({
  addon,
  open,
  onOpenChange,
}: {
  addon: {
    _id: Id<"featureAddons">;
    name: string;
    price: number;
    priceLabel: string | null;
    menuKeys: string[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useMutation(api.addonBilling.submitAddonPurchase);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  if (open && !seeded) {
    setAmount(addon.price > 0 ? String(addon.price) : "");
    setReference("");
    setSeeded(true);
  }
  if (!open && seeded) setSeeded(false);

  const amountValid = (parseInt(amount.replace(/\D/g, ""), 10) || 0) > 0;

  const handleSubmit = async () => {
    const numeric = parseInt(amount.replace(/\D/g, ""), 10) || 0;
    if (numeric <= 0) {
      toast.error("Masukkan nominal pembayaran");
      return;
    }
    setSaving(true);
    try {
      await submit({
        addonId: addon._id,
        amount: numeric,
        reference: reference.trim() || undefined,
      });
      toast.success("Pengajuan pembelian dikirim. Menunggu verifikasi admin.");
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal mengajukan pembelian";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beli {addon.name}</DialogTitle>
          <DialogDescription>
            Setelah transfer, isi detail di bawah. Admin akan memverifikasi dan
            membuka akses fitur ini untuk organisasi Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-muted-foreground text-xs mb-1">
              Membuka menu berikut:
            </p>
            <p className="font-medium">{menuLabels(addon.menuKeys)}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Nominal ditransfer (Rp)</Label>
            <Input
              inputMode="numeric"
              placeholder="0"
              value={
                amount
                  ? new Intl.NumberFormat("id-ID").format(
                      parseInt(amount.replace(/\D/g, ""), 10) || 0,
                    )
                  : ""
              }
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Harga add-on: {addon.priceLabel ?? formatRupiah(addon.price)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Referensi transfer (opsional)</Label>
            <Textarea
              placeholder="No. referensi, bank pengirim, tanggal transfer, dll"
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
            disabled={saving || !amountValid}
            className="cursor-pointer"
          >
            {saving ? "Mengirim..." : "Ajukan Pembelian"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Seat Add-on (extra user seats) ────────────────────────────────────────────

const SEAT_QUICK_OPTIONS = [5, 10, 25] as const;

function BuySeatsDialog({
  pricePerSeat,
  open,
  onOpenChange,
}: {
  pricePerSeat: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const submit = useMutation(api.seatBilling.submitSeatPurchase);
  const generateUploadUrl = useMutation(api.seatBilling.generateProofUploadUrl);
  const bankAccounts = useQuery(api.paymentSettings.listActiveBankAccounts, {});
  const [seats, setSeats] = useState<number>(5);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [senderBankName, setSenderBankName] = useState("");
  const [senderAccountNumber, setSenderAccountNumber] = useState("");
  const [senderAccountHolder, setSenderAccountHolder] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<PreparedProof | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = pricePerSeat * Math.max(seats, 0);
  const selectedAccount = (bankAccounts ?? []).find(
    (a) => a._id === bankAccountId,
  );

  const seatsValid = Number.isInteger(seats) && seats > 0;
  const senderValid =
    senderBankName.trim().length > 0 &&
    senderAccountNumber.trim().length > 0 &&
    senderAccountHolder.trim().length > 0;
  const destinationValid = bankAccountId.length > 0;
  const canSubmit =
    seatsValid &&
    senderValid &&
    destinationValid &&
    termsAccepted &&
    file !== null &&
    !saving;

  const resetForm = () => {
    setSeats(5);
    setBankAccountId("");
    setSenderBankName("");
    setSenderAccountNumber("");
    setSenderAccountHolder("");
    setReference("");
    setFile(null);
    setTermsAccepted(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }
    const okTypes = ["image/", "application/pdf"];
    if (!okTypes.some((t) => selected.type.startsWith(t))) {
      toast.error("Unggah gambar atau PDF bukti transfer");
      return;
    }
    try {
      setFile(await prepareProofFile(selected));
    } catch (err) {
      setFile(null);
      toast.error(
        err instanceof Error ? err.message : "File bukti tidak terbaca",
      );
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success("Disalin");
  };

  const handleSubmit = async () => {
    if (!seatsValid) {
      toast.error("Masukkan jumlah kursi yang valid");
      return;
    }
    if (!destinationValid) {
      toast.error("Pilih rekening tujuan transfer");
      return;
    }
    if (!senderValid) {
      toast.error("Lengkapi data rekening pengirim");
      return;
    }
    if (!termsAccepted) {
      toast.error("Setujui syarat & ketentuan pembayaran");
      return;
    }
    if (!file) {
      toast.error("Unggah bukti transfer terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const storageId = await uploadPreparedProof(file, () =>
        generateUploadUrl({}),
      );

      await submit({
        seats,
        amount: total,
        reference: reference.trim() || undefined,
        proofStorageId: storageId as Id<"_storage">,
        bankAccountId: bankAccountId as Id<"bankAccounts">,
        senderBankName: senderBankName.trim(),
        senderAccountNumber: senderAccountNumber.trim(),
        senderAccountHolder: senderAccountHolder.trim(),
        termsAccepted,
      });
      toast.success("Pengajuan kursi dikirim. Menunggu verifikasi super admin.");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : error instanceof Error
            ? error.message
            : "Gagal mengajukan pembelian kursi";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Beli Kursi Tambahan</DialogTitle>
          <DialogDescription>
            Tambah kapasitas pengguna tanpa mengganti paket. Transfer ke rekening
            tujuan, isi data pengirim, lalu unggah bukti. Kursi aktif setelah
            diverifikasi super admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jumlah kursi</Label>
            <div className="flex flex-wrap gap-2">
              {SEAT_QUICK_OPTIONS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={seats === n ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setSeats(n)}
                >
                  +{n}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={seats}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setSeats(Number.isNaN(n) ? 0 : n);
              }}
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Harga per kursi</span>
              <span className="font-medium">{formatRupiah(pricePerSeat)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Jumlah kursi</span>
              <span className="font-medium">{Math.max(seats, 0)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5">
              <span className="text-muted-foreground">Total transfer</span>
              <span className="text-base font-bold text-primary">
                {formatRupiah(total)}
              </span>
            </div>
          </div>

          {/* Destination account selection */}
          <div className="space-y-1.5">
            <Label>
              Rekening tujuan transfer <span className="text-red-600">*</span>
            </Label>
            {bankAccounts === undefined ? (
              <Skeleton className="h-10 w-full" />
            ) : bankAccounts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Belum ada rekening tujuan. Hubungi super admin untuk mengatur
                rekening pembayaran terlebih dahulu.
              </p>
            ) : (
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih rekening tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.bankName} - {a.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedAccount && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Landmark className="size-4 text-primary" />
                  {selectedAccount.bankName}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">No. rekening</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {selectedAccount.accountNumber}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={() => handleCopy(selectedAccount.accountNumber)}
                      aria-label="Salin nomor rekening"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Atas nama</span>
                  <span className="font-medium">
                    {selectedAccount.accountHolder}
                  </span>
                </div>
                {selectedAccount.instructions && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {selectedAccount.instructions}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sender (payer) account details */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Data rekening pengirim</p>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Nama bank pengirim <span className="text-red-600">*</span>
              </Label>
              <Input
                placeholder="Contoh: BCA"
                value={senderBankName}
                onChange={(e) => setSenderBankName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                No. rekening pengirim <span className="text-red-600">*</span>
              </Label>
              <Input
                inputMode="numeric"
                placeholder="Contoh: 1234567890"
                value={senderAccountNumber}
                onChange={(e) => setSenderAccountNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Nama pemilik rekening pengirim{" "}
                <span className="text-red-600">*</span>
              </Label>
              <Input
                placeholder="Contoh: Budi Santoso"
                value={senderAccountHolder}
                onChange={(e) => setSenderAccountHolder(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referensi transfer (opsional)</Label>
            <Textarea
              placeholder="No. referensi, tanggal transfer, dll"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Bukti transfer</Label>
            <label
              htmlFor="seat-proof"
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40"
            >
              {file ? (
                <>
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <X
                    className="ml-auto size-4 shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                    }}
                  />
                </>
              ) : (
                <>
                  <Upload className="size-4 shrink-0" />
                  Unggah gambar atau PDF (maks. 10MB)
                </>
              )}
            </label>
            <input
              id="seat-proof"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Terms & conditions */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium">Syarat &amp; Ketentuan Pembayaran</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                Pembayaran yang sudah dikirim tidak dapat dibatalkan maupun
                dikembalikan (non-refundable).
              </li>
              <li>
                Kursi tambahan bersifat permanen dan baru aktif setelah bukti
                transfer diverifikasi super admin.
              </li>
              <li>
                Pastikan nominal transfer sama persis dengan total yang tertera
                agar verifikasi tidak tertunda.
              </li>
              <li>
                Data rekening pengirim dan bukti transfer yang Anda kirim benar
                dan dapat dipertanggungjawabkan.
              </li>
              <li>Proses verifikasi dilakukan pada hari kerja.</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-2 pt-1">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs">
                Saya telah membaca dan menyetujui syarat &amp; ketentuan
                pembayaran di atas.
              </span>
            </label>
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
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {saving ? "Mengirim..." : "Ajukan Pembelian"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeatAddonSection({ canPay }: { canPay: boolean }) {
  const info = useQuery(api.seatBilling.getMySeatInfo, {});
  const [buyOpen, setBuyOpen] = useState(false);

  if (info === undefined) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (info === null) return null;

  // Unlimited plans never need extra seats; the add-on being disabled also
  // hides the section unless the org already has purchased seats to display.
  const isUnlimited = info.planMaxEmployees <= 0;
  if (isUnlimited) return null;
  if (!info.isActive && info.extraSeats === 0 && info.purchases.length === 0) {
    return null;
  }

  const pendingPurchase = info.purchases.find((p) => p.status === "pending");

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <UserPlus className="size-4" />
        Kursi Tambahan (Pengguna)
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Tambah kapasitas pengguna tanpa mengganti paket. Kursi aktif setelah
        pembelian diverifikasi super admin.
      </p>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Terpakai</p>
              <p className="text-lg font-bold">{info.usedSeats}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kapasitas</p>
              <p className="text-lg font-bold">{info.effectiveMax}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kursi tambahan</p>
              <p className="text-lg font-bold text-primary">
                +{info.extraSeats}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            Paket {info.planName ?? ""} memberi {info.planMaxEmployees} kursi
            {info.extraSeats > 0 && ` + ${info.extraSeats} tambahan`}.
          </div>

          {pendingPurchase && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
              <Clock className="mr-1 inline size-3.5" />
              Pengajuan {pendingPurchase.seats} kursi sedang menunggu verifikasi
              super admin.
            </div>
          )}

          {canPay && info.isActive && (
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <span className="text-sm">
                Harga per kursi:{" "}
                <span className="font-semibold">
                  {formatRupiah(info.pricePerSeat)}
                </span>
              </span>
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={!!pendingPurchase}
                onClick={() => setBuyOpen(true)}
              >
                <UserPlus className="size-4" />
                {pendingPurchase ? "Menunggu Verifikasi" : "Beli Kursi"}
              </Button>
            </div>
          )}

          {/* Purchase history (excluding the pending one already shown above) */}
          {info.purchases.length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Riwayat pembelian kursi
              </p>
              {info.purchases.slice(0, 5).map((p) => {
                const meta = PAYMENT_STATUS_META[p.status];
                return (
                  <div
                    key={p._id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span>
                      +{p.seats} kursi ·{" "}
                      {p.amountLabel ?? formatRupiah(p.amount)}
                    </span>
                    {meta && (
                      <Badge className={cn("text-[10px]", meta.badgeClass)}>
                        {meta.label}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {canPay && (
        <BuySeatsDialog
          pricePerSeat={info.pricePerSeat}
          open={buyOpen}
          onOpenChange={setBuyOpen}
        />
      )}
    </div>
  );
}

// ── Add-ons Section ────────────────────────────────────────────────────────────

function AddonsSection({ canPay }: { canPay: boolean }) {
  const catalog = useQuery(api.featureAddons.listActive, {});
  const myAddons = useQuery(api.addonBilling.getMyAddons, {});
  const [buyAddon, setBuyAddon] = useState<{
    _id: Id<"featureAddons">;
    name: string;
    price: number;
    priceLabel: string | null;
    menuKeys: string[];
  } | null>(null);

  if (catalog === undefined || myAddons === undefined) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (catalog.length === 0) return null;

  const activeIds = new Set(myAddons?.activeAddonIds ?? []);
  const pendingIds = new Set(myAddons?.pendingAddonIds ?? []);

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Puzzle className="size-4" />
        Fitur Tambahan (Add-on)
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Buka fitur ekstra tanpa mengganti paket. Setelah pembelian diverifikasi,
        menu langsung aktif untuk organisasi Anda.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.map((addon) => {
          const isActive = activeIds.has(addon._id);
          const isPending = pendingIds.has(addon._id);
          return (
            <Card key={addon._id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{addon.name}</span>
                      {isActive && (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                          <Sparkles className="size-3 mr-1" />
                          Aktif
                        </Badge>
                      )}
                      {!isActive && isPending && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                          <Clock className="size-3 mr-1" />
                          Menunggu
                        </Badge>
                      )}
                    </div>
                    {addon.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {addon.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {menuLabels(addon.menuKeys)}
                    </p>
                    <p className="text-sm font-semibold mt-1.5">
                      {addon.priceLabel ?? formatRupiah(addon.price)}
                    </p>
                  </div>
                  {canPay && !isActive && (
                    <Button
                      size="sm"
                      className="cursor-pointer shrink-0"
                      disabled={isPending}
                      onClick={() =>
                        setBuyAddon({
                          _id: addon._id,
                          name: addon.name,
                          price: addon.price,
                          priceLabel: addon.priceLabel,
                          menuKeys: addon.menuKeys,
                        })
                      }
                    >
                      {isPending ? "Menunggu" : "Beli"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {buyAddon && (
        <PurchaseAddonDialog
          addon={buyAddon}
          open={buyAddon !== null}
          onOpenChange={(o) => !o && setBuyAddon(null)}
        />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <CreditCard className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Langganan &amp; Pembayaran
          </h1>
          <p className="text-sm text-muted-foreground">
            Pantau masa berlaku langganan dan ajukan pembayaran.
          </p>
        </div>
      </div>

      <Authenticated>
        <BillingContent />
      </Authenticated>
      <AuthLoading>
        <Skeleton className="h-40 w-full" />
      </AuthLoading>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>Masuk untuk melihat langganan</EmptyTitle>
            <EmptyDescription>
              Silakan masuk untuk melihat informasi langganan organisasi Anda.
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </Empty>
      </Unauthenticated>
    </div>
  );
}
