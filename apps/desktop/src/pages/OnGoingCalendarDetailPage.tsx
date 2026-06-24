import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import { InboxStuffDetails } from "../features/inbox/InboxStuffDetails";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { onGoingCalendarDetailListTheme } from "../features/lists/listThemes";
import type { OnGoingWorkspaceController } from "../features/ongoing/useOnGoingWorkspaceController";

type Props = Readonly<{ controller: OnGoingWorkspaceController }>;
type ReadyProps = Props & Readonly<{ setActiveScreen: (screen: ScreenId) => void }>;

const LazyMarkdownAssetComboDialog = lazy(async () => ({ default: (await import("../features/inbox/MarkdownAssetComboDialog")).MarkdownAssetComboDialog }));
const LazyMarkdownLinkComboDialog = lazy(async () => ({ default: (await import("../features/inbox/MarkdownLinkComboDialog")).MarkdownLinkComboDialog }));

function detailBinding(id: string, key: string, description: string, runKeybind: () => void, leader = false): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "ongoing-calendar-detail-page", zone: "next-action-detail" };
}

function backToOnGoing(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void) {
  if (controller.editingBodyId) return;
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function buildDetailBindings(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openLink: () => void, openAsset: () => void): KeybindDefinition[] {
  return [
    detailBinding("ongoing-calendar-detail-page.back", "Escape", "Back to on going", () => backToOnGoing(controller, setActiveScreen)),
    detailBinding("ongoing-calendar-detail-page.which-key", "k", "Show available keybinds", () => undefined, true),
    ...buildFormattingBindings("ongoing-calendar-detail-page", openLink, openAsset, "next-action-detail")
  ];
}

function useDetailZone(controller: OnGoingWorkspaceController) {
  const selectedId = controller.selectedItem?.item.id ?? null;
  useEffect(() => {
    controller.setActiveZone("next-action-detail");
    if (selectedId && controller.editingBodyId !== selectedId) controller.startBodyEdit(selectedId);
  }, [controller.setActiveZone, controller.editingBodyId, selectedId, controller.startBodyEdit]);
}

async function exitBodyEditing(controller: OnGoingWorkspaceController, setActiveScreen: (screen: ScreenId) => void, body: ItemBody) {
  await controller.commitBody(body);
  controller.setActiveZone("next-actions-list");
  setActiveScreen("ongoing-next-actions");
}

function DetailReady({ controller, setActiveScreen }: ReadyProps) {
  if (!controller.selectedItem) return null;
  return <InboxStuffDetails item={controller.selectedItem.item} showCreatedMeta={false} metaVariant="calendar" editing={controller.editingBodyId === controller.selectedItem.item.id} onAutosaveEditing={controller.autosaveBody} onCommitEditing={controller.commitBody} onExitEditingFromNormalMode={(body) => exitBodyEditing(controller, setActiveScreen, body)} onCancelEditing={controller.cancelBodyEdit} onVimModeChange={controller.setVimMode} />;
}

function DetailBody({ controller, setActiveScreen }: ReadyProps) {
  if (controller.isLoading) return <p className="pane-state">Loading on going calendar details...</p>;
  if (controller.errorMessage) return <RetryState message={controller.errorMessage} onRetry={controller.reload} />;
  if (!controller.selectedItem) return <p className="pane-state">Select an on going calendar to inspect its details.</p>;
  return <DetailReady controller={controller} setActiveScreen={setActiveScreen} />;
}

/**
 * Renders the focused On Going calendar detail screen and body editing flow.
 *
 * @example <OnGoingCalendarDetailPage controller={controller} />
 */
export function OnGoingCalendarDetailPage({ controller }: Props) {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const { setActiveScreen } = useActiveScreen();
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  const bindings = useMemo(() => buildDetailBindings(controller, setActiveScreen, openLink, openAsset), [controller, setActiveScreen, openLink, openAsset]);
  useKeybindScreen("ongoing-calendar-detail-page");
  useDetailZone(controller);
  useRegisterKeybinds(bindings);
  return <ListWorkspace theme={onGoingCalendarDetailListTheme} currentLabel={onGoingCalendarDetailListTheme.label} modeLabel={controller.vimMode ?? undefined}><section className="stuff-detail-layout" aria-label="On going calendar detail"><ListView title="On Going Detail" active bodyClassName="list-pane__body--detail"><DetailBody controller={controller} setActiveScreen={setActiveScreen} /></ListView></section><LeaderMenu /><Suspense fallback={null}>{isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}{isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.item.id} onClose={() => setIsAssetOpen(false)} /> : null}</Suspense></ListWorkspace>;
}
