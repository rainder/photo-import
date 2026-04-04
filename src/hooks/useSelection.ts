import { useCallback, useState } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((paths: string[]) => {
    setSelected(new Set(paths));
  }, []);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback(
    (path: string) => selected.has(path),
    [selected]
  );

  return {
    selected,
    count: selected.size,
    toggle,
    selectAll,
    deselectAll,
    isSelected,
  };
}
