import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  History,
  User as UserIcon,
  Building2,
  Users as UsersIcon,
  Briefcase,
  Link2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";

function getEventMeta(eventType: string): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
} {
  if (eventType.startsWith("manager")) {
    return {
      icon: UserIcon,
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
      label: "Atasan",
    };
  }
  if (eventType.startsWith("department")) {
    return {
      icon: Building2,
      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
      label: "Departemen",
    };
  }
  if (eventType.startsWith("team")) {
    return {
      icon: UsersIcon,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      label: "Tim",
    };
  }
  if (eventType.startsWith("position")) {
    return {
      icon: Briefcase,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      label: "Posisi",
    };
  }
  if (eventType.startsWith("dotted")) {
    return {
      icon: Link2,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
      label: "Jalur Sekunder",
    };
  }
  return {
    icon: History,
    color: "bg-muted text-muted-foreground border-border",
    label: "Lainnya",
  };
}

export default function OrgHistoryPanel() {
  const history = useQuery(api.orgAdvanced.history.listRecent, { limit: 50 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" />
          Riwayat Perubahan Struktur
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!history ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada perubahan tercatat
          </p>
        ) : (
          <div className="relative space-y-3 pl-4">
            <div className="absolute left-1 top-2 bottom-2 w-0.5 bg-border" />
            {history.map((h) => {
              const meta = getEventMeta(h.row.eventType);
              const Icon = meta.icon;
              return (
                <div key={h.row._id} className="relative">
                  <div
                    className={cn(
                      "absolute -left-3.5 top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-background",
                      meta.color,
                    )}
                  >
                    <Icon className="size-3" />
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", meta.color)}
                      >
                        {meta.label}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(h.row.timestamp), "d MMM yyyy · HH:mm", {
                          locale: localeId,
                        })}
                      </p>
                    </div>
                    <p className="text-sm">{h.row.summary}</p>
                    {h.actor ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        oleh {h.actor.name ?? "Admin"}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
