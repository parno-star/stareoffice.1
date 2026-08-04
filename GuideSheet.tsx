import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { getGuideForMenu } from "@/lib/guide-data.ts";
import type { MenuGuide } from "@/lib/guide-data.ts";
import { motion, AnimatePresence } from "motion/react";

/**
 * Tipe data nav yang di-pass dari DashboardLayout.
 * Menggunakan struktur yang sama persis dengan navGroups.
 */
type GuideNavItem = {
  key: string;
  label: string;
};

type GuideNavSubGroup = {
  key: string;
  label: string;
  items: GuideNavItem[];
};

type GuideNavGroup = {
  key: string;
  label: string;
  items: GuideNavItem[];
  subGroups?: GuideNavSubGroup[];
};

type GuideSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navGroups: ReadonlyArray<GuideNavGroup>;
};

/** Flatten all menu items for search & navigation */
function flattenItems(groups: ReadonlyArray<GuideNavGroup>): GuideNavItem[] {
  const result: GuideNavItem[] = [];
  for (const g of groups) {
    for (const item of g.items) result.push(item);
    for (const sg of g.subGroups ?? []) {
      for (const item of sg.items) result.push(item);
    }
  }
  return result;
}

function GuideContent({ guide, label }: { guide: MenuGuide; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Purpose */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{label}</h3>
          {guide.status === "coming_soon" && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Clock className="size-3" />
              Segera Hadir
            </Badge>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {guide.purpose}
        </p>
      </div>

      {/* Flow */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ArrowRight className="size-4 text-primary" />
          Alur Proses
        </h4>
        <div className="relative space-y-0 pl-4">
          {guide.flow.map((step, i) => (
            <div key={i} className="relative flex items-start gap-3 pb-3 last:pb-0">
              {/* Connector line */}
              {i < guide.flow.length - 1 && (
                <div className="absolute left-[7px] top-6 h-[calc(100%-12px)] w-px bg-border" />
              )}
              {/* Number circle */}
              <div className="relative z-10 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground mt-0.5">
                {i + 1}
              </div>
              <span className="text-sm text-muted-foreground">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          Langkah Pengoperasian
        </h4>
        <div className="space-y-3">
          {guide.steps.map((step, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-3 space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{step.title}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground pl-7">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function GuideSheet({
  open,
  onOpenChange,
  navGroups,
}: GuideSheetProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allItems = useMemo(() => flattenItems(navGroups), [navGroups]);

  const selectedItem = allItems.find((i) => i.key === selectedKey);
  const selectedGuide = selectedItem
    ? getGuideForMenu(selectedItem.key, selectedItem.label)
    : null;

  // Filter groups/items by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return navGroups;
    const q = searchQuery.toLowerCase();
    return navGroups
      .map((g) => {
        const items = g.items.filter((i) =>
          i.label.toLowerCase().includes(q),
        );
        const subGroups = (g.subGroups ?? [])
          .map((sg) => ({
            ...sg,
            items: sg.items.filter((i) =>
              i.label.toLowerCase().includes(q),
            ),
          }))
          .filter((sg) => sg.items.length > 0);
        return { ...g, items, subGroups };
      })
      .filter((g) => g.items.length > 0 || (g.subGroups ?? []).length > 0);
  }, [navGroups, searchQuery]);

  const handleBack = () => setSelectedKey(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {selectedKey && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleBack}
                className="shrink-0 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <SheetTitle className="text-lg">
                {selectedKey ? "Detail Panduan" : "Panduan Menu"}
              </SheetTitle>
            </div>
          </div>
          {!selectedKey && (
            <p className="text-sm text-muted-foreground mt-1">
              Pilih menu untuk melihat panduan penggunaan
            </p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-6">
            <AnimatePresence mode="wait">
              {selectedKey && selectedGuide ? (
                <GuideContent
                  key={selectedKey}
                  guide={selectedGuide}
                  label={selectedItem?.label ?? ""}
                />
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cari menu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Menu Groups */}
                  {filteredGroups.map((group) => (
                    <div key={group.key} className="space-y-1.5">
                      <h4 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {group.label}
                      </h4>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const guide = getGuideForMenu(item.key, item.label);
                          return (
                            <button
                              key={item.key}
                              onClick={() => setSelectedKey(item.key)}
                              className={cn(
                                "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {item.label}
                                </span>
                                {guide.status === "coming_soon" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    Segera
                                  </Badge>
                                )}
                              </div>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </button>
                          );
                        })}

                        {/* Sub groups */}
                        {(group.subGroups ?? []).map((sg) => (
                          <div key={sg.key} className="mt-1 space-y-0.5">
                            <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                              {sg.label}
                            </p>
                            {sg.items.map((item) => {
                              const guide = getGuideForMenu(
                                item.key,
                                item.label,
                              );
                              return (
                                <button
                                  key={item.key}
                                  onClick={() => setSelectedKey(item.key)}
                                  className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 pl-5 text-sm transition-colors hover:bg-accent"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {item.label}
                                    </span>
                                    {guide.status === "coming_soon" && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        Segera
                                      </Badge>
                                    )}
                                  </div>
                                  <ChevronRight className="size-4 text-muted-foreground" />
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredGroups.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada menu yang cocok dengan pencarian Anda.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
