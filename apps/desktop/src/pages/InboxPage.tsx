import { useEffect, useMemo } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import type { KeybindDefinition } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { inboxListTheme } from "../features/lists/listThemes";
import {
  useActiveScreen,
  useActiveZone,
  useKeybindScreen,
  useRegisterKeybinds
} from "../features/keybinds/hooks";

type InboxPageProps = {
  controller: InboxWorkspaceController;
};

export function InboxPage({ controller }: InboxPageProps) {
  useKeybindScreen("inbox");

  const { setActiveScreen } = useActiveScreen();
  const {
    activeZone,
    createNewStuff,
    deleteSelectedStuff,
    editingBody,
    editingBodyId,
    editingId,
    editingTitle,
    errorMessage,
    isCreating,
    isDeleting,
    isLoading,
    isUpdating,
    reload,
    selectedItem,
    setActiveZone,
    setEditingBody,
    setEditingTitle,
    setPendingBodyEditId,
    setSelectedId,
    selectNextStuff,
    selectPreviousStuff,
    startEditingSelectedStuff,
    startEditingSelectedStuffBody,
    cancelEditingSelectedStuff,
    cancelEditingSelectedStuffBody,
    commitEditingSelectedStuff,
    commitEditingSelectedStuffBody,
    stuffs
  } = controller;

  useEffect(() => {
    if (activeZone !== "inbox-list" && activeZone !== "stuff-detail") {
      setActiveZone("inbox-list");
    }
  }, [activeZone, setActiveZone]);

  const bindings = useMemo<KeybindDefinition[]>(
    () => [
      {
        id: "inbox.create-stuff",
        key: "a",
        description: "Add new stuff",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => {
          if (
            isLoading ||
            isCreating ||
            isDeleting ||
            isUpdating ||
            editingId !== null ||
            editingBodyId !== null
          ) {
            return;
          }

          void createNewStuff().catch((error: unknown) => {
            console.error("Failed to create stuff", error);
          });
        }
      },
      {
        id: "inbox.delete-stuff-list",
        key: "d",
        description: "Delete selected stuff",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => {
          if (
            isLoading ||
            isCreating ||
            isDeleting ||
            isUpdating ||
            editingId !== null ||
            editingBodyId !== null ||
            !selectedItem
          ) {
            return;
          }

          void deleteSelectedStuff().catch((error: unknown) => {
            console.error("Failed to delete stuff", error);
          });
        }
      },
      {
        id: "inbox.delete-stuff-detail",
        key: "d",
        description: "Delete selected stuff",
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => {
          if (
            isLoading ||
            isCreating ||
            isDeleting ||
            isUpdating ||
            editingId !== null ||
            editingBodyId !== null ||
            !selectedItem
          ) {
            return;
          }

          void deleteSelectedStuff().catch((error: unknown) => {
            console.error("Failed to delete stuff", error);
          });
        }
      },
      {
        id: "inbox.edit-title",
        key: "Enter",
        description: "Edit selected title",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => {
          if (
            isLoading ||
            isCreating ||
            isDeleting ||
            isUpdating ||
            editingId !== null ||
            editingBodyId !== null ||
            !selectedItem
          ) {
            return;
          }

          startEditingSelectedStuff();
        }
      },
      {
        id: "inbox.move-down",
        key: "j",
        description: "Move down",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => {
          if (editingId !== null || editingBodyId !== null) {
            return;
          }

          selectNextStuff();
        }
      },
      {
        id: "inbox.move-up",
        key: "k",
        description: "Move up",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => {
          if (editingId !== null || editingBodyId !== null) {
            return;
          }

          selectPreviousStuff();
        }
      },
      {
        id: "inbox.focus-detail",
        key: "l",
        description: "Focus stuff detail",
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => {
          if (stuffs.length === 0 || editingId !== null || editingBodyId !== null) {
            return;
          }

          setActiveZone("stuff-detail");
        }
      },
      {
        id: "inbox.edit-body",
        key: "Enter",
        description: "Edit selected body",
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => {
          if (
            isLoading ||
            isCreating ||
            isDeleting ||
            isUpdating ||
            editingId !== null ||
            editingBodyId !== null ||
            !selectedItem
          ) {
            return;
          }

          startEditingSelectedStuffBody();
        }
      },
      {
        id: "inbox.focus-list",
        key: "h",
        description: "Focus inbox list",
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => {
          if (editingBodyId !== null) {
            return;
          }

          setActiveZone("inbox-list");
        }
      },
      {
        id: "inbox.open-detail-screen",
        key: "Enter",
        description: "Open full stuff detail",
        leader: true,
        sequence: ["Enter"],
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => {
          if (!selectedItem || editingBodyId !== null) {
            return;
          }

          setActiveScreen("stuff-detail");
        }
      },
      {
        id: "inbox.which-key-list",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "inbox" as const,
        zone: "inbox-list" as const,
        handler: () => undefined
      },
      {
        id: "inbox.which-key-detail",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "inbox" as const,
        zone: "stuff-detail" as const,
        handler: () => undefined
      }
    ],
    [
      editingId,
      editingBodyId,
      isCreating,
      isDeleting,
      isLoading,
      isUpdating,
      selectedItem,
      setActiveScreen,
      setActiveZone,
      stuffs.length
    ]
  );

  useRegisterKeybinds(bindings);

  const listBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading inbox...</p>;
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

    if (stuffs.length === 0) {
      return <p className="pane-state">Inbox is empty.</p>;
    }

    return (
      <InboxList
        items={stuffs}
        selectedId={selectedItem?.id ?? ""}
        editingId={editingId}
        editingTitle={editingTitle}
        onSelect={setSelectedId}
        onEditingTitleChange={setEditingTitle}
        onStartEditing={startEditingSelectedStuff}
        onCommitEditing={() => {
          void commitEditingSelectedStuff().catch((error: unknown) => {
            console.error("Failed to update stuff title", error);
          });
        }}
        onCommitEditingAndContinue={() => {
          void commitEditingSelectedStuff().catch((error: unknown) => {
            console.error("Failed to update stuff title", error);
          });
        }}
        onCancelEditing={cancelEditingSelectedStuff}
      />
    );
  })();

  const detailBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading stuff details...</p>;
    }

    if (errorMessage) {
      return <p className="pane-state">Stuff details are unavailable while inbox loading fails.</p>;
    }

    if (!selectedItem) {
      return <p className="pane-state">Select a stuff to inspect its details.</p>;
    }

    return (
      <InboxStuffDetails
        item={selectedItem}
        editing={editingBodyId === selectedItem.id}
        editingBody={editingBody}
        onEditingBodyChange={setEditingBody}
        onCommitEditing={() => {
          void commitEditingSelectedStuffBody().catch((error: unknown) => {
            console.error("Failed to update stuff body", error);
          });
        }}
        onCancelEditing={cancelEditingSelectedStuffBody}
      />
    );
  })();

  const listMeta = `${stuffs.length} ${stuffs.length === 1 ? "item" : "items"}`;

  return (
    <ListWorkspace theme={inboxListTheme} currentLabel={inboxListTheme.label}>
      <section className="inbox-terminal-layout" aria-label="Inbox">
        <ListPane
          title="Inbox"
          meta={listMeta}
          panelIndex={1}
          active={activeZone === "inbox-list"}
          bodyClassName="list-pane__body--flush"
          className="inbox-pane inbox-pane--list"
        >
          {listBody}
        </ListPane>

        <ListPane
          title="Stuff Detail"
          panelIndex={2}
          active={activeZone === "stuff-detail"}
          bodyClassName="list-pane__body--detail"
          className="inbox-pane inbox-pane--detail"
        >
          {detailBody}
        </ListPane>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
