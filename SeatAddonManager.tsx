import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  UserPlus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
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
import { formatRupiah } from "../_lib/subscription-ui.ts";
import ProofViewer from "./ProofViewer.tsx";

// ── Seat Add-on Settings (super admin) ───────────────────────────────────────

function SeatAddonSettingsCard() {
  const settings = useQuery(api.seatBilling.getSeatSettings, {});
  const update = useMutation(api.seatBilling.updateSeatSettings);
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the local form from server state once it loads.
  if (settings !== undefined && !seeded) {
    setPrice(String(settings.pricePerSeat));
    setActive(settings.isActive);
    setSeeded(true);
  }

  if (settings === undefined) {
    return <Skeleton className="h-28 w-full" />;
  }

  const handleSave = async () => {
    const numeric = parseInt(price.replace(/\D/g, ""), 10) || 0;
    if (numeric <= 0) {
      toast.error("Masukkan harga per kursi");
      return;
    }
    setSaving(true);
    try {
      await update({ pricePerSeat: numeric, isActive: active });
      toast.success("Pengaturan kursi tambahan disimpan");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menyimpan pengaturan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <UserPlus className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              Kursi Tambahan (Add-on Pengguna)
            </p>
            {settings.isActive ? (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                Aktif
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-muted text-muted-foreground border-border">
                Nonaktif
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Atur harga per kursi dan aktifkan agar organisasi dapat membeli kursi
            pengguna ekstra tanpa mengganti paket.
          </p>
          <p className="mt-1 text-xs font-medium">
            {settings.isActive
              ? `Saat ini aktif · ${formatRupiah(settings.pricePerSeat)} / kursi`
              : "Saat ini nonaktif — organisasi belum melihat opsi ini"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Harga per kursi (Rp)</Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={
                  price
                    ? new Intl.NumberFormat("id-ID").format(
                        parseInt(price.replace(/\D/g, ""), 10) || 0,
                      )
                    : ""
                }
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status penawaran</Label>
              <Select
                value={active ? "on" : "off"}
                onValueChange={(v) => setActive(v === "on")}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Aktif (organisasi bisa membeli)</SelectItem>
                  <SelectItem value="off">Nonaktif (disembunyikan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pending Seat Purchases Section (super admin) ─────────────────────────────

function PendingSeatPurchasesSection() {
  const pending = useQuery(api.seatBilling.getPendingSeatPurchases, {});
  const verify = useMutation(api.seatBilling.verifySeatPurchase);
  const reject = useMutation(api.seatBilling.rejectSeatPurchase);
  const [rejectingId, setRejectingId] =
    useState<Id<"seatPurchases"> | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<Id<"seatPurchases"> | null>(null);

  if (pending === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (pending.length === 0) return null;

  const handleVerify = async (id: Id<"seatPurchases">) => {
    setBusyId(id);
    try {
      await verify({ purchaseId: id });
      toast.success("Kursi tambahan diverifikasi & langsung aktif");
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
      await reject({
        purchaseId: rejectingId,
        reason: reason.trim() || undefined,
      });
      toast.success("Pengajuan kursi ditolak");
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
        <UserPlus className="size-4 text-amber-600" />
        <h3 className="text-sm font-semibold">
          Kursi menunggu verifikasi ({pending.length})
        </h3>
      </div>
      {pending.map((p) => (
        <Card key={p._id} className="border-amber-200 dark:border-amber-800/40">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.orgName}</span>
                  <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700">
                    +{p.seats} kursi
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRupiah(p.amount)}
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
                      title="Bukti transfer kursi"
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
            <DialogTitle>Tolak pengajuan kursi</DialogTitle>
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
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Public wrapper: seat add-on management block for the Add-on tab ──────────

export default function SeatAddonManager() {
  return (
    <div className="space-y-3">
      <PendingSeatPurchasesSection />
      <SeatAddonSettingsCard />
    </div>
  );
}
