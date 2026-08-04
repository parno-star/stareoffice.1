import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import { Sparkles, TrendingUp } from "lucide-react";
import {
  formatDuration,
  getCategoryConfig,
  getColorConfig,
  getLevelConfig,
} from "../_lib/training-utils.ts";
import { Badge } from "@/components/ui/badge.tsx";

export default function RecommendationsPanel() {
  const recs = useQuery(api.training.recommendations.getRecommendations, {
    limit: 6,
  });

  if (recs === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }
  if (recs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Belum ada rekomendasi</p>
        <p className="text-xs text-muted-foreground">
          Lengkapi keahlian & selesaikan kelas pertama untuk mendapatkan saran
          cerdas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-purple-600" />
        <h3 className="font-semibold">Rekomendasi untuk Anda</h3>
        <Badge variant="secondary" className="ml-auto gap-1">
          <TrendingUp className="size-3" /> AI
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recs.map((c) => {
          const color = getColorConfig(c.coverColor);
          const cat = getCategoryConfig(c.category);
          const level = getLevelConfig(c.level);
          const CatIcon = cat.icon;
          return (
            <Link
              key={c._id}
              to={`/training/${c._id}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-lg"
            >
              <div
                className={cn(
                  "relative p-4 text-white",
                  color.cover,
                )}
              >
                <div className="flex items-center justify-between">
                  <CatIcon className="size-5" />
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                    {c.score} pts
                  </span>
                </div>
                <h4 className="mt-2 line-clamp-2 text-sm font-bold">
                  {c.title}
                </h4>
                <p className="mt-1 text-[11px] text-white/85">
                  {cat.label} · {level.label} ·{" "}
                  {formatDuration(c.durationMinutes)}
                </p>
              </div>
              <div className="flex-1 space-y-1 p-3">
                {c.reasons.slice(0, 2).map((r, i) => (
                  <p
                    key={i}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                  >
                    <span className="inline-block size-1 rounded-full bg-primary" />
                    {r}
                  </p>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
