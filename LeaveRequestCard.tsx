import {
  Card,
  CardContent,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar, Trash2, User, Briefcase } from "lucide-react";
import LeaveStatusBadge from "./LeaveStatusBadge.tsx";
import { formatLeaveType } from "../_lib/leave-utils.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type EnrichedRequest = Doc<"leaveRequests"> & {
  userName: string;
  userDepartment: string;
  userJobTitle: string;
  reviewerName: string | null;
};

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy", { locale: idLocale });
  } catch {
    return iso;
  }
}

export default function LeaveRequestCard({
  request,
  showUser = false,
  allowCancel = false,
  adminActions,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  request: EnrichedRequest;
  showUser?: boolean;
  allowCancel?: boolean;
  adminActions?: React.ReactNode;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: EnrichedRequest["_id"]) => void;
}) {
  const cancel = useMutation(api.leaveRequests.cancel);
  const [deleting, setDeleting] = useState(false);

  const handleCancel = async () => {
    setDeleting(true);
    try {
      await cancel({ id: request._id });
      toast.success("Pengajuan dibatalkan");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal membatalkan");
      } else {
        toast.error("Gagal membatalkan");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className={selected ? "ring-2 ring-primary" : undefined}>
      <CardContent className="flex gap-3 space-y-0">
        {selectable ? (
          <div className="pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(request._id)}
              aria-label="Pilih pengajuan"
              className="cursor-pointer"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {showUser ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="size-4 text-muted-foreground" />
                {request.userName}
                {request.userJobTitle ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    · {request.userJobTitle}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {formatLeaveType(request.type)}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {request.dayCount} hari
              </span>
            </div>
          </div>
          <LeaveStatusBadge status={request.status} />
        </div>

        <div className="flex items-center gap-2 text-sm text-foreground/90">
          <Calendar className="size-4 text-muted-foreground" />
          <span>
            {formatDate(request.startDate)}
            {request.startDate !== request.endDate
              ? ` – ${formatDate(request.endDate)}`
              : ""}
          </span>
        </div>

        <p className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
          {request.reason}
        </p>

        {request.reviewNote ? (
          <div className="rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Catatan {request.reviewerName ? `dari ${request.reviewerName}` : "peninjau"}
            </p>
            <p className="mt-1 text-foreground/90">{request.reviewNote}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            Diajukan {formatDate(new Date(request._creationTime).toISOString().slice(0, 10))}
          </span>

          <div className="flex items-center gap-2">
            {adminActions}
            {allowCancel && request.status === "pending" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive"
                    disabled={deleting}
                  >
                    <Trash2 className="size-3.5" />
                    Batalkan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Batalkan pengajuan cuti?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini tidak dapat dibatalkan. Pengajuan Anda akan
                      dihapus secara permanen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Tutup</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>
                      Ya, batalkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
