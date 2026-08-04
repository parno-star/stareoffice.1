import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Sparkles, Users } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { DirectoryEntry } from "@/convex/directory.js";
import {
  getInitials,
  SKILL_CATEGORY_LABELS,
} from "../_lib/directory-utils.ts";

type SkillBucket = {
  skill: string;
  category: string;
  entries: Array<{ entry: DirectoryEntry; level: number }>;
  avgLevel: number;
};

export default function DirectorySkillsView({
  entries,
  onSelect,
  onPickSkill,
}: {
  entries: Array<DirectoryEntry>;
  onSelect: (id: Id<"users">) => void;
  onPickSkill: (skill: string) => void;
}) {
  const buckets = useMemo<Array<SkillBucket>>(() => {
    const map = new Map<string, SkillBucket>();
    for (const e of entries) {
      for (const s of e.skills) {
        const key = `${s.skill.toLowerCase()}__${s.category}`;
        const existing = map.get(key);
        if (existing) {
          existing.entries.push({ entry: e, level: s.level });
        } else {
          map.set(key, {
            skill: s.skill,
            category: s.category,
            entries: [{ entry: e, level: s.level }],
            avgLevel: 0,
          });
        }
      }
    }
    for (const bucket of map.values()) {
      const sum = bucket.entries.reduce((a, b) => a + b.level, 0);
      bucket.avgLevel =
        bucket.entries.length > 0
          ? Math.round((sum / bucket.entries.length) * 10) / 10
          : 0;
      bucket.entries.sort((a, b) => b.level - a.level);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.entries.length - a.entries.length,
    );
  }, [entries]);

  if (buckets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">Belum ada keahlian terdaftar</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Karyawan dapat menambahkan keahlian mereka dari halaman Struktur
            Organisasi di bagian Keahlian.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {buckets.map((b) => (
        <Card key={`${b.skill}-${b.category}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onPickSkill(b.skill)}
                className="group cursor-pointer text-left"
              >
                <p className="font-semibold leading-tight group-hover:text-primary group-hover:underline">
                  {b.skill}
                </p>
                <p className="text-xs text-muted-foreground">
                  {SKILL_CATEGORY_LABELS[b.category] ?? b.category}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Users className="size-3" />
                  {b.entries.length}
                </Badge>
                <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  ★ {b.avgLevel}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {b.entries.slice(0, 8).map(({ entry, level }) => (
                <button
                  key={entry.user._id}
                  onClick={() => onSelect(entry.user._id)}
                  className="group flex cursor-pointer items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm"
                  title={`${entry.user.name ?? "?"} · ${level}/5`}
                >
                  <Avatar className="size-5">
                    {entry.user.avatarUrl ? (
                      <AvatarImage
                        src={entry.user.avatarUrl}
                        alt={entry.user.name ?? ""}
                      />
                    ) : null}
                    <AvatarFallback className="text-[9px] font-semibold">
                      {getInitials(entry.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[110px] truncate group-hover:text-primary">
                    {entry.user.name ?? "?"}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {level}
                  </span>
                </button>
              ))}
              {b.entries.length > 8 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  +{b.entries.length - 8}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
