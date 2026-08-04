import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { UserX, Trash2, Mail, ShieldAlert, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { ROLE_LABELS } from "@/convex/roles";
import type { Role } from "@/convex/roles";

type OrphanUser = {
  _id: Id<"users">;
  _creationTime: number;
  name?: string;
  email?: string;
  role?: string;
  tokenIdentifier: string;
};

/** Format a Unix timestamp (ms) into a readable Indonesian date + time. */
function formatCreatedAt(ms: number): string {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role?: string): string {
  if (!role) return "Karyawan";
  return ROLE_LABELS[role as Role] ?? role;
}

/**
 * Lists user accounts that no longer belong to any organization (for example
 * accounts left behind by an organization that was deleted before cascade
 * cleanup existed) and lets the super admin permanently delete them so the
 * database and all counts stay clean. Placeholder directory stubs and the super
 * admin's own account are never shown here.
 */
export default function OrphanUsersCleanup() {
  const users = useQuery(api.superAdmin.listAllUsers, { organizationId: null });
  const deleteUser = useMutation(api.superAdmin.deleteUser);

  const [target, setTarget] = useState<OrphanUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isLoading = users === undefined;

  // Only real, deletable accounts: exclude the super admin and any directory
  // placeholder stubs that were never linked to a real login.
  const orphans: Array<OrphanUser> = (users ?? [])
    .filter(
      (u) =>
        u.role !== "super_admin" &&
        !(u.tokenIdentifier ?? "").startsWith("placeholder:"),
    )
    .map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      name: u.name,
      email: u.email,
      role: u.role,
      tokenIdentifier: u.tokenIdentifier,
    }));

  async function handleDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteUser({ userId: target._id });
      toast.success("Pengguna dihapus permanen");
      setTarget(null);
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message: string };
        toast.error(data.message);
      } else {
        toast.error("Gagal menghapus pengguna");
      }
    } finally {
      setDeleting(false);
    }
  }

  // Nothing to clean up — hide the whole section to keep the panel tidy.
  if (!isLoading && orphans.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserX className="w-4 h-4 text-amber-600" />
          Pengguna Tanpa Organisasi
          {!isLoading && (
            <Badge variant="secondary" className="ml-1">
              {orphans.length}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Akun yang tidak lagi terhubung ke organisasi mana pun (biasanya sisa
          dari organisasi yang sudah dihapus). Menghapusnya menjaga data dan
          jumlah pengguna tetap akurat.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          orphans.map((u) => (
            <div
              key={u._id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {u.name ?? "Tanpa nama"}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {roleLabel(u.role)}
                  </Badge>
                </div>
                {u.email && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                )}
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span>Dibuat {formatCreatedAt(u._creationTime)}</span>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="cursor-pointer shrink-0"
                onClick={() => setTarget(u)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Hapus
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Hapus Pengguna Permanen?
            </DialogTitle>
            <DialogDescription>
              Akun{" "}
              <span className="font-semibold text-foreground">
                {target?.name ?? target?.email ?? "ini"}
              </span>{" "}
              beserta seluruh data pribadinya akan dihapus permanen dan tidak
              dapat dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setTarget(null)}
              disabled={deleting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
