import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Sparkles, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { getInitials } from "../_lib/org-utils.ts";

export default function SmartSearch({
  onSelectUser,
}: {
  onSelectUser: (id: Id<"users">) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, { flush }] = useDebounce(query, 300);

  const results = useQuery(
    api.orgAdvanced.benchmark.aiSearch,
    debounced.trim().length > 1 ? { query: debounced } : "skip",
  );

  // Flush on unmount to avoid stale search
  useEffect(() => {
    return () => flush();
  }, [flush]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Pencarian Cerdas</p>
            <p className="text-[11px] text-muted-foreground">
              Cari orang berdasarkan nama, jabatan, keahlian, atau deskripsi.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari: React, kepemimpinan, Jakarta, finance..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {debounced.trim().length <= 1 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Ketik minimal 2 karakter untuk mulai mencari
          </p>
        ) : !results ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Tidak ada hasil ditemukan
          </p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {results.map((r) => (
              <button
                key={r.user._id}
                type="button"
                onClick={() => onSelectUser(r.user._id)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted cursor-pointer"
              >
                <Avatar className="size-9">
                  {r.user.avatarUrl ? (
                    <AvatarImage src={r.user.avatarUrl} alt={r.user.name ?? ""} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(r.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">
                      {r.user.name ?? "Tanpa Nama"}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      skor {r.score}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.user.jobTitle ?? "—"}
                    {r.user.department ? ` · ${r.user.department}` : ""}
                  </p>
                  {r.reasons.length > 0 ? (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      Cocok: {r.reasons.join(", ")}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
