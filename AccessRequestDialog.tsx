import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Building2,
  Loader2,
  LogIn,
  Send,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { DATA_SCOPES, scopeLabels } from "@/convex/dataScopes.ts";

type Props = {
  organizationId: Id<"organizations">;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Consent-first access dialog for super admins. Before a super admin can enter a
 * company's data, that company must approve a time-boxed access request. This
 * dialog shows the current status and lets the vendor request access or (once
 * approved) enter.
 */
export default function AccessRequestDialog({
  organizationId,
  organizationName,
  open,
  onOpenChange,
}: Props) {
  const [reason, setReason] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [entering, setEntering] = useState(false);

  const status = useQuery(
    api.dataAccess.getMyAccessStatus,
    open ? { organizationId } : "skip",
  );
  const requestAccess = useMutation(api.dataAccess.requestAccess);
  const setViewing = useMutation(api.organizations.setViewingOrganization);

  const toggleScope = (id: string) => {
    setScopes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleRequest = async () => {
    if (reason.trim().length < 5) {
      toast.error("Mohon isi alasan akses (minimal 5 karakter).");
      return;
    }
    if (scopes.length === 0) {
      toast.error("Pilih minimal satu kategori data.");
      return;
    }
    setSubmitting(true);
    try {
      await requestAccess({
        organizationId,
        reason: reason.trim(),
        scopes,
      });
      toast.success("Permintaan akses dikirim. Menunggu persetujuan perusahaan.");
      setReason("");
      setScopes([]);
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnter = async () => {
    setEntering(true);
    try {
      await setViewing({ organizationId });
      window.location.reload();
    } catch (err) {
      handleError(err);
      setEntering(false);
    }
  };

  const handleError = (err: unknown) => {
    if (err instanceof ConvexError) {
      const d = err.data as { message?: string };
      toast.error(d.message ?? "Terjadi kesalahan");
    } else {
      toast.error("Terjadi kesalahan, coba lagi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Akses Data Perusahaan
          </DialogTitle>
          <DialogDescription>
            Demi menjaga kerahasiaan data, Anda hanya dapat mengakses data
            perusahaan setelah mendapat izin dari perusahaan tersebut.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <Building2 className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{organizationName}</span>
        </div>

        {status === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : status.active ? (
          <ActiveState
            expiresAt={status.active.expiresAt}
            scopes={status.active.scopes}
            entering={entering}
            onEnter={handleEnter}
            addScopes={scopes}
            toggleScope={toggleScope}
            reason={reason}
            setReason={setReason}
            submitting={submitting}
            onRequest={handleRequest}
            hasPending={status.pending !== null}
            pendingScopes={status.pending?.scopes}
          />
        ) : status.pending ? (
          <PendingState
            requestedAt={status.pending.requestedAt}
            scopes={status.pending.scopes}
          />
        ) : (
          <RequestState
            reason={reason}
            setReason={setReason}
            scopes={scopes}
            toggleScope={toggleScope}
            submitting={submitting}
            onRequest={handleRequest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScopeBadges({ scopes }: { scopes?: string[] }) {
  if (!scopes || scopes.length === 0) return null;
  return (
    <p className="mt-0.5">
      <span className="font-medium">Kategori: </span>
      {scopeLabels(scopes)}
    </p>
  );
}

function ActiveState({
  expiresAt,
  scopes,
  entering,
  onEnter,
  addScopes,
  toggleScope,
  reason,
  setReason,
  submitting,
  onRequest,
  hasPending,
  pendingScopes,
}: {
  expiresAt?: string;
  scopes?: string[];
  entering: boolean;
  onEnter: () => void;
  addScopes: string[];
  toggleScope: (id: string) => void;
  reason: string;
  setReason: (v: string) => void;
  submitting: boolean;
  onRequest: () => void;
  hasPending: boolean;
  pendingScopes?: string[];
}) {
  const grantedSet = new Set(scopes ?? []);
  // Categories the vendor does NOT yet have — the only ones worth requesting.
  const remaining = DATA_SCOPES.filter((s) => !grantedSet.has(s.id));

  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <div className="text-xs">
          <p className="font-semibold">Akses disetujui</p>
          {expiresAt && (
            <p className="mt-0.5 flex items-center gap-1">
              <Clock className="size-3" />
              Berakhir{" "}
              {formatDistanceToNow(new Date(expiresAt), {
                addSuffix: true,
                locale: localeId,
              })}
            </p>
          )}
          <ScopeBadges scopes={scopes} />
        </div>
      </div>

      <DialogFooter className="sm:justify-start">
        <Button onClick={onEnter} disabled={entering} className="cursor-pointer">
          {entering ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          Masuk ke data perusahaan
        </Button>
      </DialogFooter>

      {/* Top-up: request ADDITIONAL categories beyond the ones already granted */}
      {remaining.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <div>
            <p className="text-sm font-medium">Ajukan kategori tambahan</p>
            <p className="text-xs text-muted-foreground">
              Butuh akses ke data lain? Pilih kategori tambahan lalu ajukan.
              Permintaan tetap perlu disetujui perusahaan.
            </p>
          </div>

          {hasPending && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              <p className="text-xs">
                Ada permintaan tambahan yang menunggu persetujuan.
                <ScopeBadges scopes={pendingScopes} />
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {remaining.map((s) => {
              const checked = addScopes.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleScope(s.id)}
                  className={
                    "flex w-full cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors " +
                    (checked ? "border-primary bg-primary/5" : "hover:bg-accent")
                  }
                >
                  <Checkbox checked={checked} className="mt-0.5 cursor-pointer" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Alasan akses tambahan</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Membantu penyelesaian tiket dukungan #123 terkait data surat."
              rows={3}
            />
          </div>

          <Button
            onClick={onRequest}
            disabled={submitting || addScopes.length === 0}
            variant="secondary"
            className="cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Ajukan Kategori Tambahan
          </Button>
        </div>
      )}
    </>
  );
}

function PendingState({
  requestedAt,
  scopes,
}: {
  requestedAt: string;
  scopes?: string[];
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <Clock className="mt-0.5 size-4 shrink-0" />
      <div className="text-xs">
        <p className="font-semibold">Menunggu persetujuan perusahaan</p>
        <p className="mt-0.5">
          Permintaan dikirim{" "}
          {formatDistanceToNow(new Date(requestedAt), {
            addSuffix: true,
            locale: localeId,
          })}
          . Anda akan diberi tahu setelah admin perusahaan menyetujui atau menolak.
        </p>
        <ScopeBadges scopes={scopes} />
      </div>
    </div>
  );
}

function RequestState({
  reason,
  setReason,
  scopes,
  toggleScope,
  submitting,
  onRequest,
}: {
  reason: string;
  setReason: (v: string) => void;
  scopes: string[];
  toggleScope: (id: string) => void;
  submitting: boolean;
  onRequest: () => void;
}) {
  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p className="text-xs">
          Anda belum memiliki izin akses ke data perusahaan ini. Pilih kategori
          data seperlunya dan sebutkan alasan. Semua permintaan dan akses tercatat
          pada jejak audit yang dapat dilihat perusahaan.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Kategori data yang diperlukan</label>
        <div className="space-y-1.5">
          {DATA_SCOPES.map((s) => {
            const checked = scopes.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleScope(s.id)}
                className={
                  "flex w-full cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors " +
                  (checked
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent")
                }
              >
                <Checkbox checked={checked} className="mt-0.5 cursor-pointer" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Alasan akses</label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Contoh: Membantu penyelesaian tiket dukungan #123 terkait data surat."
          rows={3}
        />
      </div>
      <DialogFooter>
        <Button
          onClick={onRequest}
          disabled={submitting}
          className="cursor-pointer"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Ajukan Permintaan Akses
        </Button>
      </DialogFooter>
    </>
  );
}
