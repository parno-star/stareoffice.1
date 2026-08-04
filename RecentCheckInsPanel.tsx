import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Activity, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function RecentCheckInsPanel() {
  const recent = useQuery(api.okr.keyResults.listRecentCheckins, { limit: 8 });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4" />
          Aktivitas Terbaru
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recent === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada check-in minggu ini.
          </p>
        ) : (
          recent.map((c) => {
            const delta = c.newValue - c.previousValue;
            const Icon =
              delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
            return (
              <div
                key={c._id}
                className="flex gap-3 rounded-lg border bg-card p-2.5"
              >
                <Avatar className="size-7 shrink-0">
                  <AvatarImage src={c.user?.avatarUrl} />
                  <AvatarFallback className="text-xs">
                    {initials(c.user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-medium">
                      {c.user?.name ?? "Pengguna"}
                    </span>{" "}
                    check-in di{" "}
                    <span className="font-medium">{c.keyResultTitle}</span>
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon
                      className={cn(
                        "size-3",
                        delta > 0
                          ? "text-emerald-600"
                          : delta < 0
                            ? "text-rose-600"
                            : "text-muted-foreground",
                      )}
                    />
                    <span>
                      {c.previousValue} → {c.newValue}
                    </span>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(c.checkedInAt), {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
