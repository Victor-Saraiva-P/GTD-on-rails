import type { HistoryAction } from "../history/useUndoRedoHistory";
import type { ProjectItem } from "./projectItems";

/**
 * Deletes a project item or clears a pending draft item.
 *
 * @example await deleteProjectItemAction(item, "__draft__", deleteItem, pushUndo, clearDraft, clearEdit, reload)
 */
export async function deleteProjectItemAction(
  item: ProjectItem | null,
  draftId: string,
  deleteItem: (id: string) => Promise<void>,
  pushUndo: (action: HistoryAction<ProjectItem>) => void,
  clearDraft: () => void,
  clearEdit: () => void,
  reload: () => void
): Promise<void> {
  if (!item) return;
  if (item.id === draftId) {
    clearDraft();
    return;
  }
  await deleteItem(item.id);
  pushUndo({ type: "DELETE", payload: item });
  clearEdit();
  reload();
}

/**
 * Executes an undo operation for a project item deletion or restoration.
 *
 * @example await executeProjectItemUndo(action, restoreItem, deleteItem, setSelectedId, reload)
 */
export async function executeProjectItemUndo(
  action: HistoryAction<ProjectItem> | null,
  restoreItem: (id: string) => Promise<void>,
  deleteItem: (id: string) => Promise<void>,
  setSelectedId: (id: string | null) => void,
  reload: () => void
): Promise<void> {
  if (!action) return;
  if (action.type === "DELETE") {
    await restoreItem(action.payload.id);
    setSelectedId(action.payload.id);
  } else {
    await deleteItem(action.payload.id);
  }
  reload();
}

/**
 * Executes a redo operation for a project item deletion or restoration.
 *
 * @example await executeProjectItemRedo(action, restoreItem, deleteItem, setSelectedId, reload)
 */
export async function executeProjectItemRedo(
  action: HistoryAction<ProjectItem> | null,
  restoreItem: (id: string) => Promise<void>,
  deleteItem: (id: string) => Promise<void>,
  setSelectedId: (id: string | null) => void,
  reload: () => void
): Promise<void> {
  if (!action) return;
  if (action.type === "RESTORE") {
    await deleteItem(action.payload.id);
  } else {
    await restoreItem(action.payload.id);
    setSelectedId(action.payload.id);
  }
  reload();
}
