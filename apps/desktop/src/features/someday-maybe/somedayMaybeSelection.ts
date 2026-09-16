import { useState } from "react";
import type { SomedayMaybeItem } from "./types.ts";

function resolveSelectedItem(items: SomedayMaybeItem[], selectedId: string | null): SomedayMaybeItem | null {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

function resolveSelectedIndex(items: SomedayMaybeItem[], selectedItem: SomedayMaybeItem | null): number {
  return selectedItem ? items.findIndex((item) => item.id === selectedItem.id) : -1;
}

function selectByOffset(
  items: SomedayMaybeItem[],
  selectedIndex: number,
  setSelectedId: (id: string | null) => void,
  offset: number
) {
  if (items.length === 0) return;
  const nextIndex = Math.min(Math.max(selectedIndex + offset, 0), items.length - 1);
  setSelectedId(items[nextIndex].id);
}

function selectByBoundary(
  items: SomedayMaybeItem[],
  setSelectedId: (id: string | null) => void,
  boundary: "first" | "last"
) {
  const index = boundary === "first" ? 0 : items.length - 1;
  setSelectedId(items[index]?.id ?? null);
}

/**
 * Tracks selected someday/maybe item and keyboard cursor navigation.
 *
 * @example const selection = useSomedayMaybeSelection(items)
 */
export function useSomedayMaybeSelection(items: SomedayMaybeItem[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = resolveSelectedItem(items, selectedId);
  const selectedIndex = resolveSelectedIndex(items, selectedItem);

  return {
    selectedId,
    selectedIndex,
    selectedItem,
    selectFirst: () => selectByBoundary(items, setSelectedId, "first"),
    selectLast: () => selectByBoundary(items, setSelectedId, "last"),
    selectNext: () => selectByOffset(items, selectedIndex, setSelectedId, 1),
    selectPrevious: () => selectByOffset(items, selectedIndex, setSelectedId, -1),
    setSelectedId
  };
}
