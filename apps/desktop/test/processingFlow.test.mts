import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  buildCalendarPayload,
  buildRecurringCalendarTemplatePayload,
  clockTimeDisplayValue,
  initialSegmentedCalendarDateState,
  isSegmentedCalendarDateValid,
  moveSegmentedCalendarDateFocus,
  nextClockTimeDigits,
  nextSegmentedCalendarDateDigit,
  previousProcessingStep,
  segmentedCalendarDateDisplayValue,
  segmentedCalendarDateIsoValue,
  segmentedCalendarDateStateFromIsoValue,
  stepAfterInitialChoice
} from "../src/features/processing/processingFlow.ts";
import type { SegmentedCalendarDateState } from "../src/features/processing/processingFlow.ts";

describe("processing flow", () => {
  test("initial keyboard choices branch to next actions or calendar", () => {
    assert.equal(stepAfterInitialChoice("next-action"), "set-deadline");
    assert.equal(stepAfterInitialChoice("calendar"), "set-calendar-date");
    assert.equal(stepAfterInitialChoice("recurring-calendar"), "set-recurring-start-date");
  });

  test("escape goes back after the initial step", () => {
    assert.equal(previousProcessingStep("set-deadline"), "initial");
    assert.equal(previousProcessingStep("select-context"), "set-deadline");
    assert.equal(previousProcessingStep("set-energy"), "select-context");
    assert.equal(previousProcessingStep("set-time"), "set-energy");
    assert.equal(previousProcessingStep("set-calendar-date"), "initial");
    assert.equal(previousProcessingStep("set-calendar-time"), "set-calendar-date");
    assert.equal(previousProcessingStep("set-recurring-start-date"), "initial");
    assert.equal(previousProcessingStep("set-recurring-interval"), "set-recurring-start-date");
    assert.equal(previousProcessingStep("set-recurring-time"), "set-recurring-interval");
    assert.equal(previousProcessingStep("set-recurring-end-date"), "set-recurring-time");
  });

  test("calendar time keyboard input preserves valid HH:mm digits", () => {
    const digits = ["0", "9", "3", "0"].reduce(nextClockTimeDigits, "");
    assert.equal(digits, "0930");
    assert.equal(clockTimeDisplayValue(digits), "09:30");
  });

  test("calendar time keyboard input rejects invalid clock values", () => {
    assert.equal(nextClockTimeDigits("236", "0"), "236");
    assert.equal(nextClockTimeDigits("240", "0"), "240");
    assert.equal(nextClockTimeDigits("2359", "9"), "2359");
  });

  test("segmented calendar date initializes from the local date", () => {
    const state = initialSegmentedCalendarDateState(new Date(2026, 4, 22));

    assert.equal(segmentedCalendarDateDisplayValue(state), "22/05/2026");
    assert.equal(state.activeSegment, "day");
  });

  test("segmented calendar date digit input overwrites and advances", () => {
    let state = initialSegmentedCalendarDateState(new Date(2026, 4, 22));
    state = nextSegmentedCalendarDateDigit(state, "3");

    assert.equal(segmentedCalendarDateDisplayValue(state), "3_/05/2026");
    assert.equal(state.activeSegment, "day");
    assert.equal(isSegmentedCalendarDateValid(state), false);

    state = nextSegmentedCalendarDateDigit(state, "1");
    state = nextSegmentedCalendarDateDigit(state, "1");
    state = nextSegmentedCalendarDateDigit(state, "2");
    state = nextSegmentedCalendarDateDigit(state, "2");
    state = nextSegmentedCalendarDateDigit(state, "0");
    state = nextSegmentedCalendarDateDigit(state, "2");
    state = nextSegmentedCalendarDateDigit(state, "8");

    assert.equal(segmentedCalendarDateDisplayValue(state), "31/12/2028");
    assert.equal(state.activeSegment, "day");
    assert.equal(segmentedCalendarDateIsoValue(state), "2028-12-31");
  });

  test("segmented calendar date movement has walls", () => {
    const state = initialSegmentedCalendarDateState(new Date(2026, 4, 22));
    const monthState = moveSegmentedCalendarDateFocus(state, "l");
    const yearState = moveSegmentedCalendarDateFocus(monthState, "l");

    assert.equal(moveSegmentedCalendarDateFocus(state, "h").activeSegment, "day");
    assert.equal(monthState.activeSegment, "month");
    assert.equal(yearState.activeSegment, "year");
    assert.equal(moveSegmentedCalendarDateFocus(yearState, "l").activeSegment, "year");
    assert.equal(moveSegmentedCalendarDateFocus(yearState, "h").activeSegment, "month");
  });

  test("segmented calendar date validation uses real calendar dates", () => {
    const leapDay = dateState("29", "02", "2028");
    const nonLeapDay = dateState("29", "02", "2026");
    const impossibleDate = dateState("31", "02", "2026");

    assert.equal(isSegmentedCalendarDateValid(leapDay), true);
    assert.equal(segmentedCalendarDateIsoValue(leapDay), "2028-02-29");
    assert.equal(isSegmentedCalendarDateValid(nonLeapDay), false);
    assert.equal(segmentedCalendarDateIsoValue(nonLeapDay), null);
    assert.equal(isSegmentedCalendarDateValid(impossibleDate), false);
  });

  test("segmented calendar date can restore a confirmed ISO date", () => {
    const state = segmentedCalendarDateStateFromIsoValue("2028-02-29");

    if (state === null) assert.fail("Expected 2028-02-29 to restore as a segmented date state.");
    assert.equal(segmentedCalendarDateDisplayValue(state), "29/02/2028");
    assert.equal(state.activeSegment, "day");
    assert.equal(segmentedCalendarDateStateFromIsoValue("2028-02-30"), null);
  });

  test("calendar payload is built only from confirmed date and optional time", () => {
    assert.deepEqual(buildCalendarPayload("2026-05-21", "0930"), {
      scheduledDate: "2026-05-21",
      scheduledTime: "09:30"
    });
    assert.deepEqual(buildCalendarPayload("2026-05-21", ""), {
      scheduledDate: "2026-05-21",
      scheduledTime: null
    });
  });

  test("recurring template payload is built from confirmed wizard choices", () => {
    assert.deepEqual(buildRecurringCalendarTemplatePayload("2026-05-21", "0930", 2, "week", ["MONDAY"], "2026-06-21"), {
      startDate: "2026-05-21",
      scheduledTime: "09:30",
      intervalValue: 2,
      recurrenceUnit: "week",
      weeklyWeekdays: ["MONDAY"],
      endDate: "2026-06-21"
    });
  });
});

function dateState(day: string, month: string, year: string): SegmentedCalendarDateState {
  return {
    day,
    month,
    year,
    activeSegment: "day" as const,
    activeDigitCount: 0
  };
}
