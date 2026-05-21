import { useEffect, useMemo } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxList } from "../features/inbox/InboxList";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { DeletedInboxWorkspaceController } from "../features/inbox/useDeletedInboxWorkspaceController";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { deletedInboxListTheme } from "../features/lists/listThemes";

type DeletedInboxPageProps = {
  controller: DeletedInboxWorkspaceController;
};

function deletedBinding(
  id: string,
  key: string,
  description: string,
  zone: FocusZoneId,
  runKeybind: () => void,
  leader = false,
  sequence?: string[]
): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "deleted-inbox", sequence, zone };
}

function canRecover(controller: DeletedInboxWorkspaceController): boolean {
  return !controller.isLoading && !controller.isUpdating && Boolean(controller.selectedItem);
}

function recoverStuffFromKeybind(controller: DeletedInboxWorkspaceController) {
  if (canRecover(controller)) {
    void controller.restoreSelectedStuff().catch((error: unknown) => console.error("Failed to restore stuff", error));
  }
}

function moveDeletedSelection(controller: DeletedInboxWorkspaceController, direction: "next" | "previous") {
  if (controller.activeZone === "deleted-inbox-list") {
    direction === "next" ? controller.selectNextStuff() : controller.selectPreviousStuff();
  }
}

function focusDeletedList(controller: DeletedInboxWorkspaceController) {
  if (controller.stuffs.length > 0) {
    controller.setActiveZone("deleted-inbox-list");
  }
}

function focusDeletedDetail(controller: DeletedInboxWorkspaceController) {
  if (controller.stuffs.length > 0) {
    controller.setActiveZone("deleted-stuff-detail");
  }
}

function openInboxFromKeybind(controller: DeletedInboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  controller.resetWorkspace();
  setActiveScreen("inbox");
}

function buildDeletedListBindings(controller: DeletedInboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  return [
    deletedBinding("deleted-inbox.recover", "r", "Recover selected stuff", "deleted-inbox-list", () => recoverStuffFromKeybind(controller)),
    deletedBinding("deleted-inbox.move-down", "j", "Move down", "deleted-inbox-list", () => moveDeletedSelection(controller, "next")),
    deletedBinding("deleted-inbox.move-up", "k", "Move up", "deleted-inbox-list", () => moveDeletedSelection(controller, "previous")),
    deletedBinding("deleted-inbox.focus-detail", "l", "Focus stuff detail", "deleted-inbox-list", () => focusDeletedDetail(controller)),
    deletedBinding("deleted-inbox.switch-forward", "]", "Open inbox", "deleted-inbox-list", () => openInboxFromKeybind(controller, setActiveScreen)),
    deletedBinding("deleted-inbox.switch-back", "[", "Open inbox", "deleted-inbox-list", () => openInboxFromKeybind(controller, setActiveScreen)),
    deletedBinding("deleted-inbox.which-key-list", "k", "Show available keybinds", "deleted-inbox-list", () => undefined, true)
  ];
}

function buildDeletedDetailBindings(controller: DeletedInboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  return [
    deletedBinding("deleted-inbox.recover-detail", "r", "Recover selected stuff", "deleted-stuff-detail", () => recoverStuffFromKeybind(controller)),
    deletedBinding("deleted-inbox.focus-list", "h", "Focus stuff list", "deleted-stuff-detail", () => focusDeletedList(controller)),
    deletedBinding("deleted-inbox.switch-forward-detail", "]", "Open inbox", "deleted-stuff-detail", () => openInboxFromKeybind(controller, setActiveScreen)),
    deletedBinding("deleted-inbox.switch-back-detail", "[", "Open inbox", "deleted-stuff-detail", () => openInboxFromKeybind(controller, setActiveScreen)),
    deletedBinding("deleted-inbox.which-key-detail", "k", "Show available keybinds", "deleted-stuff-detail", () => undefined, true)
  ];
}

function buildDeletedInboxBindings(controller: DeletedInboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  return [...buildDeletedListBindings(controller, setActiveScreen), ...buildDeletedDetailBindings(controller, setActiveScreen)];
}

function useDeletedInboxBindings(controller: DeletedInboxWorkspaceController) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildDeletedInboxBindings(controller, setActiveScreen), [controller, setActiveScreen]);

  useRegisterKeybinds(bindings);
}

function useDeletedInboxZone(controller: DeletedInboxWorkspaceController) {
  useEffect(() => {
    if (controller.activeZone !== "deleted-inbox-list" && controller.activeZone !== "deleted-stuff-detail") {
      controller.setActiveZone("deleted-inbox-list");
    }
  }, [controller.activeZone, controller.setActiveZone]);
}

function useDeletedInboxAssetPreload(controller: DeletedInboxWorkspaceController) {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(controller.stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function DeletedListReady({ controller }: DeletedInboxPageProps) {
  return (
    <InboxList
      items={controller.stuffs}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={null}
      editingTitle=""
      onSelect={controller.setSelectedId}
      onEditingTitleChange={() => undefined}
      onStartEditing={() => undefined}
      onCommitEditing={() => undefined}
      onCommitEditingAndContinue={() => undefined}
      onCancelEditing={() => undefined}
    />
  );
}

function DeletedListBody({ controller }: DeletedInboxPageProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading deleted stuff...</p>;
  }

  if (controller.errorMessage) {
    return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  }

  return controller.stuffs.length === 0 ? <p className="pane-state">No deleted stuff yet.</p> : <DeletedListReady controller={controller} />;
}

function DeletedDetailReady({ controller }: DeletedInboxPageProps) {
  const selectedItem = controller.selectedItem;

  return selectedItem ? (
    <InboxStuffDetails
      item={selectedItem}
      editing={false}
      onAutosaveEditing={() => Promise.resolve()}
      onCommitEditing={() => Promise.resolve()}
      onExitEditingFromNormalMode={() => Promise.resolve()}
      onCancelEditing={() => undefined}
    />
  ) : null;
}

function DeletedDetailBody({ controller }: DeletedInboxPageProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading stuff details...</p>;
  }

  if (controller.errorMessage) {
    return <p className="pane-state">Stuff details are unavailable while deleted stuff loading fails.</p>;
  }

  return controller.selectedItem ? (
    <DeletedDetailReady controller={controller} />
  ) : (
    <p className="pane-state">Select a deleted stuff to inspect its details.</p>
  );
}

function DeletedListView({ controller }: DeletedInboxPageProps) {
  const listMeta = `${controller.stuffs.length} ${controller.stuffs.length === 1 ? "item" : "items"}`;

  return (
    <ListView title="Deleted Stuff" meta={listMeta} viewIndex={1} active={controller.activeZone === "deleted-inbox-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <DeletedListBody controller={controller} />
    </ListView>
  );
}

function DeletedDetailView({ controller }: DeletedInboxPageProps) {
  return (
    <ListView title="Stuff Detail" viewIndex={2} active={controller.activeZone === "deleted-stuff-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <DeletedDetailBody controller={controller} />
    </ListView>
  );
}

function DeletedViews({ controller }: DeletedInboxPageProps) {
  return (
    <section className="inbox-terminal-layout" aria-label="Deleted stuff">
      <DeletedListView controller={controller} />
      <DeletedDetailView controller={controller} />
    </section>
  );
}

/**
 * Renders the deleted inbox workspace with list, details, and keybindings.
 *
 * @example <DeletedInboxPage controller={controller} />
 */
export function DeletedInboxPage({ controller }: DeletedInboxPageProps) {
  useKeybindScreen("deleted-inbox");
  useDeletedInboxZone(controller);
  useDeletedInboxAssetPreload(controller);
  useDeletedInboxBindings(controller);

  return (
    <ListWorkspace theme={deletedInboxListTheme} currentLabel={deletedInboxListTheme.label}>
      <DeletedViews controller={controller} />
      <LeaderMenu />
    </ListWorkspace>
  );
}
