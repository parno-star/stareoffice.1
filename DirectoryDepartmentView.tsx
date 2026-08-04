import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Users } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import type { DirectoryEntry } from "@/convex/directory.js";
import {
  colorForDepartment,
  COLOR_CLASSES,
  getInitials,
} from "../_lib/directory-utils.ts";

type DeptGroup = {
  name: string;
  entries: Array<DirectoryEntry>;
};

export default function DirectoryDepartmentView({
  entries,
  onSelect,
}: {
  entries: Array<DirectoryEntry>;
  onSelect: (id: Id<"users">) => void;
}) {
  const groups = useMemo<Array<DeptGroup>>(() => {
    const map = new Map<string, Array<DirectoryEntry>>();
    for (const e of entries) {
      const key = e.user.department ?? "Tanpa Departemen";
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .map(([name, list]) => ({ name, entries: list }))
      .sort((a, b) => {
        if (a.name === "Tanpa Departemen") return 1;
        if (b.name === "Tanpa Departemen") return -1;
        return b.entries.length - a.entries.length;
      });
  }, [entries]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => {
        const tone =
          g.name === "Tanpa Departemen"
            ? COLOR_CLASSES.blue
            : COLOR_CLASSES[colorForDepartment(g.name)];
        return (
          <Card key={g.name} className="overflow-hidden pt-0">
            <div className={`h-1.5 w-full ${tone.accent}`} />
            <CardContent className="pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-9 items-center justify-center rounded-lg ${tone.bg} ${tone.text}`}
                  >
                    <Users className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{g.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {g.entries.length} karyawan
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className={tone.chip}>
                  {g.entries.length}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {g.entries.map((entry) => (
                  <button
                    key={entry.user._id}
                    onClick={() => onSelect(entry.user._id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-all hover:border-primary/30 hover:bg-muted/60"
                  >
                    <Avatar className="size-8 shrink-0">
                      {entry.user.avatarUrl ? (
                        <AvatarImage
                          src={entry.user.avatarUrl}
                          alt={entry.user.name ?? ""}
                        />
                      ) : null}
                      <AvatarFallback className="text-xs font-medium">
                        {getInitials(entry.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {entry.user.name ?? "Tanpa Nama"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.user.jobTitle ?? "—"}
                      </p>
                    </div>
                    {entry.directReportCount > 0 ? (
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                        {entry.directReportCount} bawahan
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
