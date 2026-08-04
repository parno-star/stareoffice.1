/**
 * RecipientProgress – menampilkan daftar penerima surat massal beserta status
 * bacanya untuk pengirim/admin. Menampilkan ringkasan "Dibaca X dari Y" dan
 * daftar tiap penerima (sudah baca / belum baca). Otomatis tersembunyi bila
 * surat bukan pengiriman massal.
 */
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Users, CheckCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Props = {
  letterId: Id<"letters">;
};

const MODE_LABEL: Record<string, string> = {
  individual: "Beberapa penerima",
  department: "Per departemen",
  all: "Seluruh karyawan",
};

export default function RecipientProgress({ letterId }: Props) {
  const data = useQuery(api.letters.getLetterRecipients, { letterId });

  // Loading
  if (data === undefined) {
    return (
      <div className="space-y-2 rounded-lg border p-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Bukan surat massal, atau tidak ada penerima → jangan tampilkan apa pun.
  if (!data || data.total === 0) return null;

  const pct = data.total > 0 ? Math.round((data.readCount / data.total) * 100) : 0;
  const modeLabel = data.mode ? MODE_LABEL[data.mode] ?? "" : "";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="size-3.5" /> Penerima
          {data.department && (
            <span className="normal-case text-foreground">· {data.department}</span>
          )}
        </p>
        {modeLabel && (
          <Badge variant="secondary" className="text-[10px]">{modeLabel}</Badge>
        )}
      </div>

      {/* Ringkasan progres baca */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            Dibaca {data.readCount} dari {data.total}
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* Daftar penerima */}
      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {data.recipients.map((r) => (
          <div
            key={r.userId}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50"
          >
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="text-[10px]">
                {r.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{r.name}</p>
              {(r.jobTitle || r.department) && (
                <p className="truncate text-[11px] text-muted-foreground leading-tight">
                  {[r.jobTitle, r.department].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {r.readAt ? (
              <span
                className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                title={`Dibaca ${format(new Date(r.readAt), "d MMM yyyy HH:mm", { locale: localeId })}`}
              >
                <CheckCheck className="size-3.5" /> Dibaca
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="size-3.5" /> Belum
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
