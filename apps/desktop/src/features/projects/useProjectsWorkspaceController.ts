import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { projectSubviewTarget, type ProjectSubview } from "./projectSubview";
import type { ProjectPatch } from "./types";
import { useProjectSelection } from "./projectSelection";
import { useProjectsQuery } from "./useProjectsQuery";

function useProjectsModel() {
  const [activeSubview, setActiveSubview] = useState<ProjectSubview>("active");
  const query = useProjectsQuery(activeSubview);
  const selection = useProjectSelection(query.items);
  const zone = useActiveZone();
  return { activeSubview, query, selection, setActiveSubview, zone };
}

function useProjectPruning(model: ReturnType<typeof useProjectsModel>) {
  useEffect(() => {
    const selectedId = model.selection.selectedItem?.id ?? model.query.items[0]?.id ?? null;
    model.selection.setSelectedId(selectedId);
  }, [model.query.items, model.selection.selectedItem?.id]);
}

function useProjectActions(model: ReturnType<typeof useProjectsModel>) {
  return {
    markSelectedDone: () => moveSelectedProject(model, model.query.markDone),
    patchSelected: (patch: ProjectPatch) => patchSelected(model, patch),
    reload: model.query.reload,
    resetSelectedStatus: () => moveSelectedProject(model, model.query.resetStatus),
    resetWorkspace: () => resetWorkspace(model),
    selectFirst: model.selection.selectFirst,
    selectLast: model.selection.selectLast,
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    setActiveZone: model.zone.setActiveZone,
    setSelectedId: model.selection.setSelectedId,
    switchSubview: () => switchSubview(model)
  };
}

async function patchSelected(model: ReturnType<typeof useProjectsModel>, patch: ProjectPatch) {
  const selected = model.selection.selectedItem;
  if (!selected) return;
  model.selection.setSelectedId((await model.query.patchItem(selected.id, patch)).id);
}

async function moveSelectedProject(model: ReturnType<typeof useProjectsModel>, action: (id: string) => Promise<void>) {
  const selected = model.selection.selectedItem;
  if (!selected) return;
  await action(selected.id);
}

function resetWorkspace(model: ReturnType<typeof useProjectsModel>) {
  model.setActiveSubview("active");
  model.zone.setActiveZone("projects-list");
}

function switchSubview(model: ReturnType<typeof useProjectsModel>) {
  model.setActiveSubview(projectSubviewTarget(model.activeSubview));
  model.zone.setActiveZone("projects-list");
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
  return { ...actions, activeSubview: model.activeSubview, activeZone: model.zone.activeZone, errorMessage: model.query.errorMessage, isLoading: model.query.isLoading, isUpdating: model.query.isUpdating, projects: model.query.items, selectedItem: model.selection.selectedItem };
}

export type ProjectsWorkspaceController = ReturnType<typeof useProjectsWorkspaceController>;
