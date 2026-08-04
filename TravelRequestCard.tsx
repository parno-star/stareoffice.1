import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Check,
  X,
  Trash2,
  MoreVertical,
  CalendarDays,
  MapPin,
  Hotel,
  Wallet,
  Flag,
  Play,
  ExternalLink,
  Send,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { EnrichedTravelRequest } from "@/convex/travel.ts";
import {
  getTransportConfig,
  getStatusConfig,
  formatCurrency,
  formatRange,
} from "../_lib/travel-utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import ReviewTravelDialog from "./ReviewTravelDialog.tsx";
import TravelReportDialog from "./TravelReportDialog.tsx";
import { Link } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

type Props = {
  request: EnrichedTravelRequest;
  isAdmin: boolean;
  canApprove: boolean;
  currentUserId: Id<"users"> | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: Id<"travelRequests">) => void;
};

export default function TravelRequestCard({
  request,
  isAdmin,
  canApprove,
  currentUserId,
  selectable = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const transport = getTransportConfig(request.transportMode);
  const status = getStatusConfig(request.status);
  const TransportIcon = transport.icon;
  const StatusIcon = status.icon;

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject">("approve");
  const [reportOpen, setReportOpen] = useState(false);

  const remove = useMutation(api.travel.remove);
  const cancel = useMutation(api.travel.cancel);
  const submitDraft = useMutation(api.travel.submitDraft);
  const markInProgress = useMutation(api.travel.markInProgress);

  const isOwner = request.userId === currentUserId;

  const canDelete =
    isAdmin ||
    (isOwner &&
      (request.status === "draft" || request.status === "cancelled"));
  const canCancel =
    isOwner &&
    request.status !== "completed" &&
    request.status !== "cancelled" &&
    request.status !== "rejected";
  const canSubmitDraft = isOwner && request.status === "draft";
  const canMarkInProgress =
    (isOwner || isAdmin) && request.status === "approved";
  const canSubmitReport =
    isOwner &&
    (request.status === "approved" || request.status === "in_progress");

  const handleAction = async (
    fn: () => Promise<unknown>,
    okMessage: string,
  ) => {
    try {
      await fn();
      toast.success(okMessage);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memproses");
      } else {
        toast.error("Gagal memproses");
      }
    }
  };

  return (
    <>
      <Card className={`overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {selectable ? (
                <div className="pt-2.5">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect?.(request._id)}
                    aria-label="Pilih pengajuan"
                    className="cursor-pointer"
                  />
                </div>
              ) : null}
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${transport.iconBg}`}
              >
                <TransportIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <Link
                  to={`/travel/${request._id}`}
                  className="group inline-flex items-center gap-1.5 text-base font-semibold hover:underline"
                >
                  <span className="truncate">{request.title}</span>
                  <ExternalLink className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  <span className="truncate">{request.destination}</span>
                  <span>·</span>
                  <CalendarDays className="size-3.5" />
                  <span>{formatRange(request.startDate, request.endDate)}</span>
                  <span>·</span>
                  <span>{request.dayCount} hari</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${status.badge} gap-1`}>
                <StatusIcon className="size-3" />
                {status.label}
              </Badge>
              {canDelete || canCancel ? (
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
                    {canCancel ? (
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction(
                            () => cancel({ id: request._id }),
                            "Perjalanan dibatalkan",
                          )
                        }
                        className="cursor-pointer"
                      >
                        <X className="size-4" />
                        Batalkan
                      </DropdownMenuItem>
                    ) : null}
                    {canDelete ? (
                      <>
                        {canCancel ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem
                          onClick={() =>
                            handleAction(
                              () => remove({ id: request._id }),
                              "Pengajuan dihapus",
                            )
                          }
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Hapus
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {request.purpose}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-md border bg-muted/40 p-2">
              <p className="text-muted-foreground">Transport</p>
              <p className="mt-0.5 font-medium">{transport.label}</p>
            </div>
            <div className="rounded-md border bg-muted/40 p-2">
              <p className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="size-3" /> Estimasi
              </p>
              <p className="mt-0.5 font-medium">
                {formatCurrency(request.estimatedCost, request.currency ?? "IDR")}
              </p>
            </div>
            {request.accommodation ? (
              <div className="rounded-md border bg-muted/40 p-2">
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Hotel className="size-3" /> Akomodasi
                </p>
                <p className="mt-0.5 truncate font-medium">
                  {request.accommodation}
                </p>
              </div>
            ) : null}
            {request.actualCost !== undefined ? (
              <div className="rounded-md border bg-violet-500/5 p-2">
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Flag className="size-3" /> Biaya Aktual
                </p>
                <p className="mt-0.5 font-medium">
                  {formatCurrency(request.actualCost, request.currency ?? "IDR")}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarImage src={request.userAvatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(request.userName)}
                </AvatarFallback>
              </Avatar>
              <div className="text-xs">
                <p className="font-medium">{request.userName}</p>
                {request.userDepartment ? (
                  <p className="text-muted-foreground">
                    {request.userDepartment}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canApprove ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setReviewMode("reject");
                      setReviewOpen(true);
                    }}
                    className="gap-1 cursor-pointer"
                  >
                    <X className="size-4" />
                    Tolak
                  </Button>
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
                </>
              ) : null}
              {canSubmitDraft ? (
                <Button
                  size="sm"
                  onClick={() =>
                    handleAction(
                      () => submitDraft({ id: request._id }),
                      "Pengajuan dikirim untuk persetujuan",
                    )
                  }
                  className="gap-1 cursor-pointer"
                >
                  <Send className="size-4" />
                  Kirim
                </Button>
              ) : null}
              {canMarkInProgress ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    handleAction(
                      () => markInProgress({ id: request._id }),
                      "Perjalanan ditandai sedang berjalan",
                    )
                  }
                  className="gap-1 cursor-pointer"
                >
                  <Play className="size-4" />
                  Mulai
                </Button>
              ) : null}
              {canSubmitReport ? (
                <Button
                  size="sm"
                  onClick={() => setReportOpen(true)}
                  className="gap-1 cursor-pointer"
                >
                  <Flag className="size-4" />
                  Laporan
                </Button>
              ) : null}
            </div>
          </div>

          {request.status === "rejected" && request.rejectionReason ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
              <p className="font-semibold text-destructive">Alasan ditolak</p>
              <p className="mt-0.5 text-muted-foreground">
                {request.rejectionReason}
              </p>
            </div>
          ) : null}
          {request.approvalNote && request.status !== "rejected" ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                Catatan penyetuju
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {request.approvalNote}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ReviewTravelDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        requestId={request._id}
        mode={reviewMode}
        title={request.title}
      />
      <TravelReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        requestId={request._id}
        title={request.title}
        estimatedCost={request.estimatedCost}
        currency={request.currency ?? "IDR"}
      />
    </>
  );
}
