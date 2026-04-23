import { useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { ContextIconEditor } from "../features/contexts/ContextIconEditor";
import { ContextItemsPane } from "../features/contexts/ContextItemsPane";
import { ContextsList } from "../features/contexts/ContextsList";
import { CONTEXT_RELATED_ITEMS_LIMIT } from "../features/contexts/constants";
import { useContextItemsQuery } from "../features/contexts/useContextItemsQuery";
import { useContextsQuery } from "../features/contexts/useContextsQuery";
import type { ContextItem } from "../features/contexts/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { contextsListTheme } from "../features/lists/listThemes";
import { useActiveZone, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";

const DRAFT_CONTEXT_ID = "__draft_context__";

function buildDraftContext(): ContextItem {
  return {
    id: DRAFT_CONTEXT_ID,
    name: ""
  };
}

export function ContextsPage() {
  useKeybindScreen("contexts");

  const { activeZone, setActiveZone } = useActiveZone();
  const {
    contexts,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    errorMessage,
    reload,
    createContext,
    deleteContext,
    deleteContextIcon,
    updateContextName,
    updateContextIcon
  } = useContextsQuery();
  const [draftContext, setDraftContext] = useState<ContextItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isIconEditorOpen, setIsIconEditorOpen] = useState(false);
  const visibleContexts = draftContext ? [draftContext, ...contexts] : contexts;
  const selectedItem =
    visibleContexts.find((context) => context.id === selectedId) ??
    (visibleContexts.length > 0 ? visibleContexts[0] : null);
  const selectedPosition = selectedItem
    ? visibleContexts.findIndex((context) => context.id === selectedItem.id) + 1
    : 0;
  const selectedIndex = selectedPosition - 1;
  const {
    items: relatedItems,
    isLoading: isLoadingRelatedItems,
    errorMessage: relatedItemsErrorMessage,
    reload: reloadRelatedItems
  } = useContextItemsQuery(
    selectedItem && selectedItem.id !== DRAFT_CONTEXT_ID ? selectedItem.id : null,
    CONTEXT_RELATED_ITEMS_LIMIT
  );

  useEffect(() => {
    setActiveZone("context-list");
  }, [setActiveZone]);

  useEffect(() => {
    if (visibleContexts.length === 0) {
      setSelectedId(null);
      setEditingId(null);
      setEditingName("");
      setIsIconEditorOpen(false);
      return;
    }

    if (!selectedId || !visibleContexts.some((context) => context.id === selectedId)) {
      setSelectedId(visibleContexts[0].id);
    }

    if (editingId && !visibleContexts.some((context) => context.id === editingId)) {
      setEditingId(null);
      setEditingName("");
    }
  }, [editingId, selectedId, visibleContexts]);

  const openSelectedContextIconEditor = () => {
    if (!selectedItem) {
      return;
    }

    setIsIconEditorOpen(true);
    setActiveZone("context-icon-editor");
  };

  const closeSelectedContextIconEditor = () => {
    setIsIconEditorOpen(false);
    setActiveZone("context-list");
  };

  const selectNextContext = () => {
    if (visibleContexts.length === 0) {
      return;
    }

    const nextIndex = Math.min(selectedIndex + 1, visibleContexts.length - 1);
    setSelectedId(visibleContexts[nextIndex].id);
  };

  const selectPreviousContext = () => {
    if (visibleContexts.length === 0) {
      return;
    }

    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(visibleContexts[previousIndex].id);
  };

  const createNewContext = async () => {
    const nextDraft = buildDraftContext();

    setDraftContext(nextDraft);
    setSelectedId(nextDraft.id);
    setEditingId(nextDraft.id);
    setEditingName("");
    setActiveZone("context-list");
  };

  const deleteSelectedContext = async () => {
    if (!selectedItem) {
      return;
    }

    await deleteContext(selectedItem.id);
    setEditingId(null);
    setEditingName("");
    setActiveZone("context-list");
  };

  const startEditingSelectedContext = () => {
    if (!selectedItem) {
      return;
    }

    setEditingId(selectedItem.id);
    setEditingName(selectedItem.id === DRAFT_CONTEXT_ID ? "" : selectedItem.name);
  };

  const cancelEditingSelectedContext = () => {
    if (editingId === DRAFT_CONTEXT_ID) {
      setDraftContext(null);
      setSelectedId(contexts[0]?.id ?? null);
    }

    setEditingId(null);
    setEditingName("");
  };

  const commitEditingSelectedContext = async () => {
    if (!selectedItem || editingId !== selectedItem.id) {
      return;
    }

    const normalizedName = editingName.trim();

    if (!normalizedName) {
      if (selectedItem.id === DRAFT_CONTEXT_ID) {
        setDraftContext(null);
        setSelectedId(contexts[0]?.id ?? null);
      }

      setEditingId(null);
      setEditingName("");
      return;
    }

    if (selectedItem.id === DRAFT_CONTEXT_ID) {
      const createdContext = await createContext(normalizedName);

      setDraftContext(null);
      setSelectedId(createdContext.id);
      setEditingId(null);
      setEditingName("");
      return;
    }

    if (normalizedName === selectedItem.name) {
      setEditingId(null);
      setEditingName("");
      return;
    }

    const updatedContext = await updateContextName(selectedItem.id, normalizedName);

    setSelectedId(updatedContext.id);
    setEditingId(null);
    setEditingName("");
  };

  const bindings = useMemo<KeybindDefinition[]>(
    () => [
      {
        id: "contexts.create-context",
        key: "a",
        description: "Add new context",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (isLoading || isCreating || isDeleting || isUpdating || editingId !== null) {
            return;
          }

          void createNewContext().catch((error: unknown) => {
            console.error("Failed to create context", error);
          });
        }
      },
      {
        id: "contexts.delete-context-list",
        key: "d",
        description: "Delete selected context",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (isLoading || isCreating || isDeleting || isUpdating || editingId !== null || !selectedItem) {
            return;
          }

          void deleteSelectedContext().catch((error: unknown) => {
            console.error("Failed to delete context", error);
          });
        }
      },
      {
        id: "contexts.delete-context-detail",
        key: "d",
        description: "Delete selected context",
        screen: "contexts" as const,
        zone: "context-detail" as const,
        handler: () => {
          if (isLoading || isCreating || isDeleting || isUpdating || editingId !== null || !selectedItem) {
            return;
          }

          void deleteSelectedContext().catch((error: unknown) => {
            console.error("Failed to delete context", error);
          });
        }
      },
      {
        id: "contexts.edit-name",
        key: "Enter",
        description: "Edit selected context",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (isLoading || isCreating || isDeleting || isUpdating || editingId !== null || !selectedItem) {
            return;
          }

          startEditingSelectedContext();
        }
      },
      {
        id: "contexts.edit-icon-list",
        key: "e",
        description: "Edit context icon",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (isLoading || isCreating || isDeleting || isUpdating || editingId !== null || !selectedItem) {
            return;
          }

          openSelectedContextIconEditor();
        }
      },
      {
        id: "contexts.edit-icon-detail",
        key: "e",
        description: "Edit context icon",
        screen: "contexts" as const,
        zone: "context-detail" as const,
        handler: () => {
          if (isLoading || isCreating || isDeleting || isUpdating || editingId !== null || !selectedItem) {
            return;
          }

          openSelectedContextIconEditor();
        }
      },
      {
        id: "contexts.move-down",
        key: "j",
        description: "Move down",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (editingId !== null) {
            return;
          }

          selectNextContext();
        }
      },
      {
        id: "contexts.move-up",
        key: "k",
        description: "Move up",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (editingId !== null) {
            return;
          }

          selectPreviousContext();
        }
      },
      {
        id: "contexts.focus-detail",
        key: "l",
        description: "Focus context detail",
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => {
          if (visibleContexts.length === 0 || editingId !== null) {
            return;
          }

          setActiveZone("context-detail");
        }
      },
      {
        id: "contexts.focus-list",
        key: "h",
        description: "Focus contexts list",
        screen: "contexts" as const,
        zone: "context-detail" as const,
        handler: () => setActiveZone("context-list")
      },
      {
        id: "contexts.which-key-list",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "contexts" as const,
        zone: "context-list" as const,
        handler: () => undefined
      },
      {
        id: "contexts.which-key-detail",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "contexts" as const,
        zone: "context-detail" as const,
        handler: () => undefined
      },
      {
        id: "contexts.close-icon-editor",
        key: "Escape",
        description: "Close icon editor",
        screen: "contexts" as const,
        zone: "context-icon-editor" as const,
        handler: () => closeSelectedContextIconEditor()
      },
      {
        id: "contexts.which-key-icon-editor",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "contexts" as const,
        zone: "context-icon-editor" as const,
        handler: () => undefined
      }
    ],
    [
      visibleContexts.length,
      editingId,
      isCreating,
      isDeleting,
      isIconEditorOpen,
      isLoading,
      isUpdating,
      selectedIndex,
      selectedItem,
      setActiveZone,
      updateContextName
    ]
  );

  useRegisterKeybinds(bindings);

  const listBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading contexts...</p>;
    }

    if (errorMessage) {
      return (
        <div className="pane-state">
          <p>{errorMessage}</p>
          <button type="button" className="pane-state__action" onClick={reload}>
            Retry
          </button>
        </div>
      );
    }

    if (visibleContexts.length === 0) {
      return <p className="pane-state">No contexts yet.</p>;
    }

    return (
      <ContextsList
        items={visibleContexts}
        selectedId={selectedItem?.id ?? ""}
        editingId={editingId}
        editingName={editingName}
        onSelect={setSelectedId}
        onEditingNameChange={setEditingName}
        onStartEditing={startEditingSelectedContext}
        onCommitEditing={() => {
          void commitEditingSelectedContext().catch((error: unknown) => {
            console.error("Failed to update context", error);
          });
        }}
        onCancelEditing={cancelEditingSelectedContext}
      />
    );
  })();

  const detailBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading related items...</p>;
    }

    if (errorMessage) {
      return <p className="pane-state">Related items are unavailable while contexts loading fails.</p>;
    }

    if (!selectedItem) {
      return <p className="pane-state">Select a context to inspect its related items.</p>;
    }

    if (selectedItem.id === DRAFT_CONTEXT_ID) {
      return <p className="pane-state">Save the context name to inspect its related items.</p>;
    }

    if (isLoadingRelatedItems) {
      return <p className="pane-state">Loading related items...</p>;
    }

    if (relatedItemsErrorMessage) {
      return (
        <div className="pane-state">
          <p>{relatedItemsErrorMessage}</p>
          <button type="button" className="pane-state__action" onClick={reloadRelatedItems}>
            Retry
          </button>
        </div>
      );
    }

    if (relatedItems.length === 0) {
      return <p className="pane-state">No related items for this context yet.</p>;
    }

    return <ContextItemsPane context={selectedItem} items={relatedItems} />;
  })();

  const listMeta = `${visibleContexts.length} ${visibleContexts.length === 1 ? "item" : "items"}`;
  const detailMeta = `${relatedItems.length} ${relatedItems.length === 1 ? "item" : "items"}`;

  return (
    <ListWorkspace theme={contextsListTheme} currentLabel={contextsListTheme.label}>
      <section className="inbox-terminal-layout" aria-label="Contexts">
        <ListPane
          title="Contexts"
          meta={listMeta}
          panelIndex={1}
          active={activeZone === "context-list"}
          bodyClassName="list-pane__body--flush"
          className="contexts-pane"
        >
          {listBody}
        </ListPane>

        <ListPane
          title="Related Items"
          meta={selectedItem ? detailMeta : undefined}
          panelIndex={2}
          active={activeZone === "context-detail"}
          bodyClassName="list-pane__body--detail"
          className="contexts-pane"
        >
          {detailBody}
        </ListPane>
      </section>
      {isIconEditorOpen && selectedItem ? (
        <ContextIconEditor
          context={selectedItem}
          isBusy={isUpdating}
          onClose={closeSelectedContextIconEditor}
          onUpload={async (file) => {
            await updateContextIcon(selectedItem.id, file);
          }}
          onDelete={async () => {
            await deleteContextIcon(selectedItem.id);
          }}
        />
      ) : null}
      <LeaderMenu />
    </ListWorkspace>
  );
}
