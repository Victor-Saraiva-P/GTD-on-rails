import { useEffect, useState } from "react";
import { useUndoRedoHistory } from "../history/useUndoRedoHistory";
import { useActiveZone } from "../keybinds/hooks";
import { useInboxStuffsQuery } from "./useInboxStuffsQuery";
import { useStuffSelection } from "./useStuffSelection";
import type { CalendarConversionPayload } from "../calendar/types";
import type { Stuff, ItemBody } from "./types";

const DRAFT_STUFF_ID = "__draft_stuff__";

function buildDraftStuff(): Stuff {
  return {
    id: DRAFT_STUFF_ID,
    title: "",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    status: "INBOX",
    createdAt: new Date().toISOString()
  };
}

type InboxQuery = ReturnType<typeof useInboxStuffsQuery>;
type InboxModel = ReturnType<typeof useInboxWorkspaceModel>;
type InboxActions = ReturnType<typeof useInboxWorkspaceActions>;

function useDraftStuffState() {
  const [draftStuff, setDraftStuff] = useState<Stuff | null>(null);

  return { draftStuff, setDraftStuff };
}

function useTitleEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  return { editingId, editingTitle, setEditingId, setEditingTitle };
}

function useBodyEditState() {
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [vimMode, setVimMode] = useState<"NORMAL" | "INSERT" | "VISUAL" | null>(null);
  return { editingBodyId, setEditingBodyId, vimMode, setVimMode };
}

function usePendingBodyEditState() {
  const [pendingBodyEditId, setPendingBodyEditId] = useState<string | null>(null);

  return { pendingBodyEditId, setPendingBodyEditId };
}

function visibleStuffsWithDraft(draftStuff: Stuff | null, stuffs: Stuff[]): Stuff[] {
  return draftStuff ? [...stuffs, draftStuff] : stuffs;
}

type InboxSelection = ReturnType<typeof useInboxSelection>;

function useInboxSelection(stuffs: Stuff[], draftStuff: Stuff | null) {
  return useStuffSelection(visibleStuffsWithDraft(draftStuff, stuffs));
}

function clearTitleEdit(model: InboxModel) {
  model.titleEdit.setEditingId(null);
  model.titleEdit.setEditingTitle("");
}

function clearBodyEdit(model: InboxModel) {
  model.bodyEdit.setEditingBodyId(null);
  model.bodyEdit.setVimMode(null);
}

function clearPendingBodyEdit(model: InboxModel) {
  model.pending.setPendingBodyEditId(null);
}

function clearAllEditing(model: InboxModel) {
  clearTitleEdit(model);
  clearBodyEdit(model);
  clearPendingBodyEdit(model);
}

function hasVisibleStuff(model: InboxModel, id: string): boolean {
  return model.selection.visibleStuffs.some((item) => item.id === id);
}

function pruneEmptyInbox(model: InboxModel) {
  model.selection.setSelectedId(null);
  clearAllEditing(model);
}

function pruneMissingSelection(model: InboxModel) {
  if (!model.selection.selectedId || !hasVisibleStuff(model, model.selection.selectedId)) {
    model.selection.setSelectedId(model.selection.visibleStuffs[0].id);
  }
}

function pruneMissingTitleEdit(model: InboxModel) {
  if (model.titleEdit.editingId && !hasVisibleStuff(model, model.titleEdit.editingId)) {
    clearTitleEdit(model);
  }
}

function pruneMissingBodyEdit(model: InboxModel) {
  if (model.bodyEdit.editingBodyId && !hasVisibleStuff(model, model.bodyEdit.editingBodyId)) {
    clearBodyEdit(model);
  }
}

function pruneMissingPendingBodyEdit(model: InboxModel) {
  const pendingId = model.pending.pendingBodyEditId;

  if (pendingId && !hasVisibleStuff(model, pendingId)) {
    clearPendingBodyEdit(model);
  }
}

function pruneInboxState(model: InboxModel) {
  if (model.selection.visibleStuffs.length === 0) {
    pruneEmptyInbox(model);
    return;
  }

  pruneMissingSelection(model);
  pruneMissingTitleEdit(model);
  pruneMissingBodyEdit(model);
  pruneMissingPendingBodyEdit(model);
}

function usePruneInboxState(model: InboxModel) {
  useEffect(() => {
    pruneInboxState(model);
  }, [model.bodyEdit.editingBodyId, model.draft.draftStuff, model.pending.pendingBodyEditId, model.selection.selectedId, model.selection.visibleStuffs, model.titleEdit.editingId]);
}

function startBodyEdit(model: InboxModel, item: Stuff) {
  model.bodyEdit.setEditingBodyId(item.id);
}

function startBodyEditInDetail(model: InboxModel, item: Stuff) {
  model.zone.setActiveZone("stuff-detail");
  startBodyEdit(model, item);
}

function createNewStuffAction(model: InboxModel) {
  const nextDraft = buildDraftStuff();

  model.draft.setDraftStuff(nextDraft);
  model.selection.setSelectedId(nextDraft.id);
  model.titleEdit.setEditingId(nextDraft.id);
  model.titleEdit.setEditingTitle("");
  clearBodyEdit(model);
  model.pending.setPendingBodyEditId(nextDraft.id);
  model.zone.setActiveZone("inbox-list");
}

async function deleteSelectedStuffAction(model: InboxModel) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem) {
    return;
  }

  await model.query.deleteStuff(selectedItem.id);
  model.history.pushUndo({ type: "DELETE", payload: selectedItem });
  clearAllEditing(model);
  model.zone.setActiveZone("inbox-list");
}

async function undoAction(model: InboxModel) {
  const action = model.history.popUndo();
  if (!action) return;

  if (action.type === "DELETE") {
    await model.query.restoreStuff(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  } else {
    await model.query.deleteStuff(action.payload.id);
  }
}

async function redoAction(model: InboxModel) {
  const action = model.history.popRedo();
  if (!action) return;

  if (action.type === "RESTORE") {
    await model.query.deleteStuff(action.payload.id);
  } else {
    await model.query.restoreStuff(action.payload.id);
    model.selection.setSelectedId(action.payload.id);
  }
}

function startEditingSelectedStuffAction(model: InboxModel) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem) {
    return;
  }

  model.titleEdit.setEditingId(selectedItem.id);
  model.titleEdit.setEditingTitle(selectedItem.id === DRAFT_STUFF_ID ? "" : selectedItem.title);
  model.pending.setPendingBodyEditId(selectedItem.id === DRAFT_STUFF_ID ? selectedItem.id : null);
}

function cancelEditingSelectedStuffAction(model: InboxModel) {
  if (model.titleEdit.editingId === DRAFT_STUFF_ID) {
    model.draft.setDraftStuff(null);
    model.selection.setSelectedId(model.query.stuffs[0]?.id ?? null);
  }

  clearTitleEdit(model);
  clearPendingBodyEdit(model);
}

function startEditingSelectedStuffBodyAction(model: InboxModel) {
  if (model.selection.selectedItem) {
    startBodyEditInDetail(model, model.selection.selectedItem);
  }
}

function discardTitleEdit(model: InboxModel, selectedItem: Stuff, shouldContinueToBody: boolean) {
  if (selectedItem.id === DRAFT_STUFF_ID) {
    model.draft.setDraftStuff(null);
    model.selection.setSelectedId(model.query.stuffs[0]?.id ?? null);
  }

  clearTitleEdit(model);
  clearPendingBodyEdit(model);

  if (shouldContinueToBody) {
    model.zone.setActiveZone("inbox-list");
  }
}

function finishTitleEdit(model: InboxModel, item: Stuff, shouldContinueToBody: boolean) {
  model.selection.setSelectedId(item.id);
  clearTitleEdit(model);
  clearPendingBodyEdit(model);

  if (shouldContinueToBody) {
    startBodyEditInDetail(model, item);
  }
}

async function commitDraftStuff(model: InboxModel, title: string, shouldContinueToBody: boolean) {
  const createdStuff = await model.query.createStuff(title);

  model.draft.setDraftStuff(null);
  finishTitleEdit(model, createdStuff, shouldContinueToBody);
}

async function commitEditingSelectedStuffAction(model: InboxModel) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem || model.titleEdit.editingId !== selectedItem.id) {
    return;
  }

  const normalizedTitle = model.titleEdit.editingTitle.trim();
  const shouldContinueToBody = model.pending.pendingBodyEditId === selectedItem.id;

  if (!normalizedTitle) {
    discardTitleEdit(model, selectedItem, shouldContinueToBody);
    return;
  }

  await commitNormalizedTitle(model, selectedItem, normalizedTitle, shouldContinueToBody);
}

async function commitNormalizedTitle(
  model: InboxModel,
  selectedItem: Stuff,
  normalizedTitle: string,
  shouldContinueToBody: boolean
) {
  if (selectedItem.id === DRAFT_STUFF_ID) {
    await commitDraftStuff(model, normalizedTitle, shouldContinueToBody);
    return;
  }

  if (normalizedTitle === selectedItem.title) {
    finishTitleEdit(model, selectedItem, shouldContinueToBody);
    return;
  }

  const updatedStuff = await model.query.updateStuffTitle(selectedItem, normalizedTitle);
  finishTitleEdit(model, updatedStuff, shouldContinueToBody);
}

async function commitEditingSelectedStuffBodyAction(model: InboxModel, body: ItemBody) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem || model.bodyEdit.editingBodyId !== selectedItem.id) {
    return;
  }

  if (selectedItem.body.text === body.text && JSON.stringify(selectedItem.body) === JSON.stringify(body)) {
    clearBodyEdit(model);
    return;
  }

  const updatedStuff = await model.query.updateStuffBody(selectedItem, body);
  model.selection.setSelectedId(updatedStuff.id);
  clearBodyEdit(model);
  clearPendingBodyEdit(model);
}

function resetWorkspaceAction(model: InboxModel) {
  clearAllEditing(model);
  model.selection.setSelectedId(model.query.stuffs[0]?.id ?? null);
  model.zone.setActiveZone("inbox-list");
}

async function autosaveEditingSelectedStuffBodyAction(model: InboxModel, body: ItemBody) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem || model.bodyEdit.editingBodyId !== selectedItem.id || (selectedItem.body.text === body.text && JSON.stringify(selectedItem.body) === JSON.stringify(body))) {
    return;
  }

  const updatedStuff = await model.query.updateStuffBody(selectedItem, body);
  model.selection.setSelectedId(updatedStuff.id);
  clearPendingBodyEdit(model);
}

async function processSelectedStuffAction(model: InboxModel, energy: number | null, estimatedTimeMinutes: number | null, contextIds: string[], deadline: string | null) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem) {
    return;
  }

  await model.query.processStuff(selectedItem, energy, estimatedTimeMinutes, contextIds, deadline);
  model.selection.setSelectedId(model.query.stuffs[0]?.id ?? null);
  clearAllEditing(model);
  model.zone.setActiveZone("inbox-list");
}

async function processSelectedStuffToCalendarAction(model: InboxModel, payload: CalendarConversionPayload) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem) {
    return;
  }

  await model.query.processStuffToCalendar(selectedItem, payload);
  model.selection.setSelectedId(model.query.stuffs[0]?.id ?? null);
  clearAllEditing(model);
  model.zone.setActiveZone("inbox-list");
}

function useInboxWorkspaceActions(model: InboxModel) {
  return {
    autosaveEditingSelectedStuffBody: (body: ItemBody) => autosaveEditingSelectedStuffBodyAction(model, body),
    cancelEditingSelectedStuff: () => cancelEditingSelectedStuffAction(model),
    cancelEditingSelectedStuffBody: () => clearBodyEdit(model),
    commitEditingSelectedStuff: () => commitEditingSelectedStuffAction(model),
    commitEditingSelectedStuffBody: (body: ItemBody) => commitEditingSelectedStuffBodyAction(model, body),
    createNewStuff: async () => { createNewStuffAction(model); },
    deleteSelectedStuff: () => deleteSelectedStuffAction(model),
    processSelectedStuff: (energy: number | null, estimatedTimeMinutes: number | null, contextIds: string[], deadline: string | null) => processSelectedStuffAction(model, energy, estimatedTimeMinutes, contextIds, deadline),
    processSelectedStuffToCalendar: (payload: CalendarConversionPayload) => processSelectedStuffToCalendarAction(model, payload),
    undo: () => undoAction(model),
    redo: () => redoAction(model),
    selectFirstStuff: model.selection.selectFirstStuff,
    selectLastStuff: model.selection.selectLastStuff,
    selectNextStuff: model.selection.selectNextStuff,
    selectPreviousStuff: model.selection.selectPreviousStuff,
    startEditingSelectedStuff: () => startEditingSelectedStuffAction(model),
    startEditingSelectedStuffBody: () => startEditingSelectedStuffBodyAction(model),
    resetWorkspace: () => resetWorkspaceAction(model)
  };
}

function useInboxWorkspaceModel() {
  const query = useInboxStuffsQuery();
  const draft = useDraftStuffState();
  const selection = useInboxSelection(query.stuffs, draft.draftStuff);
  const titleEdit = useTitleEditState();
  const bodyEdit = useBodyEditState();
  const pending = usePendingBodyEditState();
  const zone = useActiveZone();
  const history = useUndoRedoHistory<Stuff>();

  return { bodyEdit, draft, pending, query, selection, titleEdit, zone, history };
}

function controllerEditState(model: InboxModel) {
  return { editingBodyId: model.bodyEdit.editingBodyId, editingId: model.titleEdit.editingId, editingTitle: model.titleEdit.editingTitle };
}

function controllerQueryState(query: InboxQuery) {
  return { errorMessage: query.errorMessage, isCreating: query.isCreating, isDeleting: query.isDeleting, isLoading: query.isLoading, isUpdating: query.isUpdating, reload: query.reload };
}

function controllerSelectionState(model: InboxModel) {
  return { selectedId: model.selection.selectedId, selectedIndex: model.selection.selectedIndex, selectedItem: model.selection.selectedItem, stuffs: model.selection.visibleStuffs };
}

function buildInboxWorkspaceController(model: InboxModel, actions: InboxActions) {
  return {
    ...actions,
    ...controllerEditState(model),
    ...controllerQueryState(model.query),
    ...controllerSelectionState(model),
    activeZone: model.zone.activeZone,
    vimMode: model.bodyEdit.vimMode,
    setActiveZone: model.zone.setActiveZone,
    setEditingTitle: model.titleEdit.setEditingTitle,
    setVimMode: model.bodyEdit.setVimMode,
    setPendingBodyEditId: model.pending.setPendingBodyEditId,
    setSelectedId: model.selection.setSelectedId
  };
}

/**
 * Composes inbox query, selection, editing, and keybind state for inbox screens.
 *
 * @example const controller = useInboxWorkspaceController()
 */
export function useInboxWorkspaceController() {
  const model = useInboxWorkspaceModel();
  const actions = useInboxWorkspaceActions(model);

  usePruneInboxState(model);
  return buildInboxWorkspaceController(model, actions);
}

export type InboxWorkspaceController = ReturnType<typeof useInboxWorkspaceController>;
