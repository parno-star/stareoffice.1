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
  Clock,
  Users2,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Send,
  XCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { SurveyListItem } from "@/convex/engagement";
import {
  KIND_ICONS,
  KIND_LABELS,
  STATUS_CONFIG,
  formatScorePercent,
  getCoverClass,
} from "@/pages/engagement/_lib/engagement-utils.ts";

export default function SurveyCard({
  survey,
  isAdmin,
  isOwner,
  onRespond,
  onViewResults,
  onPublish,
  onClose,
  onDelete,
}: {
  survey: SurveyListItem;
  isAdmin: boolean;
  isOwner: boolean;
  onRespond: () => void;
  onViewResults: () => void;
  onPublish: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const statusCfg = STATUS_CONFIG[survey.status] ?? STATUS_CONFIG.draft;
  const KindIcon = KIND_ICONS[survey.kind];

  const canManage = isAdmin || isOwner;

  return (
    <Card className="overflow-hidden p-0">
      <div
        className={cn(
          "h-20 flex items-center justify-between px-4 relative",
          getCoverClass(survey.color),
        )}
      >
        <div className="flex items-center gap-2 text-white">
          {KindIcon && <KindIcon className="size-5" />}
          <span className="text-sm font-semibold uppercase tracking-wide">
            {KIND_LABELS[survey.kind] ?? survey.kind}
          </span>
          {survey.isAnonymous && (
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
              {survey.status === "draft" && (
                <DropdownMenuItem
                  onClick={onPublish}
                  className="cursor-pointer"
                >
                  <Send className="size-4" />
                  Terbitkan Sekarang
                </DropdownMenuItem>
              )}
              {survey.status === "active" && (
                <DropdownMenuItem onClick={onClose} className="cursor-pointer">
                  <XCircle className="size-4" />
                  Tutup Survei
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onViewResults}
                className="cursor-pointer"
              >
                <BarChart3 className="size-4" />
                Lihat Hasil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive cursor-pointer"
              >
                <Trash2 className="size-4" />
                Hapus Survei
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
            {survey.hasResponded && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 className="size-3" />
                Sudah Diisi
              </Badge>
            )}
          </div>
          <h3 className="font-semibold line-clamp-2">{survey.title}</h3>
          {survey.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {survey.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users2 className="size-3" />
              <span>Respons</span>
            </div>
            <p className="font-semibold text-sm mt-0.5">
              {survey.responseCount}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="size-3" />
              <span>Skor</span>
            </div>
            <p className="font-semibold text-sm mt-0.5">
              {formatScorePercent(survey.averageScore)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              <span>Tutup</span>
            </div>
            <p className="font-semibold text-sm mt-0.5">
              {survey.endDate
                ? format(new Date(survey.endDate), "d MMM", {
                    locale: idLocale,
                  })
                : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-xs text-muted-foreground">
            {survey.questionCount} pertanyaan
            {survey.targetDepartment && (
              <> · {survey.targetDepartment}</>
            )}
          </div>
          {survey.canRespond ? (
            <Button
              size="sm"
              onClick={onRespond}
              className="cursor-pointer"
            >
              Isi Survei
            </Button>
          ) : survey.hasResponded && (isAdmin || isOwner) ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onViewResults}
              className="cursor-pointer"
            >
              Lihat Hasil
            </Button>
          ) : survey.hasResponded ? (
            <Button size="sm" variant="ghost" disabled>
              Terima Kasih
            </Button>
          ) : isAdmin || isOwner ? (
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
