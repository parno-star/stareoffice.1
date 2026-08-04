import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Button } from "@/components/ui/button.tsx";

/**
 * Standard bulk-action toolbar used across list/queue pages.
 *
 * Left side: "Pilih semua" checkbox with selected/total count.
 * Right side: the action buttons (passed as children) shown only when
 * something is selected, plus a "Batal Pilih" button.
 */
export default function BulkActionBar({
  allSelected,
  onToggleAll,
  selectedCount,
  totalCount,
  onClear,
  children,
  trailing,
}: {
  allSelected: boolean;
  onToggleAll: () => void;
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  /** Action buttons rendered only when selectedCount > 0. */
  children?: React.ReactNode;
  /** Optional buttons always shown (e.g. Export). */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleAll}
          aria-label="Pilih semua"
        />
        <span className="text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount} dipilih`
            : `Pilih semua (${totalCount})`}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {selectedCount > 0 ? (
          <>
            {children}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="cursor-pointer"
            >
              Batal Pilih
            </Button>
          </>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
