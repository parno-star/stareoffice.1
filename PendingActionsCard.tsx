import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Briefcase, LifeBuoy, Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PendingActionsSummary } from "@/convex/admin.js";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const leaveTypeLabels: Record<string, string> = {
  annual: "Cuti Tahunan",
  sick: "Sakit",
  personal: "Pribadi",
  maternity: "Melahirkan",
  other: "Lainnya",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const priorityLabels: Record<string, string> = {
  urgent: "Mendesak",
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

const categoryLabels: Record<string, string> = {
  workplace: "Tempat Kerja",
  process: "Proses",
  benefits: "Benefit",
  technology: "Teknologi",
  other: "Lainnya",
};

function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    const d = new Date(`${startDate}T00:00:00`);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  }
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  return `${s.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  })} – ${e.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  })}`;
}

export default function PendingActionsCard({
  data,
}: {
  data: PendingActionsSummary;
}) {
  const navigate = useNavigate();
  const totalItems =
    data.pendingLeave.length +
    data.openTickets.length +
    data.newSuggestions.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Aksi Menunggu</CardTitle>
        {totalItems > 0 ? (
          <Badge variant="secondary">{totalItems} perlu ditinjau</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Leave */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase className="size-3.5 text-primary" />
              </div>
              <p className="text-sm font-semibold">
                Pengajuan Cuti ({data.pendingLeave.length})
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 p-1 text-xs"
              onClick={() => navigate("/leave")}
            >
              Kelola
              <ArrowRight className="size-3" />
            </Button>
          </div>
          {data.pendingLeave.length === 0 ? (
            <p className="pl-9 text-xs text-muted-foreground">
              Tidak ada pengajuan menunggu.
            </p>
          ) : (
            <div className="space-y-1.5 pl-9">
              {data.pendingLeave.map((lr) => (
                <button
                  key={lr.id}
                  onClick={() => navigate("/leave")}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{lr.userName}</p>
                    <p className="truncate text-muted-foreground">
                      {leaveTypeLabels[lr.type] ?? lr.type} •{" "}
                      {formatDateRange(lr.startDate, lr.endDate)} • {lr.dayCount}{" "}
                      hari
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tickets */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10">
                <LifeBuoy className="size-3.5 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="text-sm font-semibold">
                Tiket IT Aktif ({data.openTickets.length})
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 p-1 text-xs"
              onClick={() => navigate("/support")}
            >
              Kelola
              <ArrowRight className="size-3" />
            </Button>
          </div>
          {data.openTickets.length === 0 ? (
            <p className="pl-9 text-xs text-muted-foreground">
              Tidak ada tiket aktif.
            </p>
          ) : (
            <div className="space-y-1.5 pl-9">
              {data.openTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/support/${t.id}`)}
                  className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="truncate text-muted-foreground">
                      {t.authorName} •{" "}
                      {formatDistanceToNow(new Date(t.lastActivityAt), {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${priorityColors[t.priority] ?? priorityColors.medium}`}
                  >
                    {priorityLabels[t.priority] ?? t.priority}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10">
                <Lightbulb className="size-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold">
                Saran Baru ({data.newSuggestions.length})
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 p-1 text-xs"
              onClick={() => navigate("/suggestions")}
            >
              Kelola
              <ArrowRight className="size-3" />
            </Button>
          </div>
          {data.newSuggestions.length === 0 ? (
            <p className="pl-9 text-xs text-muted-foreground">
              Tidak ada saran baru.
            </p>
          ) : (
            <div className="space-y-1.5 pl-9">
              {data.newSuggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate("/suggestions")}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="truncate text-muted-foreground">
                      {categoryLabels[s.category] ?? s.category} •{" "}
                      {s.upvoteCount} dukungan
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
