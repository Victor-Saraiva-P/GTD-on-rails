import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import {
  fetchDeletedNextActions,
  fetchDoneNextActions,
  fetchNextActions,
  patchNextActionAttributes,
  recoverDeletedNextAction,
  restoreNextActionStatus
} from "../src/features/next-actions/api.ts";

describe("next actions API", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetchNextActions omits context when no filter is selected", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/next-actions?orderBy=energy"));
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const items = await fetchNextActions({ contextId: null, currentEnergy: null, currentTimeMinutes: null, orderBy: "energy" });

    assert.deepEqual(items, []);
  });

  test("fetchNextActions includes context when filter is selected", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/next-actions?orderBy=time&contextId=ctx-1"));
      return new Response(JSON.stringify([]), { status: 200 });
    });

    await fetchNextActions({ contextId: "ctx-1", currentEnergy: null, currentTimeMinutes: null, orderBy: "time" });
  });

  test("fetchNextActions includes availability when priority sorting", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/next-actions?orderBy=priority&currentEnergy=3.0&currentTimeMinutes=45"));
      return new Response(JSON.stringify([]), { status: 200 });
    });

    await fetchNextActions({ contextId: null, currentEnergy: 3, currentTimeMinutes: 45, orderBy: "priority" });
  });

  test("patchNextActionAttributes sends next action metadata", async () => {
    const response = { id: "na-1", title: "Call", body: "", energy: "7.0", estimatedTime: "PT30M", deadline: "2026-06-01", status: "NEXT_ACTION" };
    const patch = { energy: 7, estimatedTime: { hours: 0, minutes: 30 }, deadline: "2026-06-01", contextIds: ["ctx-1"] };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/next-actions/na-1"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify(patch));
      return new Response(JSON.stringify(response), { status: 200 });
    });

    const item = await patchNextActionAttributes("na-1", patch);

    assert.equal(item.energy, 7);
    assert.deepEqual(item.estimatedTime, { hours: 0, minutes: 30 });
    assert.equal(item.deadline, "2026-06-01");
  });

  test("fetchDoneNextActions maps paged content", async () => {
    const response = { content: [{ id: "na-1", title: "Call", body: "", status: "DONE" }] };
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/next-actions/done?page=0&size=100"));
      return new Response(JSON.stringify(response), { status: 200 });
    });

    const items = await fetchDoneNextActions();

    assert.equal(items[0].status, "DONE");
  });

  test("fetchDeletedNextActions loads deleted next actions", async () => {
    const response = [{ id: "na-1", title: "Call", body: "", status: "NEXT_ACTION" }];
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/next-actions/deleted"));
      return new Response(JSON.stringify(response), { status: 200 });
    });

    const items = await fetchDeletedNextActions();

    assert.equal(items[0].id, "na-1");
  });

  test("restoreNextActionStatus posts to restore endpoint", async () => {
    const response = { id: "na-1", title: "Call", body: "", status: "NEXT_ACTION" };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/next-actions/na-1/restore"));
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify(response), { status: 200 });
    });

    const item = await restoreNextActionStatus("na-1");

    assert.equal(item.status, "NEXT_ACTION");
  });

  test("recoverDeletedNextAction restores the item", async () => {
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/items/na-1/restore"));
      assert.equal(init?.method, "POST");
      return new Response(null, { status: 204 });
    });

    await recoverDeletedNextAction("na-1");
  });
});
