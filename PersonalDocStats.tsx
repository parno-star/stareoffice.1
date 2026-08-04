import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { FileStack, CalendarClock, AlertTriangle, Folder } from "lucide-react";

export default function PersonalDocStats({
  stats,
  isLoading,
}: {
  stats:
    | {
        total: number;
        byCategory: Record<string, number>;
        expiringSoon: number;
        expired: number;
      }
    | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const items = [
    {
      icon: FileStack,
      label: "Total Dokumen",
      value: stats.total,
      tint: "bg-primary/10 text-primary",
    },
    {
      icon: Folder,
      label: "Kategori",
      value: Object.keys(stats.byCategory).length,
      tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      icon: CalendarClock,
      label: "Akan Berakhir",
      value: stats.expiringSoon,
      tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      icon: AlertTriangle,
      label: "Kadaluarsa",
      value: stats.expired,
      tint:
        stats.expired > 0
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-muted text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tint}`}
            >
              <item.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-bold">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
