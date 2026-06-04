import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { CalendarList } from "../features/calendar/CalendarList";
import type { OnGoingCalendarsWorkspaceController } from "../features/calendar/useOnGoingCalendarsWorkspaceController";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { ItemBody, Stuff } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { onGoingNextActionsListTheme } from "../features/lists/listThemes";
import { NextActionEditDialog } from "../features/next-actions/NextActionEditDialog";
import { NextActionsList } from "../features/next-actions/NextActionsList";
import type { NextActionPatch } from "../features/next-actions/types";
import type { OnGoingNextActionsWorkspaceController } from "../features/next-actions/useOnGoingNextActionsWorkspaceController";
import {
  activeOnGoingSelection,
  actionLabelForOnGoingSelection,
  listZoneForOnGoingPanel,
  type OnGoingItemSelection,
  type OnGoingPanelId
} from "../features/ongoing/combinedOnGoingState";

type OnGoingNextActionsPageProps = {
  calendarController: OnGoingCalendarsWorkspaceController;
  controller: OnGoingNextActionsWorkspaceController;
  selectNextAction: (id: string | null) => void;
};

type ControllerProps = {
  calendarController: OnGoingCalendarsWorkspaceController;
  controller: OnGoingNextActionsWorkspaceController;
  activePanel: OnGoingPanelId;
};

type EditableController = {
  activeZone: FocusZoneId;
  autosaveBody: (body: ItemBody) => Promise<void>;
  cancelBodyEdit: () => void;
  commitBody: (body: ItemBody) => Promise<void>;
  commitTitle: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  editingBodyId: string | null;
  editingId: string | null;
  editingTitle: string;
  errorMessage: string | null;
  isDeleting: boolean;
  isLoading: boolean;
  isUpdating: boolean;
  markAsDone: () => Promise<void>;
  reload: () => void;
  restoreSelected: () => Promise<void>;
  selectNext: () => void;
  selectPrevious: () => void;
  selectedIndex: number;
  selectedItem: Stuff | null;
  setActiveZone: (zone: FocusZoneId) => void;
  setEditingTitle: (title: string) => void;
  setSelectedId: (id: string | null) => void;
  setVimMode: (mode: "NORMAL" | "INSERT" | "VISUAL" | null) => void;
  startBodyEdit: () => void;
  startTitleEdit: () => void;
  stuffs: Stuff[];
  vimMode: "NORMAL" | "INSERT" | "VISUAL" | null;
};

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

function controllerForPanel(props: ControllerProps): EditableController {
  return props.activePanel === "calendars" ? props.calendarController : props.controller;
}

function activeSelection(props: ControllerProps): OnGoingItemSelection | null {
  return activeOnGoingSelection(props.activePanel, props.controller.selectedItem, props.calendarController.selectedItem);
}

function canRun(controller: EditableController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating;
}

function canEdit(controller: EditableController): boolean {
  return canRun(controller) && !controller.editingId && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function runAsync(canRunAction: boolean, action: () => Promise<void>, message: string) {
  if (canRunAction) void action().catch((error: unknown) => console.error(message, error));
}

function focusPanel(panel: OnGoingPanelId, setActivePanel: (panel: OnGoingPanelId) => void, controller: EditableController) {
  setActivePanel(panel);
  controller.setActiveZone(listZoneForOnGoingPanel(panel));
}

function moveSelection(controller: EditableController, direction: "next" | "previous") {
  if (controller.editingId || controller.editingBodyId) return;
  direction === "next" ? controller.selectNext() : controller.selectPrevious();
}

function openDetailScreen(selection: OnGoingItemSelection | null, setActiveScreen: (screen: ScreenId) => void) {
  if (selection?.type === "next-action") setActiveScreen("ongoing-next-action-detail-page");
  if (selection?.type === "calendar") setActiveScreen("ongoing-calendar-detail-page");
}

async function markAsDone(props: ControllerProps, setActiveScreen: (screen: ScreenId) => void): Promise<void> {
  const activeController = controllerForPanel(props);
  const shouldLeave = props.activePanel === "next-actions" && activeController.stuffs.length <= 1;
  await activeController.markAsDone();
  if (shouldLeave && props.calendarController.stuffs.length === 0) setActiveScreen("next-actions");
}

async function restoreSelected(props: ControllerProps, selectNextAction: (id: string | null) => void, setActiveScreen: (screen: ScreenId) => void): Promise<void> {
  const selection = activeSelection(props);
  if (!selection) return;
  await controllerForPanel(props).restoreSelected();
  if (selection.type === "next-action") openRestoredNextAction(selection.item.id, selectNextAction, setActiveScreen);
}

function openRestoredNextAction(id: string, selectNextAction: (id: string | null) => void, setActiveScreen: (screen: ScreenId) => void) {
  selectNextAction(id);
  setActiveScreen("next-actions");
}

function zonesForBindings(): FocusZoneId[] {
  return ["next-actions-list", "ongoing-calendars-list"];
}

function panelFocusBindings(setActivePanel: (panel: OnGoingPanelId) => void, controller: EditableController): KeybindDefinition[] {
  return zonesForBindings().flatMap((zone) => [
    onGoingBinding(`ongoing.focus-next-actions.${zone}`, "1", "Focus on going next actions", zone, () => focusPanel("next-actions", setActivePanel, controller)),
    onGoingBinding(`ongoing.focus-calendars.${zone}`, "2", "Focus on going calendars", zone, () => focusPanel("calendars", setActivePanel, controller))
  ]);
}

function actionBindings(props: ControllerProps, setActiveScreen: (screen: ScreenId) => void, selectNextAction: (id: string | null) => void): KeybindDefinition[] {
  return zonesForBindings().flatMap((zone) => bindingsForZone(props, setActiveScreen, selectNextAction, zone));
}

function bindingsForZone(props: ControllerProps, setActiveScreen: (screen: ScreenId) => void, selectNextAction: (id: string | null) => void, zone: FocusZoneId): KeybindDefinition[] {
  const activeController = controllerForPanel(props);
  const selection = activeSelection(props);
  const editable = canEdit(activeController);
  const deleteLabel = selection ? actionLabelForOnGoingSelection("delete", selection) : "Delete selected on going item";
  const doneLabel = selection ? actionLabelForOnGoingSelection("done", selection) : "Mark as done";
  const restoreLabel = selection ? actionLabelForOnGoingSelection("restore", selection) : "Reset status for selected on going item";

  return [
    onGoingBinding(`ongoing.delete.${zone}`, "d", deleteLabel, zone, () => runAsync(editable, activeController.deleteSelected, "Failed to delete on going item")),
    onGoingBinding(`ongoing.done.${zone}`, "x", doneLabel, zone, () => runAsync(editable, () => markAsDone(props, setActiveScreen), "Failed to mark on going item as done")),
    onGoingBinding(`ongoing.restore.${zone}`, "r", restoreLabel, zone, () => runAsync(editable, () => restoreSelected(props, selectNextAction, setActiveScreen), "Failed to restore on going item")),
    onGoingBinding(`ongoing.move-down.${zone}`, "j", "Move down", zone, () => moveSelection(activeController, "next")),
    onGoingBinding(`ongoing.move-up.${zone}`, "k", "Move up", zone, () => moveSelection(activeController, "previous")),
    onGoingBinding(`ongoing.edit-body.${zone}`, "l", "Edit selected body", zone, () => editable && activeController.startBodyEdit())
  ];
}

function nextActionOnlyBindings(props: ControllerProps, openAttrs: () => void, isAttrsOpen: boolean): KeybindDefinition[] {
  const controller = props.controller;
  return [
    onGoingBinding("ongoing.edit-title", "Enter", "Edit selected title", "next-actions-list", () => !isAttrsOpen && canEdit(controller) && controller.startTitleEdit()),
    onGoingBinding("ongoing.attrs", "e", "Edit attributes", "next-actions-list", () => canEdit(controller) && openAttrs()),
    onGoingBinding("ongoing.order", "o", "Cycle ordering", "next-actions-list", controller.toggleOrder),
    onGoingBinding("ongoing.undo", "u", "Undo last deletion", "next-actions-list", () => void controller.undo()),
    { ...onGoingBinding("ongoing.redo", "r", "Redo last action", "next-actions-list", () => void controller.redo()), ctrl: true }
  ];
}

function detailBindings(props: ControllerProps, setActiveScreen: (screen: ScreenId) => void, openLink: () => void, openAsset: () => void): KeybindDefinition[] {
  const activeController = controllerForPanel(props);
  return [
    { ...onGoingBinding("ongoing.focus-active-panel", "h", "Focus active on going panel", "next-action-detail", () => activeController.setActiveZone(listZoneForOnGoingPanel(props.activePanel))), ctrl: true },
    onGoingBinding("ongoing.open-next-action-detail", "Enter", "Open full detail", listZoneForOnGoingPanel(props.activePanel), () => openDetailScreen(activeSelection(props), setActiveScreen), true, ["Enter"]),
    onGoingBinding("ongoing.which-key-list", "k", "Show available keybinds", listZoneForOnGoingPanel(props.activePanel), () => undefined, true),
    onGoingBinding("ongoing.which-key-detail", "k", "Show available keybinds", "next-action-detail", () => undefined, true),
    ...buildFormattingBindings("ongoing-next-actions", openLink, openAsset, "next-action-detail")
  ];
}

function useOnGoingBindings(props: ControllerProps, selectNextAction: (id: string | null) => void, openAttrs: () => void, openLink: () => void, openAsset: () => void, isAttrsOpen: boolean, setActivePanel: (panel: OnGoingPanelId) => void) {
  const { setActiveScreen } = useActiveScreen();
  const activeController = controllerForPanel(props);
  const bindings = useMemo(() => [
    ...panelFocusBindings(setActivePanel, activeController),
    ...actionBindings(props, setActiveScreen, selectNextAction),
    ...nextActionOnlyBindings(props, openAttrs, isAttrsOpen),
    ...detailBindings(props, setActiveScreen, openLink, openAsset)
  ], [props, setActiveScreen, selectNextAction, openAttrs, openLink, openAsset, isAttrsOpen, setActivePanel, activeController]);
  useRegisterKeybinds(bindings);
}

function useOnGoingZone(props: ControllerProps) {
  useEffect(() => {
    const validZones = [...zonesForBindings(), "next-action-detail"];
    if (!validZones.includes(props.controller.activeZone)) {
      props.controller.setActiveZone(listZoneForOnGoingPanel(props.activePanel));
    }
  }, [props.activePanel, props.controller.activeZone, props.controller.setActiveZone]);
}

function useActiveAssetPreload(props: ControllerProps) {
  const activeController = controllerForPanel(props);
  useEffect(() => {
    if (activeController.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(activeController.stuffs, activeController.selectedIndex);
  }, [activeController.selectedIndex, activeController.stuffs]);
}

function commitTitle(controller: EditableController, label: string) {
  void controller.commitTitle().catch((error: unknown) => console.error(`Failed to update ${label} title`, error));
}

function OnGoingNextActionsPanel({ controller }: Pick<ControllerProps, "controller">) {
  const count = controller.stuffs.length;
  return (
    <ListView title="On Going Next Actions" meta={`${count} ${count === 1 ? "item" : "items"}`} panelIndex={1} active={controller.activeZone === "next-actions-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <OnGoingNextActionsBody controller={controller} />
    </ListView>
  );
}

function OnGoingNextActionsBody({ controller }: Pick<ControllerProps, "controller">) {
  if (controller.isLoading) return <p className="pane-state">Loading on going next actions...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.stuffs.length === 0) return <p className="pane-state">No on going next actions.</p>;
  return <NextActionsListReady controller={controller} />;
}

function NextActionsListReady({ controller }: Pick<ControllerProps, "controller">) {
  return (
    <NextActionsList
      items={controller.stuffs}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={controller.editingId}
      editingTitle={controller.editingTitle}
      onSelect={controller.setSelectedId}
      onEditingTitleChange={controller.setEditingTitle}
      onStartEditing={controller.startTitleEdit}
      onCommitEditing={() => commitTitle(controller, "next action")}
      onCommitEditingAndContinue={() => commitTitle(controller, "next action")}
      onCancelEditing={controller.cancelTitleEdit}
    />
  );
}

function OnGoingCalendarsPanel({ calendarController }: Pick<ControllerProps, "calendarController">) {
  const count = calendarController.stuffs.length;
  return (
    <ListView title="On Going Calendars" meta={`${count} ${count === 1 ? "item" : "items"}`} panelIndex={2} active={calendarController.activeZone === "ongoing-calendars-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <OnGoingCalendarsBody calendarController={calendarController} />
    </ListView>
  );
}

function OnGoingCalendarsBody({ calendarController }: Pick<ControllerProps, "calendarController">) {
  if (calendarController.isLoading) return <p className="pane-state">Loading on going calendars...</p>;
  if (calendarController.errorMessage) return <RetryState message={calendarController.errorMessage} onRetry={calendarController.reload} />;
  if (calendarController.stuffs.length === 0) return <p className="pane-state">No on going calendars.</p>;
  return <CalendarListReady calendarController={calendarController} />;
}

function CalendarListReady({ calendarController }: Pick<ControllerProps, "calendarController">) {
  return (
    <CalendarList
      items={calendarController.stuffs}
      selectedId={calendarController.selectedItem?.id ?? ""}
      editingId={calendarController.editingId}
      editingTitle={calendarController.editingTitle}
      onSelect={calendarController.setSelectedId}
      onEditingTitleChange={calendarController.setEditingTitle}
      onStartEditing={calendarController.startTitleEdit}
      onCommitEditing={() => commitTitle(calendarController, "calendar")}
      onCommitEditingAndContinue={() => commitTitle(calendarController, "calendar")}
      onCancelEditing={calendarController.cancelTitleEdit}
    />
  );
}

function OnGoingDetailView(props: ControllerProps) {
  const active = props.controller.activeZone === "next-action-detail";
  return (
    <ListView title="On Going Detail" active={active} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <OnGoingDetailBody {...props} />
    </ListView>
  );
}

function OnGoingDetailBody(props: ControllerProps) {
  const activeController = controllerForPanel(props);
  if (activeController.isLoading) return <p className="pane-state">Loading on going details...</p>;
  if (activeController.errorMessage) return <p className="pane-state">On going details are unavailable while loading fails.</p>;
  return <OnGoingDetailReady {...props} />;
}

function OnGoingDetailReady(props: ControllerProps) {
  const selection = activeSelection(props);
  const activeController = controllerForPanel(props);
  if (!selection) return <p className="pane-state">Select an on going item to inspect its details.</p>;
  return (
    <InboxStuffDetails
      item={selection.item}
      showCreatedMeta={false}
      metaVariant={selection.type === "calendar" ? "calendar" : "next-action"}
      editing={activeController.editingBodyId === selection.item.id}
      onAutosaveEditing={(body) => activeController.autosaveBody(body)}
      onCommitEditing={(body) => activeController.commitBody(body)}
      onExitEditingFromNormalMode={(body) => exitBodyEditing(activeController, props.activePanel, body)}
      onCancelEditing={activeController.cancelBodyEdit}
      onVimModeChange={activeController.setVimMode}
    />
  );
}

async function exitBodyEditing(controller: EditableController, panel: OnGoingPanelId, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone(listZoneForOnGoingPanel(panel));
}

function OnGoingViews(props: ControllerProps) {
  return (
    <section className="ongoing-terminal-layout" aria-label="On going work">
      <OnGoingNextActionsPanel controller={props.controller} />
      <OnGoingCalendarsPanel calendarController={props.calendarController} />
      <OnGoingDetailView {...props} />
    </section>
  );
}

/**
 * Renders on going next actions and calendars as independent panels.
 *
 * @example <OnGoingNextActionsPage controller={actions} calendarController={calendars} />
 */
export function OnGoingNextActionsPage({ controller, calendarController, selectNextAction }: OnGoingNextActionsPageProps) {
  const [activePanel, setActivePanel] = useState<OnGoingPanelId>("next-actions");
  const dialogState = useOnGoingDialogState();
  const props = { activePanel, calendarController, controller };
  useOnGoingPageEffects(props, selectNextAction, dialogState, setActivePanel);
  return <OnGoingWorkspace props={props} dialogState={dialogState} />;
}

type OnGoingDialogState = ReturnType<typeof useOnGoingDialogState>;

function useOnGoingDialogState() {
  const [isAttrsOpen, setIsAttrsOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const openAttrs = useCallback(() => setIsAttrsOpen(true), []);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  return { isAssetOpen, isAttrsOpen, isLinkOpen, openAsset, openAttrs, openLink, setIsAssetOpen, setIsAttrsOpen, setIsLinkOpen };
}

function useOnGoingPageEffects(props: ControllerProps, selectNextAction: (id: string | null) => void, dialogs: OnGoingDialogState, setActivePanel: (panel: OnGoingPanelId) => void) {
  useKeybindScreen("ongoing-next-actions");
  useOnGoingZone(props);
  useActiveAssetPreload(props);
  useOnGoingBindings(props, selectNextAction, dialogs.openAttrs, dialogs.openLink, dialogs.openAsset, dialogs.isAttrsOpen, setActivePanel);
}

function OnGoingWorkspace({ props, dialogState }: { props: ControllerProps; dialogState: OnGoingDialogState }) {
  return (
    <ListWorkspace theme={onGoingNextActionsListTheme} currentClassName="list-workspace__current--next-actions" currentLabel={<OnGoingFooterLabel {...props} />} modeLabel={props.controller.vimMode ?? props.calendarController.vimMode ?? undefined}>
      <OnGoingViews {...props} />
      <LeaderMenu />
      <OnGoingDialogs
        props={props}
        isAttrsOpen={dialogState.isAttrsOpen}
        isLinkOpen={dialogState.isLinkOpen}
        isAssetOpen={dialogState.isAssetOpen}
        setIsAttrsOpen={dialogState.setIsAttrsOpen}
        setIsLinkOpen={dialogState.setIsLinkOpen}
        setIsAssetOpen={dialogState.setIsAssetOpen}
      />
    </ListWorkspace>
  );
}

type OnGoingDialogsProps = {
  isAssetOpen: boolean;
  isAttrsOpen: boolean;
  isLinkOpen: boolean;
  props: ControllerProps;
  setIsAssetOpen: (open: boolean) => void;
  setIsAttrsOpen: (open: boolean) => void;
  setIsLinkOpen: (open: boolean) => void;
};

function OnGoingDialogs({ props, isAttrsOpen, isLinkOpen, isAssetOpen, setIsAttrsOpen, setIsLinkOpen, setIsAssetOpen }: OnGoingDialogsProps) {
  const selected = activeSelection(props);
  return (
    <>
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && selected ? <LazyMarkdownAssetComboDialog itemId={selected.item.id} onClose={() => setIsAssetOpen(false)} /> : null}
      </Suspense>
      {isAttrsOpen && props.controller.selectedItem ? <NextActionEditDialog item={props.controller.selectedItem} onSave={(patch) => saveAttributes(props.controller, patch, () => setIsAttrsOpen(false))} onClose={() => setIsAttrsOpen(false)} /> : null}
    </>
  );
}

function OnGoingFooterLabel(props: ControllerProps) {
  return (
    <span className="next-actions-footer-label">
      <span>On Going</span>
      <span>Panel: {props.activePanel === "calendars" ? "Calendars" : "Next Actions"}</span>
    </span>
  );
}

async function saveAttributes(controller: OnGoingNextActionsWorkspaceController, patch: NextActionPatch, close: () => void) {
  await controller.patchSelected(patch);
  close();
}
