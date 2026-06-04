import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { CalendarDetails } from "../features/calendar/CalendarDetails";
import type { CalendarWorkspaceController } from "../features/calendar/useCalendarWorkspaceController";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { calendarsListTheme } from "../features/lists/listThemes";

type CalendarDetailPageProps = {
  controller: CalendarWorkspaceController;
};

const LazyMarkdownAssetComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownAssetComboDialog");
  return { default: module.MarkdownAssetComboDialog };
});

const LazyMarkdownLinkComboDialog = lazy(async () => {
  const module = await import("../features/inbox/MarkdownLinkComboDialog");
  return { default: module.MarkdownLinkComboDialog };
});

function detailBinding(id: string, key: string, description: string, runKeybind: () => void, leader = false): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "calendar-detail-page", zone: "calendar-detail" };
}

function backToCalendars(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void): void {
  if (controller.editingBodyId) return;
  setActiveScreen("calendars");
}

function buildCalendarDetailBindings(
  controller: CalendarWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  openLink: () => void,
  openAsset: () => void
): KeybindDefinition[] {
  return [
    detailBinding("calendar-detail-page.back", "Escape", "Back to calendars", () => backToCalendars(controller, setActiveScreen)),
    detailBinding("calendar-detail-page.which-key", "k", "Show available keybinds", () => undefined, true),
    ...buildFormattingBindings("calendar-detail-page", openLink, openAsset, "calendar-detail")
  ];
}

function useCalendarDetailBindings(controller: CalendarWorkspaceController, openLink: () => void, openAsset: () => void): void {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => buildCalendarDetailBindings(controller, setActiveScreen, openLink, openAsset), [controller, setActiveScreen, openLink, openAsset]);
  useRegisterKeybinds(bindings);
}

function useCalendarDetailZone(controller: CalendarWorkspaceController): void {
  useEffect(() => {
    if (controller.activeZone !== "calendar-detail") controller.setActiveZone("calendar-detail");
  }, [controller.activeZone, controller.setActiveZone]);
}

async function exitDetailBodyEditing(
  controller: CalendarWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  body: ItemBody
): Promise<void> {
  await controller.commitBody(body);
  setActiveScreen("calendars");
}

function CalendarDetailBody({ controller }: CalendarDetailPageProps) {
  const { setActiveScreen } = useActiveScreen();
  if (controller.isLoading) return <p className="pane-state">Loading calendar details...</p>;
  if (controller.errorMessage) return <p className="pane-state">Calendar details are unavailable while loading fails.</p>;
  if (!controller.selectedItem) return <p className="pane-state">Select a calendar to inspect its details.</p>;
  return <CalendarDetailReady controller={controller} setActiveScreen={setActiveScreen} />;
}

function CalendarDetailReady({ controller, setActiveScreen }: CalendarDetailPageProps & { setActiveScreen: (screen: ScreenId) => void }) {
  const item = controller.selectedItem;
  if (!item) return null;
  return (
    <CalendarDetails
      item={item}
      editing={controller.editingBodyId === item.id}
      onAutosaveEditing={(body) => controller.autosaveBody(body)}
      onCommitEditing={(body) => controller.commitBody(body)}
      onExitEditingFromNormalMode={(body) => exitDetailBodyEditing(controller, setActiveScreen, body)}
      onCancelEditing={controller.cancelBodyEdit}
      onVimModeChange={controller.setVimMode}
    />
  );
}

/**
 * Renders a focused calendar detail page.
 *
 * @example <CalendarDetailPage controller={controller} />
 */
export function CalendarDetailPage({ controller }: CalendarDetailPageProps) {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  useKeybindScreen("calendar-detail-page");
  useCalendarDetailZone(controller);
  useCalendarDetailBindings(controller, openLink, openAsset);

  return (
    <ListWorkspace theme={calendarsListTheme} currentLabel={calendarsListTheme.label} modeLabel={controller.vimMode ?? undefined}>
      <section className="inbox-terminal-layout" aria-label="Calendar detail">
        <ListView title="Calendar Detail" active bodyClassName="list-pane__body--detail">
          <CalendarDetailBody controller={controller} />
        </ListView>
      </section>
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}
