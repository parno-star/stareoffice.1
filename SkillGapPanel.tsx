import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Target } from "lucide-react";
import { SKILL_CATEGORY_LABEL } from "../_lib/advanced-utils.ts";

function LevelDots({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={
            i < level
              ? "size-1.5 rounded-full bg-primary"
              : "size-1.5 rounded-full bg-muted"
          }
        />
      ))}
    </span>
  );
}

export default function SkillGapPanel() {
  const data = useQuery(api.training.skills.getMySkillGap, {});
  if (data === undefined) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <BadgeCheck className="size-4 text-emerald-600" />
            <h3 className="font-semibold">Keahlian Dimiliki</h3>
            <span className="text-xs text-muted-foreground">
              {data.owned.length} keahlian
            </span>
          </div>
          {data.owned.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Belum ada keahlian tercatat. Selesaikan kelas atau tambahkan
              keahlian dari halaman organisasi.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.owned.map((s) => (
                <li
                  key={s.skill}
                  className="flex items-center gap-3 rounded-md border bg-muted/30 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.skill}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {SKILL_CATEGORY_LABEL[s.category] ?? s.category} ·{" "}
                      {s.source === "self"
                        ? "Dari profil"
                        : "Dari kelas selesai"}
                    </p>
                  </div>
                  <LevelDots level={s.level} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="size-4 text-orange-600" />
            <h3 className="font-semibold">Kesenjangan Keahlian</h3>
            <Badge variant="secondary" className="ml-auto">
              {data.suggested.length} saran
            </Badge>
          </div>
          {data.suggested.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Mantap! Tidak ada kesenjangan keahlian saat ini.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.suggested.slice(0, 8).map((s) => (
                <li
                  key={s.skill}
                  className="rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{s.skill}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {SKILL_CATEGORY_LABEL[s.category] ?? s.category} ·
                        target level {s.level}
                      </p>
                    </div>
                    <LevelDots level={s.level} />
                  </div>
                  {s.courses.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.courses.slice(0, 3).map((c) => (
                        <Link
                          key={c.courseId}
                          to={`/training/${c.courseId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15"
                        >
                          {c.title}
                          <ArrowRight className="size-3" />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
