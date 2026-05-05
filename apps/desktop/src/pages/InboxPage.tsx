import { useEffect, useMemo } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import type { InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { inboxListTheme } from "../features/lists/listThemes";

type InboxPageProps = {
  controller: InboxWorkspaceController;
};

function inboxBinding(
  id: string,
  key: string,
  description: string,
  zone: FocusZoneId,
  runKeybind: () => void,
  leader = false,
  sequence?: string[]
): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "inbox", sequence, zone };
}

function canRunInboxAction(controller: InboxWorkspaceController): boolean {
  return !controller.isLoading && !controller.isCreating && !controller.isDeleting && !controller.isUpdating;
}

function canEditInbox(controller: InboxWorkspaceController): boolean {
  return canRunInboxAction(controller) && !controller.editingId && !controller.editingBodyId;
}

function canEditSelectedStuff(controller: InboxWorkspaceController): boolean {
  return canEditInbox(controller) && Boolean(controller.selectedItem);
}

function runInboxAsyncAction(canRun: boolean, action: () => Promise<void>, message: string) {
  if (canRun) {
    void action().catch((error: unknown) => console.error(message, error));
  }
}

function createStuffFromKeybind(controller: InboxWorkspaceController) {
  runInboxAsyncAction(canEditInbox(controller), controller.createNewStuff, "Failed to create stuff");
}

function deleteStuffFromKeybind(controller: InboxWorkspaceController) {
  runInboxAsyncAction(canEditSelectedStuff(controller), controller.deleteSelectedStuff, "Failed to delete stuff");
}

function editTitleFromKeybind(controller: InboxWorkspaceController) {
  if (canEditSelectedStuff(controller)) {
    controller.startEditingSelectedStuff();
  }
}

function moveInboxSelection(controller: InboxWorkspaceController, direction: "next" | "previous") {
  if (!controller.editingId && !controller.editingBodyId) {
    direction === "next" ? controller.selectNextStuff() : controller.selectPreviousStuff();
  }
}

function editBodyFromListKeybind(controller: InboxWorkspaceController) {
  if (canEditSelectedStuff(controller)) {
    controller.startEditingSelectedStuffBody();
  }
}

function editBodyFromKeybind(controller: InboxWorkspaceController) {
  if (canEditSelectedStuff(controller)) {
    controller.startEditingSelectedStuffBody();
  }
}

function focusInboxList(controller: InboxWorkspaceController) {
  if (!controller.editingBodyId) {
    controller.setActiveZone("inbox-list");
  }
}

function openStuffDetailScreen(controller: InboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (controller.selectedItem) {
    setActiveScreen("stuff-detail");
  }
}

function buildInboxBindings(controller: InboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  return [
    inboxBinding("inbox.create-stuff", "a", "Add new stuff", "inbox-list", () => createStuffFromKeybind(controller)),
    inboxBinding("inbox.delete-stuff-list", "d", "Delete selected stuff", "inbox-list", () => deleteStuffFromKeybind(controller)),
    inboxBinding("inbox.delete-stuff-detail", "d", "Delete selected stuff", "stuff-detail", () => deleteStuffFromKeybind(controller)),
    inboxBinding("inbox.undo-list", "u", "Undo last deletion", "inbox-list", () => void controller.undo()),
    inboxBinding("inbox.undo-detail", "u", "Undo last deletion", "stuff-detail", () => void controller.undo()),
    { ...inboxBinding("inbox.redo-list", "r", "Redo last action", "inbox-list", () => void controller.redo()), ctrl: true },
    { ...inboxBinding("inbox.redo-detail", "r", "Redo last action", "stuff-detail", () => void controller.redo()), ctrl: true },
    inboxBinding("inbox.edit-title", "Enter", "Edit selected title", "inbox-list", () => editTitleFromKeybind(controller)),
    inboxBinding("inbox.move-down", "j", "Move down", "inbox-list", () => moveInboxSelection(controller, "next")),
    inboxBinding("inbox.move-up", "k", "Move up", "inbox-list", () => moveInboxSelection(controller, "previous")),
    inboxBinding("inbox.edit-body-from-list", "l", "Edit selected body", "inbox-list", () => editBodyFromListKeybind(controller)),
    inboxBinding("inbox.edit-body", "Enter", "Edit selected body", "stuff-detail", () => editBodyFromKeybind(controller)),
    inboxBinding("inbox.focus-list", "h", "Focus inbox list", "stuff-detail", () => focusInboxList(controller)),
    inboxBinding("inbox.open-detail-screen-from-list", "Enter", "Open full stuff detail", "inbox-list", () => openStuffDetailScreen(controller, setActiveScreen), true, ["Enter"]),
    inboxBinding("inbox.open-detail-screen-from-detail", "Enter", "Open full stuff detail", "stuff-detail", () => openStuffDetailScreen(controller, setActiveScreen), true, ["Enter"]),
    inboxBinding("inbox.which-key-list", "k", "Show available keybinds", "inbox-list", () => undefined, true),
    inboxBinding("inbox.which-key-detail", "k", "Show available keybinds", "stuff-detail", () => undefined, true),
    ...buildFormattingBindings("inbox")
  ];
}


function useInboxBindings(controller: InboxWorkspaceController) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildInboxBindings(controller, setActiveScreen), [controller, setActiveScreen]);

  useRegisterKeybinds(bindings);
}

function useInboxZone(controller: InboxWorkspaceController) {
  useEffect(() => {
    if (controller.activeZone !== "inbox-list" && controller.activeZone !== "stuff-detail") {
      controller.setActiveZone(controller.editingBodyId ? "stuff-detail" : "inbox-list");
    }
  }, [controller.activeZone, controller.editingBodyId, controller.setActiveZone]);
}

function commitStuffTitle(controller: InboxWorkspaceController) {
  void controller.commitEditingSelectedStuff().catch((error: unknown) => {
    console.error("Failed to update stuff title", error);
  });
}

function commitStuffBody(controller: InboxWorkspaceController, body: string): Promise<void> {
  return controller.commitEditingSelectedStuffBody(body);
}

function autosaveStuffBody(controller: InboxWorkspaceController, body: string): Promise<void> {
  return controller.autosaveEditingSelectedStuffBody(body);
}

async function exitBodyEditingFromNormalMode(controller: InboxWorkspaceController, body: string): Promise<void> {
  await controller.commitEditingSelectedStuffBody(body);
  controller.setActiveZone("inbox-list");
}

function InboxListReady({ controller }: InboxPageProps) {
  return (
    <InboxList
      items={controller.stuffs}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={controller.editingId}
      editingTitle={controller.editingTitle}
      onSelect={controller.setSelectedId}
      onEditingTitleChange={controller.setEditingTitle}
      onStartEditing={controller.startEditingSelectedStuff}
      onCommitEditing={() => commitStuffTitle(controller)}
      onCommitEditingAndContinue={() => commitStuffTitle(controller)}
      onCancelEditing={controller.cancelEditingSelectedStuff}
    />
  );
}

function InboxListBody({ controller }: InboxPageProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading inbox...</p>;
  }

  if (controller.errorMessage) {
    return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  }

  return controller.stuffs.length === 0 ? <p className="pane-state">Inbox is empty.</p> : <InboxListReady controller={controller} />;
}

function InboxDetailReady({ controller }: InboxPageProps) {
  const selectedItem = controller.selectedItem;

  return selectedItem ? (
    <InboxStuffDetails
      item={selectedItem}
      editing={controller.editingBodyId === selectedItem.id}
      onAutosaveEditing={(body) => autosaveStuffBody(controller, body)}
      onCommitEditing={(body) => commitStuffBody(controller, body)}
      onExitEditingFromNormalMode={(body) => exitBodyEditingFromNormalMode(controller, body)}
      onCancelEditing={controller.cancelEditingSelectedStuffBody}
      onVimModeChange={controller.setVimMode}
    />
  ) : null;
}

function InboxDetailBody({ controller }: InboxPageProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading stuff details...</p>;
  }

  if (controller.errorMessage) {
    return <p className="pane-state">Stuff details are unavailable while inbox loading fails.</p>;
  }

  return controller.selectedItem ? (
    <InboxDetailReady controller={controller} />
  ) : (
    <p className="pane-state">Select a stuff to inspect its details.</p>
  );
}

function InboxListPane({ controller }: InboxPageProps) {
  const listMeta = `${controller.stuffs.length} ${controller.stuffs.length === 1 ? "item" : "items"}`;

  return (
    <ListPane title="Inbox" meta={listMeta} panelIndex={1} active={controller.activeZone === "inbox-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <InboxListBody controller={controller} />
    </ListPane>
  );
}

function InboxDetailPane({ controller }: InboxPageProps) {
  return (
    <ListPane title="Stuff Detail" panelIndex={2} active={controller.activeZone === "stuff-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <InboxDetailBody controller={controller} />
    </ListPane>
  );
}

function InboxPanes({ controller }: InboxPageProps) {
  return (
    <section className="inbox-terminal-layout" aria-label="Inbox">
      <InboxListPane controller={controller} />
      <InboxDetailPane controller={controller} />
    </section>
  );
}

/**
 * Renders the inbox workspace with list, details, and inbox keybindings.
 *
 * @example <InboxPage controller={controller} />
 */
export function InboxPage({ controller }: InboxPageProps) {
  useKeybindScreen("inbox");
  useInboxZone(controller);
  useInboxBindings(controller);

  return (
    <ListWorkspace theme={inboxListTheme} currentLabel={inboxListTheme.label} modeLabel={controller.vimMode ?? undefined}>
      <InboxPanes controller={controller} />
      <LeaderMenu />
    </ListWorkspace>
  );
}
