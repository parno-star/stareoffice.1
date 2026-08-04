import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { api } from "@/convex/_generated/api.js";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  User,
  Newspaper,
  FileText,
  ScrollText,
  BookOpen,
  GraduationCap,
  MessagesSquare,
  BriefcaseBusiness,
  Package,
  Scale,
  UserSearch,
  Users as UsersIcon,
  Goal,
  LayoutDashboard,
  Compass,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

type SearchResultKind =
  | "person"
  | "announcement"
  | "document"
  | "policy"
  | "wiki"
  | "course"
  | "forum"
  | "job"
  | "position"
  | "asset"
  | "recruitment_job"
  | "candidate"
  | "objective";

const KIND_META: Record<
  SearchResultKind,
  { label: string; icon: LucideIcon; color: string }
> = {
  person: {
    label: "Orang",
    icon: User,
    color: "text-blue-600 dark:text-blue-400",
  },
  announcement: {
    label: "Berita",
    icon: Newspaper,
    color: "text-amber-600 dark:text-amber-400",
  },
  document: {
    label: "Dokumen",
    icon: FileText,
    color: "text-slate-600 dark:text-slate-300",
  },
  policy: {
    label: "Kebijakan",
    icon: ScrollText,
    color: "text-rose-600 dark:text-rose-400",
  },
  wiki: {
    label: "Wiki",
    icon: BookOpen,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  course: {
    label: "Pelatihan",
    icon: GraduationCap,
    color: "text-violet-600 dark:text-violet-400",
  },
  forum: {
    label: "Forum",
    icon: MessagesSquare,
    color: "text-cyan-600 dark:text-cyan-400",
  },
  job: {
    label: "Lowongan Internal",
    icon: BriefcaseBusiness,
    color: "text-indigo-600 dark:text-indigo-400",
  },
  position: {
    label: "Jabatan / Grade",
    icon: Scale,
    color: "text-teal-600 dark:text-teal-400",
  },
  asset: {
    label: "Aset",
    icon: Package,
    color: "text-orange-600 dark:text-orange-400",
  },
  recruitment_job: {
    label: "Rekrutmen",
    icon: UserSearch,
    color: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  candidate: {
    label: "Kandidat",
    icon: UsersIcon,
    color: "text-pink-600 dark:text-pink-400",
  },
  objective: {
    label: "OKR",
    icon: Goal,
    color: "text-green-600 dark:text-green-400",
  },
};

// Static navigation shortcuts shown when query is empty.
const QUICK_LINKS: Array<{
  label: string;
  path: string;
  icon: LucideIcon;
}> = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Direktori Karyawan", path: "/directory", icon: User },
  { label: "Berita & Pengumuman", path: "/news", icon: Newspaper },
  { label: "Kebijakan Perusahaan", path: "/policies", icon: ScrollText },
  { label: "Wiki", path: "/wiki", icon: BookOpen },
  { label: "Pelatihan", path: "/training", icon: GraduationCap },
  { label: "Feedback 360°", path: "/feedback360", icon: Compass },
  { label: "Talent Management", path: "/talent", icon: Sprout },
];

export type OmnisearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function Omnisearch({ open, onOpenChange }: OmnisearchProps) {
  const navigate = useNavigate();
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery] = useDebounce(rawQuery, 200);

  // Reset on close
  useEffect(() => {
    if (!open) setRawQuery("");
  }, [open]);

  const trimmed = debouncedQuery.trim();
  const results = useQuery(
    api.omnisearch.search,
    trimmed.length >= 2 ? { query: trimmed } : "skip",
  );

  const isLoading = trimmed.length >= 2 && results === undefined;

  const grouped = useMemo(() => {
    const groups = new Map<SearchResultKind, Array<{
      kind: SearchResultKind;
      id: string;
      title: string;
      subtitle?: string;
      description?: string;
      meta?: string;
      link: string;
    }>>();
    if (!results) return groups;
    for (const r of results) {
      const kind = r.kind as SearchResultKind;
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind)!.push({
        kind,
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        description: r.description,
        meta: r.meta,
        link: r.link,
      });
    }
    return groups;
  }, [results]);

  const totalCount = results?.length ?? 0;

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pencarian Global"
      description="Cari karyawan, dokumen, pelatihan, kebijakan, dan lainnya"
      className="sm:max-w-2xl"
    >
      <CommandInput
        placeholder="Cari apa saja di Star e-Office..."
        value={rawQuery}
        onValueChange={setRawQuery}
      />
      <CommandList className="max-h-[420px]">
        {trimmed.length < 2 ? (
          <>
            <div className="px-3 pt-3 pb-1 text-xs text-muted-foreground">
              Ketik minimal 2 huruf untuk mulai mencari
            </div>
            <CommandGroup heading="Akses Cepat">
              {QUICK_LINKS.map((q) => {
                const Icon = q.icon;
                return (
                  <CommandItem
                    key={q.path}
                    value={`${q.label} ${q.path}`}
                    onSelect={() => handleNavigate(q.path)}
                    className="cursor-pointer"
                  >
                    <Icon className="text-muted-foreground" />
                    <span>{q.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        ) : isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-1 py-2">
                <Skeleton className="size-8 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : totalCount === 0 ? (
          <CommandEmpty>
            Tidak ada hasil untuk{" "}
            <span className="font-semibold">&quot;{trimmed}&quot;</span>
          </CommandEmpty>
        ) : (
          Array.from(grouped.entries()).map(([kind, items], idx) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <div key={kind}>
                {idx > 0 ? <CommandSeparator /> : null}
                <CommandGroup
                  heading={`${meta.label} (${items.length})`}
                >
                  {items.map((item) => (
                    <CommandItem
                      key={`${kind}-${item.id}`}
                      value={`${item.title} ${item.subtitle ?? ""} ${item.description ?? ""}`}
                      onSelect={() => handleNavigate(item.link)}
                      className="cursor-pointer items-start gap-3 py-2.5"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
                        )}
                      >
                        <Icon className={cn("size-4", meta.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {item.title}
                          </span>
                          {item.meta ? (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {item.meta}
                            </span>
                          ) : null}
                        </div>
                        {item.subtitle ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
                        ) : null}
                        {item.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })
        )}
      </CommandList>
    </CommandDialog>
  );
}
