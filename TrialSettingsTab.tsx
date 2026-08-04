import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { MENU_ITEMS, type MenuKey } from "@/convex/roles";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { Rocket, Clock, Users, LayoutGrid, Save, Check } from "lucide-react";

// Menus that are always available (core navigation) — excluded from the
// trial menu picker because they can never be turned off.
const SELECTABLE_MENUS = MENU_ITEMS.filter((m) => !m.alwaysOn);

// Super-admin-only menus that should never be offered to a trial org.
const SUPER_ADMIN_MENUS: ReadonlySet<string> = new Set([
  "membership_settings",
  "promo_settings",
  "membership_dashboard",
  "data_privacy",
]);

const TRIAL_MENUS = SELECTABLE_MENUS.filter(
  (m) => !SUPER_ADMIN_MENUS.has(m.key),
);

export default function TrialSettingsTab() {
  const settings = useQuery(api.trialSettings.get, {});
  const updateSettings = useMutation(api.trialSettings.update);

  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [durationDays, setDurationDays] = useState("30");
  const [maxEmployees, setMaxEmployees] = useState("25");
  const [activeMenus, setActiveMenus] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Seed local form state once the settings arrive.
  useEffect(() => {
    if (settings && !initialized) {
      setRegistrationEnabled(settings.registrationEnabled);
      setDurationDays(String(settings.durationDays));
      setMaxEmployees(String(settings.maxEmployees));
      setActiveMenus(new Set(settings.activeMenus));
      setInitialized(true);
    }
  }, [settings, initialized]);

  const selectedCount = activeMenus.size;

  const isDirty = useMemo(() => {
    if (!settings) return false;
    if (registrationEnabled !== settings.registrationEnabled) return true;
    if (durationDays !== String(settings.durationDays)) return true;
    if (maxEmployees !== String(settings.maxEmployees)) return true;
    const original = new Set(settings.activeMenus);
    if (original.size !== activeMenus.size) return true;
    for (const k of activeMenus) if (!original.has(k)) return true;
    return false;
  }, [settings, registrationEnabled, durationDays, maxEmployees, activeMenus]);

  function toggleMenu(key: MenuKey) {
    setActiveMenus((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setActiveMenus(new Set(TRIAL_MENUS.map((m) => m.key)));
  }

  function clearAll() {
    setActiveMenus(new Set());
  }

  async function handleSave() {
    const days = parseInt(durationDays, 10);
    const emp = parseInt(maxEmployees, 10);
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Lama masa trial minimal 1 hari");
      return;
    }
    if (!Number.isFinite(emp) || emp < 0) {
      toast.error("Batas karyawan tidak valid");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        registrationEnabled,
        durationDays: days,
        maxEmployees: emp,
        activeMenus: Array.from(activeMenus),
      });
      toast.success("Pengaturan trial disimpan");
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

  if (settings === undefined) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Intro */}
      <div className="flex items-start gap-3 rounded-lg border bg-primary/5 p-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Pengaturan Trial</h2>
          <p className="text-sm text-muted-foreground">
            Atur bagaimana organisasi baru mencoba aplikasi secara gratis.
            Organisasi trial langsung aktif tanpa persetujuan, dan otomatis
            terkunci (hanya-baca) saat masa trial berakhir hingga berlangganan.
          </p>
        </div>
      </div>

      {/* Master toggle */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                Izinkan pendaftaran organisasi baru
              </p>
              <p className="text-sm text-muted-foreground">
                Jika dimatikan, opsi "Daftar organisasi baru" tidak muncul saat
                seseorang dengan email tak dikenal masuk.
              </p>
            </div>
            <Switch
              checked={registrationEnabled}
              onCheckedChange={setRegistrationEnabled}
              className="cursor-pointer shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Lama masa trial
            </CardTitle>
            <CardDescription>
              Jumlah hari akses gratis penuh sebelum harus berlangganan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">hari</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Batas karyawan
            </CardTitle>
            <CardDescription>
              Jumlah maksimal karyawan selama trial. Isi 0 untuk tanpa batas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(e.target.value)}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">
                {parseInt(maxEmployees, 10) === 0 ? "tanpa batas" : "orang"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active menus */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                Fitur aktif selama trial
              </CardTitle>
              <CardDescription>
                Pilih menu yang bisa dipakai organisasi trial. Menu inti
                (Beranda, Profil, Asisten AI) selalu aktif.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedCount} dipilih</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="cursor-pointer"
              >
                Pilih semua
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="cursor-pointer"
              >
                Kosongkan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TRIAL_MENUS.map((menu) => {
              const checked = activeMenus.has(menu.key);
              return (
                <button
                  key={menu.key}
                  type="button"
                  onClick={() => toggleMenu(menu.key)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {menu.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {menu.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
          className="cursor-pointer"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
