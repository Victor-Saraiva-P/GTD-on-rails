import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { ContextNameWithIcon } from "../features/contexts/ContextNameWithIcon";
import { useContextsQuery } from "../features/contexts/useContextsQuery";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { nextActionsListTheme } from "../features/lists/listThemes";
import { ContextFilterDialog } from "../features/next-actions/ContextFilterDialog";
import { NextActionEditDialog } from "../features/next-actions/NextActionEditDialog";
import { NextActionsList } from "../features/next-actions/NextActionsList";
import { ProcessingEnergyStep } from "../features/processing/ProcessingEnergyStep";
import { ProcessingTimeStep } from "../features/processing/ProcessingTimeStep";
import type { NextActionPatch } from "../features/next-actions/types";
import type { NextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";

type NextActionsPageProps = {
  controller: NextActionsWorkspaceController;
  selectOnGoingAction: (id: string | null) => void;
};

type NextActionControllerProps = {
  controller: NextActionsWorkspaceController;
};

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function nextActionBinding(id: string, key: string, description: string, zone: FocusZoneId, runKeybind: () => void, leader = false, sequence?: string[]): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "next-actions", zone, sequence };
}

function canRunAction(controller: NextActionsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating;
}

function canEditSelected(controller: NextActionsWorkspaceController): boolean {
  return canRunAction(controller) && !controller.editingId && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function runAsync(canRun: boolean, action: () => Promise<void>, message: string) {
  if (canRun) void action().catch((error: unknown) => console.error(message, error));
}

function moveSelection(controller: NextActionsWorkspaceController, direction: "next" | "previous") {
  if (!controller.editingId && !controller.editingBodyId) {
    direction === "next" ? controller.selectNext() : controller.selectPrevious();
  }
}

function switchNextActionsView(controller: NextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void, screen: ScreenId) {
  if (!controller.editingId && !controller.editingBodyId) {
    setActiveScreen(screen);
  }
}

function openDetailScreen(controller: NextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (controller.selectedItem) {
    setActiveScreen("next-action-detail-page");
  }
}

async function markAsOnGoingAndOpenDetail(
  controller: NextActionsWorkspaceController,
  selectOnGoingAction: (id: string | null) => void,
  setActiveScreen: (screen: ScreenId) => void
): Promise<void> {
  const selectedId = controller.selectedItem?.id;
  if (!selectedId) return;
  await controller.markAsOnGoing();
  selectOnGoingAction(selectedId);
  setActiveScreen("ongoing-next-action-detail-page");
}

function buildNextActionBindings(
  controller: NextActionsWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  selectOnGoingAction: (id: string | null) => void,
  openContext: () => void,
  openEnergy: () => void,
  openTime: () => void,
  openAttrs: () => void,
  openLink: () => void,
  openAsset: () => void,
  isAttrsOpen: boolean
) {
  return [
    nextActionBinding("next-actions.switch-forward", "]", "Open completed next actions", "next-actions-list", () => switchNextActionsView(controller, setActiveScreen, "done-next-actions")),
    nextActionBinding("next-actions.switch-forward-detail", "]", "Open completed next actions", "next-action-detail", () => switchNextActionsView(controller, setActiveScreen, "done-next-actions")),
    nextActionBinding("next-actions.switch-back", "[", "Open deleted next actions", "next-actions-list", () => switchNextActionsView(controller, setActiveScreen, "deleted-next-actions")),
    nextActionBinding("next-actions.switch-back-detail", "[", "Open deleted next actions", "next-action-detail", () => switchNextActionsView(controller, setActiveScreen, "deleted-next-actions")),
    nextActionBinding("next-actions.delete-list", "d", "Delete selected next action", "next-actions-list", () => runAsync(canEditSelected(controller), controller.deleteSelected, "Failed to delete next action")),
    nextActionBinding("next-actions.delete-detail", "d", "Delete selected next action", "next-action-detail", () => runAsync(canEditSelected(controller), controller.deleteSelected, "Failed to delete next action")),
    nextActionBinding("next-actions.done-list", "x", "Mark as done", "next-actions-list", () => runAsync(canEditSelected(controller), controller.markAsDone, "Failed to mark as done")),
    nextActionBinding("next-actions.done-detail", "x", "Mark as done", "next-action-detail", () => runAsync(canEditSelected(controller), controller.markAsDone, "Failed to mark as done")),
    nextActionBinding("next-actions.context-list", "c", "Filter by context", "next-actions-list", openContext),
    nextActionBinding("next-actions.context-detail", "c", "Filter by context", "next-action-detail", openContext),
    nextActionBinding("next-actions.energy-list", "e", "Set available energy", "next-actions-list", openEnergy),
    nextActionBinding("next-actions.energy-detail", "e", "Set available energy", "next-action-detail", openEnergy),
    nextActionBinding("next-actions.time-list", "t", "Set available time", "next-actions-list", openTime),
    nextActionBinding("next-actions.time-detail", "t", "Set available time", "next-action-detail", openTime),
    nextActionBinding("next-actions.attrs-list", "E", "Edit next action attributes", "next-actions-list", () => canEditSelected(controller) && openAttrs()),
    nextActionBinding("next-actions.attrs-detail", "E", "Edit next action attributes", "next-action-detail", () => canEditSelected(controller) && openAttrs()),
    nextActionBinding("next-actions.ongoing-list", "o", "Mark as on going", "next-actions-list", () => runAsync(canEditSelected(controller), () => markAsOnGoingAndOpenDetail(controller, selectOnGoingAction, setActiveScreen), "Failed to mark as on going")),
    nextActionBinding("next-actions.ongoing-detail", "o", "Mark as on going", "next-action-detail", () => runAsync(canEditSelected(controller), () => markAsOnGoingAndOpenDetail(controller, selectOnGoingAction, setActiveScreen), "Failed to mark as on going")),
    nextActionBinding("next-actions.order-list", "O", "Cycle ordering", "next-actions-list", controller.toggleOrder),
    nextActionBinding("next-actions.order-detail", "O", "Cycle ordering", "next-action-detail", controller.toggleOrder),
    nextActionBinding("next-actions.undo-list", "u", "Undo last deletion", "next-actions-list", () => void controller.undo()),
    nextActionBinding("next-actions.undo-detail", "u", "Undo last deletion", "next-action-detail", () => void controller.undo()),
    { ...nextActionBinding("next-actions.redo-list", "r", "Redo last action", "next-actions-list", () => void controller.redo()), ctrl: true },
    { ...nextActionBinding("next-actions.redo-detail", "r", "Redo last action", "next-action-detail", () => void controller.redo()), ctrl: true },
    nextActionBinding("next-actions.edit-title", "Enter", "Edit selected title", "next-actions-list", () => !isAttrsOpen && canEditSelected(controller) && controller.startTitleEdit()),
    nextActionBinding("next-actions.move-down", "j", "Move down", "next-actions-list", () => moveSelection(controller, "next")),
    nextActionBinding("next-actions.move-up", "k", "Move up", "next-actions-list", () => moveSelection(controller, "previous")),
    nextActionBinding("next-actions.edit-body-list", "l", "Edit selected body", "next-actions-list", () => canEditSelected(controller) && controller.startBodyEdit()),
    nextActionBinding("next-actions.edit-body-detail", "Enter", "Edit selected body", "next-action-detail", () => !isAttrsOpen && canEditSelected(controller) && controller.startBodyEdit()),
    nextActionBinding("next-actions.open-detail-screen-from-list", "Enter", "Open full detail", "next-actions-list", () => !isAttrsOpen && openDetailScreen(controller, setActiveScreen), true, ["Enter"]),
    nextActionBinding("next-actions.open-detail-screen-from-detail", "Enter", "Open full detail", "next-action-detail", () => !isAttrsOpen && openDetailScreen(controller, setActiveScreen), true, ["Enter"]),
    nextActionBinding("next-actions.focus-list", "h", "Focus next actions list", "next-action-detail", () => !controller.editingBodyId && controller.setActiveZone("next-actions-list")),
    nextActionBinding("next-actions.which-key-list", "k", "Show available keybinds", "next-actions-list", () => undefined, true),
    nextActionBinding("next-actions.which-key-detail", "k", "Show available keybinds", "next-action-detail", () => undefined, true),
    ...buildFormattingBindings("next-actions", openLink, openAsset, "next-action-detail")
  ];
}

function useNextActionBindings(controller: NextActionsWorkspaceController, selectOnGoingAction: (id: string | null) => void, openContext: () => void, openEnergy: () => void, openTime: () => void, openAttrs: () => void, openLink: () => void, openAsset: () => void, isAttrsOpen: boolean) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildNextActionBindings(controller, setActiveScreen, selectOnGoingAction, openContext, openEnergy, openTime, openAttrs, openLink, openAsset, isAttrsOpen), [controller, setActiveScreen, selectOnGoingAction, openContext, openEnergy, openTime, openAttrs, openLink, openAsset, isAttrsOpen]);
  useRegisterKeybinds(bindings);
}

function useNextActionZone(controller: NextActionsWorkspaceController) {
  useEffect(() => {
    if (controller.activeZone !== "next-actions-list" && controller.activeZone !== "next-action-detail") {
      controller.setActiveZone(controller.editingBodyId ? "next-action-detail" : "next-actions-list");
    }
  }, [controller.activeZone, controller.editingBodyId, controller.setActiveZone]);
}

function useNextActionAssetPreload(controller: NextActionsWorkspaceController) {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(controller.stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function commitTitle(controller: NextActionsWorkspaceController) {
  void controller.commitTitle().catch((error: unknown) => console.error("Failed to update next action title", error));
}

function orderLabel(controller: NextActionsWorkspaceController): string {
  if (controller.orderBy === "priority") return "priority";
  return controller.orderBy === "time" ? "estimated time" : "energy";
}

function ContextFilterLabel({ controller }: NextActionControllerProps) {
  return controller.context ? <ContextNameWithIcon context={controller.context} /> : <>all contexts</>;
}

function availabilityLabel(controller: NextActionsWorkspaceController): string {
  const time = controller.currentTimeMinutes == null ? "any time" : `${controller.currentTimeMinutes} min`;
  const energy = controller.currentEnergy == null ? "any energy" : controller.currentEnergy.toFixed(1);
  return `${time} / ${energy}`;
}

function NextActionsListBody({ controller }: NextActionControllerProps) {
  if (controller.isLoading) return <p className="pane-state">Loading next actions...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.stuffs.length === 0) return <p className="pane-state">No next actions for this filter.</p>;
  return <NextActionsListReady controller={controller} />;
}

function NextActionsListReady({ controller }: NextActionControllerProps) {
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

function NextActionDetailBody({ controller }: NextActionControllerProps) {
  if (controller.isLoading) return <p className="pane-state">Loading next action details...</p>;
  if (controller.errorMessage) return <p className="pane-state">Next action details are unavailable while loading fails.</p>;
  if (!controller.selectedItem) return <p className="pane-state">Select a next action to inspect its details.</p>;
  return <NextActionDetailReady controller={controller} />;
}

function NextActionDetailReady({ controller }: NextActionControllerProps) {
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

async function exitBodyEditing(controller: NextActionsWorkspaceController, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone("next-actions-list");
}

function NextActionsListPane({ controller }: NextActionControllerProps) {
  const count = controller.stuffs.length;
  const meta = `${count} ${count === 1 ? "item" : "items"}`;

  return (
    <ListPane title="Next Actions" meta={meta} panelIndex={1} active={controller.activeZone === "next-actions-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <NextActionsListBody controller={controller} />
    </ListPane>
  );
}

function NextActionDetailPane({ controller }: NextActionControllerProps) {
  return (
    <ListPane title="Next Action Detail" panelIndex={2} active={controller.activeZone === "next-action-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <NextActionDetailBody controller={controller} />
    </ListPane>
  );
}

function NextActionPanes({ controller }: NextActionControllerProps) {
  return (
    <section className="inbox-terminal-layout" aria-label="Next actions">
      <NextActionsListPane controller={controller} />
      <NextActionDetailPane controller={controller} />
    </section>
  );
}

function currentEnergyDigits(value: number | null): string {
  return value == null ? "" : Math.round(value * 10).toString();
}

function currentTimeDigits(value: number | null): string {
  if (value == null) return "";
  return `${Math.floor(value / 60)}${(value % 60).toString().padStart(2, "0")}`;
}

function EnergyAvailabilityDialog(props: { controller: NextActionsWorkspaceController; onClose: () => void }) {
  const [digits, setDigits] = useState(() => currentEnergyDigits(props.controller.currentEnergy));
  const selectEnergy = (energy: number | null) => {
    props.controller.setCurrentEnergy(energy);
    props.onClose();
  };
  return <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Set available energy"><ProcessingEnergyStep digits={digits} label="Available energy (0.0 - 10.0):" onDigitsChange={setDigits} onEnergySelected={selectEnergy} onBack={props.onClose} /></section>;
}

function TimeAvailabilityDialog(props: { controller: NextActionsWorkspaceController; onClose: () => void }) {
  const [digits, setDigits] = useState(() => currentTimeDigits(props.controller.currentTimeMinutes));
  const selectTime = (minutes: number | null) => {
    props.controller.setCurrentTimeMinutes(minutes);
    props.onClose();
  };
  return <section className="processing-dialog" role="dialog" aria-modal="true" aria-label="Set available time"><ProcessingTimeStep digits={digits} label="Available time (h min):" onDigitsChange={setDigits} onTimeSelected={selectTime} onBack={props.onClose} /></section>;
}

/**
 * Renders next actions with context filtering, ordering, and editing keybindings.
 *
 * @example <NextActionsPage controller={controller} />
 */
export function NextActionsPage({ controller, selectOnGoingAction }: NextActionsPageProps) {
  const contextsQuery = useContextsQuery();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isAttrsOpen, setIsAttrsOpen] = useState(false);
  const [isEnergyOpen, setIsEnergyOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const isPickerOpen = isAttrsOpen || isContextOpen || isEnergyOpen || isTimeOpen;
  const openContext = useCallback(() => !isPickerOpen && setIsContextOpen(true), [isPickerOpen]);
  const openEnergy = useCallback(() => !isPickerOpen && setIsEnergyOpen(true), [isPickerOpen]);
  const openTime = useCallback(() => !isPickerOpen && setIsTimeOpen(true), [isPickerOpen]);
  const openAttrs = useCallback(() => !isPickerOpen && setIsAttrsOpen(true), [isPickerOpen]);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  useKeybindScreen("next-actions");
  useNextActionZone(controller);
  useNextActionAssetPreload(controller);
  useNextActionBindings(controller, selectOnGoingAction, openContext, openEnergy, openTime, openAttrs, openLink, openAsset, isAttrsOpen);

  return (
    <ListWorkspace theme={nextActionsListTheme} currentClassName="list-workspace__current--next-actions" currentLabel={<NextActionsFooterLabel controller={controller} />} modeLabel={controller.vimMode ?? undefined}>
      <NextActionPanes controller={controller} />
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
      </Suspense>
      {isContextOpen ? <ContextFilterDialog contexts={contextsQuery.contexts} currentContextId={controller.context?.id ?? null} isLoading={contextsQuery.isLoading} errorMessage={contextsQuery.errorMessage} onRetry={contextsQuery.reload} onSelect={(context) => { controller.setContext(context); setIsContextOpen(false); }} onClose={() => setIsContextOpen(false)} /> : null}
      {isEnergyOpen ? <EnergyAvailabilityDialog controller={controller} onClose={() => setIsEnergyOpen(false)} /> : null}
      {isTimeOpen ? <TimeAvailabilityDialog controller={controller} onClose={() => setIsTimeOpen(false)} /> : null}
      {isAttrsOpen && controller.selectedItem ? <NextActionEditDialog item={controller.selectedItem} onSave={(patch) => saveAttributes(controller, patch, () => setIsAttrsOpen(false))} onClose={() => setIsAttrsOpen(false)} /> : null}
    </ListWorkspace>
  );
}

function NextActionsFooterLabel({ controller }: NextActionControllerProps) {
  return (
    <span className="next-actions-footer-label">
      <span>Next Actions</span>
      <span>Order: {orderLabel(controller)}</span>
      <span>Availability: {availabilityLabel(controller)}</span>
      <span className="next-actions-footer-label__context">Context: <ContextFilterLabel controller={controller} /></span>
    </span>
  );
}

async function saveAttributes(controller: NextActionsWorkspaceController, patch: NextActionPatch, close: () => void) {
  await controller.patchSelected(patch);
  close();
}
