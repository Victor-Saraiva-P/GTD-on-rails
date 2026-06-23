import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  recurringTemplateDetailMetadata,
  recurringTemplateRecurrenceLabel
} from "../src/features/recurring-calendar-templates/recurringCalendarTemplateDisplay.ts";
import {
  moveRecurringCalendarTemplateSelection,
  recurringCalendarTemplateSelectionOffsetIndex,
  selectRecurringCalendarTemplateBoundary,
  selectedRecurringCalendarTemplate,
  selectedRecurringCalendarTemplateIndex
} from "../src/features/recurring-calendar-templates/recurringCalendarTemplateSelection.ts";
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

  test("builds detail metadata for selected template", () => {
    assert.deepEqual(recurringTemplateDetailMetadata(template({ intervalValue: 2, recurrenceUnit: "week" })), {
      recurrence: "Every 2 weeks from 21/05/2026",
      title: "Trash"
    });
  });

  test("selects requested template or falls back to first template", () => {
    const templates = [template({ id: "template-1" }), template({ id: "template-2" })];

    assert.equal(selectedRecurringCalendarTemplate(templates, "template-2")?.id, "template-2");
    assert.equal(selectedRecurringCalendarTemplate(templates, "missing")?.id, "template-1");
  });

  test("clamps recurring template movement within list bounds", () => {
    const templates = [template({ id: "template-1" }), template({ id: "template-2" })];
    const selected = selectedRecurringCalendarTemplate(templates, "template-2");

    assert.equal(selectedRecurringCalendarTemplateIndex(templates, selected), 1);
    assert.equal(recurringCalendarTemplateSelectionOffsetIndex({ templates, selectedIndex: 1 }, 1), 1);
    assert.equal(recurringCalendarTemplateSelectionOffsetIndex({ templates, selectedIndex: 1 }, -1), 0);
  });

  test("moves recurring template selection and selects boundaries", () => {
    const templates = [template({ id: "template-1" }), template({ id: "template-2" })];
    const selectedIds: (string | null)[] = [];
    const cursor = { templates, selectedIndex: 0, setSelectedId: (id: string | null) => selectedIds.push(id) };

    moveRecurringCalendarTemplateSelection(cursor, 1);
    selectRecurringCalendarTemplateBoundary(cursor, "first");
    selectRecurringCalendarTemplateBoundary(cursor, "last");

    assert.deepEqual(selectedIds, ["template-2", "template-1", "template-2"]);
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
