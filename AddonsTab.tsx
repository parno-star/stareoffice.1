import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { MenuKey } from "@/convex/roles";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale/id";
import {
  Puzzle,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
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
import { cn } from "@/lib/utils.ts";
import {
  ADDON_MENU_OPTIONS,
  menuLabels,
  formatRupiah,
} from "../_lib/addons-ui.ts";
import SeatAddonManager from "./SeatAddonManager.tsx";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy", { locale: idLocale });
}

// ── Add-on Editor Dialog ─────────────────────────────────────────────────────

type EditingAddon = {
  _id: Id<"featureAddons">;
  name: string;
  description: string | null;
  menuKeys: string[];
  price: number;
  isActive: boolean;
} | null;

function AddonEditorDialog({
  editing,
  open,
  onOpenChange,
}: {
  editing: EditingAddon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createAddon = useMutation(api.featureAddons.createAddon);
  const updateAddon = useMutation(api.featureAddons.updateAddon);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [menuKeys, setMenuKeys] = useState<Set<string>>(new Set());
  const [isActive, setIsActive] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed local state once when opening.
  if (open && !seeded) {
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setPrice(editing ? String(editing.price) : "");
    setMenuKeys(new Set(editing?.menuKeys ?? []));
    setIsActive(editing?.isActive ?? true);
    setSeeded(true);
  }
  if (!open && seeded) setSeeded(false);

  const toggleMenu = (key: string) => {
    setMenuKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    const numericPrice = parseInt(price.replace(/\D/g, ""), 10) || 0;
    if (!name.trim()) {
      toast.error("Nama add-on wajib diisi");
      return;
    }
    if (menuKeys.size === 0) {
      toast.error("Pilih minimal satu menu yang dibuka");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAddon({
          addonId: editing._id,
          name: name.trim(),
          description: description.trim(),
          menuKeys: [...menuKeys],
          price: numericPrice,
          isActive,
        });
        toast.success("Add-on diperbarui");
      } else {
        await createAddon({
          name: name.trim(),
          description: description.trim() || undefined,
          menuKeys: [...menuKeys],
          price: numericPrice,
          isActive,
        });
        toast.success("Add-on dibuat");
      }
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menyimpan add-on";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Add-on" : "Add-on Baru"}</DialogTitle>
          <DialogDescription>
            Tentukan nama, harga, dan menu yang dibuka add-on ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama add-on</Label>
            <Input
              placeholder="Modul Rekrutmen"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi (opsional)</Label>
            <Textarea
              placeholder="Buka akses fitur rekrutmen & ATS"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Harga (Rp)</Label>
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
          <div className="space-y-2">
            <Label>Menu yang dibuka ({menuKeys.size} dipilih)</Label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-lg border p-2">
              {ADDON_MENU_OPTIONS.map((m) => {
                const checked = menuKeys.has(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMenu(m.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors",
                      checked
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {checked && <CheckCircle2 className="size-3" />}
                    </span>
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Aktif</Label>
              <p className="text-xs text-muted-foreground">
                Hanya add-on aktif yang dapat dibeli organisasi.
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              className="cursor-pointer"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Batal
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pending Purchases Section ────────────────────────────────────────────────

function PendingPurchasesSection() {
  const pending = useQuery(api.addonBilling.getPendingPurchases, {});
  const verify = useMutation(api.addonBilling.verifyPurchase);
  const reject = useMutation(api.addonBilling.rejectPurchase);
  const [rejectingId, setRejectingId] =
    useState<Id<"addonPurchases"> | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<Id<"addonPurchases"> | null>(null);

  if (pending === undefined) return <Skeleton className="h-20 w-full" />;
  if (pending.length === 0) return null;

  const handleVerify = async (purchaseId: Id<"addonPurchases">) => {
    setBusyId(purchaseId);
    try {
      await verify({ purchaseId });
      toast.success("Pembelian diverifikasi & add-on diaktifkan");
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
      toast.success("Pengajuan ditolak");
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
        <Clock className="size-4 text-amber-600" />
        <h3 className="text-sm font-semibold">
          Pembelian menunggu verifikasi ({pending.length})
        </h3>
      </div>
      {pending.map((p) => (
        <Card key={p._id} className="border-amber-200 dark:border-amber-800/40">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.orgName}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.addonName ?? "Add-on"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.amountLabel ?? formatRupiah(p.amount)}
                  {p.submittedByName && ` · oleh ${p.submittedByName}`} ·{" "}
                  {formatDate(p.createdAt)}
                </p>
                {p.reference && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ref: {p.reference}
                  </p>
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
            <DialogTitle>Tolak pengajuan pembelian</DialogTitle>
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
              Tolak Pembelian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Grant / Manage Org Add-ons Dialog ────────────────────────────────────────

function ManageOrgAddonsDialog({
  org,
  open,
  onOpenChange,
}: {
  org: {
    orgId: Id<"organizations">;
    orgName: string;
    activeAddons: Array<{ addonId: Id<"featureAddons">; name: string; source: string }>;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const catalog = useQuery(api.featureAddons.listAll, {});
  const grant = useMutation(api.addonBilling.grantAddon);
  const revoke = useMutation(api.addonBilling.revokeAddon);
  const [busyId, setBusyId] = useState<Id<"featureAddons"> | null>(null);

  const activeIds = new Set(org.activeAddons.map((a) => a.addonId));

  const handleGrant = async (addonId: Id<"featureAddons">) => {
    setBusyId(addonId);
    try {
      await grant({ organizationId: org.orgId, addonId });
      toast.success("Add-on diberikan ke organisasi");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal memberikan add-on";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (addonId: Id<"featureAddons">) => {
    setBusyId(addonId);
    try {
      await revoke({ organizationId: org.orgId, addonId });
      toast.success("Add-on dicabut");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal mencabut add-on";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Add-on</DialogTitle>
          <DialogDescription>{org.orgName}</DialogDescription>
        </DialogHeader>
        {catalog === undefined ? (
          <Skeleton className="h-40 w-full" />
        ) : catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Belum ada add-on di katalog.
          </p>
        ) : (
          <div className="space-y-2">
            {catalog.map((addon) => {
              const isActive = activeIds.has(addon._id);
              return (
                <div
                  key={addon._id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{addon.name}</span>
                      {isActive && (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                          Aktif
                        </Badge>
                      )}
                      {!addon.isActive && (
                        <Badge variant="secondary" className="text-[10px]">
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {menuLabels(addon.menuKeys)}
                    </p>
                  </div>
                  {isActive ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-red-600 shrink-0"
                      disabled={busyId === addon._id}
                      onClick={() => void handleRevoke(addon._id)}
                    >
                      Cabut
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="cursor-pointer shrink-0"
                      disabled={busyId === addon._id}
                      onClick={() => void handleGrant(addon._id)}
                    >
                      Berikan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Catalog Section ──────────────────────────────────────────────────────────

function CatalogSection() {
  const catalog = useQuery(api.featureAddons.listAll, {});
  const deleteAddon = useMutation(api.featureAddons.deleteAddon);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EditingAddon>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<{ id: Id<"featureAddons">; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAddon({ addonId: deleteTarget.id });
      toast.success("Add-on dihapus");
      setDeleteTarget(null);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menghapus";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Puzzle className="size-4 text-primary" />
          Katalog Add-on
        </h3>
        <Button
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add-on Baru
        </Button>
      </div>

      {catalog === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : catalog.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Puzzle />
            </EmptyMedia>
            <EmptyTitle>Belum ada add-on</EmptyTitle>
            <EmptyDescription>
              Buat add-on untuk menjual fitur tambahan ke organisasi.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {catalog.map((addon) => (
            <Card key={addon._id} className={cn(!addon.isActive && "opacity-60")}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{addon.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {addon.priceLabel ?? formatRupiah(addon.price)}
                      </Badge>
                      {addon.isActive ? (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Nonaktif
                        </Badge>
                      )}
                    </div>
                    {addon.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {addon.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Membuka: {menuLabels(addon.menuKeys)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="cursor-pointer size-8"
                      onClick={() => {
                        setEditing({
                          _id: addon._id,
                          name: addon.name,
                          description: addon.description,
                          menuKeys: addon.menuKeys,
                          price: addon.price,
                          isActive: addon.isActive,
                        });
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="cursor-pointer size-8 text-red-600"
                      onClick={() =>
                        setDeleteTarget({ id: addon._id, name: addon.name })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddonEditorDialog
        editing={editing}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus add-on?</DialogTitle>
            <DialogDescription>
              Menghapus &quot;{deleteTarget?.name}&quot; juga mencabut akses semua
              organisasi yang memilikinya. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              className="cursor-pointer bg-red-600 hover:bg-red-700"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Org Add-ons Section ──────────────────────────────────────────────────────

function OrgAddonsSection() {
  const overview = useQuery(api.addonBilling.getOrgAddonOverview, {});
  const [search, setSearch] = useState("");
  const [manageOrg, setManageOrg] = useState<{
    orgId: Id<"organizations">;
    orgName: string;
    activeAddons: Array<{ addonId: Id<"featureAddons">; name: string; source: string }>;
  } | null>(null);

  if (overview === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const filtered = overview.filter((o) =>
    o.orgName.toLowerCase().includes(search.toLowerCase().trim()),
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Building2 className="size-4 text-primary" />
        Add-on per Organisasi
      </h3>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Cari organisasi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Tidak ada organisasi</EmptyTitle>
            <EmptyDescription>Coba ubah kata kunci pencarian.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((org) => (
            <Card key={org.orgId} className={cn(!org.isActive && "opacity-60")}>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{org.orgName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {org.planName}
                      </Badge>
                    </div>
                    {org.activeAddons.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {org.activeAddons.map((a) => (
                          <Badge
                            key={a.addonId}
                            className="text-[10px] bg-primary/10 text-primary border-primary/20"
                          >
                            <Sparkles className="size-3 mr-1" />
                            {a.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Belum ada add-on aktif
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer shrink-0"
                    onClick={() =>
                      setManageOrg({
                        orgId: org.orgId,
                        orgName: org.orgName,
                        activeAddons: org.activeAddons,
                      })
                    }
                  >
                    Kelola
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {manageOrg && (
        <ManageOrgAddonsDialog
          org={manageOrg}
          open={manageOrg !== null}
          onOpenChange={(o) => !o && setManageOrg(null)}
        />
      )}
    </div>
  );
}

// ── Main Add-ons Tab ─────────────────────────────────────────────────────────

export default function AddonsTab() {
  return (
    <div className="space-y-6 mt-4">
      <PendingPurchasesSection />
      <SeatAddonManager />
      <CatalogSection />
      <OrgAddonsSection />
    </div>
  );
}
