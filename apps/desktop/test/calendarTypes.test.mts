import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  calendarWorkspaceItemDate,
  isNextActionCalendarEntry,
  toCalendarEntry,
  type Calendar
} from "../src/features/calendar/types.ts";

const calendar: Calendar = {
  id: "cal-1",
  title: "Meeting",
  body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
  createdAt: "",
  scheduledDate: "2026-05-21",
  scheduledTime: "09:00",
  status: "CALENDAR"
};

describe("calendar workspace item types", () => {
  test("preserves projected next action identity and deadline date", () => {
    const entry = toCalendarEntry({
      id: "next-1",
      sourceKind: "NEXT_ACTION",
      temporalState: "DUE_TODAY",
      title: "Submit report",
      body: null,
      deadline: "2026-05-21",
      status: "NEXT_ACTION",
      estimatedTime: "PT45M"
    });

    assert.equal(isNextActionCalendarEntry(entry), true);
    assert.equal(calendarWorkspaceItemDate(entry), "2026-05-21");
    assert.equal(entry.scheduledDate, null);
    assert.deepEqual(entry.estimatedTime, { hours: 0, minutes: 45 });
  });

  test("uses scheduled date for native calendar items", () => {
    assert.equal(isNextActionCalendarEntry(calendar), false);
    assert.equal(calendarWorkspaceItemDate(calendar), "2026-05-21");
  });
});
