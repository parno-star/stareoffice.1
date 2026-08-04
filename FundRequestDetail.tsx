import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  CalendarDays,
  Tag,
  FileText,
  User,
  Building2,
  Send,
  CircleX,
  Check,
  Download,
  Paperclip,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { FundRequestWithDetails } from "@/convex/fundRequests.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  getCategoryConfig,
  getStatusConfig,
  formatCurrency,
  formatDate,
  getRequestTypeConfig,
} from "../_lib/fund-utils.ts";
import ReviewDialog from "./ReviewDialog.tsx";
import DisburseDialog from "./DisburseDialog.tsx";
import AuditTimeline from "../../finance-audit/_components/AuditTimeline.tsx";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const APPROVAL_STATUS_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 className="size-4 text-emerald-500" />,
  rejected: <XCircle className="size-4 text-red-500" />,
  pending: <Clock className="size-4 text-amber-500" />,
  skipped: <Check className="size-4 text-slate-400" />,
  revision: <RotateCcw className="size-4 text-orange-500" />,
};

type Props = {
  request: FundRequestWithDetails | null;
  open: boolean;
  onClose: () => void;
  myUserId: Id<"users"> | null;
  isPrivileged: boolean;
  canDisburse: boolean;
};

export default function FundRequestDetail({
  request: initialRequest,
  open,
  onClose,
  myUserId,
  isPrivileged,
  canDisburse,
}: Props) {
  const submitMutation = useMutation(api.fundRequests.submit);
  const cancelMutation = useMutation(api.fundRequests.cancel);
  const resubmitMutation = useMutation(api.fundRequests.resubmitAfterRevision);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "revise">("approve");
  const [disburseOpen, setDisburseOpen] = useState(false);

  // Always use the latest reactive data from Convex for the currently selected request.
  // Falls back to the initial snapshot passed in while the query is loading.
  const latestRequest = useQuery(
    api.fundRequests.getById,
    initialRequest ? { id: initialRequest._id } : "skip",
  );
  const customCategories = useQuery(api.fundRequests.listCategories, {});
  const request = latestRequest ?? initialRequest;

  if (!request) return null;

  const statusCfg = getStatusConfig(request.status);
  const catCfg = getCategoryConfig(request.category, customCategories ?? []);
  const requestTypeCfg = request.requestType ? getRequestTypeConfig(request.requestType) : null;

  // Parse type-specific data
  const typeSpecificData: Record<string, string> = {};
  if (request.typeSpecificData) {
    try {
      const parsed = JSON.parse(request.typeSpecificData) as Record<string, string>;
      Object.assign(typeSpecificData, parsed);
    } catch {
      // ignore parse errors
    }
  }

  const isMine = request.submitterId === myUserId;
  const canSubmit = isMine && request.status === "draft";
  const canResubmit = isMine && request.status === "revision_needed";
  const canCancel = (isMine || isPrivileged) && ["draft", "in_review", "revision_needed"].includes(request.status);

  // Is current user the active approver?
  const currentApproval = request.approvals.find(
    (a) => a.level === request.currentApprovalLevel && a.status === "pending",
  );
  const isCurrentApprover =
    currentApproval?.approverId === myUserId &&
    (request.status === "in_review" || request.status === "pending");

  const handleSubmit = async () => {
    try {
      await submitMutation({ id: request._id });
      toast.success("Pengajuan berhasil dikirim");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim");
      } else {
        toast.error("Gagal mengirim");
      }
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation({ id: request._id });
      toast.success("Pengajuan dibatalkan");
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal membatalkan");
      } else {
        toast.error("Gagal membatalkan");
      }
    }
  };

  const handleResubmit = async () => {
    try {
      await resubmitMutation({ id: request._id });
      toast.success("Pengajuan berhasil dikirim ulang untuk review");
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengirim ulang");
      } else {
        toast.error("Gagal mengirim ulang");
      }
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-base font-bold leading-snug pr-2">
                {request.title}
              </SheetTitle>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn("size-2 rounded-full", statusCfg.dot)} />
                <span className={cn("text-xs font-medium", statusCfg.color)}>
                  {statusCfg.label}
                </span>
              </div>
            </div>
          </SheetHeader>

          <div className="px-6 py-5 space-y-6">
            {/* Amount highlight */}
            <div className="rounded-xl border bg-primary/5 p-5 text-center">
              <p className="text-xs text-muted-foreground mb-1">Jumlah Dana</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(request.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Dibutuhkan: {formatDate(request.neededBy)}
              </p>
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Tag className="size-3.5 text-muted-foreground shrink-0" />
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium border", catCfg.bg, catCfg.color, catCfg.border)}>
                  {catCfg.label}
                </span>
              </div>
              {requestTypeCfg && (
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium border", requestTypeCfg.bg, requestTypeCfg.color, requestTypeCfg.border)}>
                    {requestTypeCfg.label}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" />
                <span className="text-xs">
                  {request.submittedAt
                    ? formatDate(request.submittedAt)
                    : "Belum diajukan"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-3.5 shrink-0" />
                <span className="text-xs">{request.submitterName ?? "—"}</span>
              </div>
              {request.userDepartment ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="text-xs">{request.userDepartment}</span>
                </div>
              ) : null}
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tujuan / Justifikasi
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.purpose}</p>
            </div>

            {/* Type-specific data */}
            {requestTypeCfg && Object.keys(typeSpecificData).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Detail {requestTypeCfg.label}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {requestTypeCfg.fields.map((f) => {
                    const val = typeSpecificData[f.key];
                    if (!val) return null;
                    let displayVal = val;
                    if (f.options) {
                      const opt = f.options.find((o) => o.value === val);
                      displayVal = opt?.label ?? val;
                    }
                    return (
                      <div key={f.key} className="rounded-lg bg-muted/30 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">{f.label}</p>
                        <p className="font-medium text-xs">{displayVal}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments */}
            {request.attachmentsWithUrl.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="size-3.5" />
                  Dokumen Pendukung ({request.attachmentsWithUrl.length})
                </p>
                <div className="space-y-1.5">
                  {request.attachmentsWithUrl.map((a) => (
                    <div
                      key={a.storageId}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.fileName}</p>
                        {a.label ? (
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {a.label}
                          </Badge>
                        ) : null}
                      </div>
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={a.fileName}
                          className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-primary"
                          aria-label="Unduh dokumen"
                        >
                          <Download className="size-4" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <Separator />

            {/* Approval chain */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Rantai Persetujuan
                </p>
                {request.approvalChainName ? (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Link2 className="size-3" />
                    {request.approvalChainName}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-2">
                {request.approvals.map((approval, idx) => {
                  const isOverdue = approval.slaDeadline && approval.status === "pending" && new Date(approval.slaDeadline) < new Date();
                  return (
                    <div
                      key={approval._id}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3",
                        approval.level === request.currentApprovalLevel &&
                          request.status === "in_review"
                          ? "border-amber-400/50 bg-amber-500/5"
                          : "bg-muted/20",
                      )}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {approval.approverName ?? "—"}
                          </p>
                          <span className="shrink-0">{APPROVAL_STATUS_ICON[approval.status]}</span>
                        </div>
                        {approval.approverJobTitle ? (
                          <p className="text-xs text-muted-foreground">{approval.approverJobTitle}</p>
                        ) : null}
                        {approval.delegatedFromName ? (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <ArrowRight className="size-3" />
                            Delegasi dari {approval.delegatedFromName}
                          </p>
                        ) : null}
                        {approval.note ? (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            &ldquo;{approval.note}&rdquo;
                          </p>
                        ) : null}
                        <div className="flex items-center gap-2 mt-0.5">
                          {approval.actedAt ? (
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(approval.actedAt)}
                            </p>
                          ) : null}
                          {isOverdue ? (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium">
                              <AlertTriangle className="size-3" />
                              Melewati SLA
                            </span>
                          ) : approval.slaDeadline && approval.status === "pending" ? (
                            <span className="text-[10px] text-muted-foreground">
                              Batas: {formatDate(approval.slaDeadline)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px]",
                          approval.status === "approved" && "border-emerald-400/50 text-emerald-600",
                          approval.status === "rejected" && "border-red-400/50 text-red-600",
                          approval.status === "pending" && "border-amber-400/50 text-amber-600",
                          approval.status === "revision" && "border-orange-400/50 text-orange-600",
                        )}
                      >
                        {approval.status === "approved"
                          ? "Disetujui"
                          : approval.status === "rejected"
                          ? "Ditolak"
                          : approval.status === "revision"
                          ? "Minta Revisi"
                          : "Menunggu"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Disbursement info */}
            {request.status === "disbursed" && request.disbursedAt ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Info Pencairan
                  </p>
                  <div className="rounded-lg border bg-teal-500/5 border-teal-400/30 p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tanggal Cair</span>
                      <span className="font-medium">{formatDate(request.disbursedAt)}</span>
                    </div>
                    {request.paymentMethod ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Metode</span>
                        <span className="font-medium capitalize">{request.paymentMethod}</span>
                      </div>
                    ) : null}
                    {request.paymentReference ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ref</span>
                        <span className="font-medium">{request.paymentReference}</span>
                      </div>
                    ) : null}
                    {request.disbursementNote ? (
                      <p className="text-xs text-muted-foreground italic mt-1">{request.disbursementNote}</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {/* Rejection info */}
            {request.status === "rejected" && request.rejectionReason ? (
              <>
                <Separator />
                <div className="rounded-lg border border-red-400/30 bg-red-500/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-600">Alasan Penolakan</p>
                  <p className="text-sm">{request.rejectionReason}</p>
                </div>
              </>
            ) : null}

            {/* Revision info */}
            {request.status === "revision_needed" && request.revisionNote ? (
              <>
                <Separator />
                <div className="rounded-lg border border-orange-400/30 bg-orange-500/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                    <RotateCcw className="size-3.5" />
                    Catatan Revisi
                  </p>
                  <p className="text-sm">{request.revisionNote}</p>
                  {request.revisionRequestedAt ? (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDate(request.revisionRequestedAt)}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {/* Audit Timeline */}
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Riwayat Aktifitas
              </p>
              <AuditTimeline fundRequestId={request._id} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {canSubmit ? (
                <Button size="sm" className="gap-1.5" onClick={handleSubmit}>
                  <Send className="size-4" />
                  Ajukan untuk Persetujuan
                </Button>
              ) : null}
              {canResubmit ? (
                <Button size="sm" className="gap-1.5" onClick={handleResubmit}>
                  <Send className="size-4" />
                  Kirim Ulang Setelah Revisi
                </Button>
              ) : null}
              {isCurrentApprover ? (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setReviewAction("approve"); setReviewOpen(true); }}
                  >
                    <CheckCircle2 className="size-4" />
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={() => { setReviewAction("revise"); setReviewOpen(true); }}
                  >
                    <RotateCcw className="size-4" />
                    Minta Revisi
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => { setReviewAction("reject"); setReviewOpen(true); }}
                  >
                    <XCircle className="size-4" />
                    Tolak
                  </Button>
                </>
              ) : null}
              {canDisburse && request.status === "approved" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => setDisburseOpen(true)}
                >
                  <Banknote className="size-4" />
                  Cairkan Dana
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleCancel}
                >
                  <CircleX className="size-4" />
                  Batalkan
                </Button>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        fundRequestId={request._id}
        title={request.title}
        amount={request.amount}
        action={reviewAction}
      />
      <DisburseDialog
        open={disburseOpen}
        onClose={() => setDisburseOpen(false)}
        fundRequestId={request._id}
        title={request.title}
        amount={request.amount}
      />
    </>
  );
}
