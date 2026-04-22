import { useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { ContextItemsPane } from "../features/contexts/ContextItemsPane";
import { ContextsList } from "../features/contexts/ContextsList";
import { CONTEXT_RELATED_ITEMS_LIMIT } from "../features/contexts/constants";
import { useContextItemsQuery } from "../features/contexts/useContextItemsQuery";
import { useContextsQuery } from "../features/contexts/useContextsQuery";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { contextsListTheme } from "../features/lists/listThemes";
import { useActiveZone, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";

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
    updateContextName
  } = useContextsQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const selectedItem =
    contexts.find((context) => context.id === selectedId) ??
    (contexts.length > 0 ? contexts[0] : null);
  const selectedPosition = selectedItem
    ? contexts.findIndex((context) => context.id === selectedItem.id) + 1
    : 0;
  const selectedIndex = selectedPosition - 1;
  const {
    items: relatedItems,
    isLoading: isLoadingRelatedItems,
    errorMessage: relatedItemsErrorMessage,
    reload: reloadRelatedItems
  } = useContextItemsQuery(selectedItem?.id ?? null, CONTEXT_RELATED_ITEMS_LIMIT);

  useEffect(() => {
    setActiveZone("context-list");
  }, [setActiveZone]);

  useEffect(() => {
    if (contexts.length === 0) {
      setSelectedId(null);
      setEditingId(null);
      setEditingName("");
      return;
    }

    if (!selectedId || !contexts.some((context) => context.id === selectedId)) {
      setSelectedId(contexts[0].id);
    }

    if (editingId && !contexts.some((context) => context.id === editingId)) {
      setEditingId(null);
      setEditingName("");
    }
  }, [contexts, editingId, selectedId]);

  const selectNextContext = () => {
    if (contexts.length === 0) {
      return;
    }

    const nextIndex = Math.min(selectedIndex + 1, contexts.length - 1);
    setSelectedId(contexts[nextIndex].id);
  };

  const selectPreviousContext = () => {
    if (contexts.length === 0) {
      return;
    }

    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(contexts[previousIndex].id);
  };

  const createNewContext = async () => {
    const createdContext = await createContext();

    setSelectedId(createdContext.id);
    setEditingId(createdContext.id);
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
    setEditingName(selectedItem.name);
  };

  const cancelEditingSelectedContext = () => {
    setEditingId(null);
    setEditingName("");
  };

  const commitEditingSelectedContext = async () => {
    if (!selectedItem || editingId !== selectedItem.id) {
      return;
    }

    const normalizedName = editingName.trim();

    if (!normalizedName) {
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
          if (contexts.length === 0 || editingId !== null) {
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
      }
    ],
    [
      contexts.length,
      editingId,
      isCreating,
      isDeleting,
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

    if (contexts.length === 0) {
      return <p className="pane-state">No contexts yet.</p>;
    }

    return (
      <ContextsList
        items={contexts}
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

  const listMeta = `${contexts.length} ${contexts.length === 1 ? "item" : "items"}`;
  const detailMeta = `${relatedItems.length} ${relatedItems.length === 1 ? "item" : "items"}`;

  return (
    <ListWorkspace
      theme={contextsListTheme}
      currentIconSrc={contextsListTheme.iconSrc}
      currentLabel={contextsListTheme.label}
    >
      <section className="inbox-terminal-layout" aria-label="Contexts">
        <ListPane
          title="Contexts"
          meta={listMeta}
          panelIndex={1}
          active={activeZone === "context-list"}
          bodyClassName="list-pane__body--flush"
          iconSrc={contextsListTheme.iconSrc}
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
          iconSrc={contextsListTheme.iconSrc}
          className="contexts-pane"
        >
          {detailBody}
        </ListPane>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
