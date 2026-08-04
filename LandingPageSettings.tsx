import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { LANDING_SECTIONS } from "@/convex/lib/landingSections.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  LayoutDashboard,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner.tsx";

export default function LandingPageSettings() {
  const visibility = useQuery(api.siteSettings.getLandingSectionVisibility, {});
  const updateVisibility = useMutation(api.siteSettings.updateLandingSectionVisibility);

  const [localState, setLocalState] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visibility && !localState) {
      setLocalState({ ...visibility });
    }
  }, [visibility, localState]);

  const handleToggle = (id: string) => {
    if (!localState) return;
    setLocalState((prev) => (prev ? { ...prev, [id]: !prev[id] } : prev));
  };

  const handleSave = async () => {
    if (!localState) return;
    setSaving(true);
    try {
      await updateVisibility({ sections: localState });
      toast.success("Pengaturan landing page berhasil disimpan");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan pengaturan";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const resetState: Record<string, boolean> = {};
    for (const s of LANDING_SECTIONS) {
      resetState[s.id] = true;
    }
    setLocalState(resetState);
  };

  const hasChanges =
    localState && visibility && JSON.stringify(localState) !== JSON.stringify(visibility);

  const hiddenCount = localState
    ? Object.values(localState).filter((v) => !v).length
    : 0;

  if (!localState) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="size-4 text-primary" />
            Tampilan Bagian Landing Page
          </CardTitle>
          <CardDescription>
            Tampilkan atau sembunyikan setiap bagian pada halaman landing page. Perubahan langsung terlihat setelah disimpan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {LANDING_SECTIONS.map((section) => {
            const visible = localState[section.id] ?? true;

            return (
              <div
                key={section.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                  visible
                    ? "border-border bg-card"
                    : "border-dashed border-muted-foreground/20 bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${
                      visible
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        visible ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {section.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {visible ? "Ditampilkan" : "Disembunyikan"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={visible}
                  onCheckedChange={() => handleToggle(section.id)}
                  className="cursor-pointer"
                />
              </div>
            );
          })}

          {/* Summary */}
          <div className="rounded-xl bg-muted/40 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              {LANDING_SECTIONS.length - hiddenCount} dari {LANDING_SECTIONS.length} bagian ditampilkan
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="cursor-pointer gap-1.5"
          disabled={saving}
        >
          <RotateCcw className="size-3.5" />
          Reset Semua
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="cursor-pointer gap-2"
        >
          {saving ? <Spinner className="size-4" /> : <Save className="size-4" />}
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
