import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { calendarDetailMetadata } from "../src/features/calendar/calendarDetailMetadata.ts";
import {
  calendarItemsForPanel,
  calendarSelectionOffsetIndex,
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
});

describe("calendar detail metadata", () => {
  test("includes scheduled date and optional time", () => {
    const item = { ...calendar("cal-1", "Appointment"), scheduledTime: "09:30" };

    assert.deepEqual(calendarDetailMetadata(item), {
      title: "Appointment",
      parts: ["scheduled: 2026-05-21", "time: 09:30"]
    });
  });

  test("omits status from detail metadata", () => {
    const metadata = calendarDetailMetadata(calendar("cal-1", "Appointment", "DONE"));

    assert.equal(metadata.parts.some((part) => part.includes("DONE")), false);
    assert.equal(metadata.parts.some((part) => part.toLowerCase().includes("status")), false);
  });
});
