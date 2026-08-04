import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  HeartPulse,
  Flame,
  CalendarDays,
  TrendingUp,
  BatteryCharging,
  CloudLightning,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  MOOD_ICONS,
  getMoodColor,
  getMoodLabel,
} from "@/pages/engagement/_lib/engagement-utils.ts";

export default function WellnessPanel({
  onCheckin,
}: {
  onCheckin: () => void;
}) {
  const summary = useQuery(api.engagement.getWellnessSummary, {});
  const today = useQuery(api.engagement.getTodayWellness, {});
  const history = useQuery(api.engagement.listMyWellnessCheckins, {
    limit: 10,
  });

  if (summary === undefined || today === undefined || history === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const todaysMood = today?.moodScore;

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-200/50 dark:border-rose-500/20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <HeartPulse className="size-5 text-rose-500" />
              Check-in Wellness Hari Ini
            </h3>
            <p className="text-sm text-muted-foreground">
              {today
                ? "Anda sudah melakukan check-in hari ini. Perbarui jika perasaan berubah."
                : "Luangkan 30 detik untuk merefleksikan perasaan Anda."}
            </p>
          </div>
          <Button onClick={onCheckin} className="cursor-pointer">
            <HeartPulse className="size-4" />
            {today ? "Perbarui" : "Mulai Check-in"}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <StatTile
            icon={HeartPulse}
            label="Mood Hari Ini"
            value={todaysMood ? getMoodLabel(todaysMood) : "—"}
            color={todaysMood ? getMoodColor(todaysMood) : "text-muted-foreground"}
          />
          <StatTile
            icon={Flame}
            label="Streak"
            value={`${summary.streakDays} hari`}
            color="text-orange-500"
          />
          <StatTile
            icon={TrendingUp}
            label="Rata-rata Mood"
            value={
              summary.averageMood !== null
                ? `${summary.averageMood.toFixed(1)} / 5`
                : "—"
            }
            color="text-emerald-500"
          />
          <StatTile
            icon={CalendarDays}
            label="Total Check-in"
            value={String(summary.totalCheckins)}
            color="text-blue-500"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <BatteryCharging className="size-4 text-emerald-500" />
            <p className="text-sm font-semibold">Energi</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {summary.averageEnergy !== null
              ? summary.averageEnergy.toFixed(1)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Rata-rata dari 5</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CloudLightning className="size-4 text-rose-500" />
            <p className="text-sm font-semibold">Stres</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {summary.averageStress !== null
              ? summary.averageStress.toFixed(1)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Rata-rata dari 5</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-amber-500" />
            <p className="text-sm font-semibold">Beban Kerja</p>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {summary.averageWorkload !== null
              ? summary.averageWorkload.toFixed(1)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Rata-rata dari 5</p>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          Mood 14 Hari Terakhir
        </h3>
        <div className="flex items-end justify-between gap-1 h-32">
          {summary.last14Days.map((d) => {
            const h = d.moodScore ? (d.moodScore / 5) * 100 : 0;
            const mood = MOOD_ICONS.find(
              (m) => m.value === Math.round(d.moodScore ?? 0),
            );
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center justify-end gap-1"
              >
                <div className="w-full flex flex-col items-center justify-end h-full">
                  <div
                    className={cn(
                      "w-full rounded-t-md min-h-[4px] transition-all",
                      d.moodScore
                        ? mood?.value === 5
                          ? "bg-blue-500"
                          : mood?.value === 4
                            ? "bg-emerald-500"
                            : mood?.value === 3
                              ? "bg-amber-500"
                              : mood?.value === 2
                                ? "bg-orange-500"
                                : "bg-rose-500"
                        : "bg-muted",
                    )}
                    style={{ height: `${Math.max(h, 4)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(d.date), "d", { locale: idLocale })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {format(
              new Date(summary.last14Days[0]?.date ?? new Date()),
              "d MMM",
              { locale: idLocale },
            )}
          </span>
          <span>
            {format(
              new Date(
                summary.last14Days[summary.last14Days.length - 1]?.date ??
                  new Date(),
              ),
              "d MMM",
              { locale: idLocale },
            )}
          </span>
        </div>
      </Card>

      {summary.tagCounts.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Tag Perasaan Anda</h3>
          <div className="flex flex-wrap gap-2">
            {summary.tagCounts.map((t) => (
              <Badge key={t.tag} variant="secondary" className="capitalize">
                {t.tag} · {t.count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Riwayat Check-in</h3>
        {history.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HeartPulse />
              </EmptyMedia>
              <EmptyTitle>Belum ada check-in</EmptyTitle>
              <EmptyDescription>
                Mulai check-in pertama Anda untuk melacak perasaan.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={onCheckin} className="cursor-pointer">
                Mulai Check-in
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-2">
            {history.map((c) => {
              const mood = MOOD_ICONS.find((m) => m.value === c.moodScore);
              const Icon = mood?.icon ?? HeartPulse;
              return (
                <div
                  key={c._id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <Icon className={cn("size-5 shrink-0 mt-0.5", mood?.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {mood?.label ?? "-"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.checkedInAt), "d MMM yyyy, HH:mm", {
                          locale: idLocale,
                        })}
                      </span>
                    </div>
                    {c.note && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {c.note}
                      </p>
                    )}
                    {c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.tags.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="text-[10px] px-2 py-0 capitalize"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-background/60 border p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", color)} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
