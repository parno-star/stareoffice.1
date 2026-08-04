import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { LANDING_SECTIONS } from "@/convex/lib/landingSections.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet.tsx";
import { toast } from "sonner";
import {
  Settings2,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner.tsx";

export default function LandingPageEditor() {
  const visibility = useQuery(
    api.siteSettings.getLandingSectionVisibility,
    {},
  );
  const updateVisibility = useMutation(
    api.siteSettings.updateLandingSectionVisibility,
  );

  const [localState, setLocalState] = useState<Record<string, boolean> | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // Sync server state to local state when loaded or updated
  useEffect(() => {
    if (visibility && !localState) {
      setLocalState({ ...visibility });
    }
  }, [visibility, localState]);

  // Re-sync when sheet opens
  useEffect(() => {
    if (open && visibility) {
      setLocalState({ ...visibility });
    }
  }, [open, visibility]);

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
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reset all sections to visible
    const resetState: Record<string, boolean> = {};
    for (const s of LANDING_SECTIONS) {
      resetState[s.id] = true;
    }
    setLocalState(resetState);
  };

  const hasChanges =
    localState &&
    visibility &&
    JSON.stringify(localState) !== JSON.stringify(visibility);

  const hiddenCount = localState
    ? Object.values(localState).filter((v) => !v).length
    : 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="cursor-pointer gap-2 shadow-lg shadow-primary/10"
        >
          <Settings2 className="size-4" />
          <span className="hidden sm:inline">Edit Landing Page</span>
          {hiddenCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {hiddenCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="size-5 text-primary" />
            Kelola Tampilan Landing Page
          </SheetTitle>
          <SheetDescription>
            Tampilkan atau sembunyikan setiap bagian landing page. Perubahan
            langsung terlihat setelah disimpan.
          </SheetDescription>
        </SheetHeader>

        {!localState ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-2">
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
                      {visible ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          visible
                            ? "text-foreground"
                            : "text-muted-foreground line-through"
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
                {LANDING_SECTIONS.length - hiddenCount} dari{" "}
                {LANDING_SECTIONS.length} bagian ditampilkan
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
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
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="ml-auto cursor-pointer gap-1.5"
              >
                {saving ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Simpan Perubahan
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
