import { useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { ContextIconEditor } from "../features/contexts/ContextIconEditor";
import { ContextItemsPane } from "../features/contexts/ContextItemsPane";
import { ContextsList } from "../features/contexts/ContextsList";
import { CONTEXT_RELATED_ITEMS_LIMIT } from "../features/contexts/constants";
import { useContextItemsQuery } from "../features/contexts/useContextItemsQuery";
import { useContextsQuery } from "../features/contexts/useContextsQuery";
import type { ContextItem } from "../features/contexts/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveZone, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition } from "../features/keybinds/types";
import { contextsListTheme } from "../features/lists/listThemes";

const DRAFT_CONTEXT_ID = "__draft_context__";

type ContextsModel = ReturnType<typeof useContextsModel>;
type ContextsActions = ReturnType<typeof useContextsActions>;

function buildDraftContext(): ContextItem {
  return {
    id: DRAFT_CONTEXT_ID,
    name: ""
  };
}

function useDraftContextState() {
  const [draftContext, setDraftContext] = useState<ContextItem | null>(null);

  return { draftContext, setDraftContext };
}

function useContextEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  return { editingId, editingName, setEditingId, setEditingName };
}

function useContextIconEditorState() {
  const [isIconEditorOpen, setIsIconEditorOpen] = useState(false);

  return { isIconEditorOpen, setIsIconEditorOpen };
}

function visibleContextsWithDraft(draftContext: ContextItem | null, contexts: ContextItem[]) {
  return draftContext ? [draftContext, ...contexts] : contexts;
}

function selectedContext(visibleContexts: ContextItem[], selectedId: string | null) {
  return visibleContexts.find((context) => context.id === selectedId) ?? visibleContexts[0] ?? null;
}

function selectedContextIndex(visibleContexts: ContextItem[], selectedItem: ContextItem | null): number {
  return selectedItem ? visibleContexts.findIndex((context) => context.id === selectedItem.id) : -1;
}

function selectContextByOffset(selection: ContextSelectionCursor, offset: number) {
  if (selection.visibleContexts.length === 0) {
    return;
  }

  const nextIndex = Math.min(Math.max(selection.selectedIndex + offset, 0), selection.visibleContexts.length - 1);
  selection.setSelectedId(selection.visibleContexts[nextIndex].id);
}

type ContextSelectionCursor = {
  selectedIndex: number;
  setSelectedId: (id: string | null) => void;
  visibleContexts: ContextItem[];
};

function useContextSelection(contexts: ContextItem[], draftContext: ContextItem | null) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleContexts = visibleContextsWithDraft(draftContext, contexts);
  const selectedItem = selectedContext(visibleContexts, selectedId);
  const selectedIndex = selectedContextIndex(visibleContexts, selectedItem);
  const selection = { selectedIndex, setSelectedId, visibleContexts };

  return { ...selection, selectedId, selectedItem, selectNextContext: () => selectContextByOffset(selection, 1), selectPreviousContext: () => selectContextByOffset(selection, -1) };
}

function relatedContextId(selectedItem: ContextItem | null): string | null {
  return selectedItem && selectedItem.id !== DRAFT_CONTEXT_ID ? selectedItem.id : null;
}

function useContextsModel() {
  const zone = useActiveZone();
  const query = useContextsQuery();
  const draft = useDraftContextState();
  const edit = useContextEditState();
  const iconEditor = useContextIconEditorState();
  const selection = useContextSelection(query.contexts, draft.draftContext);
  const related = useContextItemsQuery(relatedContextId(selection.selectedItem), CONTEXT_RELATED_ITEMS_LIMIT);

  return { draft, edit, iconEditor, query, related, selection, zone };
}

function clearContextEdit(model: ContextsModel) {
  model.edit.setEditingId(null);
  model.edit.setEditingName("");
}

function hasVisibleContext(model: ContextsModel, id: string): boolean {
  return model.selection.visibleContexts.some((context) => context.id === id);
}

function pruneEmptyContexts(model: ContextsModel) {
  model.selection.setSelectedId(null);
  clearContextEdit(model);
  model.iconEditor.setIsIconEditorOpen(false);
}

function pruneMissingContextSelection(model: ContextsModel) {
  if (!model.selection.selectedId || !hasVisibleContext(model, model.selection.selectedId)) {
    model.selection.setSelectedId(model.selection.visibleContexts[0].id);
  }
}

function pruneMissingContextEdit(model: ContextsModel) {
  if (model.edit.editingId && !hasVisibleContext(model, model.edit.editingId)) {
    clearContextEdit(model);
  }
}

function pruneContextsState(model: ContextsModel) {
  if (model.selection.visibleContexts.length === 0) {
    pruneEmptyContexts(model);
    return;
  }

  pruneMissingContextSelection(model);
  pruneMissingContextEdit(model);
}

function useContextsPruning(model: ContextsModel) {
  useEffect(() => {
    pruneContextsState(model);
  }, [model.edit.editingId, model.selection.selectedId, model.selection.visibleContexts]);
}

function useContextsZone(model: ContextsModel) {
  useEffect(() => {
    model.zone.setActiveZone("context-list");
  }, [model.zone]);
}

function openSelectedContextIconEditor(model: ContextsModel) {
  if (model.selection.selectedItem) {
    model.iconEditor.setIsIconEditorOpen(true);
    model.zone.setActiveZone("context-icon-editor");
  }
}

function closeSelectedContextIconEditor(model: ContextsModel) {
  model.iconEditor.setIsIconEditorOpen(false);
  model.zone.setActiveZone("context-list");
}

function createNewContextAction(model: ContextsModel) {
  const nextDraft = buildDraftContext();

  model.draft.setDraftContext(nextDraft);
  model.selection.setSelectedId(nextDraft.id);
  model.edit.setEditingId(nextDraft.id);
  model.edit.setEditingName("");
  model.zone.setActiveZone("context-list");
}

async function deleteSelectedContextAction(model: ContextsModel) {
  if (!model.selection.selectedItem) {
    return;
  }

  await model.query.deleteContext(model.selection.selectedItem.id);
  clearContextEdit(model);
  model.zone.setActiveZone("context-list");
}

function startEditingSelectedContextAction(model: ContextsModel) {
  const selectedItem = model.selection.selectedItem;

  if (selectedItem) {
    model.edit.setEditingId(selectedItem.id);
    model.edit.setEditingName(selectedItem.id === DRAFT_CONTEXT_ID ? "" : selectedItem.name);
  }
}

function cancelEditingSelectedContextAction(model: ContextsModel) {
  if (model.edit.editingId === DRAFT_CONTEXT_ID) {
    model.draft.setDraftContext(null);
    model.selection.setSelectedId(model.query.contexts[0]?.id ?? null);
  }

  clearContextEdit(model);
}

function discardContextEdit(model: ContextsModel, selectedItem: ContextItem) {
  if (selectedItem.id === DRAFT_CONTEXT_ID) {
    model.draft.setDraftContext(null);
    model.selection.setSelectedId(model.query.contexts[0]?.id ?? null);
  }

  clearContextEdit(model);
}

function finishContextEdit(model: ContextsModel, item: ContextItem) {
  model.selection.setSelectedId(item.id);
  clearContextEdit(model);
}

async function commitDraftContext(model: ContextsModel, normalizedName: string) {
  const createdContext = await model.query.createContext(normalizedName);

  model.draft.setDraftContext(null);
  finishContextEdit(model, createdContext);
}

async function commitNormalizedContextName(
  model: ContextsModel,
  selectedItem: ContextItem,
  normalizedName: string
) {
  if (selectedItem.id === DRAFT_CONTEXT_ID) {
    await commitDraftContext(model, normalizedName);
    return;
  }

  if (normalizedName === selectedItem.name) {
    finishContextEdit(model, selectedItem);
    return;
  }

  finishContextEdit(model, await model.query.updateContextName(selectedItem.id, normalizedName));
}

async function commitEditingSelectedContextAction(model: ContextsModel) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem || model.edit.editingId !== selectedItem.id) {
    return;
  }

  const normalizedName = model.edit.editingName.trim();

  if (normalizedName) {
    await commitNormalizedContextName(model, selectedItem, normalizedName);
  } else {
    discardContextEdit(model, selectedItem);
  }
}

function useContextsActions(model: ContextsModel) {
  return {
    cancelEditingSelectedContext: () => cancelEditingSelectedContextAction(model),
    closeSelectedContextIconEditor: () => closeSelectedContextIconEditor(model),
    commitEditingSelectedContext: () => commitEditingSelectedContextAction(model),
    createNewContext: () => Promise.resolve(createNewContextAction(model)),
    deleteSelectedContext: () => deleteSelectedContextAction(model),
    openSelectedContextIconEditor: () => openSelectedContextIconEditor(model),
    selectNextContext: model.selection.selectNextContext,
    selectPreviousContext: model.selection.selectPreviousContext,
    startEditingSelectedContext: () => startEditingSelectedContextAction(model)
  };
}

function contextsBinding(
  id: string,
  key: string,
  description: string,
  zone: FocusZoneId,
  runKeybind: () => void,
  leader = false
): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "contexts", zone };
}

function canChangeContext(model: ContextsModel): boolean {
  return !model.query.isLoading && !model.query.isCreating && !model.query.isDeleting && !model.query.isUpdating && !model.edit.editingId;
}

function canChangeSelectedContext(model: ContextsModel): boolean {
  return canChangeContext(model) && Boolean(model.selection.selectedItem);
}

function runContextAsyncAction(canRun: boolean, action: () => Promise<void>, message: string) {
  if (canRun) {
    void action().catch((error: unknown) => console.error(message, error));
  }
}

function buildContextsBindings(model: ContextsModel, actions: ContextsActions) {
  return [
    contextsBinding("contexts.create-context", "a", "Add new context", "context-list", () => runContextAsyncAction(canChangeContext(model), actions.createNewContext, "Failed to create context")),
    contextsBinding("contexts.delete-context-list", "d", "Delete selected context", "context-list", () => runContextAsyncAction(canChangeSelectedContext(model), actions.deleteSelectedContext, "Failed to delete context")),
    contextsBinding("contexts.delete-context-detail", "d", "Delete selected context", "context-detail", () => runContextAsyncAction(canChangeSelectedContext(model), actions.deleteSelectedContext, "Failed to delete context")),
    contextsBinding("contexts.edit-name", "Enter", "Edit selected context", "context-list", () => canChangeSelectedContext(model) && actions.startEditingSelectedContext()),
    contextsBinding("contexts.edit-icon-list", "e", "Edit context icon", "context-list", () => canChangeSelectedContext(model) && actions.openSelectedContextIconEditor()),
    contextsBinding("contexts.edit-icon-detail", "e", "Edit context icon", "context-detail", () => canChangeSelectedContext(model) && actions.openSelectedContextIconEditor()),
    contextsBinding("contexts.move-down", "j", "Move down", "context-list", () => !model.edit.editingId && actions.selectNextContext()),
    contextsBinding("contexts.move-up", "k", "Move up", "context-list", () => !model.edit.editingId && actions.selectPreviousContext()),
    contextsBinding("contexts.focus-detail", "l", "Focus context detail", "context-list", () => focusContextDetail(model)),
    contextsBinding("contexts.focus-list", "h", "Focus contexts list", "context-detail", () => model.zone.setActiveZone("context-list")),
    contextsBinding("contexts.which-key-list", "k", "Show available keybinds", "context-list", () => undefined, true),
    contextsBinding("contexts.which-key-detail", "k", "Show available keybinds", "context-detail", () => undefined, true),
    contextsBinding("contexts.close-icon-editor", "Escape", "Close icon editor", "context-icon-editor", actions.closeSelectedContextIconEditor),
    contextsBinding("contexts.which-key-icon-editor", "k", "Show available keybinds", "context-icon-editor", () => undefined, true)
  ];
}

function focusContextDetail(model: ContextsModel) {
  if (model.selection.visibleContexts.length > 0 && !model.edit.editingId) {
    model.zone.setActiveZone("context-detail");
  }
}

function useContextsBindings(model: ContextsModel, actions: ContextsActions) {
  const bindings = useMemo(() => buildContextsBindings(model, actions), [actions, model]);

  useRegisterKeybinds(bindings);
}

function commitContextName(model: ContextsModel, actions: ContextsActions) {
  void actions.commitEditingSelectedContext().catch((error: unknown) => {
    console.error("Failed to update context", error);
  });
}

function ContextsListReady({ model, actions }: ContextsViewProps) {
  return (
    <ContextsList
      items={model.selection.visibleContexts}
      selectedId={model.selection.selectedItem?.id ?? ""}
      editingId={model.edit.editingId}
      editingName={model.edit.editingName}
      onSelect={model.selection.setSelectedId}
      onEditingNameChange={model.edit.setEditingName}
      onStartEditing={actions.startEditingSelectedContext}
      onCommitEditing={() => commitContextName(model, actions)}
      onCancelEditing={actions.cancelEditingSelectedContext}
    />
  );
}

type ContextsViewProps = {
  actions: ContextsActions;
  model: ContextsModel;
};

function ContextsListBody({ model, actions }: ContextsViewProps) {
  if (model.query.isLoading) {
    return <p className="pane-state">Loading contexts...</p>;
  }

  if (model.query.errorMessage) {
    return <RetryState message={model.query.errorMessage} onRetry={model.query.reload} />;
  }

  return model.selection.visibleContexts.length === 0 ? <p className="pane-state">No contexts yet.</p> : <ContextsListReady model={model} actions={actions} />;
}

function RelatedItemsBody({ model }: Pick<ContextsViewProps, "model">) {
  if (model.query.isLoading) {
    return <p className="pane-state">Loading related items...</p>;
  }

  if (model.query.errorMessage) {
    return <p className="pane-state">Related items are unavailable while contexts loading fails.</p>;
  }

  return <LoadedRelatedItemsBody model={model} />;
}

function LoadedRelatedItemsBody({ model }: Pick<ContextsViewProps, "model">) {
  const selectedItem = model.selection.selectedItem;

  if (!selectedItem) {
    return <p className="pane-state">Select a context to inspect its related items.</p>;
  }

  if (selectedItem.id === DRAFT_CONTEXT_ID) {
    return <p className="pane-state">Save the context name to inspect its related items.</p>;
  }

  return <RelatedItemsResult model={model} selectedItem={selectedItem} />;
}

function RelatedItemsResult({ model, selectedItem }: { model: ContextsModel; selectedItem: ContextItem }) {
  if (model.related.isLoading) {
    return <p className="pane-state">Loading related items...</p>;
  }

  if (model.related.errorMessage) {
    return <RetryState message={model.related.errorMessage} onRetry={model.related.reload} />;
  }

  return model.related.items.length === 0 ? <p className="pane-state">No related items for this context yet.</p> : <ContextItemsPane context={selectedItem} items={model.related.items} />;
}

function ContextsListPane(props: ContextsViewProps) {
  const count = props.model.selection.visibleContexts.length;
  const listMeta = `${count} ${count === 1 ? "item" : "items"}`;

  return (
    <ListPane title="Contexts" meta={listMeta} panelIndex={1} active={props.model.zone.activeZone === "context-list"} bodyClassName="list-pane__body--flush" className="contexts-pane">
      <ContextsListBody {...props} />
    </ListPane>
  );
}

function RelatedItemsPane({ model }: Pick<ContextsViewProps, "model">) {
  const count = model.related.items.length;
  const detailMeta = `${count} ${count === 1 ? "item" : "items"}`;

  return (
    <ListPane title="Related Items" meta={model.selection.selectedItem ? detailMeta : undefined} panelIndex={2} active={model.zone.activeZone === "context-detail"} bodyClassName="list-pane__body--detail" className="contexts-pane">
      <RelatedItemsBody model={model} />
    </ListPane>
  );
}

function ContextPanes(props: ContextsViewProps) {
  return (
    <section className="inbox-terminal-layout" aria-label="Contexts">
      <ContextsListPane {...props} />
      <RelatedItemsPane model={props.model} />
    </section>
  );
}

async function uploadSelectedContextIcon(model: ContextsModel, file: File) {
  if (model.selection.selectedItem) {
    await model.query.updateContextIcon(model.selection.selectedItem.id, file);
  }
}

async function deleteSelectedContextIcon(model: ContextsModel) {
  if (model.selection.selectedItem) {
    await model.query.deleteContextIcon(model.selection.selectedItem.id);
  }
}

function ContextIconEditorLayer({ model, actions }: ContextsViewProps) {
  if (!model.iconEditor.isIconEditorOpen || !model.selection.selectedItem) {
    return null;
  }

  return <ContextIconEditor context={model.selection.selectedItem} isBusy={model.query.isUpdating} onClose={actions.closeSelectedContextIconEditor} onUpload={(file) => uploadSelectedContextIcon(model, file)} onDelete={() => deleteSelectedContextIcon(model)} />;
}

export function ContextsPage() {
  useKeybindScreen("contexts");
  const model = useContextsModel();
  const actions = useContextsActions(model);

  useContextsZone(model);
  useContextsPruning(model);
  useContextsBindings(model, actions);

  return (
    <ListWorkspace theme={contextsListTheme} currentLabel={contextsListTheme.label}>
      <ContextPanes model={model} actions={actions} />
      <ContextIconEditorLayer model={model} actions={actions} />
      <LeaderMenu />
    </ListWorkspace>
  );
}
