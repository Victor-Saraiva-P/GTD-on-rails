import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { recurringTemplateRecurrenceLabel } from "../src/features/recurring-calendar-templates/recurringCalendarTemplateDisplay.ts";
import type { RecurringCalendarTemplate } from "../src/features/recurring-calendar-templates/types.ts";

describe("recurring calendar template list", () => {
  test("summarizes weekly recurrence with optional time and end date", () => {
    assert.equal(
      recurringTemplateRecurrenceLabel(template({ intervalValue: 2, recurrenceUnit: "week", scheduledTime: "09:30:00", endDate: "2026-06-21" })),
      "Every 2 weeks from 21/05/2026 at 09:30 until 21/06/2026"
    );
  });

  test("summarizes open-ended daily recurrence", () => {
    assert.equal(recurringTemplateRecurrenceLabel(template({})), "Every day from 21/05/2026");
  });
});

function template(overrides: Partial<RecurringCalendarTemplate>): RecurringCalendarTemplate {
  return {
    id: "template-1",
    title: "Trash",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    startDate: "2026-05-21",
    scheduledTime: null,
    intervalValue: 1,
    recurrenceUnit: "day",
    weeklyWeekdays: [],
    endDate: null,
    ...overrides
  };
}
