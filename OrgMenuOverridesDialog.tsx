import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { MENU_ITEMS, type MenuKey } from "@/convex/roles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  SlidersHorizontal,
  RotateCcw,
  Search,
  Check,
  X,
  Minus,
  Info,
} from "lucide-react";

// Menu grouping mirrors the sidebar structure so super admins share the same
// mental model as in the role-menu editor.
const MENU_GROUPS: { label: string; keys: MenuKey[] }[] = [
  {
    label: "Umum",
    keys: ["home", "dashboard", "my_profile", "chatbot", "notifications", "calendar", "letters"],
  },
  {
    label: "Ruang Saya",
    keys: ["attendance", "leave", "expenses", "fund_requests", "travel", "projects", "career_path"],
  },
  {
    label: "Komunikasi",
    keys: ["messages", "news", "forum", "polls", "suggestions", "celebrations", "recognitions", "awards", "gallery"],
  },
  {
    label: "Tim & Kinerja",
    keys: ["organization", "teams", "performance", "okr", "feedback360", "engagement", "pulse"],
  },
  {
    label: "Sumber Daya",
    keys: ["rooms", "assets", "events", "documents", "my_documents", "wiki", "policies"],
  },
  {
    label: "Manajemen SDM",
    keys: ["directory", "career_planning", "recruitment", "jobs", "onboarding", "offboarding", "training", "mentorship", "talent", "grading", "profile_verification", "reports", "analytics"],
  },
  {
    label: "Keuangan",
    keys: ["payroll", "finance_dashboard", "finance_audit", "finance_settings"],
  },
  {
    label: "Administrasi",
    keys: ["admin", "user_management", "billing", "support"],
  },
];

type ForcedState = "on" | "off" | "default";

export default function OrgMenuOverridesDialog({
  organizationId,
  organizationName,
  open,
  onClose,
}: {
  organizationId: Id<"organizations">;
  organizationName: string;
  open: boolean;
  onClose: () => void;
}) {
  const overrides = useQuery(
    api.orgMenuOverrides.getForOrg,
    open ? { organizationId } : "skip",
  );
  const setOverride = useMutation(api.orgMenuOverrides.setOverride);
  const clearAll = useMutation(api.orgMenuOverrides.clearAllForOrg);

  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const overrideCount = overrides ? Object.keys(overrides).length : 0;

  const menuByKey = useMemo(() => {
    const map = new Map<MenuKey, (typeof MENU_ITEMS)[number]>();
    for (const m of MENU_ITEMS) map.set(m.key, m);
    return map;
  }, []);

  function stateFor(key: MenuKey): ForcedState {
    const o = overrides?.[key];
    if (!o) return "default";
    return o.forced;
  }

  async function apply(key: MenuKey, forced: ForcedState) {
    setSavingKey(key);
    try {
      await setOverride({ organizationId, menuKey: key, forced });
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message: string };
        toast.error(data.message);
      } else {
        toast.error("Gagal menyimpan pengaturan");
      }
    } finally {
      setSavingKey(null);
    }
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      await clearAll({ organizationId });
      toast.success("Semua pengaturan menu khusus direset");
    } catch {
      toast.error("Gagal mereset pengaturan");
    } finally {
      setClearing(false);
    }
  }

  const query = search.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            Menu Khusus — {organizationName}
          </DialogTitle>
          <DialogDescription>
            Nyalakan atau matikan menu khusus untuk organisasi ini saja. Pengaturan
            ini menimpa paket langganan dan tidak memengaruhi organisasi lain.
          </DialogDescription>
        </DialogHeader>

        {/* Legend + search */}
        <div className="space-y-3 border-b pb-3">
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Minus className="w-3.5 h-3.5" /> Ikuti paket (default)
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <Check className="w-3.5 h-3.5" /> Selalu aktif
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <X className="w-3.5 h-3.5" /> Selalu nonaktif
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari menu..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Menu list */}
        <div className="overflow-y-auto flex-1 pr-1 py-2 space-y-5">
          {overrides === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
              {MENU_GROUPS.map((group) => {
                const items = group.keys
                  .map((k) => menuByKey.get(k))
                  .filter((m): m is (typeof MENU_ITEMS)[number] => Boolean(m))
                  .filter((m) =>
                    query === "" ||
                    m.label.toLowerCase().includes(query) ||
                    m.description.toLowerCase().includes(query),
                  );
                if (items.length === 0) return null;

                return (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {group.label}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((menuItem) => {
                        const isAlwaysOn = menuItem.alwaysOn ?? false;
                        const state = stateFor(menuItem.key);
                        const busy = savingKey === menuItem.key;
                        return (
                          <div
                            key={menuItem.key}
                            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/60 bg-card"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium leading-tight truncate">
                                  {menuItem.label}
                                </p>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3 h-3 text-muted-foreground shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-[220px]">
                                    <p className="text-xs">{menuItem.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                                {isAlwaysOn && (
                                  <Badge variant="secondary" className="text-[10px] py-0 shrink-0">
                                    Inti
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Tri-state segmented control */}
                            <div className="flex items-center rounded-md border overflow-hidden shrink-0">
                              <SegBtn
                                active={state === "default"}
                                disabled={busy}
                                onClick={() => void apply(menuItem.key, "default")}
                                title="Ikuti paket"
                                tone="neutral"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </SegBtn>
                              <SegBtn
                                active={state === "on"}
                                disabled={busy}
                                onClick={() => void apply(menuItem.key, "on")}
                                title="Selalu aktif"
                                tone="on"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </SegBtn>
                              <SegBtn
                                active={state === "off"}
                                disabled={busy || isAlwaysOn}
                                onClick={() => void apply(menuItem.key, "off")}
                                title={isAlwaysOn ? "Menu inti tidak dapat dimatikan" : "Selalu nonaktif"}
                                tone="off"
                              >
                                <X className="w-3.5 h-3.5" />
                              </SegBtn>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </TooltipProvider>
          )}
        </div>

        <DialogFooter className="pt-3 border-t gap-2">
          {overrideCount > 0 && (
            <Button
              variant="ghost"
              onClick={() => void handleClearAll()}
              disabled={clearing}
              className="cursor-pointer text-muted-foreground mr-auto"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              {clearing ? "Mereset..." : `Reset semua (${overrideCount})`}
            </Button>
          )}
          <Button onClick={onClose} className="cursor-pointer">
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SegBtn({
  active,
  disabled,
  onClick,
  title,
  tone,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  tone: "neutral" | "on" | "off";
  children: React.ReactNode;
}) {
  const activeClass =
    tone === "on"
      ? "bg-emerald-500 text-white"
      : tone === "off"
        ? "bg-red-500 text-white"
        : "bg-muted text-foreground";

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center h-8 w-9 transition-colors ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "cursor-pointer hover:bg-muted/70"
      } ${active ? activeClass : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}
