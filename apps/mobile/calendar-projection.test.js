import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarEntriesForDate,
  calendarGroupLabel,
  filterCalendarEntries,
  localIsoDate,
  millisecondsUntilNextLocalDay
} from "./calendar-projection.js";

test("calendarEntriesForDate uses server projection for the matching local date", () => {
  const serverEntry = { id: "server", sourceKind: "NEXT_ACTION", temporalState: "DUE_TODAY", date: "2026-10-09" };
  const bootstrap = { calendarLocalDate: "2026-10-09", calendarEntries: [serverEntry], calendar: [], nextActions: [] };

  assert.deepEqual(calendarEntriesForDate(bootstrap, "2026-10-09"), [serverEntry]);
});

test("calendarEntriesForDate reclassifies cached next action deadlines when local date changes", () => {
  const bootstrap = {
    calendarLocalDate: "2026-10-09",
    calendarEntries: [],
    calendar: [],
    nextActions: [{ id: "n-1", title: "Submit report", deadline: "2026-10-09", status: "NEXT_ACTION", projectTitle: null, createdAt: "2026-10-01T10:00:00Z" }]
  };

  const [entry] = calendarEntriesForDate(bootstrap, "2026-10-10");

  assert.equal(entry.sourceKind, "NEXT_ACTION");
  assert.equal(entry.temporalState, "OVERDUE");
  assert.equal(entry.date, "2026-10-09");
});

test("today includes overdue and due entries while week uses the local Monday-to-Sunday range", () => {
  const entries = [
    { id: "old", date: "2026-10-08", temporalState: "OVERDUE", sourceKind: "NEXT_ACTION" },
    { id: "today", date: "2026-10-09", temporalState: "DUE_TODAY", sourceKind: "NEXT_ACTION" },
    { id: "weekend", date: "2026-10-11", temporalState: "WEEK", sourceKind: "NEXT_ACTION" },
    { id: "next-week", date: "2026-10-12", temporalState: "WEEK", sourceKind: "NEXT_ACTION" }
  ];

  assert.deepEqual(filterCalendarEntries(entries, "today", "2026-10-09").map((item) => item.id), ["old", "today"]);
  assert.deepEqual(filterCalendarEntries(entries, "week", "2026-10-09").map((item) => item.id), ["old", "today", "weekend"]);
});

test("calendarGroupLabel exposes Today group headings and omits weekly entries", () => {
  assert.equal(calendarGroupLabel("SCHEDULED_TODAY"), "Scheduled today");
  assert.equal(calendarGroupLabel("OVERDUE"), "Overdue");
  assert.equal(calendarGroupLabel("DUE_TODAY"), "Due today");
  assert.equal(calendarGroupLabel("WEEK"), null);
});

test("localIsoDate formats the local civil date without UTC conversion", () => {
  assert.equal(localIsoDate(new Date(2026, 9, 9, 23, 30)), "2026-10-09");
});

test("millisecondsUntilNextLocalDay schedules the next local midnight", () => {
  const now = new Date(2026, 9, 9, 23, 59, 30);
  assert.equal(millisecondsUntilNextLocalDay(now), 30_000);
});
