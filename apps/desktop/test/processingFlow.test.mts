import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  buildCalendarPayload,
  clockTimeDisplayValue,
  nextClockTimeDigits,
  previousProcessingStep,
  stepAfterInitialChoice
} from "../src/features/processing/processingFlow.ts";

describe("processing flow", () => {
  test("initial keyboard choices branch to next actions or calendar", () => {
    assert.equal(stepAfterInitialChoice("next-action"), "select-context");
    assert.equal(stepAfterInitialChoice("calendar"), "set-calendar-date");
  });

  test("escape goes back after the initial step", () => {
    assert.equal(previousProcessingStep("select-context"), "initial");
    assert.equal(previousProcessingStep("set-energy"), "select-context");
    assert.equal(previousProcessingStep("set-time"), "set-energy");
    assert.equal(previousProcessingStep("set-calendar-date"), "initial");
    assert.equal(previousProcessingStep("set-calendar-time"), "set-calendar-date");
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
});
