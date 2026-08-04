import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  MENU_ITEMS,
  ROLE_VALUES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  DEFAULT_ROLE_MENUS,
  type MenuKey,
  type Role,
} from "@/convex/roles";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { Pencil, RotateCcw, ShieldCheck, CheckSquare, Square, Minus } from "lucide-react";

// Group menus by category for easier browsing
// Pengelompokan diselaraskan dengan struktur sidebar (navGroups di
// DashboardLayout) agar admin memiliki model mental yang sama. Grup terakhir
// menampung menu khusus platform/super-admin yang tidak muncul di sidebar biasa.
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
    keys: ["payroll", "finance_dashboard", "finance_audit"],
  },
  {
    label: "Administrasi",
    keys: ["admin", "user_management", "billing", "support"],
  },
  {
    label: "Platform & Keanggotaan",
    keys: ["membership_settings", "promo_settings", "membership_dashboard"],
  },
];

export default function RoleMenuSettingsTab() {
  const settings = useQuery(api.roleMenuSettings.getAllRoleMenuSettings, {});
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  if (settings === undefined) {
    return (
      <div className="space-y-3 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Atur menu mana saja yang dapat diakses oleh setiap role. Perubahan berlaku secara global untuk semua pengguna dengan role tersebut.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLE_VALUES.map((role) => {
          const config = settings[role];
          const count = config?.allowedMenus.length ?? 0;
          const defaultCount = DEFAULT_ROLE_MENUS[role].length;
          const isCustomized = config?.isCustomized ?? false;

          return (
            <Card key={role} className="relative">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold">
                        {ROLE_LABELS[role]}
                      </CardTitle>
                      {isCustomized && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                          Dikustomisasi
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer shrink-0 h-8 w-8"
                    onClick={() => setEditingRole(role)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {count} menu aktif
                  </span>
                  {!isCustomized && (
                    <span className="text-xs text-muted-foreground">(default: {defaultCount})</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingRole && (
        <EditRoleMenuDialog
          role={editingRole}
          currentMenus={settings[editingRole]?.allowedMenus ?? [...DEFAULT_ROLE_MENUS[editingRole]]}
          isCustomized={settings[editingRole]?.isCustomized ?? false}
          onClose={() => setEditingRole(null)}
        />
      )}
    </div>
  );
}

function EditRoleMenuDialog({
  role,
  currentMenus,
  isCustomized,
  onClose,
}: {
  role: Role;
  currentMenus: string[];
  isCustomized: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentMenus));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const updateMenus = useMutation(api.roleMenuSettings.updateRoleMenus);
  const resetMenus = useMutation(api.roleMenuSettings.resetRoleMenus);

  function toggle(key: string) {
    // Never allow toggling alwaysOn menus off
    const menuDef = MENU_ITEMS.find((m) => m.key === key);
    if (menuDef?.alwaysOn) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(MENU_ITEMS.map((m) => m.key)));
  }

  function selectNone() {
    // Keep alwaysOn menus
    const alwaysOn = new Set(MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key));
    setSelected(alwaysOn);
  }

  function selectGroup(keys: MenuKey[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = keys.every((k) => next.has(k));
      for (const k of keys) {
        const menuDef = MENU_ITEMS.find((m) => m.key === k);
        if (menuDef?.alwaysOn) {
          next.add(k);
          continue;
        }
        if (allIn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateMenus({ role, allowedMenus: Array.from(selected) });
      toast.success(`Akses menu untuk ${ROLE_LABELS[role]} berhasil disimpan`);
      onClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message: string };
        toast.error(data.message);
      } else {
        toast.error("Gagal menyimpan pengaturan");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetMenus({ role });
      toast.success(`Akses menu untuk ${ROLE_LABELS[role]} direset ke default`);
      onClose();
    } catch (err) {
      toast.error("Gagal mereset pengaturan");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Akses Menu — {ROLE_LABELS[role]}
          </DialogTitle>
          <DialogDescription>
            {ROLE_DESCRIPTIONS[role]}
          </DialogDescription>
        </DialogHeader>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-wrap border-b pb-3">
          <span className="text-xs text-muted-foreground font-medium">Pilih cepat:</span>
          <Button variant="secondary" size="sm" className="cursor-pointer h-7 text-xs" onClick={selectAll}>
            <CheckSquare className="w-3 h-3 mr-1" /> Semua
          </Button>
          <Button variant="secondary" size="sm" className="cursor-pointer h-7 text-xs" onClick={selectNone}>
            <Square className="w-3 h-3 mr-1" /> Hapus Semua
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {selected.size} / {MENU_ITEMS.length} menu dipilih
          </span>
        </div>

        {/* Scrollable menu group list */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-5 py-2">
          <TooltipProvider delayDuration={300}>
            {MENU_GROUPS.map((group) => {
              // Only show groups that have valid menu items
              const items = group.keys
                .map((k) => MENU_ITEMS.find((m) => m.key === k))
                .filter(Boolean) as (typeof MENU_ITEMS)[number][];
              if (items.length === 0) return null;

              const groupAllSelected = items.every((m) => selected.has(m.key));
              const groupSomeSelected = items.some((m) => selected.has(m.key));

              return (
                <div key={group.label}>
                  <button
                    onClick={() => selectGroup(group.keys)}
                    className="flex items-center gap-2 mb-2 cursor-pointer w-full text-left group"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      groupAllSelected
                        ? "bg-primary border-primary"
                        : groupSomeSelected
                          ? "bg-primary/20 border-primary"
                          : "border-border"
                    }`}>
                      {groupAllSelected ? (
                        <CheckSquare className="w-3 h-3 text-primary-foreground" />
                      ) : groupSomeSelected ? (
                        <Minus className="w-3 h-3 text-primary" />
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                      {group.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({items.filter((m) => selected.has(m.key)).length}/{items.length})
                    </span>
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-2">
                    {items.map((menuItem) => {
                      const isChecked = selected.has(menuItem.key);
                      const isAlwaysOn = menuItem.alwaysOn ?? false;
                      return (
                        <Tooltip key={menuItem.key}>
                          <TooltipTrigger asChild>
                            <label
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors ${
                                isAlwaysOn
                                  ? "opacity-60 cursor-not-allowed bg-muted/40 border-border"
                                  : isChecked
                                    ? "bg-primary/5 border-primary/30 cursor-pointer hover:bg-primary/10"
                                    : "border-transparent hover:bg-muted/50 cursor-pointer"
                              }`}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={isAlwaysOn}
                                onCheckedChange={() => toggle(menuItem.key)}
                                className="cursor-pointer"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-tight truncate">
                                  {menuItem.label}
                                </p>
                              </div>
                              {isAlwaysOn && (
                                <Badge variant="secondary" className="text-[10px] ml-auto shrink-0 py-0">
                                  Wajib
                                </Badge>
                              )}
                            </label>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[200px]">
                            <p className="text-xs">{menuItem.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </div>

        <DialogFooter className="pt-3 border-t gap-2">
          {isCustomized && (
            <Button
              variant="ghost"
              onClick={() => void handleReset()}
              disabled={resetting || saving}
              className="cursor-pointer text-muted-foreground mr-auto"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              {resetting ? "Mereset..." : "Reset ke Default"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Batal
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="cursor-pointer"
          >
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
