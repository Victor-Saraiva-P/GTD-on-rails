import { useEffect, useState } from "react";
import { useUndoRedoHistory } from "../history/useUndoRedoHistory.ts";
import type { ItemBody } from "../inbox/types.ts";
import { isSameBody } from "../inbox/types.ts";
import { useActiveZone } from "../keybinds/hooks.ts";
import type { FocusZoneId } from "../keybinds/types.ts";
import {
  somedayMaybeSubviewTarget,
  type SomedayMaybeSubviewDirection
} from "./somedayMaybeSubview.ts";
import { useSomedayMaybeSelection } from "./somedayMaybeSelection.ts";
import type { SomedayMaybeItem, SomedayMaybeSubview } from "./types.ts";
import { useSomedayMaybeQuery } from "./useSomedayMaybeQuery.ts";

type TitleEditState = {
  editingId: string | null;
  editingTitle: string;
  editingTitleError: string | null;
  setEditingId: (id: string | null) => void;
  setEditingTitle: (title: string) => void;
  setEditingTitleError: (error: string | null) => void;
};

type BodyEditState = {
  editingBodyId: string | null;
  vimMode: "NORMAL" | "INSERT" | "VISUAL" | null;
  setEditingBodyId: (id: string | null) => void;
  setVimMode: (mode: "NORMAL" | "INSERT" | "VISUAL" | null) => void;
};

function useTitleEditState(): TitleEditState {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTitleError, setEditingTitleError] = useState<string | null>(null);
  return { editingId, editingTitle, editingTitleError, setEditingId, setEditingTitle, setEditingTitleError };
}

function useBodyEditState(): BodyEditState {
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { editingBodyId, setEditingBodyId, setVimMode, vimMode };
}

function useSomedayMaybeModel() {
  const [activeSubview, setActiveSubview] = useState<SomedayMaybeSubview>("active");
  const query = useSomedayMaybeQuery(activeSubview);
  const selection = useSomedayMaybeSelection(query.items);
  const titleEdit = useTitleEditState();
  const bodyEdit = useBodyEditState();
  const zone = useActiveZone();
  const history = useUndoRedoHistory<SomedayMaybeItem>();

  return { activeSubview, bodyEdit, history, query, selection, setActiveSubview, titleEdit, zone };
}

type WorkspaceModel = ReturnType<typeof useSomedayMaybeModel>;

function clearEditing(model: WorkspaceModel) {
  model.titleEdit.setEditingId(null);
  model.titleEdit.setEditingTitle("");
  model.titleEdit.setEditingTitleError(null);
  model.bodyEdit.setEditingBodyId(null);
  model.bodyEdit.setVimMode(null);
}

function useWorkspacePruning(model: WorkspaceModel) {
  useEffect(() => {
    const hasCurrent = model.query.items.some((i) => i.id === model.selection.selectedId);
    if (!hasCurrent) {
      model.selection.setSelectedId(model.query.items[0]?.id ?? null);
      clearEditing(model);
    }
  }, [model.query.items, model.selection.selectedId]);
}

async function commitTitleEdit(model: WorkspaceModel) {
  const item = model.selection.selectedItem;
  if (!item || model.titleEdit.editingId !== item.id) return;
  const title = model.titleEdit.editingTitle.trim();
  if (!title) {
    clearEditing(model);
    return;
  }
  if (title === item.title) {
    clearEditing(model);
    return;
  }
  try {
    const updated = await model.query.updateTitle(item, title);
    model.selection.setSelectedId(updated.id);
    clearEditing(model);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save title.";
    model.titleEdit.setEditingTitleError(message);
    throw error;
  }
}

async function commitBodyEdit(model: WorkspaceModel, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.bodyEdit.editingBodyId !== item.id) return;
  if (!isSameBody(item.body, body)) {
    const updated = await model.query.updateBody(item, body);
    model.selection.setSelectedId(updated.id);
  }
  model.bodyEdit.setEditingBodyId(null);
  model.bodyEdit.setVimMode(null);
}

async function autosaveBodyEdit(model: WorkspaceModel, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.bodyEdit.editingBodyId !== item.id) return;
  if (isSameBody(item.body, body)) return;
  const updated = await model.query.updateBody(item, body);
  model.selection.setSelectedId(updated.id);
}

async function revertSelectedToStuff(model: WorkspaceModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.revertToStuff(item.id);
  clearEditing(model);
  model.zone.setActiveZone("someday-maybe-list");
}

async function deleteSelected(model: WorkspaceModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.deleteItem(item.id);
  model.history.pushUndo({ type: "DELETE", payload: item });
  clearEditing(model);
  model.zone.setActiveZone("someday-maybe-list");
}

async function recoverSelected(model: WorkspaceModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.recoverItem(item.id);
  model.history.pushUndo({ type: "RESTORE", payload: item });
  clearEditing(model);
  model.zone.setActiveZone("someday-maybe-list");
}

async function undoAction(model: WorkspaceModel) {
  const action = model.history.popUndo();
  if (!action) return;
  if (action.type === "DELETE") {
    await model.query.recoverItem(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  } else {
    await model.query.deleteItem(action.payload.id);
  }
}

async function redoAction(model: WorkspaceModel) {
  const action = model.history.popRedo();
  if (!action) return;
  if (action.type === "RESTORE") {
    await model.query.deleteItem(action.payload.id);
  } else {
    await model.query.recoverItem(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  }
}

function startEditingTitle(model: WorkspaceModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.titleEdit.setEditingId(item.id);
  model.titleEdit.setEditingTitle(item.title);
  model.titleEdit.setEditingTitleError(null);
}

function startEditingBody(model: WorkspaceModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.zone.setActiveZone("someday-maybe-detail");
  model.bodyEdit.setEditingBodyId(item.id);
}

function switchSubview(model: WorkspaceModel, direction: SomedayMaybeSubviewDirection) {
  clearEditing(model);
  model.setActiveSubview(somedayMaybeSubviewTarget(model.activeSubview, direction));
  model.zone.setActiveZone("someday-maybe-list");
}

function resetWorkspace(model: WorkspaceModel) {
  clearEditing(model);
  model.setActiveSubview("active");
  model.selection.setSelectedId(model.query.items[0]?.id ?? null);
  model.zone.setActiveZone("someday-maybe-list");
}

function buildWorkspaceActions(model: WorkspaceModel) {
  return {
    assignSelectedProject: async (projectId: string | null) => {
      const item = model.selection.selectedItem;
      if (!item) return;
      await model.query.assignProject(item, projectId);
    },
    autosaveEditingBody: (body: ItemBody) => autosaveBodyEdit(model, body),
    cancelEditingBody: () => {
      model.bodyEdit.setEditingBodyId(null);
      model.bodyEdit.setVimMode(null);
    },
    cancelEditingTitle: () => clearEditing(model),
    commitEditingBody: (body: ItemBody) => commitBodyEdit(model, body),
    commitEditingTitle: () => commitTitleEdit(model),
    deleteSelected: () => deleteSelected(model),
    recoverSelected: () => recoverSelected(model),
    redo: () => redoAction(model),
    reload: model.query.reload,
    resetWorkspace: () => resetWorkspace(model),
    revertSelectedToStuff: () => revertSelectedToStuff(model),
    selectFirst: model.selection.selectFirst,
    selectLast: model.selection.selectLast,
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    setActiveZone: (zone: FocusZoneId) => model.zone.setActiveZone(zone),
    setEditingTitle: (title: string) => {
      model.titleEdit.setEditingTitle(title);
      model.titleEdit.setEditingTitleError(null);
    },
    setSelectedId: model.selection.setSelectedId,
    setVimMode: model.bodyEdit.setVimMode,
    startEditingBody: () => startEditingBody(model),
    startEditingTitle: () => startEditingTitle(model),
    switchSubview: (direction: SomedayMaybeSubviewDirection) => switchSubview(model, direction),
    undo: () => undoAction(model)
  };
}

/**
 * Controller for managing someday/maybe state, keyboard actions, and subviews.
 *
 * @example const controller = useSomedayMaybeWorkspaceController()
 */
export function useSomedayMaybeWorkspaceController() {
  const model = useSomedayMaybeModel();
  useWorkspacePruning(model);
  const actions = buildWorkspaceActions(model);

  return {
    ...actions,
    activeSubview: model.activeSubview,
    activeZone: model.zone.activeZone,
    editingBodyId: model.bodyEdit.editingBodyId,
    editingId: model.titleEdit.editingId,
    editingTitle: model.titleEdit.editingTitle,
    editingTitleError: model.titleEdit.editingTitleError,
    errorMessage: model.query.errorMessage,
    isLoading: model.query.isLoading,
    isUpdating: model.query.isUpdating,
    items: model.selection.selectedItem ? model.query.items : model.query.items,
    selectedIndex: model.selection.selectedIndex,
    selectedItem: model.selection.selectedItem,
    stuffs: model.query.items,
    vimMode: model.bodyEdit.vimMode
  };
}

export type SomedayMaybeWorkspaceController = ReturnType<typeof useSomedayMaybeWorkspaceController>;
