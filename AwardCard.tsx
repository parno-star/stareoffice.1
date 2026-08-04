import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  PartyPopper,
  Trash2,
  Sparkles,
  Star,
  FileText,
  Pencil,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { AwardListItem } from "@/convex/awards";
import {
  getCategoryConfig,
  getInitials,
  formatAwardDate,
  formatBonus,
} from "../_lib/awards-utils.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
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
import { useState } from "react";

type Props = {
  award: AwardListItem;
  isAdmin: boolean;
  onEdit?: (award: AwardListItem) => void;
  featured?: boolean;
};

export default function AwardCard({
  award,
  isAdmin,
  onEdit,
  featured = false,
}: Props) {
  const cfg = getCategoryConfig(award.category);
  const Icon = cfg.icon;
  const [congratulating, setCongratulating] = useState(false);

  const toggleCongrats = useMutation(api.awards.toggleCongratulations);
  const deleteAward = useMutation(api.awards.deleteAward);

  const handleCongrats = async () => {
    if (congratulating) return;
    setCongratulating(true);
    try {
      const result = await toggleCongrats({ awardId: award._id });
      if (result.congratulated) {
        toast.success("Ucapan selamat dikirim!");
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengirim ucapan");
      } else {
        toast.error("Gagal mengirim ucapan");
      }
    } finally {
      setCongratulating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAward({ awardId: award._id });
      toast.success("Penghargaan dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus penghargaan");
      } else {
        toast.error("Gagal menghapus penghargaan");
      }
    }
  };

  return (
    <Card
      className={cn(
        "overflow-hidden bg-gradient-to-br transition-all hover:shadow-lg",
        cfg.gradient,
        featured && "ring-2 ring-offset-2 ring-offset-background shadow-xl",
        featured && cfg.ring,
      )}
    >
      <CardContent className={cn("space-y-4", featured && "py-6")}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("gap-1 font-semibold", cfg.badge)}
            >
              <Icon className="size-3" />
              {cfg.shortLabel}
            </Badge>
            {award.isFeatured ? (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
              >
                <Sparkles className="size-3" />
                Featured
              </Badge>
            ) : null}
            {award.periodLabel ? (
              <Badge variant="secondary" className="font-medium">
                {award.periodLabel}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && onEdit ? (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit(award);
                }}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
            {isAdmin ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus penghargaan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini tidak dapat dibatalkan. Sertifikat dan ucapan
                      selamat akan ikut terhapus.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>

        <Link
          to={`/awards/${award._id}`}
          className="block cursor-pointer space-y-4"
        >
          {/* Recipient spotlight */}
          <div
            className={cn(
              "flex items-center gap-4",
              featured && "flex-col text-center sm:flex-row sm:text-left",
            )}
          >
            <div className="relative shrink-0">
              <Avatar
                className={cn(
                  "ring-4 ring-background",
                  featured ? "size-20" : "size-14",
                )}
              >
                {award.recipientAvatar ? (
                  <AvatarImage src={award.recipientAvatar} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-lg font-bold">
                  {getInitials(award.recipientName)}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-background shadow-md ring-2 ring-background",
                )}
              >
                <Icon className={cn("size-4", cfg.iconColor)} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "font-bold leading-tight",
                  featured ? "text-2xl" : "text-lg",
                )}
              >
                {award.recipientName ?? "Karyawan"}
              </h3>
              {award.recipientJobTitle ? (
                <p className="text-sm text-muted-foreground">
                  {award.recipientJobTitle}
                  {award.recipientDepartment
                    ? ` • ${award.recipientDepartment}`
                    : ""}
                </p>
              ) : null}
              <p
                className={cn(
                  "mt-1 font-semibold leading-tight",
                  featured ? "text-lg" : "text-sm",
                )}
              >
                {award.title}
              </p>
            </div>
          </div>

          {/* Description */}
          {award.description ? (
            <div className="rounded-lg border bg-card/70 p-3 backdrop-blur-sm">
              <p
                className={cn(
                  "whitespace-pre-wrap text-sm leading-relaxed",
                  !featured && "line-clamp-3",
                )}
              >
                {award.description}
              </p>
            </div>
          ) : null}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Diberikan {formatAwardDate(award.awardedOn)}</span>
            {award.bonusAmount && award.bonusAmount > 0 ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Bonus {formatBonus(award.bonusAmount)}
              </span>
            ) : null}
            {award.certificateUrl ? (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" />
                Sertifikat tersedia
              </span>
            ) : null}
          </div>
        </Link>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground">
            Oleh {award.awardedByName ?? "Admin"}
          </span>
          <Button
            size="sm"
            variant={award.hasCongratulated ? "default" : "ghost"}
            onClick={handleCongrats}
            disabled={congratulating}
            className={cn(
              "h-8 gap-1.5 px-2.5 cursor-pointer",
              award.hasCongratulated &&
                "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            {award.hasCongratulated ? (
              <Star className="size-3.5 fill-current" />
            ) : (
              <PartyPopper className="size-3.5" />
            )}
            <span>
              {award.hasCongratulated ? "Sudah diucapkan" : "Selamat!"}
            </span>
            <span className="tabular-nums font-semibold">
              {award.congratulationCount ?? 0}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
