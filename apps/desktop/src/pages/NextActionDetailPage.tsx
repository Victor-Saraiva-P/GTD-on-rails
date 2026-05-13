import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { nextActionDetailListTheme } from "../features/lists/listThemes";
import type { NextActionsWorkspaceController } from "../features/next-actions/useNextActionsWorkspaceController";

type NextActionDetailPageProps = {
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

function nextActionDetailBinding(id: string, key: string, description: string, runKeybind: () => void, leader = false): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "next-action-detail-page", zone: "next-action-detail" };
}

function canEditBody(controller: NextActionsWorkspaceController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function editBodyFromKeybind(controller: NextActionsWorkspaceController) {
  if (canEditBody(controller)) {
    controller.startBodyEdit();
  }
}

function backToNextActionsFromKeybind(controller: NextActionsWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (!controller.editingBodyId) {
    controller.setActiveZone("next-actions-list");
    setActiveScreen("next-actions");
  }
}

function buildDetailBindings(
  controller: NextActionsWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  openLinkCombo: () => void,
  openAssetCombo: () => void
) {
  return [
    nextActionDetailBinding("next-action-detail-page.edit-body", "Enter", "Edit selected body", () => editBodyFromKeybind(controller)),
    nextActionDetailBinding("next-action-detail-page.back", "Escape", "Back to next actions", () => backToNextActionsFromKeybind(controller, setActiveScreen)),
    nextActionDetailBinding("next-action-detail-page.which-key", "k", "Show available keybinds", () => undefined, true),
    ...buildFormattingBindings("next-action-detail-page", openLinkCombo, openAssetCombo, "next-action-detail")
  ];
}

function useDetailBindings(controller: NextActionsWorkspaceController, openLinkCombo: () => void, openAssetCombo: () => void) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildDetailBindings(controller, setActiveScreen, openLinkCombo, openAssetCombo), [controller, setActiveScreen, openLinkCombo, openAssetCombo]);

  useRegisterKeybinds(bindings);
}

function useDetailZone(controller: NextActionsWorkspaceController) {
  useEffect(() => {
    controller.setActiveZone("next-action-detail");
    if (!controller.editingBodyId && controller.selectedItem) {
      controller.startBodyEdit();
    }
  }, [controller.setActiveZone, controller.editingBodyId, controller.selectedItem, controller.startBodyEdit]);
}

async function exitBodyEditingToNextActions(
  controller: NextActionsWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  body: ItemBody
): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone("next-actions-list");
  setActiveScreen("next-actions");
}

type DetailReadyProps = NextActionDetailPageProps & {
  setActiveScreen: (screen: ScreenId) => void;
};

function DetailReady({ controller, setActiveScreen }: DetailReadyProps) {
  const item = controller.selectedItem;

  return item ? (
    <InboxStuffDetails
      item={item}
      showCreatedMeta={false}
      metaVariant="next-action"
      editing={controller.editingBodyId === item.id}
      onAutosaveEditing={(body) => controller.autosaveBody(body)}
      onCommitEditing={(body) => controller.commitBody(body)}
      onExitEditingFromNormalMode={(body) => exitBodyEditingToNextActions(controller, setActiveScreen, body)}
      onCancelEditing={controller.cancelBodyEdit}
      onVimModeChange={controller.setVimMode}
    />
  ) : null;
}

function DetailBody({ controller, setActiveScreen }: DetailReadyProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading details...</p>;
  }

  if (controller.errorMessage) {
    return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  }

  return controller.selectedItem ? (
    <DetailReady controller={controller} setActiveScreen={setActiveScreen} />
  ) : (
    <p className="pane-state">Select a next action to inspect its details.</p>
  );
}

function DetailPane({ controller, setActiveScreen }: DetailReadyProps) {
  return (
    <ListPane title="Next Action Detail" active bodyClassName="list-pane__body--detail">
      <DetailBody controller={controller} setActiveScreen={setActiveScreen} />
    </ListPane>
  );
}

/**
 * Renders the focused next-action-detail screen and its detail keybindings.
 *
 * @example <NextActionDetailPage controller={controller} />
 */
export function NextActionDetailPage({ controller }: NextActionDetailPageProps) {
  const [isLinkComboOpen, setIsLinkComboOpen] = useState(false);
  const [isAssetComboOpen, setIsAssetComboOpen] = useState(false);
  const openLinkCombo = useCallback(() => setIsLinkComboOpen(true), []);
  const openAssetCombo = useCallback(() => setIsAssetComboOpen(true), []);
  const { setActiveScreen } = useActiveScreen();
  useKeybindScreen("next-action-detail-page");
  useDetailZone(controller);
  useDetailBindings(controller, openLinkCombo, openAssetCombo);

  return (
    <ListWorkspace theme={nextActionDetailListTheme} currentLabel={nextActionDetailListTheme.label} modeLabel={controller.vimMode ?? undefined}>
      <section className="stuff-detail-layout" aria-label="Next action detail">
        <DetailPane controller={controller} setActiveScreen={setActiveScreen} />
      </section>
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkComboOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkComboOpen(false)} /> : null}
        {isAssetComboOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetComboOpen(false)} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}