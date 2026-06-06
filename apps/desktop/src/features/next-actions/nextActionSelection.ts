import { useState } from "react";
import type { NextAction } from "./types";

export type NextActionSelectionCursor = {
  items: NextAction[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
};

export function selectedNextActionItem(items: NextAction[], selectedId: string | null): NextAction | null {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

export function selectedNextActionIndex(items: NextAction[], item: NextAction | null): number {
  return item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
}

export function moveNextActionSelection(selection: NextActionSelectionCursor, offset: number): void {
  if (selection.items.length === 0) return;
  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.items.length - 1);
  selection.setSelectedId(selection.items[nextIndex].id);
}

export function selectNextActionBoundary(selection: NextActionSelectionCursor, boundary: "first" | "last"): void {
  if (selection.items.length === 0) return;
  const index = boundary === "first" ? 0 : selection.items.length - 1;
  selection.setSelectedId(selection.items[index].id);
}

export function useNextActionSelection(items: NextAction[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedNextActionItem(items, selectedId);
  const index = selectedNextActionIndex(items, selected);
  const selection = { items, selectedIndex: index, setSelectedId };
  return { ...selection, selectedId, selectedItem: selected, selectFirst: () => selectNextActionBoundary(selection, "first"), selectLast: () => selectNextActionBoundary(selection, "last"), selectNext: () => moveNextActionSelection(selection, 1), selectPrevious: () => moveNextActionSelection(selection, -1) };
}
