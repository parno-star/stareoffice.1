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
  Check,
  X,
  Users,
  HardDrive,
  Headphones,
  Sparkles,
  EyeOff,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useState } from "react";
import { sortFeaturesByMenuOrder } from "../_lib/feature-catalog.ts";

type PlanCardProps = {
  plan: Doc<"membershipPlans">;
  onEdit: () => void;
};

const SUPPORT_LABELS: Record<string, string> = {
  community: "Komunitas",
  email: "Email",
  priority: "Prioritas",
  dedicated: "Dedicated AM",
};

function formatStorage(mb: number): string {
  if (mb === 0) return "Unlimited";
  if (mb >= 1024) return `${Math.round(mb / 1024)} GB`;
  return `${mb} MB`;
}

function formatEmployees(max: number): string {
  if (max === 0) return "Unlimited";
  return `${max} karyawan`;
}

export default function PlanCard({ plan, onEdit }: PlanCardProps) {
  const updatePlan = useMutation(api.membership.update);
  const removePlan = useMutation(api.membership.remove);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    try {
      await updatePlan({ planId: plan._id, isActive: !plan.isActive });
      toast.success(plan.isActive ? "Paket dinonaktifkan" : "Paket diaktifkan");
    } catch {
      toast.error("Gagal mengubah status paket");
    }
  };

  const handleTogglePopular = async () => {
    try {
      await updatePlan({ planId: plan._id, isPopular: !plan.isPopular });
      toast.success(plan.isPopular ? "Badge populer dihapus" : "Badge populer ditambahkan");
    } catch {
      toast.error("Gagal mengubah badge populer");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removePlan({ planId: plan._id });
      toast.success(`Paket "${plan.name}" berhasil dihapus`);
      setShowDelete(false);
    } catch {
      toast.error("Gagal menghapus paket");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "relative flex flex-col transition-all",
          !plan.isActive && "opacity-60",
          plan.isPopular && "ring-2 ring-accent/30 shadow-accent/10",
        )}
      >
        {/* Popular badge */}
        {plan.isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <Badge className="gap-1 bg-accent text-white shadow-lg shadow-accent/30">
              <Sparkles className="size-3" />
              Paling Populer
            </Badge>
          </div>
        )}

        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              {!plan.isActive && (
                <Badge variant="secondary" className="text-xs">
                  <EyeOff className="mr-1 size-3" />
                  Nonaktif
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {plan.description}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 cursor-pointer"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                <Pencil className="mr-2 size-4" />
                Edit Paket
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTogglePopular} className="cursor-pointer">
                <Sparkles className="mr-2 size-4" />
                {plan.isPopular ? "Hapus Badge Populer" : "Tandai Populer"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive} className="cursor-pointer">
                {plan.isActive ? (
                  <>
                    <EyeOff className="mr-2 size-4" />
                    Nonaktifkan
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 size-4" />
                    Aktifkan
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDelete(true)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Hapus Paket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          {/* Price */}
          <div>
            <span className="text-2xl font-extrabold tracking-tight">
              {plan.price}
            </span>
            <span className="ml-1 text-sm text-muted-foreground">
              {plan.priceUnit}
            </span>
          </div>

          {/* Limits */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs">
              <Users className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Karyawan:</span>
              <span className="ml-auto font-semibold">{formatEmployees(plan.maxEmployees)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <HardDrive className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Penyimpanan:</span>
              <span className="ml-auto font-semibold">{formatStorage(plan.maxStorageMb)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Headphones className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Dukungan:</span>
              <span className="ml-auto font-semibold">
                {SUPPORT_LABELS[plan.supportLevel] ?? plan.supportLevel}
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="flex-1 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fitur Termasuk
            </p>
            {sortFeaturesByMenuOrder(plan.coreFeatures).slice(0, 6).map((f) => (
              <div key={f} className="flex items-start gap-2">
                <div className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Check className="size-2" strokeWidth={3} />
                </div>
                <span className="text-xs leading-tight">{f}</span>
              </div>
            ))}
            {plan.coreFeatures.length > 6 && (
              <p className="text-xs text-muted-foreground">
                +{plan.coreFeatures.length - 6} fitur lainnya
              </p>
            )}
            {plan.disabledFeatures.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tidak Tersedia
                </p>
                {sortFeaturesByMenuOrder(plan.disabledFeatures).map((f) => (
                  <div key={f} className="flex items-start gap-2 opacity-50">
                    <div className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-muted">
                      <X className="size-2" strokeWidth={3} />
                    </div>
                    <span className="text-xs leading-tight line-through">{f}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Urutan: {plan.order}</span>
            <span>Slug: {plan.slug}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket "{plan.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Organisasi yang menggunakan
              paket ini tidak akan terpengaruh secara langsung, namun paket akan
              dihapus dari daftar pilihan.
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
