import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { calendarDetailMetadata } from "../src/features/calendar/calendarDetailMetadata.ts";
import {
  calendarItemsForPanel,
  calendarSelectionOffsetIndex,
  calendarSubviewTarget,
  resolveWeeklyColumnShift,
  selectedCalendar,
  selectedCalendarIndex,
  type CalendarPanel
} from "../src/features/calendar/calendarWorkspaceState.ts";
import type { Calendar } from "../src/features/calendar/types.ts";

function calendar(id: string, title: string, status: Calendar["status"] = "CALENDAR"): Calendar {
  return {
    id,
    title,
    body: { text: "body", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    createdAt: "",
    scheduledDate: "2026-05-21",
    scheduledTime: null,
    status
  };
}

describe("calendar workspace state", () => {
  test("selects the requested calendar or falls back to the first item", () => {
    const items = [calendar("cal-1", "First"), calendar("cal-2", "Second")];

    assert.equal(selectedCalendar(items, "cal-2")?.title, "Second");
    assert.equal(selectedCalendar(items, "missing")?.title, "First");
  });

  test("tracks selected index for panel movement", () => {
    const items = [calendar("cal-1", "First"), calendar("cal-2", "Second")];
    const selected = selectedCalendar(items, "cal-2");

    assert.equal(selectedCalendarIndex(items, selected), 1);
    assert.equal(calendarSelectionOffsetIndex({ items, selectedIndex: 1 }, 1), 1);
    assert.equal(calendarSelectionOffsetIndex({ items, selectedIndex: 1 }, -1), 0);
  });

  test("uses active panel to choose the selected calendar collection", () => {
    const due = [calendar("due", "Due")];
    const done = [calendar("done", "Done", "DONE")];

    assert.equal(calendarItemsForPanel(due, done, [], [], [], "due")[0].id, "due");
    assert.equal(calendarItemsForPanel(due, done, [], [], [], "done-today" satisfies CalendarPanel)[0].id, "done");
  });

  test("cycles calendar subviews forward with their default panels", () => {
    assert.deepEqual(calendarSubviewTarget("today", "next"), { panel: "mon", subview: "weekly" });
    assert.deepEqual(calendarSubviewTarget("weekly", "next"), { panel: "completed", subview: "completed" });
    assert.deepEqual(calendarSubviewTarget("completed", "next"), { panel: "deleted", subview: "deleted" });
    assert.deepEqual(calendarSubviewTarget("deleted", "next"), { panel: "due", subview: "today" });
  });

  test("cycles calendar subviews backward with their default panels", () => {
    assert.deepEqual(calendarSubviewTarget("today", "previous"), { panel: "deleted", subview: "deleted" });
    assert.deepEqual(calendarSubviewTarget("deleted", "previous"), { panel: "completed", subview: "completed" });
    assert.deepEqual(calendarSubviewTarget("completed", "previous"), { panel: "mon", subview: "weekly" });
    assert.deepEqual(calendarSubviewTarget("weekly", "previous"), { panel: "due", subview: "today" });
  });
});

describe("calendar detail metadata", () => {
  test("includes stated schedule with trimmed optional time", () => {
    const item = { ...calendar("cal-1", "Appointment"), scheduledTime: "09:30:00" };

    assert.deepEqual(calendarDetailMetadata(item), {
      title: "Appointment",
      actualSchedule: null,
      statedSchedule: "05/21/2026 09:30"
    });
  });

  test("includes actual schedule window when present", () => {
    const item = {
      ...calendar("cal-1", "Appointment"),
      schedule: {
        dateStart: "2026-05-21",
        timeStart: "09:30:00",
        dateEnd: "2026-05-21",
        timeEnd: "10:00:00"
      }
    };

    assert.equal(calendarDetailMetadata(item).actualSchedule, "05/21/2026 09:30 → 05/21/2026 10:00");
  });

  test("omits status from detail metadata", () => {
    const metadata = calendarDetailMetadata(calendar("cal-1", "Appointment", "DONE"));

    assert.equal(metadata.statedSchedule.includes("DONE"), false);
    assert.equal(metadata.statedSchedule.toLowerCase().includes("status"), false);
  });
});

describe("resolveWeeklyColumnShift", () => {
  test("moves right within the week without crossing a boundary", () => {
    assert.deepEqual(resolveWeeklyColumnShift("mon", "right"), { kind: "inner", panel: "tue" });
    assert.deepEqual(resolveWeeklyColumnShift("thu", "right"), { kind: "inner", panel: "fri" });
    assert.deepEqual(resolveWeeklyColumnShift("sat", "right"), { kind: "inner", panel: "sun" });
  });

  test("moves left within the week without crossing a boundary", () => {
    assert.deepEqual(resolveWeeklyColumnShift("sun", "left"), { kind: "inner", panel: "sat" });
    assert.deepEqual(resolveWeeklyColumnShift("wed", "left"), { kind: "inner", panel: "tue" });
    assert.deepEqual(resolveWeeklyColumnShift("tue", "left"), { kind: "inner", panel: "mon" });
  });

  test("crossing right boundary from Sunday goes to next week Monday", () => {
    assert.deepEqual(resolveWeeklyColumnShift("sun", "right"), { kind: "boundary", panel: "mon", weekOffsetDelta: 1 });
  });

  test("crossing left boundary from Monday goes to previous week Sunday", () => {
    assert.deepEqual(resolveWeeklyColumnShift("mon", "left"), { kind: "boundary", panel: "sun", weekOffsetDelta: -1 });
  });
});
