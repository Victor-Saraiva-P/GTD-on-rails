import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { mergeAndSortOnGoingItems } from "../src/features/ongoing/onGoingListOrdering.ts";
import type { NextAction } from "../src/features/next-actions/types.ts";
import type { Calendar } from "../src/features/calendar/types.ts";

describe("On Going list ordering", () => {
  test("merges next actions and calendars and sorts by schedule start ascending", () => {
    const na1 = nextAction("na-1", "2026-06-20", "10:00");
    const na2 = nextAction("na-2", "2026-06-21", "09:00");
    const cal1 = calendar("cal-1", "2026-06-20", "09:30");
    const cal2 = calendar("cal-2", "2026-06-22", "11:00");

    const merged = mergeAndSortOnGoingItems([na1, na2], [cal1, cal2]);

    assert.equal(merged.length, 4);
    assert.equal(merged[0]?.item.id, "cal-1"); // 09:30
    assert.equal(merged[1]?.item.id, "na-1"); // 10:00
    assert.equal(merged[2]?.item.id, "na-2"); // 21st 09:00
    assert.equal(merged[3]?.item.id, "cal-2"); // 22nd 11:00

    assert.equal(merged[0]?.type, "calendar");
    assert.equal(merged[1]?.type, "next-action");
  });

  test("pushes items without schedule start to the end", () => {
    const na1 = nextAction("na-1", "2026-06-20", "10:00");
    const na2 = nextAction("na-2", null, null);
    const cal1 = calendar("cal-1", "2026-06-20", "09:30");

    const merged = mergeAndSortOnGoingItems([na1, na2], [cal1]);

    assert.equal(merged.length, 3);
    assert.equal(merged[0]?.item.id, "cal-1");
    assert.equal(merged[1]?.item.id, "na-1");
    assert.equal(merged[2]?.item.id, "na-2");
  });

  test("handles empty lists", () => {
    const merged = mergeAndSortOnGoingItems([], []);
    assert.equal(merged.length, 0);
  });
});

function nextAction(id: string, dateStart: string | null, timeStart: string | null): NextAction {
  return {
    id,
    title: `NA ${id}`,
    body: null,
    status: "ONGOING",
    schedule: { dateStart, timeStart },
    createdAt: "2026-05-01T00:00:00Z"
  };
}

function calendar(id: string, dateStart: string | null, timeStart: string | null): Calendar {
  return {
    id,
    title: `Cal ${id}`,
    body: null,
    status: "ONGOING",
    scheduledDate: "2026-06-01",
    scheduledTime: null,
    schedule: { dateStart, timeStart },
    createdAt: "2026-05-01T00:00:00Z"
  };
}
