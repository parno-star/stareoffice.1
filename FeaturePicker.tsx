import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { FeatureGroup } from "../_lib/feature-catalog.ts";

type FeaturePickerProps = {
  groups: FeatureGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Show a small "mengunci menu" badge next to gated features */
  showGateBadge?: boolean;
};

/**
 * Grouped checklist for picking feature labels from a known catalog.
 * Also allows adding a custom label not present in the catalog.
 */
export default function FeaturePicker({
  groups,
  selected,
  onChange,
  showGateBadge = false,
}: FeaturePickerProps) {
  const [custom, setCustom] = useState("");

  const knownLabels = useMemo(
    () => new Set(groups.flatMap((g) => g.options.map((o) => o.label))),
    [groups],
  );

  // Selected labels that aren't part of any catalog group (added manually).
  const customSelected = selected.filter((s) => !knownLabels.has(s));

  const toggle = (label: string, checked: boolean) => {
    if (checked) {
      if (!selected.includes(label)) onChange([...selected, label]);
    } else {
      onChange(selected.filter((s) => s !== label));
    }
  };

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    if (!selected.includes(value)) onChange([...selected, value]);
    setCustom("");
  };

  return (
    <div className="space-y-4 rounded-lg border p-3">
      {groups.map((group) => (
        <div key={group.category} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {group.category}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.options.map((opt) => {
              const isChecked = selected.includes(opt.label);
              return (
                <label
                  key={opt.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer transition-colors",
                    isChecked
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(c) => toggle(opt.label, c === true)}
                    className="cursor-pointer"
                  />
                  <span className="flex-1 leading-tight">{opt.label}</span>
                  {showGateBadge && opt.gates && (
                    <Badge variant="secondary" className="text-[10px]">
                      kunci menu
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom labels added by the admin */}
      {customSelected.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fitur Kustom
          </p>
          <div className="flex flex-wrap gap-2">
            {customSelected.map((label) => (
              <Badge
                key={label}
                variant="outline"
                className="cursor-pointer gap-1"
                onClick={() => toggle(label, false)}
              >
                {label}
                <span className="text-muted-foreground">×</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Add a custom label */}
      <div className="flex gap-2 pt-1">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Tambah fitur lain (opsional)..."
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="cursor-pointer shrink-0 gap-1"
          onClick={addCustom}
        >
          <Plus className="size-3" />
          Tambah
        </Button>
      </div>
    </div>
  );
}
