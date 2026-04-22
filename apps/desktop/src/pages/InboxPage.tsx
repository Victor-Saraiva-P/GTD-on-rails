import { useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { KeybindDefinition } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { inboxListTheme } from "../features/lists/listThemes";
import { useActiveZone, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { useInboxStuffsQuery } from "../features/inbox/useInboxStuffsQuery";

export function InboxPage() {
  useKeybindScreen("inbox");

  const {
    stuffs,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    errorMessage,
    reload,
    createStuff,
    deleteStuff,
    updateStuffBody,
    updateStuffTitle
  } = useInboxStuffsQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingBodyEditId, setPendingBodyEditId] = useState<string | null>(null);
  const { activeZone, setActiveZone } = useActiveZone();
  const selectedItem =
    stuffs.find((item) => item.id === selectedId) ?? (stuffs.length > 0 ? stuffs[0] : null);
  const selectedIndex = selectedItem
    ? stuffs.findIndex((item) => item.id === selectedItem.id)
    : -1;

  useEffect(() => {
    setActiveZone("inbox-list");
  }, [setActiveZone]);

  useEffect(() => {
    if (stuffs.length === 0) {
      setSelectedId(null);
      setEditingId(null);
      setEditingTitle("");
      setEditingBodyId(null);
      setEditingBody("");
      setPendingBodyEditId(null);
      return;
    }

    if (!selectedId || !stuffs.some((item) => item.id === selectedId)) {
      setSelectedId(stuffs[0].id);
    }

    if (editingId && !stuffs.some((item) => item.id === editingId)) {
      setEditingId(null);
      setEditingTitle("");
    }

    if (editingBodyId && !stuffs.some((item) => item.id === editingBodyId)) {
      setEditingBodyId(null);
      setEditingBody("");
    }

    if (pendingBodyEditId && !stuffs.some((item) => item.id === pendingBodyEditId)) {
      setPendingBodyEditId(null);
    }
  }, [selectedId, stuffs]);

  const selectNextStuff = () => {
    if (stuffs.length === 0) {
      return;
    }

    const nextIndex = Math.min(selectedIndex + 1, stuffs.length - 1);
    setSelectedId(stuffs[nextIndex].id);
  };

  const selectPreviousStuff = () => {
    if (stuffs.length === 0) {
      return;
    }

    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(stuffs[previousIndex].id);
  };

  const createNewStuff = async () => {
    const createdStuff = await createStuff();

    setSelectedId(createdStuff.id);
    setEditingId(createdStuff.id);
    setEditingTitle("");
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(createdStuff.id);
    setActiveZone("inbox-list");
  };

  const deleteSelectedStuff = async () => {
    if (!selectedItem) {
      return;
    }

    await deleteStuff(selectedItem.id);
    setEditingId(null);
    setEditingTitle("");
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(null);
    setActiveZone("inbox-list");
  };

  const startEditingSelectedStuff = () => {
    if (!selectedItem) {
      return;
    }

    setEditingId(selectedItem.id);
    setEditingTitle(selectedItem.title);
    setPendingBodyEditId(null);
  };

  const cancelEditingSelectedStuff = () => {
    setEditingId(null);
    setEditingTitle("");
    setPendingBodyEditId(null);
  };

  const startEditingSelectedStuffBody = () => {
    if (!selectedItem) {
      return;
    }

    setEditingBodyId(selectedItem.id);
    setEditingBody(selectedItem.body ?? "");
  };

  const cancelEditingSelectedStuffBody = () => {
    setEditingBodyId(null);
    setEditingBody("");
  };

  const commitEditingSelectedStuff = async () => {
    if (!selectedItem || editingId !== selectedItem.id) {
      return;
    }

    const normalizedTitle = editingTitle.trim();
    const shouldContinueToBody = pendingBodyEditId === selectedItem.id;

    if (!normalizedTitle) {
      setEditingId(null);
      setEditingTitle("");
      if (shouldContinueToBody) {
        setActiveZone("stuff-detail");
        setEditingBodyId(selectedItem.id);
        setEditingBody(selectedItem.body ?? "");
      }
      setPendingBodyEditId(null);
      return;
    }

    if (normalizedTitle === selectedItem.title) {
      setEditingId(null);
      setEditingTitle("");
      if (shouldContinueToBody) {
        setActiveZone("stuff-detail");
        setEditingBodyId(selectedItem.id);
        setEditingBody(selectedItem.body ?? "");
      }
      setPendingBodyEditId(null);
      return;
    }

    const updatedStuff = await updateStuffTitle(selectedItem, normalizedTitle);

    setSelectedId(updatedStuff.id);
    setEditingId(null);
    setEditingTitle("");
    if (shouldContinueToBody) {
      setActiveZone("stuff-detail");
      setEditingBodyId(updatedStuff.id);
      setEditingBody(updatedStuff.body ?? "");
    }
    setPendingBodyEditId(null);
  };

  const commitEditingSelectedStuffBody = async () => {
    if (!selectedItem || editingBodyId !== selectedItem.id) {
      return;
    }

    const normalizedBody = editingBody.trim();
    const nextBody = normalizedBody ? editingBody : null;

    if ((selectedItem.body ?? null) === nextBody) {
      setEditingBodyId(null);
      setEditingBody("");
      return;
    }

    const updatedStuff = await updateStuffBody(selectedItem, nextBody);

    setSelectedId(updatedStuff.id);
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(null);
  };

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
      createStuff,
      deleteStuff,
      editingId,
      editingBodyId,
      isCreating,
      isDeleting,
      isLoading,
      isUpdating,
      selectedIndex,
      selectedItem,
      setActiveZone,
      stuffs.length,
      updateStuffBody,
      updateStuffTitle
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
    <ListWorkspace
      theme={inboxListTheme}
      currentIconSrc={inboxListTheme.iconSrc}
      currentLabel={inboxListTheme.label}
    >
      <section className="inbox-terminal-layout" aria-label="Inbox">
        <ListPane
          title="Inbox"
          meta={listMeta}
          panelIndex={1}
          active={activeZone === "inbox-list"}
          bodyClassName="list-pane__body--flush"
          iconSrc={inboxListTheme.iconSrc}
        >
          {listBody}
        </ListPane>

        <ListPane
          title="Stuff Detail"
          panelIndex={2}
          active={activeZone === "stuff-detail"}
          bodyClassName="list-pane__body--detail"
        >
          {detailBody}
        </ListPane>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
