import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  ROLE_LABELS,
  ROLE_VALUES,
  isSuperAdminRole,
  normalizeRole,
  type Role,
} from "@/convex/roles.ts";
import {
  ArrowRightLeft,
  Search,
  Users as UsersIcon,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { ROLE_COLORS } from "../_lib/role-ui.ts";
import { cn } from "@/lib/utils.ts";

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function AccountStatusBadge({ status }: { status: string | undefined }) {
  if (!status || status === "active")
    return (
      <Badge className="shrink-0 gap-1 bg-emerald-500 text-[10px] hover:bg-emerald-600">
        <ShieldCheck className="size-2.5" />
        Aktif
      </Badge>
    );
  if (status === "pending_approval")
    return (
      <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
        <Clock className="size-2.5" />
        Pending
      </Badge>
    );
  if (status === "suspended")
    return (
      <Badge variant="destructive" className="shrink-0 gap-1 text-[10px]">
        <AlertTriangle className="size-2.5" />
        Nonaktif
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive" className="shrink-0 gap-1 text-[10px]">
        <ShieldX className="size-2.5" />
        Ditolak
      </Badge>
    );
  return (
    <Badge variant="outline" className="shrink-0 text-[10px]">
      {status}
    </Badge>
  );
}

export default function UserRolesTab({
  currentUserId,
  currentUserRole,
}: {
  currentUserId: Id<"users">;
  currentUserRole: string | undefined;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<Id<"users"> | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ id: Id<"users">; name: string } | null>(null);
  const [newRoleForMe, setNewRoleForMe] = useState<string>("employee");
  const [isTransferring, setIsTransferring] = useState(false);
  const [ctrlTarget, setCtrlTarget] = useState<{
    id: Id<"users">;
    name: string;
    action: "suspend" | "activate";
  } | null>(null);
  const [ctrlReason, setCtrlReason] = useState("");
  const [isCtrlSaving, setIsCtrlSaving] = useState(false);
  const amSuperAdmin = isSuperAdminRole(currentUserRole);
  const amAdmin = normalizeRole(currentUserRole) === "admin";

  const users = useQuery(api.userSettings.listUsersForSettings, { search });
  const stats = useQuery(api.userSettings.getRoleStats, {});
  const positionLevels = useQuery(api.positionLevels.listActive, {});
  const setUserRole = useMutation(api.userSettings.setUserRole);
  const assignLevel = useMutation(api.positionLevels.assignToUser);
  const transferAdmin = useMutation(api.userSettings.transferAdmin);
  const suspendUser = useMutation(api.roleRequests.suspendUser);
  const activateUser = useMutation(api.roleRequests.activateUser);

  const filtered = users?.filter((u) => {
    if (roleFilter === "all") return true;
    return normalizeRole(u.role) === roleFilter;
  });

  // Regular admins must never see the Super Admin role in the summary cards or
  // the filter dropdown — it is a platform-owner-only role. Super Admins keep
  // the full list.
  const visibleRoles = ROLE_VALUES.filter(
    (r) => amSuperAdmin || r !== "super_admin",
  );

  const handleChangeRole = async (userId: Id<"users">, newRole: Role) => {
    setSavingId(userId);
    try {
      await setUserRole({ userId, role: newRole });
      toast.success(`Peran diperbarui menjadi ${ROLE_LABELS[newRole]}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengubah peran");
      } else {
        toast.error("Gagal mengubah peran");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleChangePositionLevel = async (userId: Id<"users">, levelId: string) => {
    setSavingId(userId);
    try {
      await assignLevel({
        userId,
        positionLevelId: levelId === "none" ? null : levelId as Id<"positionLevels">,
      });
      const levelName = positionLevels?.find((l) => l._id === levelId)?.name ?? "Belum ditetapkan";
      toast.success(`Jenjang jabatan diperbarui: ${levelName}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengubah jenjang jabatan");
      } else {
        toast.error("Gagal mengubah jenjang jabatan");
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleTransferAdmin = async () => {
    if (!transferTarget) return;
    setIsTransferring(true);
    try {
      await transferAdmin({
        targetUserId: transferTarget.id,
        newRoleForMe: newRoleForMe,
      });
      toast.success(`Peran Administrator berhasil dialihkan ke ${transferTarget.name}`);
      setTransferTarget(null);
      setNewRoleForMe("employee");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengalihkan peran");
      } else {
        toast.error("Gagal mengalihkan peran");
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAccountControl = async () => {
    if (!ctrlTarget) return;
    setIsCtrlSaving(true);
    try {
      if (ctrlTarget.action === "suspend") {
        await suspendUser({
          targetUserId: ctrlTarget.id,
          reason: ctrlReason.trim() || undefined,
        });
        toast.success(`Akun ${ctrlTarget.name} dinonaktifkan`);
      } else {
        await activateUser({
          targetUserId: ctrlTarget.id,
          note: ctrlReason.trim() || undefined,
        });
        toast.success(`Akun ${ctrlTarget.name} diaktifkan kembali`);
      }
      setCtrlTarget(null);
      setCtrlReason("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal memproses");
      } else {
        toast.error("Terjadi kesalahan");
      }
    } finally {
      setIsCtrlSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Transfer Admin card — only visible to current admin (not super admin) */}
      {amAdmin && !amSuperAdmin && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="size-4 text-amber-600" />
              Transfer Administrator
            </CardTitle>
            <CardDescription>
              Setiap organisasi hanya memiliki satu Administrator. Anda dapat mengalihkan peran ini ke pengguna lain.
              Setelah dialihkan, peran Anda akan berubah.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Pilih pengguna tujuan
                </label>
                <Select
                  value=""
                  onValueChange={(val) => {
                    const u = users?.find((x) => x._id === val);
                    if (u) setTransferTarget({ id: u._id, name: u.name ?? u.email ?? "Pengguna" });
                  }}
                >
                  <SelectTrigger className="w-full cursor-pointer">
                    <SelectValue placeholder="Pilih pengguna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      ?.filter((u) => u._id !== currentUserId && !isSuperAdminRole(u.role))
                      .map((u) => (
                        <SelectItem key={u._id} value={u._id} className="cursor-pointer">
                          {u.name ?? u.email ?? "Tanpa Nama"} — {ROLE_LABELS[normalizeRole(u.role)]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:w-44">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Peran baru Anda
                </label>
                <Select value={newRoleForMe} onValueChange={setNewRoleForMe}>
                  <SelectTrigger className="w-full cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_VALUES.filter(
                      (r) => r !== "admin" && r !== "super_admin",
                    ).map((r) => (
                      <SelectItem key={r} value={r} className="cursor-pointer">
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer confirmation dialog */}
      <AlertDialog open={!!transferTarget} onOpenChange={(open) => { if (!open) setTransferTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Transfer Administrator</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan mengalihkan peran Administrator ke{" "}
              <span className="font-semibold">{transferTarget?.name}</span>.
              Peran Anda akan berubah menjadi{" "}
              <span className="font-semibold">{ROLE_LABELS[newRoleForMe as Role] ?? newRoleForMe}</span>.
              Tindakan ini tidak dapat dibatalkan sendiri — Anda memerlukan admin baru atau Super Admin untuk mengembalikan peran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring} className="cursor-pointer">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferAdmin}
              disabled={isTransferring}
              className="cursor-pointer bg-amber-600 hover:bg-amber-700"
            >
              {isTransferring ? "Mengalihkan..." : "Ya, Alihkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role distribution summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {visibleRoles.map((role) => {
          const count = stats?.find((s) => s.role === role)?.count ?? 0;
          return (
            <Card key={role}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {ROLE_LABELS[role]}
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {stats === undefined ? "—" : count}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 border", ROLE_COLORS[role])}
                >
                  {count}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="size-4 text-primary" />
            Daftar Pengguna
          </CardTitle>
          <CardDescription>
            Ubah peran pengguna. Perubahan berlaku langsung pada akses menu
            mereka. Peran juga terisi otomatis mengikuti Peran Default jabatan
            saat jabatan pengguna diubah, dan tetap dapat disesuaikan manual di
            sini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, email, atau departemen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Peran</SelectItem>
                {visibleRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {users === undefined ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : filtered && filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada pengguna yang cocok.
              </p>
            ) : (
              filtered?.map((u) => {
                const role = normalizeRole(u.role);
                const isSelf = u._id === currentUserId;
                return (
                  <div
                    key={u._id}
                    className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar className="size-10 shrink-0">
                        {u.avatarUrl ? (
                          <AvatarImage src={u.avatarUrl} alt={u.name ?? ""} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {u.name ?? "Tanpa Nama"}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn("shrink-0 border", ROLE_COLORS[role])}
                          >
                            {ROLE_LABELS[role]}
                          </Badge>
                          {isSelf ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px]"
                            >
                              Anda
                            </Badge>
                          ) : null}
                          <AccountStatusBadge status={u.accountStatus} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {u.jobTitle ?? "—"}
                          {u.department ? ` • ${u.department}` : ""}
                        </p>
                        {u.email ? (
                          <p className="truncate text-[11px] text-muted-foreground/80">
                            {u.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      {/* Role / access dropdown */}
                      <div className="w-full sm:w-44">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Peran / Hak Akses
                        </label>
                        {/* Admin's own row: no role dropdown, must use Transfer Admin */}
                        {isSelf && amAdmin && !amSuperAdmin ? (
                          <div className="flex h-9 w-full items-center rounded-md border bg-muted/50 px-3">
                            <span className="text-sm font-medium text-muted-foreground">
                              {ROLE_LABELS["admin"]}
                            </span>
                          </div>
                        ) : (
                          <Select
                            value={role}
                            onValueChange={(value) => {
                              const next = value as Role;
                              if (next !== role) {
                                void handleChangeRole(u._id, next);
                              }
                            }}
                            disabled={
                              savingId === u._id ||
                              (!amSuperAdmin && role === "super_admin")
                            }
                          >
                            <SelectTrigger className="w-full shrink-0 cursor-pointer">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_VALUES.filter((r) => {
                                // Hide super_admin from non-super-admins
                                if (r === "super_admin" && !amSuperAdmin) return false;
                                // Hide admin from non-super-admins (must use Transfer Admin)
                                if (r === "admin" && !amSuperAdmin) return false;
                                return true;
                              }).map((r) => (
                                <SelectItem
                                  key={r}
                                  value={r}
                                  className="cursor-pointer"
                                >
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {/* Position level dropdown */}
                      {positionLevels && positionLevels.length > 0 && (
                        <div className="w-full sm:w-44">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Jenjang Jabatan
                          </label>
                          <Select
                            value={u.positionLevelId ?? "none"}
                            onValueChange={(value) => {
                              void handleChangePositionLevel(u._id, value);
                            }}
                            disabled={savingId === u._id}
                          >
                            <SelectTrigger className="w-full shrink-0 cursor-pointer">
                              <SelectValue placeholder="Jenjang Jabatan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="cursor-pointer">Belum Ditetapkan</SelectItem>
                              {positionLevels.map((pl) => (
                                <SelectItem key={pl._id} value={pl._id} className="cursor-pointer">
                                  {pl.code} - {pl.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {/* Account activation toggle */}
                      {!isSelf && role !== "super_admin" && (
                        <div className="w-full sm:w-auto">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Status Akun
                          </label>
                          <div className="flex h-9 items-center gap-2">
                            <Switch
                              checked={u.accountStatus !== "suspended"}
                              onCheckedChange={(checked) =>
                                setCtrlTarget({
                                  id: u._id,
                                  name: u.name ?? u.email ?? "Pengguna",
                                  action: checked ? "activate" : "suspend",
                                })
                              }
                              className="cursor-pointer data-[state=checked]:bg-emerald-500"
                              aria-label="Toggle status akun"
                            />
                            <span
                              className={cn(
                                "text-xs font-medium",
                                u.accountStatus === "suspended"
                                  ? "text-destructive"
                                  : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {u.accountStatus === "suspended"
                                ? "Nonaktif"
                                : "Aktif"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Suspend / Activate confirmation dialog */}
      <AlertDialog
        open={!!ctrlTarget}
        onOpenChange={(open) => {
          if (!open && !isCtrlSaving) {
            setCtrlTarget(null);
            setCtrlReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={
                ctrlTarget?.action === "suspend"
                  ? "text-destructive"
                  : "text-emerald-600"
              }
            >
              {ctrlTarget?.action === "suspend"
                ? `Nonaktifkan Akun ${ctrlTarget?.name}`
                : `Aktifkan Akun ${ctrlTarget?.name}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ctrlTarget?.action === "suspend"
                ? "Akun pengguna akan dinonaktifkan dan tidak dapat mengakses sistem sampai diaktifkan kembali."
                : "Akun pengguna akan diaktifkan kembali dan dapat mengakses sistem."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Alasan (opsional)
            </label>
            <Textarea
              placeholder={
                ctrlTarget?.action === "suspend"
                  ? "Alasan menonaktifkan akun..."
                  : "Catatan aktivasi akun..."
              }
              value={ctrlReason}
              onChange={(e) => setCtrlReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCtrlSaving} className="cursor-pointer">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAccountControl}
              disabled={isCtrlSaving}
              className={cn(
                "cursor-pointer",
                ctrlTarget?.action === "suspend"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {isCtrlSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Memproses...
                </>
              ) : ctrlTarget?.action === "suspend" ? (
                "Nonaktifkan"
              ) : (
                "Aktifkan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
