import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import type { ItemBody } from "../inbox/types";
import { isSameBody } from "../inbox/types";
import type { OnGoingItemSelection } from "./combinedOnGoingState.ts";
import { useOnGoingUnifiedQuery } from "./useOnGoingUnifiedQuery.ts";

function useOnGoingSelection(items: OnGoingItemSelection[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.item.id === selectedId) ?? items[0] ?? null;
  const selectedIndex = selectedItem ? items.findIndex((item) => item.item.id === selectedItem.item.id) : -1;

  return { items, pendingSelectedId, selectedId, selectedIndex, selectedItem, setPendingSelectedId, setSelectedId };
}

function useOnGoingEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTitleError, setEditingTitleError] = useState<string | null>(null);
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);

  return { editingId, editingTitle, editingTitleError, setEditingId, setEditingTitle, setEditingTitleError, editingBodyId, setEditingBodyId, setVimMode, vimMode };
}

type OnGoingSelection = ReturnType<typeof useOnGoingSelection>;
type OnGoingEditState = ReturnType<typeof useOnGoingEditState>;

type OnGoingModel = {
  edit: OnGoingEditState;
  query: ReturnType<typeof useOnGoingUnifiedQuery>;
  selection: OnGoingSelection;
  zone: ReturnType<typeof useActiveZone>;
};

function clearEditing(edit: OnGoingEditState) {
  edit.setEditingBodyId(null);
  edit.setEditingId(null);
  edit.setEditingTitle("");
  edit.setEditingTitleError(null);
  edit.setVimMode(null);
}

function usePruning(model: OnGoingModel) {
  useEffect(() => {
    if (model.selection.items.length === 0) {
      model.selection.setSelectedId(null);
      return;
    }
    if (!model.selection.selectedItem) {
      model.selection.setSelectedId(model.selection.items[0].item.id);
    }
  }, [model.selection.items, model.selection.selectedId]);
}

function usePendingSelection(model: OnGoingModel) {
  useEffect(() => {
    const id = model.selection.pendingSelectedId;
    if (!id || !model.selection.items.some((item) => item.item.id === id)) return;
    model.selection.setSelectedId(id);
    model.selection.setPendingSelectedId(null);
  }, [model.selection.items, model.selection.pendingSelectedId]);
}

async function mutateSelected(model: OnGoingModel, action: "markAsDone" | "restoreSelected" | "deleteSelected") {
  const selected = model.selection.selectedItem;
  if (!selected) return;

  if (selected.type === "next-action") {
    const mutate = model.query.nextActionsActions[action];
    if (mutate) await mutate(selected.item.id);
  } else {
    // map the standard action names to calendar-specific ones if necessary
    const calActions = model.query.calendarsActions;
    if (action === "markAsDone") await calActions.markAsDone(selected.item.id);
    else if (action === "restoreSelected") await calActions.restoreStatus(selected.item.id);
    else if (action === "deleteSelected") await calActions.deleteItem(selected.item.id);
  }

  clearEditing(model.edit);
}

function startTitleEdit(model: OnGoingModel) {
  const item = model.selection.selectedItem;
  if (!item) return;
  model.edit.setEditingId(item.item.id);
  model.edit.setEditingTitle(item.item.title);
  model.edit.setEditingTitleError(null);
}

async function commitTitle(model: OnGoingModel) {
  const selected = model.selection.selectedItem;
  if (!selected || model.edit.editingId !== selected.item.id) return;
  const title = model.edit.editingTitle.trim();
  if (!title) { clearEditing(model.edit); return; }

  try {
    if (title !== selected.item.title) {
      if (selected.type === "next-action") {
        await model.query.nextActionsActions.updateTitle(selected.item, title);
      } else {
        await model.query.calendarsActions.updateTitle(selected.item, title);
      }
    }
    clearEditing(model.edit);
  } catch (error: unknown) {
    model.edit.setEditingTitleError(error instanceof Error ? error.message : "Failed to save title.");
    throw error;
  }
}

async function commitBody(model: OnGoingModel, body: ItemBody) {
  const selected = model.selection.selectedItem;
  if (!selected || model.edit.editingBodyId !== selected.item.id) return;
  if (!isSameBody(selected.item.body, body)) {
    if (selected.type === "next-action") {
      await model.query.nextActionsActions.updateBody(selected.item, body);
    } else {
      await model.query.calendarsActions.updateBody(selected.item, body);
    }
  }
  clearEditing(model.edit);
}

async function autosaveBody(model: OnGoingModel, body: ItemBody) {
  const selected = model.selection.selectedItem;
  if (!selected || model.edit.editingBodyId !== selected.item.id || isSameBody(selected.item.body, body)) return;
  if (selected.type === "next-action") {
    await model.query.nextActionsActions.updateBody(selected.item, body);
  } else {
    await model.query.calendarsActions.updateBody(selected.item, body);
  }
}

function moveSelection(selection: OnGoingSelection, offset: number) {
  if (selection.items.length === 0) return;
  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.items.length - 1);
  selection.setSelectedId(selection.items[nextIndex].item.id);
}

function selectOnGoingId(selection: OnGoingSelection, id: string | null) {
  if (!id || selection.items.some((item) => item.item.id === id)) {
    selection.setSelectedId(id);
    return;
  }
  selection.setPendingSelectedId(id);
}

export function useOnGoingWorkspaceController() {
  const query = useOnGoingUnifiedQuery();
  const selection = useOnGoingSelection(query.items);
  const edit = useOnGoingEditState();
  const zone = useActiveZone();
  const model = { edit, query, selection, zone };

  usePruning(model);
  usePendingSelection(model);

  return {
    // State
    activeZone: zone.activeZone,
    setActiveZone: zone.setActiveZone,
    stuffs: selection.items,
    selectedItem: selection.selectedItem,
    selectedIndex: selection.selectedIndex,
    isLoading: query.isLoading,
    isUpdating: query.isUpdating,
    isDeleting: query.isDeleting,
    errorMessage: query.errorMessage,
    editingId: edit.editingId,
    editingTitle: edit.editingTitle,
    editingTitleError: edit.editingTitleError,
    editingBodyId: edit.editingBodyId,
    vimMode: edit.vimMode,
    reload: query.reload,

    // Selection Actions
    setSelectedId: (id: string | null) => selectOnGoingId(selection, id),
    selectNext: () => moveSelection(selection, 1),
    selectPrevious: () => moveSelection(selection, -1),
    selectFirst: () => { if (selection.items.length > 0) selection.setSelectedId(selection.items[0].item.id); },
    selectLast: () => { if (selection.items.length > 0) selection.setSelectedId(selection.items[selection.items.length - 1].item.id); },

    // Edit Actions
    setEditingTitle: (value: string) => { edit.setEditingTitle(value); edit.setEditingTitleError(null); },
    startTitleEdit: () => startTitleEdit(model),
    cancelTitleEdit: () => clearEditing(edit),
    commitTitle: () => commitTitle(model),
    startBodyEdit: (id?: string) => edit.setEditingBodyId(id ?? selection.selectedItem?.item.id ?? null),
    cancelBodyEdit: () => clearEditing(edit),
    commitBody: (body: ItemBody) => commitBody(model, body),
    autosaveBody: (body: ItemBody) => autosaveBody(model, body),
    setVimMode: edit.setVimMode,
    resetWorkspace: () => clearEditing(edit),

    // Mutations
    markAsDone: () => mutateSelected(model, "markAsDone"),
    restoreSelected: () => mutateSelected(model, "restoreSelected"),
    deleteSelected: () => mutateSelected(model, "deleteSelected"),
  };
}

export type OnGoingWorkspaceController = ReturnType<typeof useOnGoingWorkspaceController>;
