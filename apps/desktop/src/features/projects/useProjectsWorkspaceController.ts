import { useEffect } from "react";
import { useActiveZone } from "../keybinds/hooks";
import type { ProjectPatch } from "./types";
import { useProjectSelection } from "./projectSelection";
import { useProjectsQuery } from "./useProjectsQuery";

function useProjectsModel() {
  const query = useProjectsQuery();
  const selection = useProjectSelection(query.items);
  const zone = useActiveZone();
  return { query, selection, zone };
}

function useProjectPruning(model: ReturnType<typeof useProjectsModel>) {
  useEffect(() => {
    const selectedId = model.selection.selectedItem?.id ?? model.query.items[0]?.id ?? null;
    model.selection.setSelectedId(selectedId);
  }, [model.query.items, model.selection.selectedItem?.id]);
}

function useProjectActions(model: ReturnType<typeof useProjectsModel>) {
  return {
    patchSelected: (patch: ProjectPatch) => patchSelected(model, patch),
    reload: model.query.reload,
    resetWorkspace: () => model.zone.setActiveZone("projects-list"),
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    setActiveZone: model.zone.setActiveZone,
    setSelectedId: model.selection.setSelectedId
  };
}

async function patchSelected(model: ReturnType<typeof useProjectsModel>, patch: ProjectPatch) {
  const selected = model.selection.selectedItem;
  if (!selected) return;
  model.selection.setSelectedId((await model.query.patchItem(selected.id, patch)).id);
}

/**
 * Composes project list, selection, and editing state.
 *
 * @example const controller = useProjectsWorkspaceController()
 */
export function useProjectsWorkspaceController() {
  const model = useProjectsModel();
  const actions = useProjectActions(model);
  useProjectPruning(model);
  return { ...actions, activeZone: model.zone.activeZone, errorMessage: model.query.errorMessage, isLoading: model.query.isLoading, isUpdating: model.query.isUpdating, projects: model.query.items, selectedItem: model.selection.selectedItem };
}

export type ProjectsWorkspaceController = ReturnType<typeof useProjectsWorkspaceController>;
