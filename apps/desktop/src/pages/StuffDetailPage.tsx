import { useEffect, useMemo } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition } from "../features/keybinds/types";
import { stuffDetailListTheme } from "../features/lists/listThemes";

type StuffDetailPageProps = {
  controller: InboxWorkspaceController;
};

export function StuffDetailPage({ controller }: StuffDetailPageProps) {
  useKeybindScreen("stuff-detail");

  const { setActiveScreen } = useActiveScreen();
  const {
    editingBody,
    editingBodyId,
    errorMessage,
    isCreating,
    isDeleting,
    isLoading,
    isUpdating,
    reload,
    selectedItem,
    setActiveZone,
    setEditingBody,
    commitEditingSelectedStuffBody,
    startEditingSelectedStuffBody
  } = controller;

  useEffect(() => {
    setActiveZone("stuff-detail");
  }, [setActiveZone]);

  const bindings = useMemo<KeybindDefinition[]>(
    () => [
      {
        id: "stuff-detail-page.edit-body",
        key: "Enter",
        description: "Edit selected body",
        screen: "stuff-detail" as const,
        zone: "stuff-detail" as const,
        handler: () => {
          if (
            isLoading ||
            isCreating ||
            isDeleting ||
            isUpdating ||
            editingBodyId !== null ||
            !selectedItem
          ) {
            return;
          }

          startEditingSelectedStuffBody();
        }
      },
      {
        id: "stuff-detail-page.back-to-inbox",
        key: "Escape",
        description: "Back to inbox",
        screen: "stuff-detail" as const,
        zone: "stuff-detail" as const,
        handler: () => {
          if (editingBodyId !== null) {
            return;
          }

          setActiveZone("inbox-list");
          setActiveScreen("inbox");
        }
      },
      {
        id: "stuff-detail-page.which-key",
        key: "k",
        description: "Show available keybinds",
        leader: true,
        screen: "stuff-detail" as const,
        zone: "stuff-detail" as const,
        handler: () => undefined
      }
    ],
    [
      editingBodyId,
      isCreating,
      isDeleting,
      isLoading,
      isUpdating,
      selectedItem,
      setActiveScreen,
      setActiveZone,
      startEditingSelectedStuffBody
    ]
  );

  useRegisterKeybinds(bindings);

  const detailBody = (() => {
    if (isLoading) {
      return <p className="pane-state">Loading stuff details...</p>;
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

    if (!selectedItem) {
      return <p className="pane-state">Select a stuff in inbox to inspect its details.</p>;
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
        onCancelEditing={() => {
          void commitEditingSelectedStuffBody().catch((error: unknown) => {
            console.error("Failed to update stuff body", error);
          });
        }}
      />
    );
  })();

  return (
    <ListWorkspace
      theme={stuffDetailListTheme}
      currentIconSrc={stuffDetailListTheme.iconSrc}
      currentLabel={stuffDetailListTheme.label}
    >
      <section className="stuff-detail-layout" aria-label="Stuff detail">
        <ListPane
          title="Stuff Detail"
          active
          bodyClassName="list-pane__body--detail"
          iconSrc={stuffDetailListTheme.iconSrc}
        >
          {detailBody}
        </ListPane>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
