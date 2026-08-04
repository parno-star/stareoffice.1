import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CalendarCheck, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { getMonthRange, formatMinutes } from "../_lib/utils.ts";

export default function MonthlyStats() {
  const range = getMonthRange();
  const stats = useQuery(api.attendance.getMyMonthSummary, {
    startDate: range.start,
    endDate: range.end,
  });

  if (stats === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const items = [
    {
      icon: CalendarCheck,
      label: "Hari Hadir",
      value: stats.presentDays.toString(),
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: AlertTriangle,
      label: "Terlambat",
      value: stats.lateDays.toString(),
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      icon: Clock,
      label: "Total Jam",
      value: formatMinutes(stats.totalMinutes),
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-500/10",
    },
    {
      icon: TrendingUp,
      label: "Rata-rata",
      value: formatMinutes(stats.avgMinutes),
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ringkasan {range.label}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label}>
            <CardContent className="space-y-2">
              <div
                className={`flex size-8 items-center justify-center rounded-lg ${item.bg}`}
              >
                <item.icon className={`size-4 ${item.color}`} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {item.label}
                </div>
                <div className="text-xl font-bold">{item.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
