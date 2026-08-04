import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  DEFAULT_ROLE_MENUS,
  MENU_ITEMS,
  MENU_GROUPS,
  MENU_SECTIONS,
  getGroupMenuKeys,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_VALUES,
  isSuperAdminRole,
  type MenuKey,
  type MenuGroupId,
  type MenuSectionId,
  type Role,
} from "@/convex/roles.ts";
import { cn } from "@/lib/utils.ts";
import {
  Shield,
  RefreshCw,
  Save,
  CheckCircle2,
  Lock,
  LayoutGrid,
  UserCircle,
  MessagesSquare,
  Boxes,
  Users,
  Wallet,
  Target,
  Settings2,
  Server,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { ROLE_COLORS, ROLE_DOT_COLORS } from "../_lib/role-ui.ts";

// Core menus that are always active for everyone and cannot be toggled off.
const ALWAYS_ON_KEYS = new Set<MenuKey>(
  MENU_ITEMS.filter((m) => m.alwaysOn).map((m) => m.key),
);

// Role grouping is a PURELY VISUAL layer that mirrors the organization's
// structure. The access engine still uses the 15 fixed, tested roles — each
// entry below simply decides which card a role appears under.
//
// A group can hold roles directly, or split them into named sub-groups
// (sub-kelompok). Sub-group labels use Bahasa Indonesia. Order top -> bottom:
// End User -> Operation -> Management -> System / Platform.
type RoleSubGroup = {
  // Sub-group heading. `null` renders the roles directly under the group with
  // no extra sub-heading (used for groups that have a single flat list).
  label: string | null;
  roles: ReadonlyArray<Role>;
};
type RoleGroup = {
  label: string;
  subGroups: ReadonlyArray<RoleSubGroup>;
};

const ROLE_GROUPS: ReadonlyArray<RoleGroup> = [
  {
    label: "End User",
    subGroups: [{ label: null, roles: ["employee", "contractor"] }],
  },
  {
    label: "Operation",
    subGroups: [
      {
        label: "Sumber Daya Manusia",
        roles: ["hr_manager", "hr_staff", "ld_specialist", "payroll_officer"],
      },
      { label: "Keuangan", roles: ["finance_manager", "finance_staff", "approver"] },
    ],
  },
  {
    label: "Management",
    subGroups: [{ label: null, roles: ["director", "department_head", "team_lead"] }],
  },
  {
    label: "System / Platform",
    subGroups: [{ label: null, roles: ["admin", "it_support"] }],
  },
] as const;

const EDITABLE_ROLES: ReadonlyArray<Role> = ROLE_VALUES.filter(
  (r) => r !== "super_admin",
);

// Local label overrides for this page only. The user wants the "contractor"
// role to read as "Non Karyawan" under the End User group here, without
// changing the global ROLE_LABELS used elsewhere in the app.
const DISPLAY_ROLE_LABELS: Partial<Record<Role, string>> = {
  contractor: "Non Karyawan",
};

function displayRoleLabel(role: Role): string {
  return DISPLAY_ROLE_LABELS[role] ?? ROLE_LABELS[role];
}

// Visual accent per top-level role group so the different cards are clearly
// separated. Keyed by the group label defined in ROLE_GROUPS.
const ROLE_GROUP_STYLES: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    bar: string;
    header: string;
    ring: string;
  }
> = {
  "End User": {
    icon: UserCircle,
    bar: "bg-sky-500",
    header: "text-sky-700 dark:text-sky-300",
    ring: "border-sky-200 bg-sky-50/40 dark:border-sky-400/25 dark:bg-sky-500/5",
  },
  Operation: {
    icon: Boxes,
    bar: "bg-amber-500",
    header: "text-amber-700 dark:text-amber-300",
    ring: "border-amber-200 bg-amber-50/40 dark:border-amber-400/25 dark:bg-amber-500/5",
  },
  Management: {
    icon: Target,
    bar: "bg-violet-500",
    header: "text-violet-700 dark:text-violet-300",
    ring: "border-violet-200 bg-violet-50/40 dark:border-violet-400/25 dark:bg-violet-500/5",
  },
  "System / Platform": {
    icon: Server,
    bar: "bg-rose-500",
    header: "text-rose-700 dark:text-rose-300",
    ring: "border-rose-200 bg-rose-50/40 dark:border-rose-400/25 dark:bg-rose-500/5",
  },
};

const DEFAULT_GROUP_STYLE = {
  icon: Users,
  bar: "bg-slate-400",
  header: "text-foreground",
  ring: "border-border bg-muted/30",
} as const;

// Build empty draft for all roles
function buildEmptyDraft(): Record<Role, ReadonlyArray<MenuKey>> {
  const result = {} as Record<Role, ReadonlyArray<MenuKey>>;
  for (const r of ROLE_VALUES) {
    result[r] = [];
  }
  return result;
}

export default function RoleMenusTab({
  currentUserRole,
}: {
  currentUserRole: string | undefined;
}) {
  const amSuperAdmin = isSuperAdminRole(currentUserRole);
  const settings = useQuery(api.userSettings.getAllRoleMenus, {});
  const positions = useQuery(api.positionDirectory.list, {});
  const configurableMenuKeys = useQuery(
    api.userSettings.getConfigurableMenuKeys,
    {},
  );
  const updateRoleMenus = useMutation(api.userSettings.updateRoleMenus);
  const resetRoleMenus = useMutation(api.userSettings.resetRoleMenus);

  // Map each role -> the org's active positions (jabatan) that inherit it via
  // their `defaultRole`. This is a read-only, visual mapping: the access engine
  // still runs on the 15 fixed roles. Adding/editing jabatan happens in the
  // dedicated "Kelola Jabatan" panel (single source of truth).
  const positionsByRole = useMemo(() => {
    const map = {} as Record<Role, Doc<"positionDirectory">[]>;
    for (const r of ROLE_VALUES) map[r] = [];
    for (const p of positions ?? []) {
      const role = p.defaultRole as Role | undefined;
      if (role && role in map) map[role].push(p);
    }
    for (const r of ROLE_VALUES) {
      map[r].sort((a, b) => a.fullName.localeCompare(b.fullName, "id"));
    }
    return map;
  }, [positions]);

  // Regular admins cannot edit the "Administrator" role (Super Admin only), so
  // opening that tab first would show every control disabled. Default them to
  // the first role they are actually allowed to configure.
  const [activeRole, setActiveRole] = useState<Role>(
    amSuperAdmin ? "admin" : "it_support",
  );
  const [draft, setDraft] = useState<Record<Role, ReadonlyArray<MenuKey>>>(buildEmptyDraft);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<Role | null>(null);

  // Initialize draft when data loads
  if (settings !== undefined && !initialized) {
    const next = buildEmptyDraft();
    for (const role of ROLE_VALUES) {
      next[role] =
        settings.find((s) => s.role === role)?.allowedMenus ??
        [...DEFAULT_ROLE_MENUS[role]];
    }
    setDraft(next);
    setInitialized(true);
  }

  const currentSetting = settings?.find((s) => s.role === activeRole);
  const draftMenus = draft[activeRole];
  const storedMenus = useMemo(
    () => (currentSetting ? currentSetting.allowedMenus : []),
    [currentSetting],
  );
  const isDirty = useMemo(() => {
    if (storedMenus.length !== draftMenus.length) return true;
    const set = new Set(storedMenus);
    return draftMenus.some((m) => !set.has(m));
  }, [storedMenus, draftMenus]);

  // Menus shown in the grid. Super Admin sees all; a company admin only sees
  // the menus their organization has been granted (platform-owner-only and
  // plan-locked menus are hidden). Fall back to all menus while loading.
  const visibleMenuItems = useMemo(() => {
    if (amSuperAdmin || configurableMenuKeys === undefined) return MENU_ITEMS;
    const allowed = new Set<MenuKey>(configurableMenuKeys);
    return MENU_ITEMS.filter((m) => allowed.has(m.key));
  }, [amSuperAdmin, configurableMenuKeys]);

  // Split the visible menus into sidebar-aligned groups, then roll the groups
  // up under the two big sections (Umum Dasar & Spesifik Fungsional). Menu order
  // within each group follows the sidebar order (getGroupMenuKeys). Only
  // groups/sections that actually have menus are shown.
  const sectionedMenuItems = useMemo(() => {
    const visibleByKey = new Map(visibleMenuItems.map((m) => [m.key, m]));
    const groups = MENU_GROUPS.map((group) => ({
      group,
      items: getGroupMenuKeys(group.id)
        .map((key) => visibleByKey.get(key))
        .filter((m): m is (typeof visibleMenuItems)[number] => m !== undefined),
    })).filter((g) => g.items.length > 0);
    return MENU_SECTIONS.map((section) => ({
      section,
      groups: groups.filter((g) => g.group.sectionId === section.id),
    })).filter((s) => s.groups.length > 0);
  }, [visibleMenuItems]);

  const toggleMenu = (key: MenuKey) => {
    // Core always-on menus can never be toggled.
    if (ALWAYS_ON_KEYS.has(key)) return;
    setDraft((prev) => {
      const current = prev[activeRole];
      const has = current.includes(key);
      const next: Array<MenuKey> = has
        ? current.filter((m) => m !== key)
        : [...current, key];
      // Guarantee core always-on menus stay in the saved set.
      for (const alwaysOn of ALWAYS_ON_KEYS) {
        if (!next.includes(alwaysOn)) next.push(alwaysOn);
      }
      return { ...prev, [activeRole]: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRoleMenus({
        role: activeRole,
        allowedMenus: Array.from(draft[activeRole]),
      });
      toast.success(`Akses menu ${displayRoleLabel(activeRole)} disimpan`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    try {
      await resetRoleMenus({ role: resetTarget });
      setDraft((prev) => ({
        ...prev,
        [resetTarget]: [...DEFAULT_ROLE_MENUS[resetTarget]],
      }));
      toast.success(`Akses menu ${displayRoleLabel(resetTarget)} direset ke default`);
      setResetTarget(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mereset");
      } else {
        toast.error("Gagal mereset");
      }
    }
  };

  if (settings === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info notice */}
      <Card className="border-purple-200 bg-purple-50/40 dark:border-purple-400/30 dark:bg-purple-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="mt-0.5 size-4 shrink-0 text-purple-600 dark:text-purple-300" />
          <div className="text-sm">
            {amSuperAdmin ? (
              <>
                <p className="font-semibold">Super Admin</p>
                <p className="text-muted-foreground">
                  Memiliki akses ke seluruh menu secara otomatis. Halaman ini
                  digunakan untuk mengatur akses menu bagi peran lainnya.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Administrator</p>
                <p className="text-muted-foreground">
                  Memiliki akses otomatis ke seluruh menu yang aktif untuk
                  organisasi Anda sesuai paket yang diambil. Halaman ini
                  digunakan untuk mengatur akses menu bagi peran lainnya.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeRole}
        onValueChange={(v) => setActiveRole(v as Role)}
        className="space-y-4"
      >
        {/* Grouped tab list: each top-level group is its own accented panel so
            the separation between groups is obvious. Inside a panel: optional
            sub-group heading -> role tabs. */}
        <div className="grid gap-3 lg:grid-cols-2">
          {ROLE_GROUPS.map((group) => {
            const style = ROLE_GROUP_STYLES[group.label] ?? DEFAULT_GROUP_STYLE;
            const GroupIcon = style.icon;
            // Skip groups with no editable roles entirely.
            const hasEditable = group.subGroups.some((sub) =>
              sub.roles.some((r) => EDITABLE_ROLES.includes(r)),
            );
            if (!hasEditable) return null;
            return (
              <div
                key={group.label}
                className={cn(
                  "space-y-3 rounded-xl border p-3.5 shadow-sm",
                  style.ring,
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-4 w-1.5 rounded-full", style.bar)} />
                  <GroupIcon className={cn("size-4", style.header)} />
                  <p
                    className={cn(
                      "text-xs font-bold uppercase tracking-widest",
                      style.header,
                    )}
                  >
                    {group.label}
                  </p>
                </div>
                <div className="space-y-2.5">
                  {group.subGroups.map((sub, subIdx) => {
                    const editableRoles = sub.roles.filter((r) =>
                      EDITABLE_ROLES.includes(r),
                    );
                    if (editableRoles.length === 0) return null;
                    return (
                      <div key={sub.label ?? `flat-${subIdx}`}>
                        {sub.label && (
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {sub.label}
                          </p>
                        )}
                        <TabsList className="flex h-auto flex-wrap justify-start gap-1.5 bg-transparent p-0">
                          {editableRoles.map((role) => (
                            <TabsTrigger
                              key={role}
                              value={role}
                              className="flex-none grow-0 gap-1.5 rounded-lg border border-transparent bg-background/60 px-2.5 py-1.5 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                              <span
                                className={cn(
                                  "size-2 rounded-full",
                                  ROLE_DOT_COLORS[role],
                                )}
                              />
                              {displayRoleLabel(role)}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab content per role */}
        {EDITABLE_ROLES.map((role) => {
          const roleLocked = role === "admin" && !amSuperAdmin;
          return (
            <TabsContent key={role} value={role} className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <Badge
                        variant="outline"
                        className={cn("border", ROLE_COLORS[role])}
                      >
                        {displayRoleLabel(role)}
                      </Badge>
                      {settings?.find((s) => s.role === role)?.isCustom ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Kustom
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                      {roleLocked && (
                        <Badge variant="outline" className="text-[10px]">
                          Hanya Super Admin
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{ROLE_DESCRIPTIONS[role]}</CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={() => setResetTarget(role)}
                      disabled={saving || roleLocked}
                    >
                      <RefreshCw className="size-3.5" />
                      Reset default
                    </Button>
                    <Button
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      onClick={handleSave}
                      disabled={
                        saving ||
                        activeRole !== role ||
                        !isDirty ||
                        !initialized ||
                        roleLocked
                      }
                    >
                      {saving ? (
                        <>Menyimpan...</>
                      ) : (
                        <>
                          <Save className="size-3.5" />
                          Simpan perubahan
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {roleLocked ? (
                      <>
                        Peran{" "}
                        <span className="font-semibold">Administrator</span>{" "}
                        secara otomatis memiliki akses ke seluruh menu yang aktif
                        untuk organisasi Anda. Konfigurasinya dikelola oleh Super
                        Admin dan tidak dapat diubah dari sini. Anda dapat
                        mengatur akses menu untuk peran lain melalui tab di atas.
                      </>
                    ) : (
                      <>
                        Pilih menu yang boleh diakses oleh peran{" "}
                        <span className="font-semibold">
                          {displayRoleLabel(role)}
                        </span>
                        . Menu inti (Beranda, Dashboard, Data Profil Saya,
                        Notifikasi, Asisten AI, dan Manajemen Surat) selalu aktif
                        dan tidak dapat dinonaktifkan.
                      </>
                    )}
                  </p>

                  {/* Jabatan (titelatur) yang mewarisi peran ini. Tampilan
                      informatif saja: pengelolaan jabatan ada di panel
                      "Kelola Jabatan". */}
                  {!roleLocked && (
                    <JabatanForRole
                      roleLabel={displayRoleLabel(role)}
                      positions={positionsByRole[role]}
                      loading={positions === undefined}
                    />
                  )}

                  <div className="space-y-8">
                    {sectionedMenuItems.map(({ section, groups }) => {
                      const sectionActive = groups.reduce(
                        (acc, g) =>
                          acc +
                          g.items.filter(
                            (m) =>
                              ALWAYS_ON_KEYS.has(m.key) ||
                              draft[role].includes(m.key),
                          ).length,
                        0,
                      );
                      const sectionTotal = groups.reduce(
                        (acc, g) => acc + g.items.length,
                        0,
                      );
                      return (
                        <MenuSectionBlock
                          key={section.id}
                          sectionId={section.id}
                          label={section.label}
                          description={section.description}
                          activeCount={sectionActive}
                          totalCount={sectionTotal}
                        >
                          {groups.map(({ group, items }) => {
                            const activeCount = items.filter(
                              (m) =>
                                ALWAYS_ON_KEYS.has(m.key) ||
                                draft[role].includes(m.key),
                            ).length;
                            return (
                              <MenuGroupSection
                                key={group.id}
                                groupId={group.id}
                                label={group.label}
                                description={group.description}
                                activeCount={activeCount}
                                totalCount={items.length}
                              >
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {items.map((menu) => {
                                    const checked =
                                      ALWAYS_ON_KEYS.has(menu.key) ||
                                      draft[role].includes(menu.key);
                                    const locked =
                                      ALWAYS_ON_KEYS.has(menu.key) || roleLocked;
                                    return (
                                      <label
                                        key={menu.key}
                                        className={cn(
                                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                                          checked
                                            ? "border-primary/40 bg-primary/5"
                                            : "hover:bg-accent/50",
                                          locked && "cursor-not-allowed opacity-70",
                                        )}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          disabled={locked}
                                          onCheckedChange={() => {
                                            if (!locked && activeRole === role) {
                                              toggleMenu(menu.key);
                                            }
                                          }}
                                          className="mt-0.5"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                                            {menu.label}
                                            {checked && (
                                              <CheckCircle2 className="size-3.5 text-primary" />
                                            )}
                                          </div>
                                          <div className="truncate text-xs text-muted-foreground">
                                            {menu.description}
                                          </div>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </MenuGroupSection>
                            );
                          })}
                        </MenuSectionBlock>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(v) => {
          if (!v) setResetTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset akses menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Akses menu untuk peran{" "}
              <span className="font-semibold">
                {resetTarget ? displayRoleLabel(resetTarget) : ""}
              </span>{" "}
              akan dikembalikan ke setelan default bawaan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Reset ke default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Visual styling per menu group. Each group mirrors a sidebar section and gets
// a distinct accent so the different areas are easy to tell apart.
const GROUP_STYLES: Record<
  MenuGroupId,
  { icon: React.ComponentType<{ className?: string }>; accent: string; chip: string }
> = {
  core: {
    icon: Lock,
    accent: "text-amber-600 dark:text-amber-400",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300",
  },
  umum: {
    icon: LayoutGrid,
    accent: "text-sky-600 dark:text-sky-400",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300",
  },
  ruang_saya: {
    icon: UserCircle,
    accent: "text-cyan-600 dark:text-cyan-400",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-300",
  },
  komunikasi: {
    icon: MessagesSquare,
    accent: "text-emerald-600 dark:text-emerald-400",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  sumber_daya: {
    icon: Boxes,
    accent: "text-teal-600 dark:text-teal-400",
    chip: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/10 dark:text-teal-300",
  },
  manajemen_sdm: {
    icon: Users,
    accent: "text-violet-600 dark:text-violet-400",
    chip: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300",
  },
  keuangan: {
    icon: Wallet,
    accent: "text-green-600 dark:text-green-400",
    chip: "border-green-200 bg-green-50 text-green-700 dark:border-green-400/30 dark:bg-green-500/10 dark:text-green-300",
  },
  tim_kinerja: {
    icon: Target,
    accent: "text-indigo-600 dark:text-indigo-400",
    chip: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300",
  },
  administrasi: {
    icon: Settings2,
    accent: "text-slate-600 dark:text-slate-300",
    chip: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/30 dark:bg-slate-500/10 dark:text-slate-300",
  },
  platform: {
    icon: Server,
    accent: "text-rose-600 dark:text-rose-400",
    chip: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300",
  },
};

// Styling for the two big sections (Umum Dasar & Spesifik Fungsional).
const SECTION_STYLES: Record<MenuSectionId, { bar: string; chip: string }> = {
  umum_dasar: {
    bar: "bg-sky-500",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300",
  },
  spesifik_fungsional: {
    bar: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300",
  },
};

function MenuSectionBlock({
  sectionId,
  label,
  description,
  activeCount,
  totalCount,
  children,
}: {
  sectionId: MenuSectionId;
  label: string;
  description: string;
  activeCount: number;
  totalCount: number;
  children: React.ReactNode;
}) {
  const style = SECTION_STYLES[sectionId];
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("h-5 w-1.5 rounded-full", style.bar)} />
        <h3 className="text-base font-bold uppercase tracking-wide text-foreground">
          {label}
        </h3>
        <Badge
          variant="outline"
          className={cn("border text-[10px] font-semibold", style.chip)}
        >
          {activeCount}/{totalCount} aktif
        </Badge>
        <p className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
          {description}
        </p>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function MenuGroupSection({
  groupId,
  label,
  description,
  activeCount,
  totalCount,
  children,
}: {
  groupId: MenuGroupId;
  label: string;
  description: string;
  activeCount: number;
  totalCount: number;
  children: React.ReactNode;
}) {
  const style = GROUP_STYLES[groupId];
  const Icon = style.icon;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4 shrink-0", style.accent)} />
          <h4 className="text-sm font-semibold text-foreground">{label}</h4>
        </div>
        <Badge
          variant="outline"
          className={cn("border text-[10px] font-medium", style.chip)}
        >
          {activeCount}/{totalCount} aktif
        </Badge>
        <p className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

// Shows the org's job positions (jabatan) that inherit a given role, as a set
// of chips. Managing jabatan (add/edit/remove + choosing the inherited role) is
// done from the dedicated "Kelola Jabatan" panel, so this section only reads
// and links there to keep a single source of truth.
function JabatanForRole({
  roleLabel,
  positions,
  loading,
}: {
  roleLabel: string;
  positions: Doc<"positionDirectory">[];
  loading: boolean;
}) {
  const active = positions.filter((p) => p.isActive);
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Jabatan dengan peran ini</p>
          {!loading && (
            <Badge variant="secondary" className="text-[10px]">
              {active.length}
            </Badge>
          )}
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 cursor-pointer gap-1.5 text-xs"
        >
          <Link to="/organization?tab=jabatan">
            <Settings2 className="size-3.5" />
            Kelola Jabatan
            <ExternalLink className="size-3" />
          </Link>
        </Button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Titelatur berikut otomatis mewarisi akses peran{" "}
        <span className="font-medium">{roleLabel}</span>. Ubah pemetaan lewat
        panel Kelola Jabatan.
      </p>

      {loading ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ) : active.length === 0 ? (
        <p className="mt-2 text-xs italic text-muted-foreground">
          Belum ada jabatan yang dipetakan ke peran ini.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {active.map((p) => (
            <Badge
              key={p._id}
              variant="outline"
              className="gap-1.5 font-normal"
              title={p.nomenclature || p.fullName}
            >
              <span className="size-1.5 rounded-full bg-primary/60" />
              {p.fullName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
