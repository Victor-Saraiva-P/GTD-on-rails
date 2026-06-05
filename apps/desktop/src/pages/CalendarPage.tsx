import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { RetryState } from "../components/RetryState";
import { CalendarDetails } from "../features/calendar/CalendarDetails";
import { CalendarList } from "../features/calendar/CalendarList";
import { CalendarScheduleEditDialog } from "../features/calendar/CalendarScheduleEditDialog";
import type { CalendarPanel } from "../features/calendar/calendarWorkspaceState";
import type { CalendarWorkspaceController } from "../features/calendar/useCalendarWorkspaceController";
import { buildFormattingBindings } from "../features/inbox/formattingKeybinds";
import { prefetchNearbyInboxAssets } from "../features/inbox/inboxAssetPrefetch";
import type { ItemBody } from "../features/inbox/types";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../features/keybinds/types";
import { scrollDetailPane } from "../features/keybinds/scrollDetailPane";
import { calendarsListTheme, deletedCalendarsListTheme, doneCalendarsListTheme, type ListTheme } from "../features/lists/listThemes";
import { getMondayForOffset } from "../features/calendar/calendarDateUtils";

type CalendarPageProps = Readonly<{
  controller: CalendarWorkspaceController;
  selectOnGoingCalendar: (id: string) => void;
}>;

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

function moveCalendarColumn(controller: CalendarWorkspaceController, direction: "left" | "right"): void {
  if (controller.editingId || controller.editingBodyId) return;
  direction === "left" ? controller.moveColumnLeft() : controller.moveColumnRight();
}

function switchCalendarSubview(controller: CalendarWorkspaceController, direction: "next" | "previous"): void {
  if (controller.editingId || controller.editingBodyId) return;
  direction === "next" ? controller.switchToNextSubview() : controller.switchToPreviousSubview();
}

function openCalendarDetailPage(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void): void {
  if (controller.selectedItem) setActiveScreen("calendar-detail-page");
}

function openCalendarScheduleDialog(controller: CalendarWorkspaceController, openScheduleEdit: () => void): void {
  if (canEditCalendar(controller)) openScheduleEdit();
}

function buildPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void): KeybindDefinition[] {
  if (controller.activeSubview === "completed") {
    return [
      calendarBinding("calendars.move-completed-down", "j", "Move down", "calendar-completed-panel", () => moveCalendarSelection(controller, "next")),
      calendarBinding("calendars.move-completed-up", "k", "Move up", "calendar-completed-panel", () => moveCalendarSelection(controller, "previous")),
      calendarBinding("calendars.edit-completed-schedule", "e", "Edit selected schedule", "calendar-completed-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
      calendarBinding("calendars.open-completed-detail", "Enter", "Open full detail", "calendar-completed-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
      calendarBinding("calendars.delete-completed", "d", "Delete selected calendar", "calendar-completed-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
      calendarBinding("calendars.restore-completed", "r", "Reset status for selected calendar", "calendar-completed-panel", () => runCalendarAction(canEditCalendar(controller), controller.restoreSelected, "Failed to restore calendar")),
      calendarBinding("calendars.undo-completed", "u", "Undo last action", "calendar-completed-panel", controller.undo),
      { ...calendarBinding("calendars.redo-completed", "r", "Redo last action", "calendar-completed-panel", controller.redo), ctrl: true }
    ];
  }
  if (controller.activeSubview === "deleted") {
    return [
      calendarBinding("calendars.move-deleted-down", "j", "Move down", "calendar-deleted-panel", () => moveCalendarSelection(controller, "next")),
      calendarBinding("calendars.move-deleted-up", "k", "Move up", "calendar-deleted-panel", () => moveCalendarSelection(controller, "previous")),
      calendarBinding("calendars.edit-deleted-schedule", "e", "Edit selected schedule", "calendar-deleted-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
      calendarBinding("calendars.open-deleted-detail", "Enter", "Open full detail", "calendar-deleted-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
      calendarBinding("calendars.recover-deleted", "r", "Recover selected calendar", "calendar-deleted-panel", () => runCalendarAction(canEditCalendar(controller), controller.recoverDeleted, "Failed to recover calendar")),
      calendarBinding("calendars.undo-deleted", "u", "Undo last action", "calendar-deleted-panel", controller.undo),
      { ...calendarBinding("calendars.redo-deleted", "r", "Redo last action", "calendar-deleted-panel", controller.redo), ctrl: true }
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
        calendarBinding(`calendars.move-${day}-left`, "h", "Move to previous day", zone, () => moveCalendarColumn(controller, "left")),
        calendarBinding(`calendars.move-${day}-right`, "l", "Move to next day", zone, () => moveCalendarColumn(controller, "right")),
        calendarBinding(`calendars.move-${day}-previous-week`, "H", "Move to previous week", zone, controller.moveWeekPrevious),
        calendarBinding(`calendars.move-${day}-next-week`, "L", "Move to next week", zone, controller.moveWeekNext),
        calendarBinding(`calendars.focus-${day}-today`, "t", "Focus today", zone, controller.focusTodayWeek),
        calendarBinding(`calendars.edit-${day}-schedule`, "e", "Edit selected schedule", zone, () => openCalendarScheduleDialog(controller, openScheduleEdit)),
        calendarBinding(`calendars.edit-${day}-title`, "Enter", "Edit selected title", zone, () => canEditCalendar(controller) && controller.startTitleEdit()),
        calendarBinding(`calendars.open-${day}-detail`, "Enter", "Open full detail", zone, () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
        calendarBinding(`calendars.ongoing-${day}`, "o", "Mark as on going", zone, () => runMarkAsOnGoing(controller, selectOnGoingCalendar, setActiveScreen)),
        calendarBinding(`calendars.delete-${day}`, "d", "Delete selected calendar", zone, () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
        calendarBinding(`calendars.undo-${day}`, "u", "Undo last action", zone, controller.undo),
        { ...calendarBinding(`calendars.redo-${day}`, "r", "Redo last action", zone, controller.redo), ctrl: true }
      );
    });
    return bindings;
  }
  return [
    ...buildDuePanelBindings(controller, setActiveScreen, openScheduleEdit, selectOnGoingCalendar),
    ...buildDoneTodayPanelBindings(controller, setActiveScreen, openScheduleEdit)
  ];
}

function runMarkAsOnGoing(controller: CalendarWorkspaceController, selectOnGoingCalendar: (id: string) => void, setActiveScreen: (screen: ScreenId) => void): void {
  const id = controller.selectedItem?.id;
  if (!id) return;
  runCalendarAction(canEditCalendar(controller), async () => {
    await controller.markAsOnGoing();
    selectOnGoingCalendar(id);
    setActiveScreen("ongoing-calendar-detail-page");
  }, "Failed to mark calendar as on going");
}

function buildDuePanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due", "1", "Focus due calendar panel", "calendar-today-due-panel", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done-from-due", "2", "Focus completed today panel", "calendar-today-due-panel", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.move-due-down", "j", "Move down", "calendar-today-due-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-due-up", "k", "Move up", "calendar-today-due-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.edit-due-schedule", "e", "Edit selected schedule", "calendar-today-due-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding("calendars.edit-title", "Enter", "Edit selected title", "calendar-today-due-panel", () => canEditCalendar(controller) && controller.startTitleEdit()),
    calendarBinding("calendars.edit-body", "l", "Edit selected body", "calendar-today-due-panel", () => canEditCalendar(controller) && controller.startBodyEdit()),
    calendarBinding("calendars.open-detail", "Enter", "Open full detail", "calendar-today-due-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.ongoing", "o", "Mark as on going", "calendar-today-due-panel", () => runMarkAsOnGoing(controller, selectOnGoingCalendar, setActiveScreen)),
    calendarBinding("calendars.done", "x", "Mark as done", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.markAsDone, "Failed to mark calendar as done")),
    calendarBinding("calendars.delete", "d", "Delete selected calendar", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
    calendarBinding("calendars.undo-due", "u", "Undo last action", "calendar-today-due-panel", controller.undo),
    { ...calendarBinding("calendars.redo-due", "r", "Redo last action", "calendar-today-due-panel", controller.redo), ctrl: true }
  ];
}

function buildDoneTodayPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due-from-done", "1", "Focus due calendar panel", "calendar-today-done-panel", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done", "2", "Focus completed today panel", "calendar-today-done-panel", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.move-done-down", "j", "Move down", "calendar-today-done-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-done-up", "k", "Move up", "calendar-today-done-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.edit-done-schedule", "e", "Edit selected schedule", "calendar-today-done-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding("calendars.open-done-detail", "Enter", "Open full detail", "calendar-today-done-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.restore-done", "r", "Reset status for selected calendar", "calendar-today-done-panel", () => runCalendarAction(canEditCalendar(controller), controller.restoreSelected, "Failed to restore calendar")),
    calendarBinding("calendars.delete-done", "d", "Delete selected calendar", "calendar-today-done-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
    calendarBinding("calendars.undo-done", "u", "Undo last action", "calendar-today-done-panel", controller.undo),
    { ...calendarBinding("calendars.redo-done", "r", "Redo last action", "calendar-today-done-panel", controller.redo), ctrl: true }
  ];
}

function buildDetailBindings(controller: CalendarWorkspaceController, openLink: () => void, openAsset: () => void): KeybindDefinition[] {
  return [
    { ...calendarBinding("calendars.focus-active-list", "h", "Focus active calendar panel", "calendar-detail", () => controller.setActiveZone(activePanelZone(controller.activePanel))), ctrl: true },
    calendarBinding("calendars.which-key-detail", "k", "Show available keybinds", "calendar-detail", () => undefined, true),
    ...buildFormattingBindings("calendars", openLink, openAsset, "calendar-detail")
  ];
}

function buildSubviewBindings(controller: CalendarWorkspaceController): KeybindDefinition[] {
  const zones = calendarSubviewKeybindZones();
  return zones.flatMap((zone) => [
    calendarBinding(`calendars.switch-next-${zone}`, "]", "Open next calendar view", zone, () => switchCalendarSubview(controller, "next")),
    calendarBinding(`calendars.switch-previous-${zone}`, "[", "Open previous calendar view", zone, () => switchCalendarSubview(controller, "previous")),
    calendarBinding(`calendars.page-down-${zone}`, "PageDown", "Scroll down detail", zone, () => scrollDetailPane(1)),
    calendarBinding(`calendars.page-up-${zone}`, "PageUp", "Scroll up detail", zone, () => scrollDetailPane(-1))
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

function useCalendarBindings(controller: CalendarWorkspaceController, openLink: () => void, openAsset: () => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void): void {
  const { setActiveScreen } = useActiveScreen();
  const bindings = useMemo(() => [
    ...buildSubviewBindings(controller),
    ...buildPanelBindings(controller, setActiveScreen, openScheduleEdit, selectOnGoingCalendar),
    ...buildDetailBindings(controller, openLink, openAsset)
  ], [controller.activeSubview, controller, setActiveScreen, openLink, openAsset, openScheduleEdit, selectOnGoingCalendar]);
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

function calendarWorkspaceTheme(activeSubview: CalendarWorkspaceController["activeSubview"]): ListTheme {
  if (activeSubview === "completed") return doneCalendarsListTheme;
  if (activeSubview === "deleted") return deletedCalendarsListTheme;
  return calendarsListTheme;
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
  return <CalendarPanelReady controller={props.controller} items={items} panel={props.panel} />;
}

function emptyPanelMessage(panel: CalendarPanel): string {
  if (panel === "done-today") return "No calendars completed today.";
  if (panel === "completed") return "No completed calendars.";
  if (panel === "deleted") return "No deleted calendars.";
  if (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(panel)) return "";
  return "No due or late calendars.";
}

function CalendarPanelReady({ controller, items, panel }: CalendarControllerProps & { items: CalendarWorkspaceController["stuffs"], panel: CalendarPanel }) {
  return (
    <CalendarList
      items={items}
      archiveStatus={panel === "deleted" ? "deleted" : undefined}
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
    <ListView title="Done" meta={meta} panelIndex={2} active={controller.activeZone === "calendar-today-done-panel"} bodyClassName="list-pane__body--flush" className="inbox-pane inbox-pane--list calendar-pane--done">
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
  const dayName = day.charAt(0).toUpperCase() + day.slice(1);
  const monday = getMondayForOffset(controller.weekOffset);
  const columnDate = new Date(monday);
  columnDate.setDate(monday.getDate() + index - 1);
  
  const today = new Date();
  const isToday = columnDate.getFullYear() === today.getFullYear() &&
                  columnDate.getMonth() === today.getMonth() &&
                  columnDate.getDate() === today.getDate();

  const zoneId = `calendar-${day}-panel` as FocusZoneId;
  const active = controller.activeZone === zoneId;

  return (
    <section className={`list-pane ${active ? "list-pane--active" : ""} inbox-pane inbox-pane--list`}>
      <header className="weekly-column-header">
        <span className="weekly-column-day">{dayName}</span>
        <span className={`weekly-column-date ${isToday ? "weekly-column-date--today" : ""}`}>
          {columnDate.getDate()}
        </span>
      </header>
      <div className="list-pane__body list-pane__body--flush">
        <CalendarPanelBody controller={controller} panel={day} />
      </div>
    </section>
  );
}

function CalendarDetailView({ controller }: CalendarControllerProps) {
  return (
    <ListView title="Calendar Detail" viewIndex={2} active={controller.activeZone === "calendar-detail"} bodyClassName="list-pane__body--detail" className="inbox-pane inbox-pane--detail">
      <CalendarDetailBody controller={controller} />
    </ListView>
  );
}

/** Computes "Month Year" label for the weekly view header (REQ-07). */
function weeklyMonthLabel(weekOffset: number): string {
  const monday = getMondayForOffset(weekOffset);
  return monday.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function WeeklyCalendarHeader({ weekOffset }: { weekOffset: number }) {
  return (
    <header className="weekly-calendar-header">
      {weeklyMonthLabel(weekOffset)}
    </header>
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
      <section className="weekly-calendar-wrapper" aria-label="Calendars">
        <WeeklyCalendarHeader weekOffset={controller.weekOffset} />
        <section className="weekly-terminal-layout">
          <WeeklyCalendarPanel day="mon" index={1} controller={controller} />
          <WeeklyCalendarPanel day="tue" index={2} controller={controller} />
          <WeeklyCalendarPanel day="wed" index={3} controller={controller} />
          <WeeklyCalendarPanel day="thu" index={4} controller={controller} />
          <WeeklyCalendarPanel day="fri" index={5} controller={controller} />
          <WeeklyCalendarPanel day="sat" index={6} controller={controller} />
          <WeeklyCalendarPanel day="sun" index={7} controller={controller} />
        </section>
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
export function CalendarPage({ controller, selectOnGoingCalendar }: CalendarPageProps) {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [isScheduleEditOpen, setIsScheduleEditOpen] = useState(false);
  const openLink = useCallback(() => setIsLinkOpen(true), []);
  const openAsset = useCallback(() => setIsAssetOpen(true), []);
  const openScheduleEdit = useCallback(() => setIsScheduleEditOpen(true), []);
  useKeybindScreen("calendars");
  useCalendarZone(controller);
  useCalendarAssetPreload(controller);
  useCalendarBindings(controller, openLink, openAsset, openScheduleEdit, selectOnGoingCalendar);

  return (
    <ListWorkspace theme={calendarWorkspaceTheme(controller.activeSubview)} currentLabel="Calendars" modeLabel={controller.vimMode ?? undefined}>
      <CalendarViews controller={controller} />
      <LeaderMenu />
      <Suspense fallback={null}>
        {isLinkOpen ? <LazyMarkdownLinkComboDialog onClose={() => setIsLinkOpen(false)} /> : null}
        {isAssetOpen && controller.selectedItem ? <LazyMarkdownAssetComboDialog itemId={controller.selectedItem.id} onClose={() => setIsAssetOpen(false)} /> : null}
        {isScheduleEditOpen && controller.selectedItem ? <CalendarScheduleEditDialog item={controller.selectedItem} onClose={() => setIsScheduleEditOpen(false)} onSave={controller.updateSchedule} /> : null}
      </Suspense>
    </ListWorkspace>
  );
}
