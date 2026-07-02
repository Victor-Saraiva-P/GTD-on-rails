import { useEffect, useState } from "react";
import { useUndoRedoHistory } from "../history/useUndoRedoHistory";
import { useActiveZone } from "../keybinds/hooks";
import { projectSubviewTarget, type ProjectSubview, type ProjectSubviewDirection } from "./projectSubview";
import type { ProjectPatch } from "./types";
import { useProjectSelection } from "./projectSelection";
import { useProjectsQuery } from "./useProjectsQuery";

function useProjectsModel() {
  const [activeSubview, setActiveSubview] = useState<ProjectSubview>("active");
  const query = useProjectsQuery(activeSubview);
  const selection = useProjectSelection(query.items);
  const zone = useActiveZone();
  const history = useUndoRedoHistory<NonNullable<typeof selection.selectedItem>>();
  return { activeSubview, history, query, selection, setActiveSubview, zone };
}

function useProjectPruning(model: ReturnType<typeof useProjectsModel>) {
  useEffect(() => {
    const selectedId = model.selection.selectedItem?.id ?? model.query.items[0]?.id ?? null;
    model.selection.setSelectedId(selectedId);
  }, [model.query.items, model.selection.selectedItem?.id]);
}

function useProjectActions(model: ReturnType<typeof useProjectsModel>) {
  return {
    deleteSelected: () => deleteSelectedProject(model),
    markSelectedDone: () => moveSelectedProject(model, model.query.markDone),
    patchSelected: (patch: ProjectPatch) => patchSelected(model, patch),
    recoverSelected: () => recoverSelectedProject(model),
    reload: model.query.reload,
    redo: () => redoProjectAction(model),
    resetSelectedStatus: () => moveSelectedProject(model, model.query.resetStatus),
    resetWorkspace: () => resetWorkspace(model),
    selectFirst: model.selection.selectFirst,
    selectLast: model.selection.selectLast,
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    setActiveZone: model.zone.setActiveZone,
    setSelectedId: model.selection.setSelectedId,
    switchSubview: (direction: ProjectSubviewDirection) => switchSubview(model, direction),
    undo: () => undoProjectAction(model)
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

async function deleteSelectedProject(model: ReturnType<typeof useProjectsModel>) {
  const selected = model.selection.selectedItem;
  if (!selected) return;
  await model.query.deleteItem(selected.id);
  model.history.pushUndo({ type: "DELETE", payload: selected });
}

async function recoverSelectedProject(model: ReturnType<typeof useProjectsModel>) {
  const selected = model.selection.selectedItem;
  if (!selected) return;
  await model.query.recoverItem(selected.id);
  model.history.pushUndo({ type: "RESTORE", payload: selected });
}

async function undoProjectAction(model: ReturnType<typeof useProjectsModel>) {
  const action = model.history.popUndo();
  if (!action) return;
  await runHistoryProjectAction(model, action.type, action.payload.id);
}

async function redoProjectAction(model: ReturnType<typeof useProjectsModel>) {
  const action = model.history.popRedo();
  if (!action) return;
  await runHistoryProjectAction(model, action.type, action.payload.id);
}

async function runHistoryProjectAction(model: ReturnType<typeof useProjectsModel>, type: "DELETE" | "RESTORE", id: string) {
  if (type === "DELETE") await model.query.recoverItem(id);
  else await model.query.deleteItem(id);
  model.selection.setSelectedId(id);
}

function resetWorkspace(model: ReturnType<typeof useProjectsModel>) {
  model.setActiveSubview("active");
  model.zone.setActiveZone("projects-list");
}

function switchSubview(model: ReturnType<typeof useProjectsModel>, direction: ProjectSubviewDirection) {
  model.setActiveSubview(projectSubviewTarget(model.activeSubview, direction));
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
