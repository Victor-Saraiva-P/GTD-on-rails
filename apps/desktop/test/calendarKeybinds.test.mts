import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  activePanelZone,
  buildCalendarKeybinds,
  canEditCalendar
} from "../src/features/calendar/calendarKeybinds.ts";
import type { CalendarWorkspaceController } from "../src/features/calendar/useCalendarWorkspaceController.ts";
import type { CalendarEntry } from "../src/features/calendar/types.ts";
import type { Project } from "../src/features/projects/types.ts";

function createFakeCalendarEntry(id: string, title = "Sample Calendar"): CalendarEntry {
  return {
    id,
    title,
    scheduledDate: "2026-09-10",
    scheduledTime: "10:00",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    status: "CALENDAR",
    createdAt: new Date().toISOString()
  };
}

class FakeCalendarController {
  activePanel = "due" as const;
  activeSubview = "due" as const;
  selectedItem: CalendarEntry | null = createFakeCalendarEntry("c-1");
  editingId: string | null = null;
  editingBodyId: string | null = null;
  isDeleting = false;
  isLoading = false;
  isUpdating = false;

  focusedPanel = "";
  selectedDirection = "";
  boundaryDirection = "";
  movedColumn = "";
  switchedSubview = "";
  activeZone = "";
  weekMoves = 0;
  focusedTodayWeekCount = 0;
  startTitleEditCalls = 0;
  startBodyEditCalls = 0;
  markAsDoneCalls = 0;
  markAsOnGoingCalls = 0;
  deleteSelectedCalls = 0;
  restoreSelectedCalls = 0;
  recoverDeletedCalls = 0;
  undoCalls = 0;
  redoCalls = 0;

  focusPanel = (panel: string) => { this.focusedPanel = panel; };
  selectNext = () => { this.selectedDirection = "next"; };
  selectPrevious = () => { this.selectedDirection = "previous"; };
  selectFirst = () => { this.boundaryDirection = "first"; };
  selectLast = () => { this.boundaryDirection = "last"; };
  moveColumnLeft = () => { this.movedColumn = "left"; };
  moveColumnRight = () => { this.movedColumn = "right"; };
  moveWeekPrevious = () => { this.weekMoves -= 1; };
  moveWeekNext = () => { this.weekMoves += 1; };
  focusTodayWeek = () => { this.focusedTodayWeekCount += 1; };
  switchToNextSubview = () => { this.switchedSubview = "next"; };
  switchToPreviousSubview = () => { this.switchedSubview = "previous"; };
  setActiveZone = (zone: string) => { this.activeZone = zone; };
  startTitleEdit = () => { this.startTitleEditCalls += 1; };
  startBodyEdit = () => { this.startBodyEditCalls += 1; };
  markAsDone = async () => { this.markAsDoneCalls += 1; };
  markAsOnGoing = async () => { this.markAsOnGoingCalls += 1; };
  deleteSelected = async () => { this.deleteSelectedCalls += 1; };
  restoreSelected = async () => { this.restoreSelectedCalls += 1; };
  recoverDeleted = async () => { this.recoverDeletedCalls += 1; };
  undo = () => { this.undoCalls += 1; };
  redo = () => { this.redoCalls += 1; };
}

describe("calendarKeybinds - canEditCalendar", () => {
  test("returns true when controller is idle with a selected item", () => {
    const controller = new FakeCalendarController();
    assert.equal(canEditCalendar(controller as unknown as CalendarWorkspaceController), true);
  });

  test("returns false when there is no selected item", () => {
    const controller = new FakeCalendarController();
    controller.selectedItem = null;
    assert.equal(canEditCalendar(controller as unknown as CalendarWorkspaceController), false);
  });

  test("returns false when loading, deleting, updating, or editing", () => {
    const cases: Array<Partial<FakeCalendarController>> = [
      { isLoading: true },
      { isDeleting: true },
      { isUpdating: true },
      { editingId: "c-1" },
      { editingBodyId: "c-1" }
    ];

    for (const testCase of cases) {
      const controller = new FakeCalendarController();
      Object.assign(controller, testCase);
      assert.equal(canEditCalendar(controller as unknown as CalendarWorkspaceController), false);
    }
  });
});

describe("calendarKeybinds - activePanelZone", () => {
  test("maps active panels to their corresponding focus zones", () => {
    assert.equal(activePanelZone("due"), "calendar-today-due-panel");
    assert.equal(activePanelZone("done-today"), "calendar-today-done-panel");
    assert.equal(activePanelZone("completed"), "calendar-completed-panel");
    assert.equal(activePanelZone("deleted"), "calendar-deleted-panel");
    assert.equal(activePanelZone("mon"), "calendar-mon-panel");
    assert.equal(activePanelZone("tue"), "calendar-tue-panel");
    assert.equal(activePanelZone("wed"), "calendar-wed-panel");
    assert.equal(activePanelZone("thu"), "calendar-thu-panel");
    assert.equal(activePanelZone("fri"), "calendar-fri-panel");
    assert.equal(activePanelZone("sat"), "calendar-sat-panel");
    assert.equal(activePanelZone("sun"), "calendar-sun-panel");
  });
});

describe("calendarKeybinds - buildCalendarKeybinds", () => {
  test("builds today due and done panel keybinds", () => {
    const controller = new FakeCalendarController();
    controller.activeSubview = "due";
    let detailScreen = "";
    let editOpened = false;
    let associateOpened = false;
    let openedOwnerId = "";

    const projects: Project[] = [{ id: "p-1", title: "Project Alpha", deadline: null, doneDate: null, doneTime: null }];
    controller.selectedItem = { ...createFakeCalendarEntry("c-1"), projectId: "p-1", projectTitle: "Project Alpha" };

    const bindings = buildCalendarKeybinds(
      controller as unknown as CalendarWorkspaceController,
      (screen) => { detailScreen = screen; },
      () => { editOpened = true; },
      () => {},
      () => {},
      () => {},
      () => { associateOpened = true; },
      (id) => { openedOwnerId = id; },
      projects
    );

    const dueBindings = bindings.filter((b) => b.zone === "calendar-today-due-panel");
    assert.ok(dueBindings.length > 0);

    const moveDown = dueBindings.find((b) => b.id === "calendars.move-due-down");
    moveDown?.runKeybind();
    assert.equal(controller.selectedDirection, "next");

    const openEdit = dueBindings.find((b) => b.id === "calendars.edit-due-schedule");
    openEdit?.runKeybind();
    assert.equal(editOpened, true);

    const openDetail = dueBindings.find((b) => b.id === "calendars.open-due-detail");
    openDetail?.runKeybind();
    assert.equal(detailScreen, "calendar-detail-page");

    const associate = dueBindings.find((b) => b.id === "calendars.associate-project-due");
    associate?.runKeybind();
    assert.equal(associateOpened, true);

    const ownerNav = dueBindings.find((b) => b.id === "calendars.open-owner-project-due");
    assert.equal(ownerNav?.key, "d");
    assert.deepEqual(ownerNav?.sequence, ["g", "d"]);
    ownerNav?.runKeybind();
    assert.equal(openedOwnerId, "p-1");
  });

  test("builds completed subview keybinds", () => {
    const controller = new FakeCalendarController();
    controller.activeSubview = "completed";

    const bindings = buildCalendarKeybinds(
      controller as unknown as CalendarWorkspaceController,
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {}
    );

    const completedBindings = bindings.filter((b) => b.zone === "calendar-completed-panel");
    assert.ok(completedBindings.length > 0);

    const restore = completedBindings.find((b) => b.id === "calendars.restore-completed");
    restore?.runKeybind();
    assert.equal(controller.restoreSelectedCalls, 1);
  });

  test("builds deleted subview keybinds", () => {
    const controller = new FakeCalendarController();
    controller.activeSubview = "deleted";

    const bindings = buildCalendarKeybinds(
      controller as unknown as CalendarWorkspaceController,
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {}
    );

    const deletedBindings = bindings.filter((b) => b.zone === "calendar-deleted-panel");
    assert.ok(deletedBindings.length > 0);

    const recover = deletedBindings.find((b) => b.id === "calendars.recover-deleted");
    recover?.runKeybind();
    assert.equal(controller.recoverDeletedCalls, 1);
  });

  test("builds weekly subview keybinds for all days", () => {
    const controller = new FakeCalendarController();
    controller.activeSubview = "weekly";

    const bindings = buildCalendarKeybinds(
      controller as unknown as CalendarWorkspaceController,
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {}
    );

    const monBindings = bindings.filter((b) => b.zone === "calendar-mon-panel");
    assert.ok(monBindings.length > 0);

    const focusWed = monBindings.find((b) => b.id === "calendars.focus-wed-from-mon");
    focusWed?.runKeybind();
    assert.equal(controller.focusedPanel, "wed");
  });
});
