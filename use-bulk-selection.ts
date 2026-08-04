import { useCallback, useMemo, useState } from "react";

/**
 * Generic multi-select helper for bulk-action lists.
 *
 * Tracks a set of selected item ids and exposes toggle helpers plus
 * "select all" state derived from the currently selectable ids.
 */
export function useBulkSelection<T extends string>(selectableIds: Array<T>) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const isAll =
        selectableIds.length > 0 &&
        selectableIds.every((id) => prev.has(id));
      return isAll ? new Set() : new Set(selectableIds);
    });
  }, [selectableIds]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  return {
    selected,
    selectedIds,
    count: selected.size,
    isSelected: useCallback((id: T) => selected.has(id), [selected]),
    toggle,
    toggleAll,
    clear,
    allSelected,
  };
}
