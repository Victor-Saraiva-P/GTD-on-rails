import { useEffect } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { useDeletedStuffsQuery } from "./useDeletedStuffsQuery";
import { useStuffSelection } from "./useStuffSelection";
import type { Stuff } from "./types";

type DeletedQuery = ReturnType<typeof useDeletedStuffsQuery>;
type DeletedModel = ReturnType<typeof useDeletedInboxWorkspaceModel>;
type DeletedActions = ReturnType<typeof useDeletedInboxWorkspaceActions>;

function useDeletedSelection(stuffs: Stuff[]) {
  return useStuffSelection(stuffs);
}

function pruneEmptyDeleted(model: DeletedModel) {
  model.selection.setSelectedId(null);
}

function hasVisibleStuff(model: DeletedModel, id: string): boolean {
  return model.selection.visibleStuffs.some((item) => item.id === id);
}

function pruneMissingSelection(model: DeletedModel) {
  if (!model.selection.selectedId || !hasVisibleStuff(model, model.selection.selectedId)) {
    model.selection.setSelectedId(model.selection.visibleStuffs[0].id);
  }
}

function pruneDeletedState(model: DeletedModel) {
  if (model.selection.visibleStuffs.length === 0) {
    pruneEmptyDeleted(model);
    return;
  }

  pruneMissingSelection(model);
}

function usePruneDeletedState(model: DeletedModel) {
  useEffect(() => {
    pruneDeletedState(model);
  }, [model.selection.selectedId, model.selection.visibleStuffs]);
}

async function restoreSelectedStuffAction(model: DeletedModel) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem) {
    return;
  }

  await model.query.restoreStuff(selectedItem.id);
  model.zone.setActiveZone("deleted-inbox-list");
}

function resetWorkspaceAction(model: DeletedModel) {
  model.selection.setSelectedId(model.query.stuffs[0]?.id ?? null);
  model.zone.setActiveZone("deleted-inbox-list");
}

function useDeletedInboxWorkspaceActions(model: DeletedModel) {
  return {
    resetWorkspace: () => resetWorkspaceAction(model),
    restoreSelectedStuff: () => restoreSelectedStuffAction(model),
    selectFirstStuff: model.selection.selectFirstStuff,
    selectLastStuff: model.selection.selectLastStuff,
    selectNextStuff: model.selection.selectNextStuff,
    selectPreviousStuff: model.selection.selectPreviousStuff
  };
}

function useDeletedInboxWorkspaceModel() {
  const query = useDeletedStuffsQuery();
  const selection = useDeletedSelection(query.stuffs);
  const zone = useActiveZone();

  return { query, selection, zone };
}

function controllerQueryState(query: DeletedQuery) {
  return { errorMessage: query.errorMessage, isLoading: query.isLoading, isUpdating: query.isUpdating, reload: query.reload };
}

function controllerSelectionState(model: DeletedModel) {
  return { selectedId: model.selection.selectedId, selectedIndex: model.selection.selectedIndex, selectedItem: model.selection.selectedItem, stuffs: model.selection.visibleStuffs };
}

function buildDeletedInboxWorkspaceController(model: DeletedModel, actions: DeletedActions) {
  return {
    ...actions,
    ...controllerQueryState(model.query),
    ...controllerSelectionState(model),
    activeZone: model.zone.activeZone,
    setActiveZone: model.zone.setActiveZone,
    setSelectedId: model.selection.setSelectedId
  };
}

/**
 * Composes deleted inbox query, selection, and keybind state.
 *
 * @example const controller = useDeletedInboxWorkspaceController()
 */
export function useDeletedInboxWorkspaceController() {
  const model = useDeletedInboxWorkspaceModel();
  const actions = useDeletedInboxWorkspaceActions(model);

  usePruneDeletedState(model);
  return buildDeletedInboxWorkspaceController(model, actions);
}

export type DeletedInboxWorkspaceController = ReturnType<typeof useDeletedInboxWorkspaceController>;
