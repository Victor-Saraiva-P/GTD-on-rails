import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import type { FocusZoneId } from "../keybinds/types";
import type { NextAction } from "./types";
import { useArchivedNextActionsQuery } from "./useArchivedNextActionsQuery";

type ArchivedNextActionsConfig = {
  listZone: FocusZoneId;
  detailZone: FocusZoneId;
  loadItems: () => Promise<NextAction[]>;
  recoverItem: (id: string) => Promise<NextAction | void>;
  errorLabel: string;
};

type SelectionCursor = {
  items: NextAction[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
};

type ArchivedModel = ReturnType<typeof useArchivedNextActionsModel>;
type ArchivedActions = ReturnType<typeof useArchivedNextActionsActions>;

function selectedItem(items: NextAction[], selectedId: string | null): NextAction | null {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

function selectedIndex(items: NextAction[], item: NextAction | null): number {
  return item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
}

function moveSelection(selection: SelectionCursor, offset: number) {
  if (selection.items.length === 0) return;
  const index = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.items.length - 1);
  selection.setSelectedId(selection.items[index].id);
}

function useArchivedSelection(items: NextAction[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedItem(items, selectedId);
  const index = selectedIndex(items, selected);
  const selection = { items, selectedIndex: index, setSelectedId };

  return { ...selection, selectedId, selectedItem: selected, selectNext: () => moveSelection(selection, 1), selectPrevious: () => moveSelection(selection, -1) };
}

function hasVisibleItem(model: ArchivedModel, id: string): boolean {
  return model.selection.items.some((item) => item.id === id);
}

function pruneArchivedState(model: ArchivedModel) {
  if (model.selection.items.length === 0) {
    model.selection.setSelectedId(null);
    return;
  }

  if (!model.selection.selectedId || !hasVisibleItem(model, model.selection.selectedId)) {
    model.selection.setSelectedId(model.selection.items[0].id);
  }
}

function useArchivedPruning(model: ArchivedModel) {
  useEffect(() => pruneArchivedState(model), [model.selection.items, model.selection.selectedId]);
}

function useArchivedNextActionsModel(config: ArchivedNextActionsConfig) {
  const query = useArchivedNextActionsQuery(config);
  const selection = useArchivedSelection(query.items);
  const zone = useActiveZone();
  return { config, query, selection, zone };
}

async function recoverSelected(model: ArchivedModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.recoverItem(item.id);
  model.zone.setActiveZone(model.config.listZone);
}

function resetWorkspace(model: ArchivedModel) {
  model.selection.setSelectedId(model.query.items[0]?.id ?? null);
  model.zone.setActiveZone(model.config.listZone);
}

function useArchivedNextActionsActions(model: ArchivedModel) {
  return {
    recoverSelected: () => recoverSelected(model),
    resetWorkspace: () => resetWorkspace(model),
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious
  };
}

function buildArchivedController(model: ArchivedModel, actions: ArchivedActions) {
  return {
    ...actions,
    activeZone: model.zone.activeZone,
    errorMessage: model.query.errorMessage,
    isLoading: model.query.isLoading,
    isUpdating: model.query.isUpdating,
    reload: model.query.reload,
    selectedIndex: model.selection.selectedIndex,
    selectedItem: model.selection.selectedItem,
    setActiveZone: model.zone.setActiveZone,
    setSelectedId: model.selection.setSelectedId,
    stuffs: model.selection.items
  };
}

/**
 * Composes archived next action list, selection, and recovery state.
 *
 * @example const controller = useArchivedNextActionsWorkspaceController(config)
 */
export function useArchivedNextActionsWorkspaceController(config: ArchivedNextActionsConfig) {
  const model = useArchivedNextActionsModel(config);
  const actions = useArchivedNextActionsActions(model);

  useArchivedPruning(model);
  return buildArchivedController(model, actions);
}

export type ArchivedNextActionsWorkspaceController = ReturnType<typeof useArchivedNextActionsWorkspaceController>;
export type { ArchivedNextActionsConfig };
