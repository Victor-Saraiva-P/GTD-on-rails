import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  actualCalendarScheduleLabel,
  formatCalendarDate,
  getMonday,
  getMondayForOffset,
  initialCalendarScheduleDraft,
  resolveTodayWeeklyPanel,
  resolveWeeklyOffset,
  saveCalendarScheduleDraft,
  statedCalendarScheduleLabel,
  trimCalendarDisplayTime
} from "../src/features/calendar/calendarDateUtils.ts";
import type { Calendar } from "../src/features/calendar/types.ts";

function calendar(scheduledTime: string | null): Calendar {
  return {
    id: "cal-1",
    title: "Appointment",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    createdAt: "",
    scheduledDate: "2026-05-21",
    scheduledTime,
    status: "CALENDAR"
  };
}

describe("getMonday", () => {
  test("returns Monday for a Wednesday input", () => {
    // 2026-05-20 is a Wednesday
    const result = getMonday(new Date(2026, 4, 20));
    assert.equal(result.getDay(), 1); // Monday
    assert.equal(result.getDate(), 18);
  });

  test("returns same day when input is already Monday", () => {
    // 2026-05-18 is a Monday
    const result = getMonday(new Date(2026, 4, 18));
    assert.equal(result.getDay(), 1);
    assert.equal(result.getDate(), 18);
  });

  test("returns previous Monday for a Sunday input", () => {
    // 2026-05-24 is a Sunday
    const result = getMonday(new Date(2026, 4, 24));
    assert.equal(result.getDay(), 1);
    assert.equal(result.getDate(), 18);
  });
});

describe("formatCalendarDate", () => {
  test("formats date as YYYY-MM-DD with zero-padded month and day", () => {
    assert.equal(formatCalendarDate(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(formatCalendarDate(new Date(2026, 11, 25)), "2026-12-25");
  });
});

describe("getMondayForOffset", () => {
  test("offset 0 returns this week's Monday", () => {
    const result = getMondayForOffset(0);
    const expected = getMonday(new Date());
    assert.equal(formatCalendarDate(result), formatCalendarDate(expected));
  });

  test("offset -1 returns previous week's Monday (7 days earlier)", () => {
    const thisMonday = getMondayForOffset(0);
    const lastMonday = getMondayForOffset(-1);
    const diffDays = (thisMonday.getTime() - lastMonday.getTime()) / (1000 * 60 * 60 * 24);
    assert.equal(diffDays, 7);
    assert.equal(lastMonday.getDay(), 1);
  });

  test("offset +1 returns next week's Monday (7 days later)", () => {
    const thisMonday = getMondayForOffset(0);
    const nextMonday = getMondayForOffset(1);
    const diffDays = (nextMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24);
    assert.equal(diffDays, 7);
    assert.equal(nextMonday.getDay(), 1);
  });

  test("offset +3 returns Monday three weeks ahead", () => {
    const thisMonday = getMondayForOffset(0);
    const futureMonday = getMondayForOffset(3);
    const diffDays = (futureMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24);
    assert.equal(diffDays, 21);
  });
});

describe("calendar display time", () => {
  test("hides seconds when API time includes them", () => {
    assert.equal(trimCalendarDisplayTime("21:00:00"), "21:00");
  });

  test("hides milliseconds and trailing chars when API time includes them", () => {
    assert.equal(trimCalendarDisplayTime("14:54:17.118"), "14:54");
    assert.equal(trimCalendarDisplayTime("14:54:17.118Z"), "14:54");
  });

  test("keeps HH:mm values unchanged", () => {
    assert.equal(trimCalendarDisplayTime("21:00"), "21:00");
  });

  test("keeps missing times absent", () => {
    assert.equal(trimCalendarDisplayTime(null), null);
    assert.equal(trimCalendarDisplayTime(undefined), null);
  });
});

describe("calendar schedule labels", () => {
  test("formats stated calendar date with optional time", () => {
    assert.equal(statedCalendarScheduleLabel("2026-05-21", "21:00:00"), "05/21/2026 21:00");
    assert.equal(statedCalendarScheduleLabel("2026-05-21", null), "05/21/2026");
  });

  test("formats actual schedule windows with arrow style", () => {
    const label = actualCalendarScheduleLabel({
      dateStart: "2026-05-21",
      timeStart: "09:00:00",
      dateEnd: "2026-05-21",
      timeEnd: "10:30:00"
    });

    assert.equal(label, "05/21/2026 09:00 → 05/21/2026 10:30");
  });

  test("omits missing actual schedule windows", () => {
    assert.equal(actualCalendarScheduleLabel(undefined), null);
    assert.equal(actualCalendarScheduleLabel({}), null);
  });
});

describe("weekly movement helpers", () => {
  test("resolves previous and next week offsets", () => {
    assert.equal(resolveWeeklyOffset(2, "previous"), 1);
    assert.equal(resolveWeeklyOffset(2, "next"), 3);
  });

  test("resolves today's weekday panel from a Monday-start week", () => {
    assert.equal(resolveTodayWeeklyPanel(new Date(2026, 4, 18)), "mon");
    assert.equal(resolveTodayWeeklyPanel(new Date(2026, 4, 24)), "sun");
  });
});

describe("calendar schedule edit draft", () => {
  test("initializes from selected calendar date and HH:mm:ss time", () => {
    assert.deepEqual(initialCalendarScheduleDraft(calendar("09:30:00")), {
      scheduledDate: "2026-05-21",
      timeDigits: "0930"
    });
  });

  test("initializes empty time when selected calendar has no time", () => {
    assert.deepEqual(initialCalendarScheduleDraft(calendar(null)), {
      scheduledDate: "2026-05-21",
      timeDigits: ""
    });
  });

  test("saves date with optional HH:mm time", () => {
    assert.deepEqual(saveCalendarScheduleDraft("2026-05-22", "2130"), {
      scheduledDate: "2026-05-22",
      scheduledTime: "21:30"
    });
    assert.deepEqual(saveCalendarScheduleDraft("2026-05-22", ""), {
      scheduledDate: "2026-05-22",
      scheduledTime: null
    });
  });
});
