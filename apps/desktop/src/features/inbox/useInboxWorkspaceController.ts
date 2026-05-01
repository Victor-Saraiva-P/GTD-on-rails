import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { useInboxStuffsQuery } from "./useInboxStuffsQuery";
import type { Stuff, Body } from "./types";

const DRAFT_STUFF_ID = "__draft_stuff__";

function buildDraftStuff(): Stuff {
  return {
    id: DRAFT_STUFF_ID,
    title: "",
    body: null,
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
  const [editingBody, setEditingBody] = useState("");

  return { editingBody, editingBodyId, setEditingBody, setEditingBodyId };
}

function usePendingBodyEditState() {
  const [pendingBodyEditId, setPendingBodyEditId] = useState<string | null>(null);

  return { pendingBodyEditId, setPendingBodyEditId };
}

function visibleStuffsWithDraft(draftStuff: Stuff | null, stuffs: Stuff[]): Stuff[] {
  return draftStuff ? [draftStuff, ...stuffs] : stuffs;
}

function selectedStuff(visibleStuffs: Stuff[], selectedId: string | null): Stuff | null {
  return visibleStuffs.find((item) => item.id === selectedId) ?? visibleStuffs[0] ?? null;
}

function selectedStuffIndex(visibleStuffs: Stuff[], selectedItem: Stuff | null): number {
  return selectedItem ? visibleStuffs.findIndex((item) => item.id === selectedItem.id) : -1;
}

type SelectionCursor = {
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
  visibleStuffs: Stuff[];
};

function selectStuffByOffset(selection: SelectionCursor, offset: number) {
  if (selection.visibleStuffs.length === 0) {
    return;
  }

  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.visibleStuffs.length - 1);
  selection.setSelectedId(selection.visibleStuffs[nextIndex].id);
}

type InboxSelection = ReturnType<typeof useInboxSelection>;

function useInboxSelection(stuffs: Stuff[], draftStuff: Stuff | null) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleStuffs = visibleStuffsWithDraft(draftStuff, stuffs);
  const selectedItem = selectedStuff(visibleStuffs, selectedId);
  const selectedIndex = selectedStuffIndex(visibleStuffs, selectedItem);
  const selection = { selectedIndex, setSelectedId, visibleStuffs };

  return { ...selection, selectedId, selectedItem, selectNextStuff: () => selectStuffByOffset(selection, 1), selectPreviousStuff: () => selectStuffByOffset(selection, -1) };
}

function clearTitleEdit(model: InboxModel) {
  model.titleEdit.setEditingId(null);
  model.titleEdit.setEditingTitle("");
}

function clearBodyEdit(model: InboxModel) {
  model.bodyEdit.setEditingBodyId(null);
  model.bodyEdit.setEditingBody("");
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

  if (item.body && item.body.blocks) {
    const text = item.body.blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => block.properties.richText.map((run) => run.text).join(""))
      .join("\n");
    model.bodyEdit.setEditingBody(text);
  } else {
    model.bodyEdit.setEditingBody("");
  }
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
  if (!model.selection.selectedItem) {
    return;
  }

  await model.query.deleteStuff(model.selection.selectedItem.id);
  clearAllEditing(model);
  model.zone.setActiveZone("inbox-list");
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
    startBodyEdit(model, model.selection.selectedItem);
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

function nextBodyValue(editingBody: string): Body | null {
  const trimmed = editingBody.trim();
  if (!trimmed) {
    return null;
  }
  return {
    version: 1,
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        properties: {
          richText: [{ text: trimmed }]
        }
      }
    ]
  };
}

async function commitEditingSelectedStuffBodyAction(model: InboxModel) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem || model.bodyEdit.editingBodyId !== selectedItem.id) {
    return;
  }

  const nextBody = nextBodyValue(model.bodyEdit.editingBody);

  if (JSON.stringify(selectedItem.body ?? null) === JSON.stringify(nextBody)) {
    clearBodyEdit(model);
    return;
  }

  const updatedStuff = await model.query.updateStuffBody(selectedItem, nextBody);
  model.selection.setSelectedId(updatedStuff.id);
  clearBodyEdit(model);
  clearPendingBodyEdit(model);
}

function useInboxWorkspaceActions(model: InboxModel) {
  return {
    cancelEditingSelectedStuff: () => cancelEditingSelectedStuffAction(model),
    cancelEditingSelectedStuffBody: () => clearBodyEdit(model),
    commitEditingSelectedStuff: () => commitEditingSelectedStuffAction(model),
    commitEditingSelectedStuffBody: () => commitEditingSelectedStuffBodyAction(model),
    createNewStuff: () => Promise.resolve(createNewStuffAction(model)),
    deleteSelectedStuff: () => deleteSelectedStuffAction(model),
    selectNextStuff: model.selection.selectNextStuff,
    selectPreviousStuff: model.selection.selectPreviousStuff,
    startEditingSelectedStuff: () => startEditingSelectedStuffAction(model),
    startEditingSelectedStuffBody: () => startEditingSelectedStuffBodyAction(model)
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

  return { bodyEdit, draft, pending, query, selection, titleEdit, zone };
}

function controllerEditState(model: InboxModel) {
  return { editingBody: model.bodyEdit.editingBody, editingBodyId: model.bodyEdit.editingBodyId, editingId: model.titleEdit.editingId, editingTitle: model.titleEdit.editingTitle };
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
    setActiveZone: model.zone.setActiveZone,
    setEditingBody: model.bodyEdit.setEditingBody,
    setEditingTitle: model.titleEdit.setEditingTitle,
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
