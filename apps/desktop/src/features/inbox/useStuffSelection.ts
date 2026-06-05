import { useState } from "react";
import type { Stuff } from "./types";

type SelectionCursor = {
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
  visibleStuffs: Stuff[];
};

function selectedStuff(visibleStuffs: Stuff[], selectedId: string | null): Stuff | null {
  return visibleStuffs.find((item) => item.id === selectedId) ?? visibleStuffs[0] ?? null;
}

function selectedStuffIndex(visibleStuffs: Stuff[], selectedItem: Stuff | null): number {
  return selectedItem ? visibleStuffs.findIndex((item) => item.id === selectedItem.id) : -1;
}

function selectStuffByOffset(selection: SelectionCursor, offset: number) {
  if (selection.visibleStuffs.length === 0) return;

  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.visibleStuffs.length - 1);
  selection.setSelectedId(selection.visibleStuffs[nextIndex].id);
}

function selectFirstStuff(selection: SelectionCursor) {
  if (selection.visibleStuffs.length === 0) return;
  selection.setSelectedId(selection.visibleStuffs[0].id);
}

function selectLastStuff(selection: SelectionCursor) {
  if (selection.visibleStuffs.length === 0) return;
  selection.setSelectedId(selection.visibleStuffs[selection.visibleStuffs.length - 1].id);
}

/**
 * Tracks selected stuff and bounded keyboard navigation for a visible stuff list.
 *
 * @example const selection = useStuffSelection(stuffs)
 */
export function useStuffSelection(visibleStuffs: Stuff[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = selectedStuff(visibleStuffs, selectedId);
  const selectedIndex = selectedStuffIndex(visibleStuffs, selectedItem);
  const selection = { selectedIndex, setSelectedId, visibleStuffs };

  return { ...selection, selectedId, selectedItem, selectFirstStuff: () => selectFirstStuff(selection), selectLastStuff: () => selectLastStuff(selection), selectNextStuff: () => selectStuffByOffset(selection, 1), selectPreviousStuff: () => selectStuffByOffset(selection, -1) };
}
