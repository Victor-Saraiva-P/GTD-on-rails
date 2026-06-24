import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import {
  deleteRecurringCalendarTemplate,
  fetchRecurringCalendarTemplates,
  patchRecurringCalendarTemplate,
  processStuffToRecurringCalendarTemplate,
  restoreRecurringCalendarTemplate,
  updateRecurringCalendarTemplateBody
} from "../src/features/recurring-calendar-templates/api.ts";
import type { RecurringCalendarTemplateConversionPayload, RecurringCalendarTemplateUpdate } from "../src/features/recurring-calendar-templates/types.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

describe("recurring calendar template API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const response = {
    id: "template-1",
    title: "Take out trash",
    body: "",
    startDate: "2026-05-21",
    scheduledTime: "09:30:00",
    intervalValue: 1,
    recurrenceUnit: "day",
    weeklyWeekdays: [],
    endDate: null
  };

  test("fetchRecurringCalendarTemplates loads active templates", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/recurring-calendar-templates"));
      return new Response(JSON.stringify([response]), { status: 200 });
    });

    const templates = await fetchRecurringCalendarTemplates();

    assert.equal(templates[0].title, "Take out trash");
    assert.equal(templates[0].scheduledTime, "09:30:00");
  });

  test("processStuffToRecurringCalendarTemplate posts conversion payload", async () => {
    const item: Stuff = { id: "stuff-1", title: "Trash", body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] }, status: "STUFF", createdAt: "" };
    const payload = conversionPayload();
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/inbox/stuff-1/recurring-calendar-template"));
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify(payload));
      return new Response(JSON.stringify(response), { status: 200 });
    });

    await processStuffToRecurringCalendarTemplate(item, payload);
  });

  test("patchRecurringCalendarTemplate sends edit payload", async () => {
    const payload = updatePayload();
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/recurring-calendar-templates/template-1"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify(payload));
      return new Response(JSON.stringify({ ...response, ...payload }), { status: 200 });
    });

    const updated = await patchRecurringCalendarTemplate("template-1", payload);

    assert.equal(updated.title, "Take out trash");
  });

  test("updateRecurringCalendarTemplateBody patches shared item body", async () => {
    const template = { ...response, body: { text: "old", inlineMarks: [], lineBlocks: [], blockEntities: [] } };
    const body = { text: "new", inlineMarks: [], lineBlocks: [], blockEntities: [] };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/recurring-calendar-templates/template-1/body"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify({ body }));
      return new Response(JSON.stringify({ ...template, body }), { status: 200 });
    });

    const updated = await updateRecurringCalendarTemplateBody(template, body);

    assert.deepEqual(updated.body, body);
  });

  test("delete and restore use template endpoints", async () => {
    const calls: string[] = [];
    globalThis.fetch = mock.fn(async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${input.toString()}`);
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(response), { status: 200 });
    });

    await deleteRecurringCalendarTemplate("template-1");
    await restoreRecurringCalendarTemplate("template-1");

    assert.ok(calls[0].startsWith("DELETE "));
    assert.ok(calls[0].endsWith("/recurring-calendar-templates/template-1"));
    assert.ok(calls[1].startsWith("POST "));
    assert.ok(calls[1].endsWith("/recurring-calendar-templates/template-1/restore"));
  });
});

function updatePayload(): RecurringCalendarTemplateUpdate {
  return {
    title: "Take out trash",
    startDate: "2026-05-21",
    scheduledTime: "09:30",
    intervalValue: 1,
    recurrenceUnit: "day",
    weeklyWeekdays: [],
    endDate: null
  };
}

function conversionPayload(): RecurringCalendarTemplateConversionPayload {
  const { title: _title, ...payload } = updatePayload();
  return payload;
}
