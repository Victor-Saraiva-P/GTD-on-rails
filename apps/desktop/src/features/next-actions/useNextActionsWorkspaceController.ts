import { useEffect, useState } from "react";
import { useUndoRedoHistory } from "../history/useUndoRedoHistory";
import { useActiveZone } from "../keybinds/hooks";
import type { ItemBody } from "../inbox/types";
import type { ContextItem } from "../contexts/types";
import type { NextAction, NextActionOrder, NextActionPatch } from "./types";
import { useNextActionsQuery } from "./useNextActionsQuery";

export type SelectionCursor = {
  items: NextAction[];
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
};
export type EditState = ReturnType<typeof useNextActionEditState>;
export type Model = {
  edit: EditState;
  filter: ReturnType<typeof useNextActionsFilterState>;
  history: ReturnType<typeof useUndoRedoHistory<NextAction>>;
  query: any;
  selection: ReturnType<typeof useNextActionSelection>;
  zone: ReturnType<typeof useActiveZone>;
};
export type Actions = ReturnType<typeof useNextActionsActions>;

export function selectedItem(items: NextAction[], selectedId: string | null): NextAction | null {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

export function selectedIndex(items: NextAction[], item: NextAction | null): number {
  return item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
}

export function moveSelection(selection: SelectionCursor, offset: number) {
  if (selection.items.length === 0) return;
  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.items.length - 1);
  selection.setSelectedId(selection.items[nextIndex].id);
}

export function useNextActionSelection(items: NextAction[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedItem(items, selectedId);
  const index = selectedIndex(items, selected);
  const selection = { items, selectedIndex: index, setSelectedId };
  return { ...selection, selectedId, selectedItem: selected, selectNext: () => moveSelection(selection, 1), selectPrevious: () => moveSelection(selection, -1) };
}

export function useNextActionEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { editingBodyId, editingId, editingTitle, setEditingBodyId, setEditingId, setEditingTitle, setVimMode, vimMode };
}

export function useNextActionsFilterState() {
  const [context, setContext] = useState<ContextItem | null>(null);
  const [currentEnergy, setCurrentEnergy] = useState<number | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number | null>(null);
  const [orderBy, setOrderBy] = useState<NextActionOrder>("energy");
  return { context, currentEnergy, currentTimeMinutes, orderBy, setContext, setCurrentEnergy, setCurrentTimeMinutes, setOrderBy };
}

export function useNextActionsModel() {
  const filter = useNextActionsFilterState();
  const query = useNextActionsQuery(
    filter.context?.id ?? null,
    filter.currentTimeMinutes,
    filter.currentEnergy,
    filter.orderBy);
  const selection = useNextActionSelection(query.items);
  const edit = useNextActionEditState();
  const zone = useActiveZone();
  const history = useUndoRedoHistory<NextAction>();
  return { edit, filter, history, query, selection, zone };
}

export function clearTitleEdit(edit: EditState) {
  edit.setEditingId(null);
  edit.setEditingTitle("");
}

export function clearBodyEdit(edit: EditState) {
  edit.setEditingBodyId(null);
  edit.setVimMode(null);
}

export function clearEditing(edit: EditState) {
  clearTitleEdit(edit);
  clearBodyEdit(edit);
}

export function hasVisibleItem(model: Model, id: string): boolean {
  return model.selection.items.some((item) => item.id === id);
}

export function pruneNextActionsState(model: Model) {
  if (model.selection.items.length === 0) {
    model.selection.setSelectedId(null);
    clearEditing(model.edit);
    return;
  }
  if (!model.selection.selectedId || !hasVisibleItem(model, model.selection.selectedId)) {
    model.selection.setSelectedId(model.selection.items[0].id);
  }
  if (model.edit.editingId && !hasVisibleItem(model, model.edit.editingId)) clearTitleEdit(model.edit);
  if (model.edit.editingBodyId && !hasVisibleItem(model, model.edit.editingBodyId)) clearBodyEdit(model.edit);
}

export function useNextActionsPruning(model: Model) {
  useEffect(() => pruneNextActionsState(model), [model.edit.editingBodyId, model.edit.editingId, model.selection.items, model.selection.selectedId]);
}

export function startTitleEdit(model: Model) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.edit.setEditingId(item.id);
  model.edit.setEditingTitle(item.title);
}

export async function commitTitleEdit(model: Model) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingId !== item.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearTitleEdit(model.edit); return; }
  const updated = title === item.title ? item : await model.query.updateTitle(item, title);
  model.selection.setSelectedId(updated.id);
  clearTitleEdit(model.edit);
}

export async function commitBodyEdit(model: Model, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id) return;
  const sameBody = item.body.text === body.text && JSON.stringify(item.body) === JSON.stringify(body);
  if (!sameBody) model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
  clearBodyEdit(model.edit);
}

export async function autosaveBodyEdit(model: Model, body: ItemBody) {
  const item = model.selection.selectedItem;
  if (!item || model.edit.editingBodyId !== item.id) return;
  if (item.body.text === body.text && JSON.stringify(item.body) === JSON.stringify(body)) return;
  model.selection.setSelectedId((await model.query.updateBody(item, body)).id);
}

export async function deleteSelected(model: Model) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.deleteItem(item.id);
  model.history.pushUndo({ type: "DELETE", payload: item });
  clearEditing(model.edit);
  model.zone.setActiveZone("next-actions-list");
}

export async function markAsDone(model: Model) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.markAsDone(item.id);
  clearEditing(model.edit);
  model.zone.setActiveZone("next-actions-list");
}

export async function markAsOnGoing(model: Model) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.markAsOnGoing(item.id);
  clearEditing(model.edit);
  model.zone.setActiveZone("next-actions-list");
}

export async function restoreSelectedStatus(model: Model) {
  const item = model.selection.selectedItem;
  if (!item) return;
  await model.query.restoreStatus(item.id);
  clearEditing(model.edit);
  model.zone.setActiveZone("next-actions-list");
}

export async function undoAction(model: Model) {
  const action = model.history.popUndo();
  if (!action) return;
  if (action.type === "DELETE") { await model.query.restoreItem(action.payload.id); model.selection.setSelectedId(action.payload.id); }
  else await model.query.deleteItem(action.payload.id);
}

export async function redoAction(model: Model) {
  const action = model.history.popRedo();
  if (!action) return;
  if (action.type === "RESTORE") await model.query.deleteItem(action.payload.id);
  else { await model.query.restoreItem(action.payload.id); model.selection.setSelectedId(action.payload.id); }
}

export function useNextActionsActions(model: Model) {
  return {
    autosaveBody: (body: ItemBody) => autosaveBodyEdit(model, body),
    cancelBodyEdit: () => clearBodyEdit(model.edit),
    cancelTitleEdit: () => clearTitleEdit(model.edit),
    commitBody: (body: ItemBody) => commitBodyEdit(model, body),
    commitTitle: () => commitTitleEdit(model),
    deleteSelected: () => deleteSelected(model),
    markAsDone: () => markAsDone(model),
    markAsOnGoing: () => markAsOnGoing(model),
    patchSelected: (patch: NextActionPatch) => patchSelected(model, patch),
    redo: () => redoAction(model),
    restoreSelected: () => restoreSelectedStatus(model),
    selectNext: model.selection.selectNext,
    selectPrevious: model.selection.selectPrevious,
    setContext: model.filter.setContext,
    setCurrentEnergy: model.filter.setCurrentEnergy,
    setCurrentTimeMinutes: model.filter.setCurrentTimeMinutes,
    startBodyEdit: () => startBodyEdit(model),
    startTitleEdit: () => startTitleEdit(model),
    toggleOrder: () => model.filter.setOrderBy(nextOrder),
    undo: () => undoAction(model)
  };
}

export function nextOrder(order: NextActionOrder): NextActionOrder {
  if (order === "energy") return "time";
  if (order === "time") return "priority";
  return "energy";
}

export function startBodyEdit(model: Model) {
  if (!model.selection.selectedItem) return;
  model.zone.setActiveZone("next-action-detail");
  model.edit.setEditingBodyId(model.selection.selectedItem.id);
}

export async function patchSelected(model: Model, patch: NextActionPatch) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.selection.setSelectedId((await model.query.patchItem(item.id, patch)).id);
}

export function buildController(model: Model, actions: Actions) {
  return {
    ...actions,
    activeZone: model.zone.activeZone,
    context: model.filter.context,
    currentEnergy: model.filter.currentEnergy,
    currentTimeMinutes: model.filter.currentTimeMinutes,
    editingBodyId: model.edit.editingBodyId,
    editingId: model.edit.editingId,
    editingTitle: model.edit.editingTitle,
    errorMessage: model.query.errorMessage,
    isDeleting: model.query.isDeleting,
    isLoading: model.query.isLoading,
    isUpdating: model.query.isUpdating,
    orderBy: model.filter.orderBy,
    reload: model.query.reload,
    selectedIndex: model.selection.selectedIndex,
    selectedItem: model.selection.selectedItem,
    setActiveZone: model.zone.setActiveZone,
    setEditingTitle: model.edit.setEditingTitle,
    setSelectedId: model.selection.setSelectedId,
    setVimMode: model.edit.setVimMode,
    stuffs: model.selection.items,
    vimMode: model.edit.vimMode
  };
}

/**
 * Composes next action list, filter, selection, and editing state.
 *
 * @example const controller = useNextActionsWorkspaceController()
 */
export function useNextActionsWorkspaceController() {
  const model = useNextActionsModel();
  const actions = useNextActionsActions(model);
  useNextActionsPruning(model);
  return buildController(model, actions);
}

export type NextActionsWorkspaceController = ReturnType<typeof useNextActionsWorkspaceController>;
