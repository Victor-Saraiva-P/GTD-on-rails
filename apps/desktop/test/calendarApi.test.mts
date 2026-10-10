import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import {
  fetchDoneTodayCalendarEntries,
  fetchOnGoingCalendars,
  fetchTodayCalendarEntries,
  fetchWeekCalendarEntries,
  deleteCalendar,
  markCalendarDone,
  patchCalendar,
  processStuffToCalendar,
  recoverDeletedCalendar,
  resetCalendarStatus,
  updateCalendarBody,
  updateCalendarTitle
} from "../src/features/calendar/api.ts";
import type { Calendar } from "../src/features/calendar/types.ts";
import type { Stuff } from "../src/features/inbox/types.ts";

describe("calendar API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const response = { id: "cal-1", title: "Pay rent", body: "", scheduledDate: "2026-05-21", status: "CALENDAR" };
  const calendar: Calendar = {
    id: "cal-1",
    title: "Pay rent",
    body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] },
    createdAt: "",
    scheduledDate: "2026-05-21",
    scheduledTime: "09:00",
    status: "CALENDAR"
  };

  test("fetchTodayCalendarEntries sends the client local date and preserves next action identity", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/calendars/today?localDate=2026-05-21"));
      return new Response(JSON.stringify([{
        id: "action-1",
        sourceKind: "NEXT_ACTION",
        temporalState: "DUE_TODAY",
        title: "Submit report",
        body: null,
        scheduledDate: null,
        scheduledTime: null,
        deadline: "2026-05-21",
        status: "NEXT_ACTION",
        energy: 4,
        estimatedTime: "PT30M",
        contexts: [{ id: "ctx-1", name: "Laptop" }]
      }]), { status: 200 });
    });

    const entries = await fetchTodayCalendarEntries("2026-05-21");

    assert.equal(entries[0].sourceKind, "NEXT_ACTION");
    assert.equal(entries[0].deadline, "2026-05-21");
    assert.equal(entries[0].scheduledDate, null);
    assert.deepEqual(entries[0].estimatedTime, { hours: 0, minutes: 30 });
  });

  test("fetchDoneTodayCalendarEntries sends the client local date", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/calendars/done/today?localDate=2026-05-21"));
      return new Response(JSON.stringify([{ ...response, sourceKind: "CALENDAR", temporalState: "DONE_TODAY", status: "DONE" }]), { status: 200 });
    });

    const entries = await fetchDoneTodayCalendarEntries("2026-05-21");

    assert.equal(entries[0].sourceKind, "CALENDAR");
    assert.equal(entries[0].status, "DONE");
  });

  test("fetchWeekCalendarEntries sends encoded start date", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/calendars/week?start=2026-05-18"));
      return new Response(JSON.stringify([]), { status: 200 });
    });

    await fetchWeekCalendarEntries("2026-05-18");
  });

  test("patchCalendar sends scheduling patch", async () => {
    const patch = { scheduledDate: "2026-05-22", scheduledTime: "09:30" };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/calendars/cal-1"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify(patch));
      return new Response(JSON.stringify({ ...response, ...patch }), { status: 200 });
    });

    const calendar = await patchCalendar("cal-1", patch);

    assert.equal(calendar.scheduledTime, "09:30");
  });

  test("markCalendarDone posts transition endpoint", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/calendars/cal-1/done"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ ...response, status: "DONE" }), { status: 200 });
    });

    const calendar = await markCalendarDone("cal-1");

    assert.equal(calendar.status, "DONE");
  });

  test("fetchOnGoingCalendars loads ongoing calendars", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/calendars/ongoing"));
      return new Response(JSON.stringify([{ ...response, status: "ONGOING" }]), { status: 200 });
    });

    const calendars = await fetchOnGoingCalendars();

    assert.equal(calendars[0].status, "ONGOING");
  });

  test("resetCalendarStatus posts reset-status endpoint", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/calendars/cal-1/reset-status"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify(response), { status: 200 });
    });

    await resetCalendarStatus("cal-1");
  });

  test("deleteCalendar soft deletes through item endpoint", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/cal-1"));
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: 204 });
    });

    await deleteCalendar("cal-1");
  });

  test("recoverDeletedCalendar posts recover endpoint", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/calendars/cal-1/recover"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify(response), { status: 200 });
    });

    await recoverDeletedCalendar("cal-1");
  });

  test("processStuffToCalendar posts conversion payload", async () => {
    const item: Stuff = { id: "stuff-1", title: "Appointment", body: { text: "", inlineMarks: [], lineBlocks: [], blockEntities: [] }, status: "STUFF", createdAt: "" };
    const payload = { scheduledDate: "2026-05-21", scheduledTime: null };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/inbox/stuff-1/calendar"));
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify(payload));
      return new Response(null, { status: 204 });
    });

    await processStuffToCalendar(item, payload);
  });

  test("updateCalendarTitle persists through item title endpoint", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/cal-1/title"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify({ title: "Updated appointment" }));
      return new Response(JSON.stringify({ id: "cal-1", title: "Updated appointment", body: "", status: "CALENDAR", createdAt: "" }), { status: 200 });
    });

    const updated = await updateCalendarTitle(calendar, "Updated appointment");

    assert.equal(updated.title, "Updated appointment");
    assert.equal(updated.scheduledDate, "2026-05-21");
    assert.equal(updated.scheduledTime, "09:00");
  });

  test("updateCalendarBody persists through item body endpoint", async () => {
    const body = { text: "Bring notes", inlineMarks: [], lineBlocks: [], blockEntities: [] };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/cal-1/body"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify({ body }));
      return new Response(JSON.stringify({ id: "cal-1", title: "Pay rent", body, status: "CALENDAR", createdAt: "" }), { status: 200 });
    });

    const updated = await updateCalendarBody(calendar, body);

    assert.equal(updated.body.text, "Bring notes");
    assert.equal(updated.scheduledDate, "2026-05-21");
  });
});
