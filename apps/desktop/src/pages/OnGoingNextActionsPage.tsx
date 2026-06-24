import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
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
import type { OnGoingWorkspaceController } from "../features/ongoing/useOnGoingWorkspaceController";
import { OnGoingUnifiedList } from "../features/ongoing/OnGoingUnifiedList";
import type { OnGoingItemSelection } from "../features/ongoing/combinedOnGoingState";

type OnGoingNextActionsPageProps = Readonly<{
  controller: OnGoingWorkspaceController;
  selectNextAction: (id: string | null) => void;
}>;

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function onGoingBinding(id: string, key: string, description: string, zone: FocusZoneId, runKeybind: () => void, leader = false, sequence?: string[]): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "ongoing-next-actions", sequence, zone };
}

function canRun(controller: OnGoingWorkspaceController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating;
}

function canEdit(controller: OnGoingWorkspaceController): boolean {
  return canRun(controller) && !controller.editingId && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function runAsync(canRunAction: boolean, action: () => Promise<void>, message: string) {
  if (canRunAction) void action().catch((error: unknown) => console.error(message, error));
}

function moveSelection(controller: OnGoingWorkspaceController, direction: "next" | "previous") {
  if (controller.editingId || controller.editingBodyId) return;
  direction === "next" ? controller.selectNext() : controller.selectPrevious();
}

function selectBoundary(controller: OnGoingWorkspaceController, boundary: "first" | "last") {
  if (controller.editingId || controller.editingBodyId) return;
  boundary === "first" ? controller.selectFirst() : controller.selectLast();
}

function openDetailScreen(selection: OnGoingItemSelection | null, setActiveScreen: (screen: ScreenId) => void) {
  if (selection?.type === "next-action") setActiveScreen("ongoing-next-action-detail-page");
  if (selection?.type === "calendar") setActiveScreen("ongoing-calendar-detail-page");
}

async function restoreSelected(controller: OnGoingWorkspaceController, selectNextAction: (id: string | null) => void, setActiveScreen: (screen: ScreenId) => void): Promise<void> {
  const selection = controller.selectedItem;
  if (!selection) return;
  await controller.restoreSelected();
  // Per Q4: `r` DOES NOT jump to another screen anymore. We stay on OnGoing page.
}

function actionBindings(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void, selectNextAction: (id: string | null) => void): KeybindDefinition[] {
  const editable = canEdit(controller);
  const zone: FocusZoneId = "next-actions-list"; // We reuse this zone ID for the unified list for simplicity

  return [
    onGoingBinding(`ongoing.delete.${zone}`, "d", "Delete selected on going item", zone, () => runAsync(editable, controller.deleteSelected, "Failed to delete on going item")),
    onGoingBinding(`ongoing.done.${zone}`, "x", "Mark as done", zone, () => runAsync(editable, controller.markAsDone, "Failed to mark on going item as done")),
    onGoingBinding(`ongoing.restore.${zone}`, "r", "Restore status", zone, () => runAsync(editable, () => restoreSelected(controller, selectNextAction, setActiveScreen), "Failed to restore on going item")),
    onGoingBinding(`ongoing.move-first.${zone}`, "g", "Move to first item", zone, () => selectBoundary(controller, "first"), false, ["g", "g"]),
    onGoingBinding(`ongoing.move-last.${zone}`, "G", "Move to last item", zone, () => selectBoundary(controller, "last")),
    onGoingBinding(`ongoing.move-down.${zone}`, "j", "Move down", zone, () => moveSelection(controller, "next")),
    onGoingBinding(`ongoing.move-up.${zone}`, "k", "Move up", zone, () => moveSelection(controller, "previous")),
    onGoingBinding(`ongoing.edit-body.${zone}`, "l", "Edit selected body", zone, () => editable && controller.startBodyEdit()),
    onGoingBinding("ongoing.edit-title", "Enter", "Edit selected title", zone, () => canEdit(controller) && controller.startTitleEdit()),
  ];
}

function detailBindings(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openLink: () => void, openAsset: () => void): KeybindDefinition[] {
  const zone: FocusZoneId = "next-actions-list";
  return [
    { ...onGoingBinding("ongoing.focus-active-panel", "h", "Focus list", "next-action-detail", () => controller.setActiveZone(zone)), ctrl: true },
    onGoingBinding("ongoing.open-detail", "Enter", "Open full detail", zone, () => openDetailScreen(controller.selectedItem, setActiveScreen), true, ["Enter"]),
    onGoingBinding("ongoing.which-key-list", "k", "Show available keybinds", zone, () => undefined, true),
    onGoingBinding("ongoing.which-key-detail", "k", "Show available keybinds", "next-action-detail", () => undefined, true),
    ...buildFormattingBindings("ongoing-next-actions", openLink, openAsset, "next-action-detail")
  ];
}

function useOnGoingBindings(controller: OnGoingWorkspaceController, selectNextAction: (id: string | null) => void, openLink: () => void, openAsset: () => void) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => [
    ...actionBindings(controller, setActiveScreen, selectNextAction),
    ...detailBindings(controller, setActiveScreen, openLink, openAsset)
  ], [setActiveScreen, selectNextAction, openLink, openAsset, controller]);
  useRegisterKeybinds(bindings);
}

function useOnGoingZone(controller: OnGoingWorkspaceController) {
  useEffect(() => {
    const validZones = ["next-actions-list", "next-action-detail"];
    if (!validZones.includes(controller.activeZone)) {
      controller.setActiveZone("next-actions-list");
    }
  }, [controller.activeZone, controller.setActiveZone]);
}

function useActiveAssetPreload(controller: OnGoingWorkspaceController) {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    const stuffs = controller.stuffs.map(s => s.item);
    prefetchNearbyInboxAssets(stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function commitTitle(controller: OnGoingWorkspaceController) {
  void controller.commitTitle().catch((error: unknown) => console.error(`Failed to update title`, error));
}

function OnGoingUnifiedPanel({ controller }: Readonly<{ controller: OnGoingWorkspaceController }>) {
  const count = controller.stuffs.length;
  return (
    <ListView title="On Going" meta={`${count} ${count === 1 ? "item" : "items"}`} panelIndex={1} active={controller.activeZone === "next-actions-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <OnGoingUnifiedBody controller={controller} />
    </ListView>
  );
}

function OnGoingUnifiedBody({ controller }: Readonly<{ controller: OnGoingWorkspaceController }>) {
  if (controller.isLoading) return <p className="pane-state">Loading on going items...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.stuffs.length === 0) return <p className="pane-state">No on going items.</p>;

  return (
    <OnGoingUnifiedList
      items={controller.stuffs}
      editingTitleError={controller.editingTitleError}
      selectedId={controller.selectedItem?.item.id ?? ""}
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

function OnGoingDetailView({ controller }: Readonly<{ controller: OnGoingWorkspaceController }>) {
  const active = controller.activeZone === "next-action-detail";
  return (
    <ListView title="On Going Detail" active={active} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <OnGoingDetailBody controller={controller} />
    </ListView>
  );
}

function OnGoingDetailBody({ controller }: Readonly<{ controller: OnGoingWorkspaceController }>) {
  if (controller.isLoading) return <p className="pane-state">Loading on going details...</p>;
  if (controller.errorMessage) return <p className="pane-state">On going details are unavailable while loading fails.</p>;

  const selection = controller.selectedItem;
  if (!selection) return <p className="pane-state">Select an on going item to inspect its details.</p>;

  return (
    <InboxStuffDetails
      item={selection.item}
      showCreatedMeta={false}
      metaVariant={selection.type === "calendar" ? "calendar" : "next-action"}
      editing={controller.editingBodyId === selection.item.id}
      onAutosaveEditing={(body) => controller.autosaveBody(body)}
      onCommitEditing={(body) => controller.commitBody(body)}
      onExitEditingFromNormalMode={async (body) => {
        await controller.commitBody(body);
        controller.setActiveZone("next-actions-list");
      }}
      onCancelEditing={controller.cancelBodyEdit}
      onVimModeChange={controller.setVimMode}
    />
  );
}

function OnGoingViews({ controller }: Readonly<{ controller: OnGoingWorkspaceController }>) {
  return (
    <section className="ongoing-terminal-layout ongoing-unified-layout" aria-label="On going work">
      <OnGoingUnifiedPanel controller={controller} />
      <OnGoingDetailView controller={controller} />
    </section>
  );
}

export function OnGoingNextActionsPage({ controller, selectNextAction }: OnGoingNextActionsPageProps) {
  const dialogState = useOnGoingDialogState();
  useKeybindScreen("ongoing-next-actions");
  useOnGoingZone(controller);
  useActiveAssetPreload(controller);
  useOnGoingBindings(controller, selectNextAction, dialogState.openLink, dialogState.openAsset);

  return (
    <ListWorkspace theme={onGoingNextActionsListTheme} currentClassName="list-workspace__current--next-actions" currentLabel={<OnGoingFooterLabel />} modeLabel={controller.vimMode ?? undefined}>
      <OnGoingViews controller={controller} />
      <LeaderMenu />
      <OnGoingDialogs controller={controller} dialogState={dialogState} />
    </ListWorkspace>
  );
}

function useOnGoingDialogState() {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  return { isAssetOpen, isLinkOpen, openAsset, openLink, setIsAssetOpen, setIsLinkOpen };
}

function OnGoingDialogs({ controller, dialogState }: Readonly<{ controller: OnGoingWorkspaceController; dialogState: ReturnType<typeof useOnGoingDialogState> }>) {
  const selected = controller.selectedItem;
  return (
    <Suspense fallback={null}>
      {dialogState.isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => dialogState.setIsLinkOpen(false)} /> : null}
      {dialogState.isAssetOpen && selected ? <LazyMarkdownAssetComboDialog itemId={selected.item.id} onClose={() => dialogState.setIsAssetOpen(false)} /> : null}
    </Suspense>
  );
}

function OnGoingFooterLabel() {
  return (
    <span className="next-actions-footer-label">
      <span>On Going</span>
    </span>
  );
}
