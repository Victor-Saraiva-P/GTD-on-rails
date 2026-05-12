import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListPane } from "../components/ListPane";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import type { InboxWorkspaceController } from "../features/inbox/useInboxWorkspaceController";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { stuffDetailListTheme } from "../features/lists/listThemes";

type StuffDetailPageProps = {
  controller: InboxWorkspaceController;
};

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function stuffDetailBinding(id: string, key: string, description: string, runKeybind: () => void, leader = false): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "stuff-detail", zone: "stuff-detail" };
}

function canEditStuffBody(controller: InboxWorkspaceController): boolean {
  return !controller.isLoading && !controller.isCreating && !controller.isDeleting && !controller.isUpdating && !controller.editingBodyId && Boolean(controller.selectedItem);
}

function editStuffBodyFromKeybind(controller: InboxWorkspaceController) {
  if (canEditStuffBody(controller)) {
    controller.startEditingSelectedStuffBody();
  }
}

function backToInboxFromKeybind(controller: InboxWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (!controller.editingBodyId) {
    controller.setActiveZone("inbox-list");
    setActiveScreen("inbox");
  }
}

function buildStuffDetailBindings(
  controller: InboxWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  openLinkCombo: () => void,
  openAssetCombo: () => void
) {
  return [
    stuffDetailBinding("stuff-detail-page.edit-body", "Enter", "Edit selected body", () => editStuffBodyFromKeybind(controller)),
    stuffDetailBinding("stuff-detail-page.back-to-inbox", "Escape", "Back to inbox", () => backToInboxFromKeybind(controller, setActiveScreen)),
    stuffDetailBinding("stuff-detail-page.which-key", "k", "Show available keybinds", () => undefined, true),
    ...buildFormattingBindings("stuff-detail", openLinkCombo, openAssetCombo)
  ];
}

function useStuffDetailBindings(controller: InboxWorkspaceController, openLinkCombo: () => void, openAssetCombo: () => void) {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildStuffDetailBindings(controller, setActiveScreen, openLinkCombo, openAssetCombo), [controller, setActiveScreen, openLinkCombo, openAssetCombo]);

  useRegisterKeybinds(bindings);
}

function useStuffDetailZone(controller: InboxWorkspaceController) {
  useEffect(() => {
    controller.setActiveZone("stuff-detail");
    if (!controller.editingBodyId && controller.selectedItem) {
      controller.startEditingSelectedStuffBody();
    }
  }, [controller.setActiveZone, controller.editingBodyId, controller.selectedItem, controller.startEditingSelectedStuffBody]);
}

function commitStuffBody(controller: InboxWorkspaceController, body: ItemBody): Promise<void> {
  return controller.commitEditingSelectedStuffBody(body);
}

function autosaveStuffBody(controller: InboxWorkspaceController, body: ItemBody): Promise<void> {
  return controller.autosaveEditingSelectedStuffBody(body);
}

async function exitBodyEditingToInbox(
  controller: InboxWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  body: ItemBody
): Promise<void> {
  await controller.commitEditingSelectedStuffBody(body);
  controller.setActiveZone("inbox-list");
  setActiveScreen("inbox");
}

type StuffDetailReadyProps = StuffDetailPageProps & {
  setActiveScreen: (screen: ScreenId) => void;
};

function StuffDetailReady({ controller, setActiveScreen }: StuffDetailReadyProps) {
  const selectedItem = controller.selectedItem;

  return selectedItem ? (
    <InboxStuffDetails
      item={selectedItem}
      editing={controller.editingBodyId === selectedItem.id}
      onAutosaveEditing={(body) => autosaveStuffBody(controller, body)}
      onCommitEditing={(body) => commitStuffBody(controller, body)}
      onExitEditingFromNormalMode={(body) => exitBodyEditingToInbox(controller, setActiveScreen, body)}
      onCancelEditing={controller.cancelEditingSelectedStuffBody}
      onVimModeChange={controller.setVimMode}
    />
  ) : null;
}

function StuffDetailBody({ controller, setActiveScreen }: StuffDetailReadyProps) {
  if (controller.isLoading) {
    return <p className="pane-state">Loading stuff details...</p>;
  }

  if (controller.errorMessage) {
    return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  }

  return controller.selectedItem ? (
    <StuffDetailReady controller={controller} setActiveScreen={setActiveScreen} />
  ) : (
    <p className="pane-state">Select a stuff in inbox to inspect its details.</p>
  );
}

function StuffDetailPane({ controller, setActiveScreen }: StuffDetailReadyProps) {
  return (
    <ListPane title="Stuff Detail" active bodyClassName="list-pane__body--detail">
      <StuffDetailBody controller={controller} setActiveScreen={setActiveScreen} />
    </ListPane>
  );
}

/**
 * Renders the focused stuff-detail screen and its detail keybindings.
 *
 * @example <StuffDetailPage controller={controller} />
 */
export function StuffDetailPage({ controller }: StuffDetailPageProps) {
  const [isLinkComboOpen, setIsLinkComboOpen] = useState(false);
  const [isAssetComboOpen, setIsAssetComboOpen] = useState(false);
  const openLinkCombo = useCallback(() => setIsLinkComboOpen(true), []);
  const openAssetCombo = useCallback(() => setIsAssetComboOpen(true), []);
  const { setActiveScreen } = useActiveScreen();
  useKeybindScreen("stuff-detail");
  useStuffDetailZone(controller);
  useStuffDetailBindings(controller, openLinkCombo, openAssetCombo);

  return (
    <ListWorkspace theme={stuffDetailListTheme} currentLabel={stuffDetailListTheme.label} modeLabel={controller.vimMode ?? undefined}>
      <section className="stuff-detail-layout" aria-label="Stuff detail">
        <StuffDetailPane controller={controller} setActiveScreen={setActiveScreen} />
      </section>
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkComboOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkComboOpen(false)} /> : null}
        {isAssetComboOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetComboOpen(false)} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}
