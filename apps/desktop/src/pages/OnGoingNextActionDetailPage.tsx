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
import type { OnGoingWorkspaceController } from "../features/ongoing/useOnGoingWorkspaceController";

type OnGoingNextActionDetailPageProps = Readonly<{
  controller: OnGoingWorkspaceController;
}>;

type DetailReadyProps = Readonly<{
  controller: OnGoingWorkspaceController;
  setActiveScreen: (screen: ScreenId) => void;
}>;

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

function backToOnGoingActions(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (controller.editingBodyId) return;
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function buildDetailBindings(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openLink: () => void, openAsset: () => void) {
  return [
    ongoingDetailBinding("ongoing-next-action-detail-page.back", "Escape", "Back to on going actions", () => backToOnGoingActions(controller, setActiveScreen)),
    ongoingDetailBinding("ongoing-next-action-detail-page.which-key", "k", "Show available keybinds", () => undefined, true),
    ...buildFormattingBindings("ongoing-next-action-detail-page", openLink, openAsset, "next-action-detail")
  ];
}

function useDetailBindings(controller: OnGoingWorkspaceController, openLink: () => void, openAsset: () => void) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildDetailBindings(controller, setActiveScreen, openLink, openAsset), [controller, setActiveScreen, openLink, openAsset]);
  useRegisterKeybinds(bindings);
}

function useDetailZone(controller: OnGoingWorkspaceController) {
  useEffect(() => {
    controller.setActiveZone("next-action-detail");
    if (!controller.editingBodyId && controller.selectedItem) controller.startBodyEdit();
  }, [controller.setActiveZone, controller.editingBodyId, controller.selectedItem, controller.startBodyEdit]);
}

async function exitBodyEditingToOnGoingActions(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function DetailReady({ controller, setActiveScreen }: DetailReadyProps) {
  if (!controller.selectedItem) return null;
  return <InboxStuffDetails item={controller.selectedItem.item} showCreatedMeta={false} metaVariant="next-action" editing={controller.editingBodyId === controller.selectedItem.item.id} onAutosaveEditing={(body) => controller.autosaveBody(body)} onCommitEditing={(body) => controller.commitBody(body)} onExitEditingFromNormalMode={(body) => exitBodyEditingToOnGoingActions(controller, setActiveScreen, body)} onCancelEditing={controller.cancelBodyEdit} onVimModeChange={controller.setVimMode} />;
}

function DetailBody({ controller, setActiveScreen }: DetailReadyProps) {
  if (controller.isLoading) return <p className="pane-state">Loading details...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (!controller.selectedItem) return <p className="pane-state">Select an on going action to inspect its details.</p>;
  return <DetailReady controller={controller} setActiveScreen={setActiveScreen} />;
}

function DetailView({ controller, setActiveScreen }: DetailReadyProps) {
  return <ListView title="On Going Detail" active bodyClassName="list-pane__body--detail"><DetailBody controller={controller} setActiveScreen={setActiveScreen} /></ListView>;
}

/**
 * Renders the focused on-going-action detail screen and keybindings.
 *
 * @example <OnGoingNextActionDetailPage controller={controller} />
 */
export function OnGoingNextActionDetailPage({ controller }: OnGoingNextActionDetailPageProps) {
  const [isLinkComboOpen, setIsLinkComboOpen] = useState(false);
  const [isAssetComboOpen, setIsAssetComboOpen] = useState(false);
  const openLinkCombo = useCallback(() => setIsLinkComboOpen(true), []);
  const openAssetCombo = useCallback(() => setIsAssetComboOpen(true), []);
  const { setActiveScreen } = useActiveScreen();
  useKeybindScreen("ongoing-next-action-detail-page");
  useDetailZone(controller);
  useDetailBindings(controller, openLinkCombo, openAssetCombo);

  return (
    <ListWorkspace theme={onGoingNextActionDetailListTheme} currentLabel={onGoingNextActionDetailListTheme.label} modeLabel={controller.vimMode ?? undefined}>
      <section className="stuff-detail-layout" aria-label="On going action detail">
        <DetailView controller={controller} setActiveScreen={setActiveScreen} />
      </section>
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkComboOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkComboOpen(false)} /> : null}
        {isAssetComboOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.item.id} onClose={() => setIsAssetComboOpen(false)} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}
