import { Card } from "@/components/ui/card.tsx";
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
  MoreVertical,
  CheckCircle2,
  Users2,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Send,
  XCircle,
  Trash2,
  Copy,
  Pencil,
  CalendarDays,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { PulseListItem } from "@/convex/pulse";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FREQUENCY_LABELS,
  STATUS_CONFIG,
  formatScorePercent,
  getCoverClass,
  getSentimentBand,
} from "@/pages/pulse/_lib/pulse-utils.ts";

export default function PulseCard({
  pulse,
  isAdmin,
  isOwner,
  onRespond,
  onViewResults,
  onPublish,
  onClose,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  pulse: PulseListItem;
  isAdmin: boolean;
  isOwner: boolean;
  onRespond: () => void;
  onViewResults: () => void;
  onPublish: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusCfg = STATUS_CONFIG[pulse.status] ?? STATUS_CONFIG.draft;
  const CategoryIcon = CATEGORY_ICONS[pulse.category];
  const band = getSentimentBand(pulse.averageSentiment);

  const canManage = isAdmin || isOwner;

  return (
    <Card className="overflow-hidden p-0">
      <div
        className={cn(
          "h-20 flex items-center justify-between px-4 relative",
          getCoverClass(pulse.color),
        )}
      >
        <div className="flex items-center gap-2 text-white">
          {CategoryIcon && <CategoryIcon className="size-5" />}
          <span className="text-sm font-semibold uppercase tracking-wide">
            {CATEGORY_LABELS[pulse.category] ?? pulse.category}
          </span>
          {pulse.isAnonymous && (
            <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
              <ShieldCheck className="size-3" />
              Anonim
            </Badge>
          )}
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-white hover:bg-white/20 cursor-pointer"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pulse.status === "draft" && (
                <>
                  <DropdownMenuItem
                    onClick={onPublish}
                    className="cursor-pointer"
                  >
                    <Send className="size-4" />
                    Terbitkan Sekarang
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onEdit}
                    className="cursor-pointer"
                  >
                    <Pencil className="size-4" />
                    Sunting
                  </DropdownMenuItem>
                </>
              )}
              {pulse.status === "active" && (
                <DropdownMenuItem onClick={onClose} className="cursor-pointer">
                  <XCircle className="size-4" />
                  Tutup Pulse
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onViewResults}
                className="cursor-pointer"
              >
                <BarChart3 className="size-4" />
                Lihat Hasil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDuplicate}
                className="cursor-pointer"
              >
                <Copy className="size-4" />
                Duplikasi / Kirim Ulang
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive cursor-pointer"
              >
                <Trash2 className="size-4" />
                Hapus Pulse
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={cn(statusCfg.badge, "border")} variant="outline">
              <span className={cn("mr-1.5 size-1.5 rounded-full", statusCfg.dot)} />
              {statusCfg.label}
            </Badge>
            {pulse.hasResponded && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 className="size-3" />
                Sudah Diisi
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              <Repeat className="size-3" />
              {FREQUENCY_LABELS[pulse.frequency] ?? pulse.frequency}
            </Badge>
          </div>
          <h3 className="font-semibold line-clamp-2">{pulse.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {pulse.question}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users2 className="size-3" />
              <span>Respons</span>
            </div>
            <p className="font-semibold text-sm mt-0.5">
              {pulse.responseCount}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="size-3" />
              <span>Sentimen</span>
            </div>
            <p className={cn("font-semibold text-sm mt-0.5", band.color)}>
              {formatScorePercent(pulse.averageSentiment)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="size-3" />
              <span>Mulai</span>
            </div>
            <p className="font-semibold text-sm mt-0.5">
              {format(new Date(pulse.startDate), "d MMM", {
                locale: idLocale,
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-xs text-muted-foreground line-clamp-1">
            {pulse.targetDepartment ? pulse.targetDepartment : "Semua Karyawan"}
            {pulse.authorName && <> · oleh {pulse.authorName}</>}
          </div>
          {pulse.canRespond ? (
            <Button
              size="sm"
              onClick={onRespond}
              className="cursor-pointer"
            >
              Beri Pendapat
            </Button>
          ) : pulse.hasResponded && canManage ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onViewResults}
              className="cursor-pointer"
            >
              Lihat Hasil
            </Button>
          ) : pulse.hasResponded ? (
            <Button size="sm" variant="ghost" disabled>
              Terima Kasih
            </Button>
          ) : canManage ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onViewResults}
              className="cursor-pointer"
            >
              Hasil
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
