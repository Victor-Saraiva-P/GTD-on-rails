import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  formatCalendarDate,
  getMonday,
  getMondayForOffset
} from "../src/features/calendar/calendarDateUtils.ts";

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
