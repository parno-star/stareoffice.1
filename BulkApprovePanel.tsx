import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import BulkActionBar from "@/components/BulkActionBar.tsx";
import { useBulkSelection } from "@/hooks/use-bulk-selection.ts";
import type { FundRequestWithDetails } from "@/convex/fundRequests.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { formatCurrency } from "../_lib/fund-utils.ts";

export default function BulkApprovePanel({
  requests,
}: {
  requests: Array<FundRequestWithDetails>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const selectableIds = useMemo(
    () => requests.map((r) => r._id),
    [requests],
  );
  const selection = useBulkSelection(selectableIds);

  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-500/5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 cursor-pointer"
      >
        <p className="text-sm">
          <span className="font-semibold">{requests.length} pengajuan</span>{" "}
          menunggu persetujuan Anda
        </p>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-amber-400/30 p-4">
          <BulkActionBar
            allSelected={selection.allSelected}
            onToggleAll={selection.toggleAll}
            selectedCount={selection.count}
            totalCount={selectableIds.length}
            onClear={selection.clear}
          >
            <Button
              size="sm"
              onClick={() => setAction("approve")}
              className="gap-1 cursor-pointer"
            >
              <Check className="size-4" />
              Setujui
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setAction("reject")}
              className="gap-1 cursor-pointer"
            >
              <X className="size-4" />
              Tolak
            </Button>
          </BulkActionBar>

          <div className="space-y-2">
            {requests.map((r) => (
              <label
                key={r._id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3"
              >
                <Checkbox
                  checked={selection.isSelected(r._id)}
                  onCheckedChange={() => selection.toggle(r._id)}
                  aria-label="Pilih pengajuan"
                  className="cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.submitterName ?? "—"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-primary">
                  {formatCurrency(r.amount)}
                </p>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {action ? (
        <BulkReviewDialog
          action={action}
          ids={selection.selectedIds}
          onOpenChange={(v) => {
            if (!v) setAction(null);
          }}
          onDone={selection.clear}
        />
      ) : null}
    </div>
  );
}

function BulkReviewDialog({
  action,
  ids,
  onOpenChange,
  onDone,
}: {
  action: "approve" | "reject";
  ids: Array<Id<"fundRequests">>;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const bulkReview = useMutation(api.fundRequests.bulkReview);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (ids.length === 0) {
      toast.error("Pilih pengajuan terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      const { count } = await bulkReview({
        ids,
        action,
        note: note.trim() ? note.trim() : undefined,
      });
      toast.success(
        `${count} pengajuan ${action === "approve" ? "disetujui" : "ditolak"}`,
      );
      setNote("");
      onOpenChange(false);
      onDone();
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

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "approve"
              ? `Setujui ${ids.length} pengajuan`
              : `Tolak ${ids.length} pengajuan`}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? "Anda akan menyetujui semua pengajuan terpilih untuk level Anda."
              : "Berikan alasan penolakan yang akan dikirim ke pengaju."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="fund-bulk-note">
            Catatan {action === "reject" ? "(disarankan)" : "(opsional)"}
          </Label>
          <Textarea
            id="fund-bulk-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              action === "approve"
                ? "Disetujui."
                : "Jelaskan alasan penolakan..."
            }
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            variant={action === "approve" ? "default" : "destructive"}
            className="cursor-pointer"
          >
            {submitting
              ? "Memproses..."
              : action === "approve"
                ? "Setujui semua"
                : "Tolak semua"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
