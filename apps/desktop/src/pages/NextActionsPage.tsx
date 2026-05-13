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
import type { NextActionPatch } from "../features/next-actions/types";
import type { NextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";

type NextActionsPageProps = {
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

function buildNextActionBindings(
  controller: NextActionsWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  openContext: () => void,
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
    nextActionBinding("next-actions.attrs-list", "e", "Edit next action attributes", "next-actions-list", () => canEditSelected(controller) && openAttrs()),
    nextActionBinding("next-actions.attrs-detail", "e", "Edit next action attributes", "next-action-detail", () => canEditSelected(controller) && openAttrs()),
    nextActionBinding("next-actions.ongoing-list", "o", "Mark as on going", "next-actions-list", () => runAsync(canEditSelected(controller), controller.markAsOnGoing, "Failed to mark as on going")),
    nextActionBinding("next-actions.ongoing-detail", "o", "Mark as on going", "next-action-detail", () => runAsync(canEditSelected(controller), controller.markAsOnGoing, "Failed to mark as on going")),
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

function useNextActionBindings(controller: NextActionsWorkspaceController, openContext: () => void, openAttrs: () => void, openLink: () => void, openAsset: () => void, isAttrsOpen: boolean) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildNextActionBindings(controller, setActiveScreen, openContext, openAttrs, openLink, openAsset, isAttrsOpen), [controller, setActiveScreen, openContext, openAttrs, openLink, openAsset, isAttrsOpen]);
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
  return controller.orderBy === "time" ? "estimated time" : "energy";
}

function ContextFilterLabel({ controller }: NextActionsPageProps) {
  return controller.context ? <ContextNameWithIcon context={controller.context} /> : <>all contexts</>;
}

function NextActionsListBody({ controller }: NextActionsPageProps) {
  if (controller.isLoading) return <p className="pane-state">Loading next actions...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (controller.stuffs.length === 0) return <p className="pane-state">No next actions for this filter.</p>;
  return <NextActionsListReady controller={controller} />;
}

function NextActionsListReady({ controller }: NextActionsPageProps) {
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

function NextActionDetailBody({ controller }: NextActionsPageProps) {
  if (controller.isLoading) return <p className="pane-state">Loading next action details...</p>;
  if (controller.errorMessage) return <p className="pane-state">Next action details are unavailable while loading fails.</p>;
  if (!controller.selectedItem) return <p className="pane-state">Select a next action to inspect its details.</p>;
  return <NextActionDetailReady controller={controller} />;
}

function NextActionDetailReady({ controller }: NextActionsPageProps) {
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

function NextActionsListPane({ controller }: NextActionsPageProps) {
  const count = controller.stuffs.length;
  const meta = `${count} ${count === 1 ? "item" : "items"}`;

  return (
    <ListPane title="Next Actions" meta={meta} panelIndex={1} active={controller.activeZone === "next-actions-list"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <NextActionsListBody controller={controller} />
    </ListPane>
  );
}

function NextActionDetailPane({ controller }: NextActionsPageProps) {
  return (
    <ListPane title="Next Action Detail" panelIndex={2} active={controller.activeZone === "next-action-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <NextActionDetailBody controller={controller} />
    </ListPane>
  );
}

function NextActionPanes({ controller }: NextActionsPageProps) {
  return (
    <section className="inbox-terminal-layout" aria-label="Next actions">
      <NextActionsListPane controller={controller} />
      <NextActionDetailPane controller={controller} />
    </section>
  );
}

/**
 * Renders next actions with context filtering, ordering, and editing keybindings.
 *
 * @example <NextActionsPage controller={controller} />
 */
export function NextActionsPage({ controller }: NextActionsPageProps) {
  const contextsQuery = useContextsQuery();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isAttrsOpen, setIsAttrsOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const openContext = useCallback(() => !isAttrsOpen && setIsContextOpen(true), [isAttrsOpen]);
  const openAttrs = useCallback(() => setIsAttrsOpen(true), []);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  useKeybindScreen("next-actions");
  useNextActionZone(controller);
  useNextActionAssetPreload(controller);
  useNextActionBindings(controller, openContext, openAttrs, openLink, openAsset, isAttrsOpen);

  return (
    <ListWorkspace theme={nextActionsListTheme} currentClassName="list-workspace__current--next-actions" currentLabel={<NextActionsFooterLabel controller={controller} />} modeLabel={controller.vimMode ?? undefined}>
      <NextActionPanes controller={controller} />
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
      </Suspense>
      {isContextOpen ? <ContextFilterDialog contexts={contextsQuery.contexts} currentContextId={controller.context?.id ?? null} isLoading={contextsQuery.isLoading} errorMessage={contextsQuery.errorMessage} onRetry={contextsQuery.reload} onSelect={(context) => { controller.setContext(context); setIsContextOpen(false); }} onClose={() => setIsContextOpen(false)} /> : null}
      {isAttrsOpen && controller.selectedItem ? <NextActionEditDialog item={controller.selectedItem} onSave={(patch) => saveAttributes(controller, patch, () => setIsAttrsOpen(false))} onClose={() => setIsAttrsOpen(false)} /> : null}
    </ListWorkspace>
  );
}

function NextActionsFooterLabel({ controller }: NextActionsPageProps) {
  return (
    <span className="next-actions-footer-label">
      <span>Next Actions</span>
      <span>Order: {orderLabel(controller)}</span>
      <span className="next-actions-footer-label__context">Context: <ContextFilterLabel controller={controller} /></span>
    </span>
  );
}

async function saveAttributes(controller: NextActionsWorkspaceController, patch: NextActionPatch, close: () => void) {
  await controller.patchSelected(patch);
  close();
}
