import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import { ROLE_LABELS, normalizeRole } from "@/convex/roles.ts";
import { ROLE_COLORS } from "@/pages/settings/users/_lib/role-ui.ts";
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, ShieldX, Activity,
  UserCog, AlertTriangle, RotateCcw, Loader2,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ---- Status helpers ----------------------------------------------------
function statusBadge(status: string) {
  if (status === "pending")
    return <Badge variant="secondary" className="gap-1"><Clock className="size-3" />Menunggu</Badge>;
  if (status === "approved")
    return <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="size-3" />Disetujui</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive" className="gap-1"><XCircle className="size-3" />Ditolak</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function accountStatusBadge(status: string | undefined) {
  if (!status || status === "active")
    return <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-600 text-[10px]"><ShieldCheck className="size-2.5" />Aktif</Badge>;
  if (status === "pending_approval")
    return <Badge variant="secondary" className="gap-1 text-[10px]"><Clock className="size-2.5" />Pending</Badge>;
  if (status === "suspended")
    return <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="size-2.5" />Suspend</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive" className="gap-1 text-[10px]"><ShieldX className="size-2.5" />Ditolak</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

function userInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ---- Approve/Reject dialog ---------------------------------------------
function ReviewDialog({
  requestId,
  userName,
  requestedRole,
  action,
  onClose,
}: {
  requestId: Id<"roleRequests">;
  userName: string;
  requestedRole: string;
  action: "approve" | "reject";
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const approve = useMutation(api.roleRequests.approveRequest);
  const reject = useMutation(api.roleRequests.rejectRequest);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (action === "approve") {
        const res = await approve({ requestId, reviewNote: note || undefined });
        if (res?.orphaned) {
          toast.info(`Akun ${userName} sudah tidak ada. Permintaan ditutup.`);
        } else {
          toast.success(`Permintaan ${userName} disetujui`);
        }
      } else {
        const res = await reject({ requestId, reviewNote: note || undefined });
        if (res?.orphaned) {
          toast.info(`Akun ${userName} sudah tidak ada. Permintaan ditutup.`);
        } else {
          toast.success(`Permintaan ${userName} ditolak`);
        }
      }
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal memproses");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setLoading(false);
    }
  };

  const isApprove = action === "approve";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={isApprove ? "text-emerald-600" : "text-destructive"}>
            {isApprove ? "Setujui Permintaan" : "Tolak Permintaan"}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Menyetujui permintaan ${userName} sebagai ${ROLE_LABELS[normalizeRole(requestedRole)]}.`
              : `Menolak permintaan ${userName}. Mereka dapat mengajukan ulang.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="review-note">
              Catatan {isApprove ? "(opsional)" : "(disarankan)"}
            </Label>
            <Textarea
              id="review-note"
              placeholder={
                isApprove
                  ? "Selamat bergabung! Akun Anda telah diaktifkan."
                  : "Mohon ajukan kembali dengan peran yang lebih sesuai..."
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant={isApprove ? "default" : "destructive"}
          >
            {loading
              ? <><Loader2 className="mr-2 size-4 animate-spin" />Memproses...</>
              : isApprove ? "Setujui" : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Suspend/Activate dialog ------------------------------------------
function AccountControlDialog({
  targetUserId,
  userName,
  action,
  onClose,
}: {
  targetUserId: Id<"users">;
  userName: string;
  action: "suspend" | "activate";
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const suspend = useMutation(api.roleRequests.suspendUser);
  const activate = useMutation(api.roleRequests.activateUser);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (action === "suspend") {
        await suspend({ targetUserId, reason: reason || undefined });
        toast.success(`Akun ${userName} disuspend`);
      } else {
        await activate({ targetUserId, note: reason || undefined });
        toast.success(`Akun ${userName} diaktifkan kembali`);
      }
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal memproses");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={action === "suspend" ? "text-destructive" : "text-emerald-600"}>
            {action === "suspend" ? `Suspend Akun ${userName}` : `Aktifkan Akun ${userName}`}
          </DialogTitle>
          <DialogDescription>
            {action === "suspend"
              ? "Akun pengguna akan dinonaktifkan dan tidak dapat mengakses sistem."
              : "Akun pengguna akan diaktifkan kembali."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label htmlFor="ctrl-reason">Alasan (opsional)</Label>
          <Textarea
            id="ctrl-reason"
            placeholder={action === "suspend" ? "Alasan suspend akun..." : "Catatan aktivasi akun..."}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant={action === "suspend" ? "destructive" : "default"}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {action === "suspend" ? "Suspend Akun" : "Aktifkan Akun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main component ----------------------------------------------------
export default function ApprovalTab() {
  const [historyFilter, setHistoryFilter] = useState("all");
  const [auditFilter, setAuditFilter] = useState<Id<"users"> | undefined>(undefined);

  const pending = useQuery(api.roleRequests.listPending, {});
  const history = useQuery(api.roleRequests.listAll, { statusFilter: historyFilter });
  const auditLog = useQuery(api.roleRequests.getAuditLog, { targetUserId: auditFilter });

  type ReviewState = { requestId: Id<"roleRequests">; userName: string; requestedRole: string; action: "approve" | "reject" } | null;
  type CtrlState = { targetUserId: Id<"users">; userName: string; action: "suspend" | "activate" } | null;

  const [reviewDialog, setReviewDialog] = useState<ReviewState>(null);
  const [ctrlDialog, setCtrlDialog] = useState<CtrlState>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    requestId: Id<"roleRequests">;
    userName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteRequest = useMutation(api.roleRequests.deleteRequest);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRequest({ requestId: deleteTarget.requestId });
      toast.success(`Riwayat permintaan ${deleteTarget.userName} dihapus`);
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal menghapus");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pending">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="size-3.5" />
            Menunggu Persetujuan
            {pending && pending.length > 0 && (
              <Badge className="ml-1 size-5 items-center justify-center rounded-full p-0 text-[10px]">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Activity className="size-3.5" />
            Riwayat Permintaan
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldCheck className="size-3.5" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ---- PENDING TAB ---- */}
        <TabsContent value="pending" className="space-y-4 pt-4">
          {pending === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <CheckCircle2 className="size-10 text-emerald-500" />
                <p className="font-semibold">Semua permintaan telah diproses</p>
                <p className="text-sm text-muted-foreground">
                  Tidak ada permintaan peran yang menunggu persetujuan.
                </p>
              </CardContent>
            </Card>
          ) : (
            pending.map((req) => (
              <Card key={req._id} className="border-amber-200 bg-amber-50/40 dark:border-amber-400/20 dark:bg-amber-500/5">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* User info */}
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarImage src={req.user?.avatarUrl} />
                        <AvatarFallback>{userInitials(req.user?.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{req.user?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{req.user?.email}</p>
                        {req.user?.department && (
                          <p className="text-xs text-muted-foreground">{req.user.department} {req.user?.jobTitle ? `• ${req.user.jobTitle}` : ""}</p>
                        )}
                      </div>
                    </div>

                    {/* Request details */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Meminta:</span>
                          <Badge
                            variant="outline"
                            className={cn("border text-xs", ROLE_COLORS[normalizeRole(req.requestedRole)])}
                          >
                            {ROLE_LABELS[normalizeRole(req.requestedRole)]}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true, locale: localeId })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5 cursor-pointer"
                        onClick={() =>
                          setReviewDialog({
                            requestId: req._id,
                            userName: req.user?.name ?? "User",
                            requestedRole: req.requestedRole,
                            action: "reject",
                          })
                        }
                      >
                        <XCircle className="size-3.5" />
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                        onClick={() =>
                          setReviewDialog({
                            requestId: req._id,
                            userName: req.user?.name ?? "User",
                            requestedRole: req.requestedRole,
                            action: "approve",
                          })
                        }
                      >
                        <CheckCircle2 className="size-3.5" />
                        Setujui
                      </Button>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="mt-3 rounded-lg bg-background/60 p-3 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Alasan: </span>
                      {req.reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ---- HISTORY TAB ---- */}
        <TabsContent value="history" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Riwayat semua permintaan peran</p>
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="approved">Disetujui</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {history === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Tidak ada riwayat ditemukan.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((req) => (
                <Card key={req._id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={req.user?.avatarUrl} />
                          <AvatarFallback className="text-xs">{userInitials(req.user?.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{req.user?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{req.user?.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className={cn("border text-[10px]", ROLE_COLORS[normalizeRole(req.requestedRole)])}
                        >
                          {ROLE_LABELS[normalizeRole(req.requestedRole)]}
                        </Badge>
                        {statusBadge(req.status)}
                        <span className="text-muted-foreground">
                          {format(new Date(req.requestedAt), "d MMM yyyy HH:mm", { locale: localeId })}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={() =>
                            setDeleteTarget({
                              requestId: req._id,
                              userName: req.user?.name ?? "User",
                            })
                          }
                          aria-label="Hapus permintaan"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {req.reviewNote && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Catatan: {req.reviewNote}
                        {req.reviewer && ` — oleh ${req.reviewer.name}`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- AUDIT LOG TAB ---- */}
        <TabsContent value="audit" className="space-y-4 pt-4">
          <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-400/20 dark:bg-blue-500/5">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-blue-600" />
                Security Audit Log
              </CardTitle>
              <CardDescription className="text-xs">
                Semua perubahan role, aktivasi, suspend, dan aktivitas keamanan dicatat secara otomatis.
              </CardDescription>
            </CardHeader>
          </Card>

          {auditLog === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : auditLog.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Belum ada aktivitas tercatat.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {auditLog.map((log) => (
                <div key={log._id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{log.detail ?? log.action}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {log.actor && (
                        <span className="font-medium text-foreground">oleh {log.actor.name}</span>
                      )}
                      <span>
                        {format(new Date(log.occurredAt), "d MMM yyyy, HH:mm", { locale: localeId })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {log.action.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {reviewDialog && (
        <ReviewDialog
          {...reviewDialog}
          onClose={() => setReviewDialog(null)}
        />
      )}
      {ctrlDialog && (
        <AccountControlDialog
          {...ctrlDialog}
          onClose={() => setCtrlDialog(null)}
        />
      )}
      {deleteTarget && (
        <Dialog open onOpenChange={() => !deleting && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Hapus Riwayat Permintaan
              </DialogTitle>
              <DialogDescription>
                Riwayat permintaan {deleteTarget.userName} akan dihapus permanen
                dari daftar. Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="cursor-pointer"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 size-4" />
                    Hapus
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
