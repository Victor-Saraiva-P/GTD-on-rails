import { buildFormattingBindings } from "../inbox/formattingKeybinds";
import type { FocusZoneId, KeybindDefinition, ScreenId } from "../keybinds/types";
import { scrollDetailPane } from "../keybinds/scrollDetailPane";
import type { CalendarPanel } from "./calendarWorkspaceState";
import type { CalendarWorkspaceController } from "./useCalendarWorkspaceController";

function calendarBinding(id: string, key: string, description: string, zone: FocusZoneId, runKeybind: () => void, leader = false, sequence?: string[]): KeybindDefinition {
  return { description, id, key, leader, runKeybind, screen: "calendars", sequence, zone };
}

export function canEditCalendar(controller: CalendarWorkspaceController): boolean {
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

function selectCalendarBoundaryItem(controller: CalendarWorkspaceController, boundary: "first" | "last"): void {
  if (controller.editingId || controller.editingBodyId) return;
  boundary === "first" ? controller.selectFirst() : controller.selectLast();
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

function openProjectAssociateFromKeybind(controller: CalendarWorkspaceController, openProjectAssociate: () => void): void {
  if (canEditCalendar(controller)) openProjectAssociate();
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

function buildCompletedPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.move-completed-down", "j", "Move down", "calendar-completed-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-completed-up", "k", "Move up", "calendar-completed-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.move-completed-first", "g", "Move to first item", "calendar-completed-panel", () => selectCalendarBoundaryItem(controller, "first"), false, ["g", "g"]),
    calendarBinding("calendars.move-completed-last", "G", "Move to last item", "calendar-completed-panel", () => selectCalendarBoundaryItem(controller, "last")),
    calendarBinding("calendars.edit-completed-schedule", "e", "Edit selected schedule", "calendar-completed-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding("calendars.open-completed-detail", "Enter", "Open full detail", "calendar-completed-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.delete-completed", "d", "Delete selected calendar", "calendar-completed-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
    calendarBinding("calendars.restore-completed", "r", "Reset status for selected calendar", "calendar-completed-panel", () => runCalendarAction(canEditCalendar(controller), controller.restoreSelected, "Failed to restore calendar")),
    calendarBinding("calendars.undo-completed", "u", "Undo last action", "calendar-completed-panel", controller.undo),
    { ...calendarBinding("calendars.redo-completed", "r", "Redo last action", "calendar-completed-panel", controller.redo), ctrl: true }
  ];
}

function buildDeletedPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.move-deleted-down", "j", "Move down", "calendar-deleted-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-deleted-up", "k", "Move up", "calendar-deleted-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.move-deleted-first", "g", "Move to first item", "calendar-deleted-panel", () => selectCalendarBoundaryItem(controller, "first"), false, ["g", "g"]),
    calendarBinding("calendars.move-deleted-last", "G", "Move to last item", "calendar-deleted-panel", () => selectCalendarBoundaryItem(controller, "last")),
    calendarBinding("calendars.edit-deleted-schedule", "e", "Edit selected schedule", "calendar-deleted-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding("calendars.open-deleted-detail", "Enter", "Open full detail", "calendar-deleted-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.recover-deleted", "r", "Recover selected calendar", "calendar-deleted-panel", () => runCalendarAction(canEditCalendar(controller), controller.recoverDeleted, "Failed to recover calendar")),
    calendarBinding("calendars.undo-deleted", "u", "Undo last action", "calendar-deleted-panel", controller.undo),
    { ...calendarBinding("calendars.redo-deleted", "r", "Redo last action", "calendar-deleted-panel", controller.redo), ctrl: true }
  ];
}

function buildWeeklyDayBindings(controller: CalendarWorkspaceController, day: CalendarPanel, zone: FocusZoneId, days: CalendarPanel[], setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void, openProjectAssociate: () => void): KeybindDefinition[] {
  const switchBindings = days.map((targetDay, j) =>
    calendarBinding(`calendars.focus-${targetDay}-from-${day}`, String(j + 1), `Focus ${targetDay} panel`, zone, () => focusCalendarPanel(controller, targetDay))
  );
  return [
    ...switchBindings,
    calendarBinding(`calendars.move-${day}-down`, "j", "Move down", zone, () => moveCalendarSelection(controller, "next")),
    calendarBinding(`calendars.move-${day}-up`, "k", "Move up", zone, () => moveCalendarSelection(controller, "previous")),
    calendarBinding(`calendars.move-${day}-first`, "g", "Move to first item", zone, () => selectCalendarBoundaryItem(controller, "first"), false, ["g", "g"]),
    calendarBinding(`calendars.move-${day}-last`, "G", "Move to last item", zone, () => selectCalendarBoundaryItem(controller, "last")),
    calendarBinding(`calendars.move-${day}-left`, "h", "Move to previous day", zone, () => moveCalendarColumn(controller, "left")),
    calendarBinding(`calendars.move-${day}-right`, "l", "Move to next day", zone, () => moveCalendarColumn(controller, "right")),
    calendarBinding(`calendars.move-${day}-previous-week`, "H", "Move to previous week", zone, controller.moveWeekPrevious),
    calendarBinding(`calendars.move-${day}-next-week`, "L", "Move to next week", zone, controller.moveWeekNext),
    calendarBinding(`calendars.focus-${day}-today`, "t", "Focus today", zone, controller.focusTodayWeek),
    calendarBinding(`calendars.edit-${day}-schedule`, "e", "Edit selected schedule", zone, () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding(`calendars.edit-${day}-title`, "Enter", "Edit selected title", zone, () => canEditCalendar(controller) && controller.startTitleEdit()),
    calendarBinding(`calendars.open-${day}-detail`, "Enter", "Open full detail", zone, () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding(`calendars.associate-project-${day}`, "P", "Associate to project", zone, () => openProjectAssociateFromKeybind(controller, openProjectAssociate)),
    calendarBinding(`calendars.ongoing-${day}`, "o", "Mark as on going", zone, () => runMarkAsOnGoing(controller, selectOnGoingCalendar, setActiveScreen)),
    calendarBinding(`calendars.delete-${day}`, "d", "Delete selected calendar", zone, () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
    calendarBinding(`calendars.undo-${day}`, "u", "Undo last action", zone, controller.undo),
    { ...calendarBinding(`calendars.redo-${day}`, "r", "Redo last action", zone, controller.redo), ctrl: true }
  ];
}

function buildWeeklyPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void, openProjectAssociate: () => void): KeybindDefinition[] {
  const days: CalendarPanel[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const zones: FocusZoneId[] = ["calendar-mon-panel", "calendar-tue-panel", "calendar-wed-panel", "calendar-thu-panel", "calendar-fri-panel", "calendar-sat-panel", "calendar-sun-panel"];
  return days.flatMap((day, i) => buildWeeklyDayBindings(controller, day, zones[i], days, setActiveScreen, openScheduleEdit, selectOnGoingCalendar, openProjectAssociate));
}

function buildDuePanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void, openProjectAssociate: () => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due", "1", "Focus due calendar panel", "calendar-today-due-panel", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done-from-due", "2", "Focus completed today panel", "calendar-today-due-panel", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.move-due-down", "j", "Move down", "calendar-today-due-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-due-up", "k", "Move up", "calendar-today-due-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.move-due-first", "g", "Move to first item", "calendar-today-due-panel", () => selectCalendarBoundaryItem(controller, "first"), false, ["g", "g"]),
    calendarBinding("calendars.move-due-last", "G", "Move to last item", "calendar-today-due-panel", () => selectCalendarBoundaryItem(controller, "last")),
    calendarBinding("calendars.edit-due-schedule", "e", "Edit selected schedule", "calendar-today-due-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding("calendars.edit-title", "Enter", "Edit selected title", "calendar-today-due-panel", () => canEditCalendar(controller) && controller.startTitleEdit()),
    calendarBinding("calendars.edit-body", "l", "Edit selected body", "calendar-today-due-panel", () => canEditCalendar(controller) && controller.startBodyEdit()),
    calendarBinding("calendars.open-detail", "Enter", "Open full detail", "calendar-today-due-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.associate-project-due", "P", "Associate to project", "calendar-today-due-panel", () => openProjectAssociateFromKeybind(controller, openProjectAssociate)),
    calendarBinding("calendars.ongoing", "o", "Mark as on going", "calendar-today-due-panel", () => runMarkAsOnGoing(controller, selectOnGoingCalendar, setActiveScreen)),
    calendarBinding("calendars.done", "x", "Mark as done", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.markAsDone, "Failed to mark calendar as done")),
    calendarBinding("calendars.delete", "d", "Delete selected calendar", "calendar-today-due-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
    calendarBinding("calendars.undo-due", "u", "Undo last action", "calendar-today-due-panel", controller.undo),
    { ...calendarBinding("calendars.redo-due", "r", "Redo last action", "calendar-today-due-panel", controller.redo), ctrl: true }
  ];
}

function buildDoneTodayPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, openProjectAssociate: () => void): KeybindDefinition[] {
  return [
    calendarBinding("calendars.focus-due-from-done", "1", "Focus due calendar panel", "calendar-today-done-panel", () => focusCalendarPanel(controller, "due")),
    calendarBinding("calendars.focus-done", "2", "Focus completed today panel", "calendar-today-done-panel", () => focusCalendarPanel(controller, "done-today")),
    calendarBinding("calendars.move-done-down", "j", "Move down", "calendar-today-done-panel", () => moveCalendarSelection(controller, "next")),
    calendarBinding("calendars.move-done-up", "k", "Move up", "calendar-today-done-panel", () => moveCalendarSelection(controller, "previous")),
    calendarBinding("calendars.move-done-first", "g", "Move to first item", "calendar-today-done-panel", () => selectCalendarBoundaryItem(controller, "first"), false, ["g", "g"]),
    calendarBinding("calendars.move-done-last", "G", "Move to last item", "calendar-today-done-panel", () => selectCalendarBoundaryItem(controller, "last")),
    calendarBinding("calendars.edit-done-schedule", "e", "Edit selected schedule", "calendar-today-done-panel", () => openCalendarScheduleDialog(controller, openScheduleEdit)),
    calendarBinding("calendars.open-done-detail", "Enter", "Open full detail", "calendar-today-done-panel", () => openCalendarDetailPage(controller, setActiveScreen), true, ["Enter"]),
    calendarBinding("calendars.associate-project-done", "P", "Associate to project", "calendar-today-done-panel", () => openProjectAssociateFromKeybind(controller, openProjectAssociate)),
    calendarBinding("calendars.restore-done", "r", "Reset status for selected calendar", "calendar-today-done-panel", () => runCalendarAction(canEditCalendar(controller), controller.restoreSelected, "Failed to restore calendar")),
    calendarBinding("calendars.delete-done", "d", "Delete selected calendar", "calendar-today-done-panel", () => runCalendarAction(canEditCalendar(controller), controller.deleteSelected, "Failed to delete calendar")),
    calendarBinding("calendars.undo-done", "u", "Undo last action", "calendar-today-done-panel", controller.undo),
    { ...calendarBinding("calendars.redo-done", "r", "Redo last action", "calendar-today-done-panel", controller.redo), ctrl: true }
  ];
}

function buildPanelBindings(controller: CalendarWorkspaceController, setActiveScreen: (screen: ScreenId) => void, openScheduleEdit: () => void, selectOnGoingCalendar: (id: string) => void, openProjectAssociate: () => void): KeybindDefinition[] {
  if (controller.activeSubview === "completed") {
    return buildCompletedPanelBindings(controller, setActiveScreen, openScheduleEdit);
  }
  if (controller.activeSubview === "deleted") {
    return buildDeletedPanelBindings(controller, setActiveScreen, openScheduleEdit);
  }
  if (controller.activeSubview === "weekly") {
    return buildWeeklyPanelBindings(controller, setActiveScreen, openScheduleEdit, selectOnGoingCalendar, openProjectAssociate);
  }
  return [
    ...buildDuePanelBindings(controller, setActiveScreen, openScheduleEdit, selectOnGoingCalendar, openProjectAssociate),
    ...buildDoneTodayPanelBindings(controller, setActiveScreen, openScheduleEdit, openProjectAssociate)
  ];
}

function buildDetailBindings(controller: CalendarWorkspaceController, openLink: () => void, openAsset: () => void, openProjectAssociate: () => void): KeybindDefinition[] {
  return [
    { ...calendarBinding("calendars.focus-active-list", "h", "Focus active calendar panel", "calendar-detail", () => controller.setActiveZone(activePanelZone(controller.activePanel))), ctrl: true },
    calendarBinding("calendars.associate-project-detail", "P", "Associate to project", "calendar-detail", () => openProjectAssociateFromKeybind(controller, openProjectAssociate)),
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

export function activePanelZone(panel: CalendarPanel): FocusZoneId {
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

/**
 * Builds all keybindings for the calendar workspace views and panels.
 *
 * @example buildCalendarKeybinds(controller, setActiveScreen, openEdit, selectOnGoing, openLink, openAsset, openProjectAssociate)
 */
export function buildCalendarKeybinds(
  controller: CalendarWorkspaceController,
  setActiveScreen: (screen: ScreenId) => void,
  openScheduleEdit: () => void,
  selectOnGoingCalendar: (id: string) => void,
  openLink: () => void,
  openAsset: () => void,
  openProjectAssociate: () => void
): KeybindDefinition[] {
  return [
    ...buildSubviewBindings(controller),
    ...buildPanelBindings(controller, setActiveScreen, openScheduleEdit, selectOnGoingCalendar, openProjectAssociate),
    ...buildDetailBindings(controller, openLink, openAsset, openProjectAssociate)
  ];
}
