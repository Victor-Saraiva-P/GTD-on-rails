import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { onGoingNextActionsListTheme } from "../features/lists/listThemes";
import { NextActionEditDialog } from "../features/next-actions/NextActionEditDialog";
import { NextActionsList } from "../features/next-actions/NextActionsList";
import type { NextActionPatch } from "../features/next-actions/types";
import type { OnGoingNextActionsWorkspaceController } from "../features/next-actions/useOnGoingNextActionsWorkspaceController";

type OnGoingNextActionsPageProps = {
  controller: OnGoingNextActionsWorkspaceController;
  selectNextAction: (id: string | null) => void;
};

type OnGoingControllerProps = {
  controller: OnGoingNextActionsWorkspaceController;
};

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function onGoingActionBinding(id: string, key: string, description: string, zone: FocusZoneId, runKeybind: () => void, leader = false, sequence?: string[]): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "ongoing-next-actions", zone, sequence };
}

function canRunAction(controller: OnGoingNextActionsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating;
}

function canEditSelected(controller: OnGoingNextActionsWorkspaceController): boolean {
  return canRunAction(controller) && !controller.editingId && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function runAsync(canRun: boolean, action: () => Promise<void>, message: string) {
  if (canRun) void action().catch((error: unknown) => console.error(message, error));
}

function moveSelection(controller: OnGoingNextActionsWorkspaceController, direction: "next" | "previous") {
  if (!controller.editingId && !controller.editingBodyId) {
    direction === "next" ? controller.selectNext() : controller.selectPrevious();
  }
}

function openDetailScreen(controller: OnGoingNextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (controller.selectedItem) {
    setActiveScreen("ongoing-next-action-detail-page");
  }
}

async function markAsDoneAndReturnWhenEmpty(controller: OnGoingNextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void): Promise<void> {
  const shouldReturnToNextActions = controller.stuffs.length <= 1;
  await controller.markAsDone();
  if (shouldReturnToNextActions) setActiveScreen("next-actions");
}

async function restoreAndOpenNextActions(controller: OnGoingNextActionsWorkspaceController, selectNextAction: (id: string | null) => void, setActiveScreen: (screen: ScreenId) => void): Promise<void> {
  const selectedId = controller.selectedItem?.id;
  if (!selectedId) return;
  await controller.restoreSelected();
  selectNextAction(selectedId);
  setActiveScreen("next-actions");
}

function buildOnGoingActionBindings(
  controller: OnGoingNextActionsWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  selectNextAction: (id: string | null) => void,
  openAttrs: () => void,
  openLink: () => void,
  openAsset: () => void,
  isAttrsOpen: boolean
) {
  return [
    onGoingActionBinding("ongoing-next-actions.delete-list", "d", "Delete selected on going action", "next-actions-list", () => runAsync(canEditSelected(controller), controller.deleteSelected, "Failed to delete next action")),
    onGoingActionBinding("ongoing-next-actions.delete-detail", "d", "Delete selected on going action", "next-action-detail", () => runAsync(canEditSelected(controller), controller.deleteSelected, "Failed to delete next action")),
    onGoingActionBinding("ongoing-next-actions.done-list", "x", "Mark as done", "next-actions-list", () => runAsync(canEditSelected(controller), () => markAsDoneAndReturnWhenEmpty(controller, setActiveScreen), "Failed to mark as done")),
    onGoingActionBinding("ongoing-next-actions.done-detail", "x", "Mark as done", "next-action-detail", () => runAsync(canEditSelected(controller), () => markAsDoneAndReturnWhenEmpty(controller, setActiveScreen), "Failed to mark as done")),
    onGoingActionBinding("ongoing-next-actions.attrs-list", "e", "Edit attributes", "next-actions-list", () => canEditSelected(controller) && openAttrs()),
    onGoingActionBinding("ongoing-next-actions.attrs-detail", "e", "Edit attributes", "next-action-detail", () => canEditSelected(controller) && openAttrs()),
    onGoingActionBinding("ongoing-next-actions.order-list", "o", "Cycle ordering", "next-actions-list", controller.toggleOrder),
    onGoingActionBinding("ongoing-next-actions.order-detail", "o", "Cycle ordering", "next-action-detail", controller.toggleOrder),
    onGoingActionBinding("ongoing-next-actions.undo-list", "u", "Undo last deletion", "next-actions-list", () => void controller.undo()),
    onGoingActionBinding("ongoing-next-actions.undo-detail", "u", "Undo last deletion", "next-action-detail", () => void controller.undo()),
    onGoingActionBinding("ongoing-next-actions.restore-list", "r", "Restore as next action", "next-actions-list", () => runAsync(canEditSelected(controller), () => restoreAndOpenNextActions(controller, selectNextAction, setActiveScreen), "Failed to restore next action")),
    onGoingActionBinding("ongoing-next-actions.restore-detail", "r", "Restore as next action", "next-action-detail", () => runAsync(canEditSelected(controller), () => restoreAndOpenNextActions(controller, selectNextAction, setActiveScreen), "Failed to restore next action")),
    { ...onGoingActionBinding("ongoing-next-actions.redo-list", "r", "Redo last action", "next-actions-list", () => void controller.redo()), ctrl: true },
    { ...onGoingActionBinding("ongoing-next-actions.redo-detail", "r", "Redo last action", "next-action-detail", () => void controller.redo()), ctrl: true },
    onGoingActionBinding("ongoing-next-actions.edit-title", "Enter", "Edit selected title", "next-actions-list", () => !isAttrsOpen && canEditSelected(controller) && controller.startTitleEdit()),
    onGoingActionBinding("ongoing-next-actions.move-down", "j", "Move down", "next-actions-list", () => moveSelection(controller, "next")),
    onGoingActionBinding("ongoing-next-actions.move-up", "k", "Move up", "next-actions-list", () => moveSelection(controller, "previous")),
    onGoingActionBinding("ongoing-next-actions.edit-body-list", "l", "Edit selected body", "next-actions-list", () => canEditSelected(controller) && controller.startBodyEdit()),
    onGoingActionBinding("ongoing-next-actions.edit-body-detail", "Enter", "Edit selected body", "next-action-detail", () => !isAttrsOpen && canEditSelected(controller) && controller.startBodyEdit()),
    onGoingActionBinding("ongoing-next-actions.open-detail-screen-from-list", "Enter", "Open full detail", "next-actions-list", () => !isAttrsOpen && openDetailScreen(controller, setActiveScreen), true, ["Enter"]),
    onGoingActionBinding("ongoing-next-actions.open-detail-screen-from-detail", "Enter", "Open full detail", "next-action-detail", () => !isAttrsOpen && openDetailScreen(controller, setActiveScreen), true, ["Enter"]),
    onGoingActionBinding("ongoing-next-actions.focus-list", "h", "Focus on going actions list", "next-action-detail", () => !controller.editingBodyId && controller.setActiveZone("next-actions-list")),
    onGoingActionBinding("ongoing-next-actions.which-key-list", "k", "Show available keybinds", "next-actions-list", () => undefined, true),
    onGoingActionBinding("ongoing-next-actions.which-key-detail", "k", "Show available keybinds", "next-action-detail", () => undefined, true),
    ...buildFormattingBindings("ongoing-next-actions", openLink, openAsset, "next-action-detail")
  ];
}

function useOnGoingActionBindings(controller: OnGoingNextActionsWorkspaceController, selectNextAction: (id: string | null) => void, openAttrs: () => void, openLink: () => void, openAsset: () => void, isAttrsOpen: boolean) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildOnGoingActionBindings(controller, setActiveScreen, selectNextAction, openAttrs, openLink, openAsset, isAttrsOpen), [controller, setActiveScreen, selectNextAction, openAttrs, openLink, openAsset, isAttrsOpen]);
  useRegisterKeybinds(bindings);
}

function useOnGoingActionZone(controller: OnGoingNextActionsWorkspaceController) {
  useEffect(() => {
    if (controller.activeZone !== "next-actions-list" && controller.activeZone !== "next-action-detail") {
      controller.setActiveZone(controller.editingBodyId ? "next-action-detail" : "next-actions-list");
    }
  }, [controller.activeZone, controller.editingBodyId, controller.setActiveZone]);
}

function useOnGoingActionAssetPreload(controller: OnGoingNextActionsWorkspaceController) {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(controller.stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function commitTitle(controller: OnGoingNextActionsWorkspaceController) {
  void controller.commitTitle().catch((error: unknown) => console.error("Failed to update next action title", error));
}

function orderLabel(controller: OnGoingNextActionsWorkspaceController): string {
  return controller.orderBy === "time" ? "estimated time" : "energy";
}

function OnGoingActionsListBody({ controller }: OnGoingControllerProps) {
  if (controller.isLoading) return <p className="pane-state">Loading on going actions...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.stuffs.length === 0) return <p className="pane-state">No on going actions for this filter.</p>;
  return <OnGoingActionsListReady controller={controller} />;
}

function OnGoingActionsListReady({ controller }: OnGoingControllerProps) {
  return (
    <NextActionsList
      items={controller.stuffs}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={controller.editingId}
      editingTitle={controller.editingTitle}
      onSelect={controller.setSelectedId}
      onEditingTitleChange={controller.setEditingTitle}
      onStartEditing={controller.startTitleEdit}
      onCommitEditing={() => commitTitle(controller)}
      onCommitEditingAndContinue={() => commitTitle(controller)}
      onCancelEditing={controller.cancelTitleEdit}
    />
  );
}

function OnGoingActionDetailBody({ controller }: OnGoingControllerProps) {
  if (controller.isLoading) return <p className="pane-state">Loading on going action details...</p>;
  if (controller.errorMessage) return <p className="pane-state">On going action details are unavailable while loading fails.</p>;
  if (!controller.selectedItem) return <p className="pane-state">Select an on going action to inspect its details.</p>;
  return <OnGoingActionDetailReady controller={controller} />;
}

function OnGoingActionDetailReady({ controller }: OnGoingControllerProps) {
  const item = controller.selectedItem;
  if (!item) return null;
  return (
    <InboxStuffDetails
      item={item}
      showCreatedMeta={false}
      metaVariant="next-action"
      editing={controller.editingBodyId === item.id}
      onAutosaveEditing={(body) => controller.autosaveBody(body)}
      onCommitEditing={(body) => controller.commitBody(body)}
      onExitEditingFromNormalMode={(body) => exitBodyEditing(controller, body)}
      onCancelEditing={controller.cancelBodyEdit}
      onVimModeChange={controller.setVimMode}
    />
  );
}

async function exitBodyEditing(controller: OnGoingNextActionsWorkspaceController, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone("next-actions-list");
}

function OnGoingActionsListPane({ controller }: OnGoingControllerProps) {
  const count = controller.stuffs.length;
  const meta = `${count} ${count === 1 ? "item" : "items"}`;

  return (
    <ListPane title="On Going Actions" meta={meta} panelIndex={1} active={controller.activeZone === "next-actions-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <OnGoingActionsListBody controller={controller} />
    </ListPane>
  );
}

function OnGoingActionDetailPane({ controller }: OnGoingControllerProps) {
  return (
    <ListPane title="On Going Action Detail" panelIndex={2} active={controller.activeZone === "next-action-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <OnGoingActionDetailBody controller={controller} />
    </ListPane>
  );
}

function OnGoingActionPanes({ controller }: OnGoingControllerProps) {
  return (
    <section className="inbox-terminal-layout" aria-label="On going actions">
      <OnGoingActionsListPane controller={controller} />
      <OnGoingActionDetailPane controller={controller} />
    </section>
  );
}

/**
 * Renders on going actions with ordering, and editing keybindings.
 *
 * @example <OnGoingNextActionsPage controller={controller} />
 */
export function OnGoingNextActionsPage({ controller, selectNextAction }: OnGoingNextActionsPageProps) {
  const [isAttrsOpen, setIsAttrsOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const openAttrs = useCallback(() => setIsAttrsOpen(true), []);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  useKeybindScreen("ongoing-next-actions");
  useOnGoingActionZone(controller);
  useOnGoingActionAssetPreload(controller);
  useOnGoingActionBindings(controller, selectNextAction, openAttrs, openLink, openAsset, isAttrsOpen);

  return (
    <ListWorkspace theme={onGoingNextActionsListTheme} currentClassName="list-workspace__current--next-actions" currentLabel={<OnGoingActionsFooterLabel controller={controller} />} modeLabel={controller.vimMode ?? undefined}>
      <OnGoingActionPanes controller={controller} />
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
      </Suspense>
      {isAttrsOpen && controller.selectedItem ? <NextActionEditDialog item={controller.selectedItem} onSave={(patch) => saveAttributes(controller, patch, () => setIsAttrsOpen(false))} onClose={() => setIsAttrsOpen(false)} /> : null}
    </ListWorkspace>
  );
}

function OnGoingActionsFooterLabel({ controller }: OnGoingControllerProps) {
  return (
    <span className="next-actions-footer-label">
      <span>On Going Actions</span>
      <span>Order: {orderLabel(controller)}</span>
    </span>
  );
}

async function saveAttributes(controller: OnGoingNextActionsWorkspaceController, patch: NextActionPatch, close: () => void) {
  await controller.patchSelected(patch);
  close();
}
