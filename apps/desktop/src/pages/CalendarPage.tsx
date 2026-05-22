import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { CalendarDetails } from "../features/calendar/CalendarDetails";
import { CalendarList } from "../features/calendar/CalendarList";
import type { CalendarPanel } from "../features/calendar/calendarWorkspaceState";
import type { CalendarWorkspaceController } from "../features/calendar/useCalendarWorkspaceController";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { calendarsListTheme } from "../features/lists/listThemes";

type CalendarPageProps = {
  controller: CalendarWorkspaceController;
};

type CalendarControllerProps = {
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

function calendarBinding(id: string, key: string, description: string, zone: FocusZoneId, runKeybind: () => void, leader = false, sequence?: string[]): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "calendars", sequence, zone };
}

function canEditCalendar(controller: CalendarWorkspaceController): boolean {
  return !controller.isLoading && !controller.isDeleting && !controller.isUpdating && Boolean(controller.selectedItem) && !controller.editingId && !controller.editingBodyId;
}

function runCalendarAction(canRun: boolean, action: () => Promise<void>, message: string): void {
  if (canRun) void action().catch((error: unknown) => console.error(message, error));
}

function focusCalendarPanel(controller: CalendarWorkspaceController, panel: CalendarPanel): void {
  if (!controller.editingId && !controller.editingBodyId) controller.focusPanel(panel);
}

function moveCalendarSelection(controller: CalendarWorkspaceController, direction: "next" | "previous"): void {
  if (controller.editingId || controller.editingBodyId) return;
  direction === "next" ? controller.selectNext() : controller.selectPrevious();
}

function switchCalendarSubview(controller: CalendarWorkspaceController, direction: "next" | "previous"): void {
  if (controller.editingId || controller.editingBodyId) return;
  direction === "next" ? controller.switchToNextSubview() : controller.switchToPreviousSubview();
}

function openCalendarDetailPage(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void): void {
  if (controller.selectedItem) setActiveScreen("calendar-detail-page");
}

function buildPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void): KeybindDefinition[] {
  if (controller.activeSubview === "completed") {
    return [
      calendarBinding("calendars.move-completed-down", "j", "Move down", "calendar-completed-panel", () => moveCalendarSelection(controller, "next")),
      calendarBinding("calendars.move-completed-up", "k", "Move up", "calendar-completed-panel", () => moveCalendarSelection(controller, "previous")),
      calendarBinding("calendars.open-completed-detail", "Enter", "Open full detail", "calendar-completed-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
      calendarBinding("calendars.delete-completed", "d", "Delete selected calendar", "calendar-completed-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
      calendarBinding("calendars.restore-completed", "r", "Restore selected calendar", "calendar-completed-panel", () => runCalendarAction(canEditCalendar(controller), controller.restoreSelected, "Failed to restore calendar"))
    ];
  }
  if (controller.activeSubview === "deleted") {
    return [
      calendarBinding("calendars.move-deleted-down", "j", "Move down", "calendar-deleted-panel", () => moveCalendarSelection(controller, "next")),
      calendarBinding("calendars.move-deleted-up", "k", "Move up", "calendar-deleted-panel", () => moveCalendarSelection(controller, "previous")),
      calendarBinding("calendars.open-deleted-detail", "Enter", "Open full detail", "calendar-deleted-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
      calendarBinding("calendars.recover-deleted", "r", "Recover selected calendar", "calendar-deleted-panel", () => runCalendarAction(canEditCalendar(controller), controller.recoverDeleted, "Failed to recover calendar"))
    ];
  }
  if (controller.activeSubview === "weekly") {
    const bindings: KeybindDefinition[] = [];
    const days: CalendarPanel[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const zones: FocusZoneId[] = ["calendar-mon-panel", "calendar-tue-panel", "calendar-wed-panel", "calendar-thu-panel", "calendar-fri-panel", "calendar-sat-panel", "calendar-sun-panel"];
    
    days.forEach((day, i) => {
      const zone = zones[i];
      // Note: we don't bind 1..7 directly in the zone because the user might want to press 2 while in zone 1 to switch!
      // But wait, the switch bindings need to be in ALL zones!
      days.forEach((targetDay, j) => {
        bindings.push(
          calendarBinding(`calendars.focus-${targetDay}-from-${day}`, String(j + 1), `Focus ${targetDay} panel`, zone, () => focusCalendarPanel(controller, targetDay))
        );
      });
      bindings.push(
        calendarBinding(`calendars.move-${day}-down`, "j", "Move down", zone, () => moveCalendarSelection(controller, "next")),
        calendarBinding(`calendars.move-${day}-up`, "k", "Move up", zone, () => moveCalendarSelection(controller, "previous")),
        calendarBinding(`calendars.open-${day}-detail`, "Enter", "Open full detail", zone, () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"])
      );
    });
    return bindings;
  }
  return [
    ...buildDuePanelBindings(controller, setActiveScreen),
    ...buildDoneTodayPanelBindings(controller, setActiveScreen)
  ];
}

function buildDuePanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due", "1", "Focus due calendar panel", "calendar-today-due-panel", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done-from-due", "2", "Focus completed today panel", "calendar-today-due-panel", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.move-due-down", "j", "Move down", "calendar-today-due-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-due-up", "k", "Move up", "calendar-today-due-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.edit-title", "Enter", "Edit selected title", "calendar-today-due-panel", () => canEditCalendar(controller) && controller.startTitleEdit()),
    calendarBinding("calendars.edit-body", "l", "Edit selected body", "calendar-today-due-panel", () => canEditCalendar(controller) && controller.startBodyEdit()),
    calendarBinding("calendars.open-detail", "Enter", "Open full detail", "calendar-today-due-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.ongoing", "o", "Mark as on going", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.markAsOnGoing, "Failed to mark calendar as on going")),
    calendarBinding("calendars.done", "x", "Mark as done", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.markAsDone, "Failed to mark calendar as done")),
    calendarBinding("calendars.delete", "d", "Delete selected calendar", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar"))
  ];
}

function buildDoneTodayPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due-from-done", "1", "Focus due calendar panel", "calendar-today-done-panel", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done", "2", "Focus completed today panel", "calendar-today-done-panel", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.move-done-down", "j", "Move down", "calendar-today-done-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-done-up", "k", "Move up", "calendar-today-done-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.open-done-detail", "Enter", "Open full detail", "calendar-today-done-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.restore-done", "r", "Restore selected calendar", "calendar-today-done-panel", () => runCalendarAction(canEditCalendar(controller), controller.restoreSelected, "Failed to restore calendar"))
  ];
}

function buildDetailBindings(controller: CalendarWorkspaceController, openLink: () => void, openAsset: () => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due-from-detail", "1", "Focus due calendar panel", "calendar-detail", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done-from-detail", "2", "Focus completed today panel", "calendar-detail", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.focus-active-list", "h", "Focus active calendar panel", "calendar-detail", () => controller.setActiveZone(activePanelZone(controller.activePanel))),
    calendarBinding("calendars.edit-body-detail", "Enter", "Edit selected body", "calendar-detail", () => canEditCalendar(controller) && controller.startBodyEdit()),
    ...buildFormattingBindings("calendars", openLink, openAsset, "calendar-detail")
  ];
}

function buildSubviewBindings(controller: CalendarWorkspaceController): KeybindDefinition[] {
  const zones = calendarSubviewKeybindZones();
  return zones.flatMap((zone) => [
    calendarBinding(`calendars.switch-next-${zone}`, "]", "Open next calendar view", zone, () => switchCalendarSubview(controller, "next")),
    calendarBinding(`calendars.switch-previous-${zone}`, "[", "Open previous calendar view", zone, () => switchCalendarSubview(controller, "previous"))
  ]);
}

function calendarSubviewKeybindZones(): FocusZoneId[] {
  return [
    "calendar-today-due-panel", "calendar-today-done-panel", "calendar-detail",
    "calendar-completed-panel", "calendar-deleted-panel", "calendar-mon-panel",
    "calendar-tue-panel", "calendar-wed-panel", "calendar-thu-panel",
    "calendar-fri-panel", "calendar-sat-panel", "calendar-sun-panel"
  ];
}

function activePanelZone(panel: CalendarPanel): FocusZoneId {
  if (panel === "done-today") return "calendar-today-done-panel";
  if (panel === "completed") return "calendar-completed-panel";
  if (panel === "deleted") return "calendar-deleted-panel";
  if (panel === "mon") return "calendar-mon-panel";
  if (panel === "tue") return "calendar-tue-panel";
  if (panel === "wed") return "calendar-wed-panel";
  if (panel === "thu") return "calendar-thu-panel";
  if (panel === "fri") return "calendar-fri-panel";
  if (panel === "sat") return "calendar-sat-panel";
  if (panel === "sun") return "calendar-sun-panel";
  return "calendar-today-due-panel";
}

function useCalendarBindings(controller: CalendarWorkspaceController, openLink: () => void, openAsset: () => void): void {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => [
    ...buildSubviewBindings(controller),
    ...buildPanelBindings(controller, setActiveScreen),
    ...buildDetailBindings(controller, openLink, openAsset)
  ], [controller.activeSubview, controller, setActiveScreen, openLink, openAsset]);
  useRegisterKeybinds(bindings);
}

function useCalendarZone(controller: CalendarWorkspaceController): void {
  useEffect(() => {
    let valid = ["calendar-today-due-panel", "calendar-today-done-panel", "calendar-detail"];
    if (controller.activeSubview === "completed") valid = ["calendar-completed-panel", "calendar-detail"];
    if (controller.activeSubview === "deleted") valid = ["calendar-deleted-panel", "calendar-detail"];
    if (controller.activeSubview === "weekly") valid = ["calendar-mon-panel", "calendar-tue-panel", "calendar-wed-panel", "calendar-thu-panel", "calendar-fri-panel", "calendar-sat-panel", "calendar-sun-panel"];
    
    if (!valid.includes(controller.activeZone)) controller.setActiveZone(valid[0] as any);
  }, [controller.activeZone, controller.activeSubview, controller.setActiveZone]);
}

function useCalendarAssetPreload(controller: CalendarWorkspaceController): void {
  useEffect(() => {
    if (controller.selectedIndex < 0) return;
    prefetchNearbyInboxAssets(controller.stuffs, controller.selectedIndex);
  }, [controller.selectedIndex, controller.stuffs]);
}

function commitCalendarTitle(controller: CalendarWorkspaceController): void {
  void controller.commitTitle().catch((error: unknown) => console.error("Failed to update calendar title", error));
}

function CalendarPanelBody(props: CalendarControllerProps & { panel: CalendarPanel }) {
  if (props.controller.isLoading) return <p className="pane-state">Loading calendars...</p>;
  if (props.controller.errorMessage) return <RetryState message={props.controller.errorMessage} onRetry={props.controller.reload} />;
  
  let items = props.controller.dueCalendars;
  if (props.panel === "done-today") items = props.controller.doneTodayCalendars;
  if (props.panel === "completed") items = props.controller.completedCalendars;
  if (props.panel === "deleted") items = props.controller.deletedCalendars;
  if (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(props.panel)) {
    const index = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(props.panel);
    items = props.controller.weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === index);
  }

  if (items.length === 0) return <p className="pane-state">{emptyPanelMessage(props.panel)}</p>;
  return <CalendarPanelReady controller={props.controller} items={items} />;
}

function emptyPanelMessage(panel: CalendarPanel): string {
  if (panel === "done-today") return "No calendars completed today.";
  if (panel === "completed") return "No completed calendars.";
  if (panel === "deleted") return "No deleted calendars.";
  if (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(panel)) return "";
  return "No due or late calendars.";
}

function CalendarPanelReady({ controller, items }: CalendarControllerProps & { items: CalendarWorkspaceController["stuffs"] }) {
  return (
    <CalendarList
      items={items}
      selectedId={controller.selectedItem?.id ?? ""}
      editingId={controller.editingId}
      editingTitle={controller.editingTitle}
      onSelect={controller.setSelectedId}
      onEditingTitleChange={controller.setEditingTitle}
      onStartEditing={controller.startTitleEdit}
      onCommitEditing={() => commitCalendarTitle(controller)}
      onCommitEditingAndContinue={() => commitCalendarTitle(controller)}
      onCancelEditing={controller.cancelTitleEdit}
    />
  );
}

function CalendarDetailBody({ controller }: CalendarControllerProps) {
  if (controller.isLoading) return <p className="pane-state">Loading calendar details...</p>;
  if (controller.errorMessage) return <p className="pane-state">Calendar details are unavailable while loading fails.</p>;
  if (!controller.selectedItem) return <p className="pane-state">Select a calendar to inspect its details.</p>;
  return <CalendarDetailReady controller={controller} />;
}

function CalendarDetailReady({ controller }: CalendarControllerProps) {
  const item = controller.selectedItem;
  if (!item) return null;
  return (
    <CalendarDetails
      item={item}
      editing={controller.editingBodyId === item.id}
      onAutosaveEditing={(body) => controller.autosaveBody(body)}
      onCommitEditing={(body) => controller.commitBody(body)}
      onExitEditingFromNormalMode={(body) => exitCalendarBodyEditing(controller, body)}
      onCancelEditing={controller.cancelBodyEdit}
      onVimModeChange={controller.setVimMode}
    />
  );
}

async function exitCalendarBodyEditing(controller: CalendarWorkspaceController, body: ItemBody): Promise<void> {
  await controller.commitBody(body);
  controller.setActiveZone(activePanelZone(controller.activePanel));
}

function DueCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.dueCalendars.length} ${controller.dueCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Calendar" meta={meta} panelIndex={1} active={controller.activeZone === "calendar-today-due-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="due" />
    </ListView>
  );
}

function DoneTodayCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.doneTodayCalendars.length} ${controller.doneTodayCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Done" meta={meta} panelIndex={2} active={controller.activeZone === "calendar-today-done-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="done-today" />
    </ListView>
  );
}

function CompletedCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.completedCalendars.length} ${controller.completedCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Completed" meta={meta} panelIndex={1} active={controller.activeZone === "calendar-completed-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="completed" />
    </ListView>
  );
}

function DeletedCalendarPanel({ controller }: CalendarControllerProps) {
  const meta = `${controller.deletedCalendars.length} ${controller.deletedCalendars.length === 1 ? "item" : "items"}`;
  return (
    <ListView title="Deleted" meta={meta} panelIndex={1} active={controller.activeZone === "calendar-deleted-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel="deleted" />
    </ListView>
  );
}

function WeeklyCalendarPanel({ controller, day, index }: CalendarControllerProps & { day: CalendarPanel, index: number }) {
  const title = day.charAt(0).toUpperCase() + day.slice(1);
  const items = controller.weeklyCalendars.filter(c => new Date(c.scheduledDate + "T00:00:00").getDay() === (index === 7 ? 0 : index));
  const meta = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  const zoneId = `calendar-${day}-panel` as FocusZoneId;
  return (
    <ListView title={title} meta={meta} panelIndex={index} active={controller.activeZone === zoneId} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list">
      <CalendarPanelBody controller={controller} panel={day} />
    </ListView>
  );
}

function CalendarDetailView({ controller }: CalendarControllerProps) {
  return (
    <ListView title="Calendar Detail" viewIndex={2} active={controller.activeZone === "calendar-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <CalendarDetailBody controller={controller} />
    </ListView>
  );
}

function CalendarViews({ controller }: CalendarControllerProps) {
  if (controller.activeSubview === "today") {
    return (
      <section className="calendar-today-layout" aria-label="Calendars">
        <section className="calendar-today-group" aria-label="Today calendars">
          <DueCalendarPanel controller={controller} />
          <DoneTodayCalendarPanel controller={controller} />
        </section>
        <CalendarDetailView controller={controller} />
      </section>
    );
  } else if (controller.activeSubview === "completed") {
    return (
      <section className="inbox-terminal-layout" aria-label="Calendars">
        <CompletedCalendarPanel controller={controller} />
        <CalendarDetailView controller={controller} />
      </section>
    );
  } else if (controller.activeSubview === "deleted") {
    return (
      <section className="inbox-terminal-layout" aria-label="Calendars">
        <DeletedCalendarPanel controller={controller} />
        <CalendarDetailView controller={controller} />
      </section>
    );
  } else if (controller.activeSubview === "weekly") {
    return (
      <section className="weekly-terminal-layout" aria-label="Calendars">
        <WeeklyCalendarPanel day="mon" index={1} controller={controller} />
        <WeeklyCalendarPanel day="tue" index={2} controller={controller} />
        <WeeklyCalendarPanel day="wed" index={3} controller={controller} />
        <WeeklyCalendarPanel day="thu" index={4} controller={controller} />
        <WeeklyCalendarPanel day="fri" index={5} controller={controller} />
        <WeeklyCalendarPanel day="sat" index={6} controller={controller} />
        <WeeklyCalendarPanel day="sun" index={7} controller={controller} />
      </section>
    );
  }
  return null;
}

/**
 * Renders the Calendar workspace with subviews and selected detail.
 *
 * @example <CalendarPage controller={controller} />
 */
export function CalendarPage({ controller }: CalendarPageProps) {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  useKeybindScreen("calendars");
  useCalendarZone(controller);
  useCalendarAssetPreload(controller);
  useCalendarBindings(controller, openLink, openAsset);

  return (
    <ListWorkspace theme={calendarsListTheme} currentLabel="Calendars" modeLabel={controller.vimMode ?? undefined}>
      <CalendarViews controller={controller} />
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}
