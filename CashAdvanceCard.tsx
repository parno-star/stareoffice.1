import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Wallet,
  CalendarDays,
  Check,
  X,
  BadgeDollarSign,
  CheckCheck,
  Trash2,
  MoreVertical,
  Ban,
  Building2,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { CashAdvanceWithUser } from "@/convex/cashAdvances.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  formatCurrency,
  formatExpenseDate,
  getAdvanceStatusConfig,
} from "../_lib/expense-utils.ts";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

type Props = {
  advance: CashAdvanceWithUser;
  isAdmin: boolean;
  currentUserId: Id<"users"> | null;
};

export default function CashAdvanceCard({
  advance,
  isAdmin,
  currentUserId,
}: Props) {
  const statusCfg = getAdvanceStatusConfig(advance.status);
  const review = useMutation(api.cashAdvances.review);
  const disburse = useMutation(api.cashAdvances.disburse);
  const settle = useMutation(api.cashAdvances.settle);
  const cancel = useMutation(api.cashAdvances.cancel);
  const remove = useMutation(api.cashAdvances.remove);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleNote, setSettleNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOwner = advance.userId === currentUserId;

  const runReview = async (mode: "approve" | "reject") => {
    if (mode === "reject" && !reviewNote.trim()) {
      toast.error("Silakan berikan alasan penolakan");
      return;
    }
    setSubmitting(true);
    try {
      await review({
        id: advance._id,
        status: mode === "approve" ? "approved" : "rejected",
        note: reviewNote.trim() || undefined,
      });
      toast.success(mode === "approve" ? "Disetujui" : "Ditolak");
      setReviewOpen(false);
      setReviewNote("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memproses");
      } else {
        toast.error("Gagal memproses");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const runDisburse = async () => {
    try {
      await disburse({ id: advance._id });
      toast.success("Uang muka dicairkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mencairkan");
      } else {
        toast.error("Gagal mencairkan");
      }
    }
  };

  const runSettle = async () => {
    setSubmitting(true);
    try {
      await settle({ id: advance._id, note: settleNote.trim() || undefined });
      toast.success("Uang muka diselesaikan");
      setSettleOpen(false);
      setSettleNote("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyelesaikan");
      } else {
        toast.error("Gagal menyelesaikan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const runCancel = async () => {
    try {
      await cancel({ id: advance._id });
      toast.success("Dibatalkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membatalkan");
      } else {
        toast.error("Gagal membatalkan");
      }
    }
  };

  const runRemove = async () => {
    try {
      await remove({ id: advance._id });
      toast.success("Dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus");
      } else {
        toast.error("Gagal menghapus");
      }
    }
  };

  const canRemove =
    isAdmin || (isOwner && advance.status === "pending");

  const settledAmount = advance.settledAmount ?? advance.relatedExpenseTotal;
  const diff = settledAmount - advance.amount;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">
                    {advance.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={statusCfg.badge}>
                      {statusCfg.label}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      Dibutuhkan {formatExpenseDate(advance.neededBy)}
                    </span>
                    {advance.userDepartment ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" />
                        {advance.userDepartment}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {formatCurrency(advance.amount)}
                    </p>
                    {advance.status === "disbursed" ||
                    advance.status === "settled" ? (
                      <p className="text-xs text-muted-foreground">
                        Terpakai: {formatCurrency(settledAmount)}{" "}
                        {advance.relatedExpenseCount > 0
                          ? `(${advance.relatedExpenseCount} bukti)`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  {canRemove ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="cursor-pointer"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isOwner && advance.status === "pending" ? (
                          <DropdownMenuItem
                            onClick={runCancel}
                            className="cursor-pointer"
                          >
                            <Ban className="size-4" />
                            Batalkan pengajuan
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onClick={runRemove}
                          className="text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {advance.purpose}
              </p>

              {advance.status === "settled" ? (
                <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="font-medium text-foreground">
                    Penyelesaian
                  </p>
                  <p className="mt-1">
                    Terpakai: {formatCurrency(settledAmount)} ·{" "}
                    {diff === 0
                      ? "Sesuai"
                      : diff > 0
                        ? `Selisih lebih Rp ${diff.toLocaleString("id-ID")} (perlu reimburse)`
                        : `Sisa Rp ${Math.abs(diff).toLocaleString("id-ID")} dikembalikan`}
                  </p>
                  {advance.settlementNote ? (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {advance.settlementNote}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    {advance.userAvatar ? (
                      <AvatarImage src={advance.userAvatar} />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(advance.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{advance.userName ?? "Karyawan"}</span>
                </div>
                {advance.reviewerName ? (
                  <span>Reviewer: {advance.reviewerName}</span>
                ) : null}
              </div>

              {advance.reviewNote ? (
                <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">
                    Catatan reviewer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {advance.reviewNote}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {isAdmin && advance.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setReviewMode("approve");
                        setReviewOpen(true);
                      }}
                      className="gap-1 cursor-pointer"
                    >
                      <Check className="size-4" />
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setReviewMode("reject");
                        setReviewOpen(true);
                      }}
                      className="gap-1 cursor-pointer"
                    >
                      <X className="size-4" />
                      Tolak
                    </Button>
                  </>
                ) : null}
                {isAdmin && advance.status === "approved" ? (
                  <Button
                    size="sm"
                    onClick={runDisburse}
                    className="gap-1 cursor-pointer"
                  >
                    <BadgeDollarSign className="size-4" />
                    Cairkan Dana
                  </Button>
                ) : null}
                {(isAdmin || isOwner) && advance.status === "disbursed" ? (
                  <Button
                    size="sm"
                    onClick={() => setSettleOpen(true)}
                    className="gap-1 cursor-pointer"
                  >
                    <CheckCheck className="size-4" />
                    Selesaikan
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={reviewOpen}
        onOpenChange={(v) => {
          if (!submitting) {
            setReviewOpen(v);
            if (!v) setReviewNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewMode === "approve" ? "Setujui Uang Muka" : "Tolak Uang Muka"}
            </DialogTitle>
            <DialogDescription>{`"${advance.title}"`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ca-review-note">
              Catatan {reviewMode === "approve" ? "(opsional)" : ""}
            </Label>
            <Textarea
              id="ca-review-note"
              rows={3}
              placeholder={
                reviewMode === "approve"
                  ? "Catatan untuk pemohon..."
                  : "Jelaskan alasan penolakan..."
              }
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setReviewOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={() => runReview(reviewMode)}
              disabled={submitting}
              variant={reviewMode === "approve" ? "default" : "destructive"}
              className="cursor-pointer"
            >
              {submitting
                ? "Memproses..."
                : reviewMode === "approve"
                  ? "Setujui"
                  : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settleOpen}
        onOpenChange={(v) => {
          if (!submitting) {
            setSettleOpen(v);
            if (!v) setSettleNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selesaikan Uang Muka</DialogTitle>
            <DialogDescription>
              {advance.relatedExpenseCount > 0
                ? `${advance.relatedExpenseCount} pengeluaran terkait senilai ${formatCurrency(advance.relatedExpenseTotal)} akan digunakan sebagai dasar penyelesaian.`
                : "Belum ada pengeluaran yang dikaitkan ke uang muka ini. Anda tetap dapat menyelesaikan secara manual."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ca-settle-note">Catatan (opsional)</Label>
            <Textarea
              id="ca-settle-note"
              rows={3}
              placeholder="Catatan rekonsiliasi, contoh: Sisa Rp 150.000 dikembalikan via transfer."
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
              disabled={submitting}
              maxLength={500}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setSettleOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={runSettle}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? "Memproses..." : "Selesaikan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
