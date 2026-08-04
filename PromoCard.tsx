import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
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
import {
  MoreVertical,
  Pencil,
  Trash2,
  Tag,
  Users,
  HardDrive,
  Percent,
  EyeOff,
  Eye,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type PromoCardProps = {
  promo: Doc<"promos">;
  onEdit: () => void;
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  plan_upgrade: { label: "Upgrade Paket", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  extra_users: { label: "Tambah Pengguna", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  extra_storage: { label: "Tambah Penyimpanan", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  discount: { label: "Diskon", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy", { locale: idLocale });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function PromoCard({ promo, onEdit }: PromoCardProps) {
  const updatePromo = useMutation(api.promos.update);
  const removePromo = useMutation(api.promos.remove);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const now = new Date().toISOString();
  const isExpired = promo.validUntil < now;
  const isNotStarted = promo.validFrom > now;
  const quotaFull = promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions;
  const typeInfo = TYPE_LABELS[promo.type] ?? { label: promo.type, color: "bg-muted" };

  const handleToggleActive = async () => {
    try {
      await updatePromo({ promoId: promo._id, isActive: !promo.isActive });
      toast.success(promo.isActive ? "Promo dinonaktifkan" : "Promo diaktifkan");
    } catch {
      toast.error("Gagal mengubah status promo");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removePromo({ promoId: promo._id });
      toast.success(`Promo "${promo.name}" berhasil dihapus`);
      setShowDelete(false);
    } catch {
      toast.error("Gagal menghapus promo");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(promo.code);
    toast.success("Kode promo disalin!");
  };

  return (
    <>
      <Card className={cn(
        "relative flex flex-col transition-all",
        (!promo.isActive || isExpired) && "opacity-60",
      )}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg truncate">{promo.name}</CardTitle>
              {!promo.isActive && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <EyeOff className="mr-1 size-3" />
                  Nonaktif
                </Badge>
              )}
              {isExpired && promo.isActive && (
                <Badge variant="destructive" className="text-xs shrink-0">Berakhir</Badge>
              )}
              {isNotStarted && promo.isActive && (
                <Badge variant="secondary" className="text-xs shrink-0">Belum Dimulai</Badge>
              )}
            </div>
            <Badge className={cn("text-xs font-medium", typeInfo.color)}>
              {typeInfo.label}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 cursor-pointer">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                <Pencil className="mr-2 size-4" /> Edit Promo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyCode} className="cursor-pointer">
                <Copy className="mr-2 size-4" /> Salin Kode
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive} className="cursor-pointer">
                {promo.isActive ? (
                  <><EyeOff className="mr-2 size-4" /> Nonaktifkan</>
                ) : (
                  <><Eye className="mr-2 size-4" /> Aktifkan</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDelete(true)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" /> Hapus Promo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3">
          {/* Code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 rounded-lg bg-muted/80 px-3 py-2 cursor-pointer hover:bg-muted transition-colors"
          >
            <Tag className="size-4 text-primary" />
            <span className="font-mono text-sm font-bold tracking-wider">{promo.code}</span>
            <Copy className="ml-auto size-3 text-muted-foreground" />
          </button>

          {promo.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{promo.description}</p>
          )}

          {/* Benefits */}
          <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
            {promo.discountPercent > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Percent className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Diskon:</span>
                <span className="ml-auto font-semibold">{promo.discountPercent}%</span>
              </div>
            )}
            {promo.discountFlat > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Tag className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Potongan:</span>
                <span className="ml-auto font-semibold">Rp {promo.discountFlat.toLocaleString("id-ID")}</span>
              </div>
            )}
            {promo.extraUsers > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Users className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Ekstra Pengguna:</span>
                <span className="ml-auto font-semibold">+{promo.extraUsers}</span>
              </div>
            )}
            {promo.extraStorageMb > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <HardDrive className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Ekstra Storage:</span>
                <span className="ml-auto font-semibold">
                  +{promo.extraStorageMb >= 1024 ? `${Math.round(promo.extraStorageMb / 1024)} GB` : `${promo.extraStorageMb} MB`}
                </span>
              </div>
            )}
          </div>

          {/* Validity & usage */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Berlaku: {formatDate(promo.validFrom)} – {formatDate(promo.validUntil)}</p>
            <div className="flex items-center justify-between">
              <span>Digunakan: {promo.redemptionCount}{promo.maxRedemptions > 0 ? `/${promo.maxRedemptions}` : ""}</span>
              {quotaFull && (
                <Badge variant="destructive" className="text-xs">Kuota Habis</Badge>
              )}
            </div>
            {promo.applicablePlanSlugs.length > 0 && (
              <p>Paket: {promo.applicablePlanSlugs.join(", ")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Promo "{promo.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Riwayat penggunaan promo akan tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
