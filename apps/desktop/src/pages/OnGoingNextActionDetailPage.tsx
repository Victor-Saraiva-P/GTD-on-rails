import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { onGoingNextActionDetailListTheme } from "../features/lists/listThemes";
import type { OnGoingNextActionsWorkspaceController } from "../features/next-actions/useOnGoingNextActionsWorkspaceController";

type OnGoingNextActionDetailPageProps = {
  controller: OnGoingNextActionsWorkspaceController;
  selectNextAction: (id: string | null) => void;
};

type DetailReadyProps = {
  controller: OnGoingNextActionsWorkspaceController;
  setActiveScreen: (screen: ScreenId) => void;
};

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function ongoingDetailBinding(id: string, key: string, description: string, runKeybind: () => void, leader = false): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "ongoing-next-action-detail-page", zone: "next-action-detail" };
}

function canEditBody(controller: OnGoingNextActionsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function editBodyFromKeybind(controller: OnGoingNextActionsWorkspaceController) {
  if (canEditBody(controller)) controller.startBodyEdit();
}

async function restoreAndOpenNextActions(
  controller: OnGoingNextActionsWorkspaceController,
  selectNextAction: (id: string | null) => void,
  setActiveScreen: (screen: ScreenId) => void
): Promise<void> {
  const selectedId = controller.selectedItem?.id;
  if (!selectedId) return;
  await controller.restoreSelected();
  selectNextAction(selectedId);
  setActiveScreen("next-actions");
}

function backToOnGoingActions(controller: OnGoingNextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (controller.editingBodyId) return;
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function buildDetailBindings(controller: OnGoingNextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void, selectNextAction: (id: string | null) => void, openLink: () => void, openAsset: () => void) {
  return [
    ongoingDetailBinding("ongoing-next-action-detail-page.edit-body", "Enter", "Edit selected body", () => editBodyFromKeybind(controller)),
    ongoingDetailBinding("ongoing-next-action-detail-page.back", "Escape", "Back to on going actions", () => backToOnGoingActions(controller, setActiveScreen)),
    ongoingDetailBinding("ongoing-next-action-detail-page.restore", "r", "Reset status to next action", () => void restoreAndOpenNextActions(controller, selectNextAction, setActiveScreen)),
    ongoingDetailBinding("ongoing-next-action-detail-page.which-key", "k", "Show available keybinds", () => undefined, true),
    ...buildFormattingBindings("ongoing-next-action-detail-page", openLink, openAsset, "next-action-detail")
  ];
}

function useDetailBindings(controller: OnGoingNextActionsWorkspaceController, selectNextAction: (id: string | null) => void, openLink: () => void, openAsset: () => void) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildDetailBindings(controller, setActiveScreen, selectNextAction, openLink, openAsset), [controller, setActiveScreen, selectNextAction, openLink, openAsset]);
  useRegisterKeybinds(bindings);
}

function useDetailZone(controller: OnGoingNextActionsWorkspaceController) {
  useEffect(() => {
    controller.setActiveZone("next-action-detail");
    if (!controller.editingBodyId && controller.selectedItem) controller.startBodyEdit();
  }, [controller.setActiveZone, controller.editingBodyId, controller.selectedItem, controller.startBodyEdit]);
}

async function exitBodyEditingToOnGoingActions(controller: OnGoingNextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function DetailReady({ controller, setActiveScreen }: DetailReadyProps) {
  if (!controller.selectedItem) return null;
  return <InboxStuffDetails item={controller.selectedItem} showCreatedMeta={false} metaVariant="next-action" editing={controller.editingBodyId === controller.selectedItem.id} onAutosaveEditing={(body) => controller.autosaveBody(body)} onCommitEditing={(body) => controller.commitBody(body)} onExitEditingFromNormalMode={(body) => exitBodyEditingToOnGoingActions(controller, setActiveScreen, body)} onCancelEditing={controller.cancelBodyEdit} onVimModeChange={controller.setVimMode} />;
}

function DetailBody({ controller, setActiveScreen }: DetailReadyProps) {
  if (controller.isLoading) return <p className="pane-state">Loading details...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (!controller.selectedItem) return <p className="pane-state">Select an on going action to inspect its details.</p>;
  return <DetailReady controller={controller} setActiveScreen={setActiveScreen} />;
}

function DetailView({ controller, setActiveScreen }: DetailReadyProps) {
  return <ListView title="On Going Action Detail" active bodyClassName="list-pane__body--detail"><DetailBody controller={controller} setActiveScreen={setActiveScreen} /></ListView>;
}

/**
 * Renders the focused on-going-action detail screen and keybindings.
 *
 * @example <OnGoingNextActionDetailPage controller={controller} />
 */
export function OnGoingNextActionDetailPage({ controller, selectNextAction }: OnGoingNextActionDetailPageProps) {
  const [isLinkComboOpen, setIsLinkComboOpen] = useState(false);
  const [isAssetComboOpen, setIsAssetComboOpen] = useState(false);
  const openLinkCombo = useCallback(() => setIsLinkComboOpen(true), []);
  const openAssetCombo = useCallback(() => setIsAssetComboOpen(true), []);
  const { setActiveScreen } = useActiveScreen();
  useKeybindScreen("ongoing-next-action-detail-page");
  useDetailZone(controller);
  useDetailBindings(controller, selectNextAction, openLinkCombo, openAssetCombo);

  return (
    <ListWorkspace theme={onGoingNextActionDetailListTheme} currentLabel={onGoingNextActionDetailListTheme.label} modeLabel={controller.vimMode ?? undefined}>
      <section className="stuff-detail-layout" aria-label="On going action detail">
        <DetailView controller={controller} setActiveScreen={setActiveScreen} />
      </section>
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkComboOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkComboOpen(false)} /> : null}
        {isAssetComboOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetComboOpen(false)} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}
