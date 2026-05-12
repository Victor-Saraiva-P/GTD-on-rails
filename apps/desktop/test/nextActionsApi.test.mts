import assert from "node:assert/strict";
import test, { afterEach, describe, mock } from "node:test";

import { fetchNextActions, patchNextActionAttributes } from "../src/features/next-actions/api.ts";

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

    const items = await fetchNextActions({ contextId: null, orderBy: "energy" });

    assert.deepEqual(items, []);
  });

  test("fetchNextActions includes context when filter is selected", async () => {
    globalThis.fetch = mock.fn(async (input) => {
      assert.ok(input.toString().endsWith("/next-actions?orderBy=time&contextId=ctx-1"));
      return new Response(JSON.stringify([]), { status: 200 });
    });

    await fetchNextActions({ contextId: "ctx-1", orderBy: "time" });
  });

  test("patchNextActionAttributes sends next action metadata", async () => {
    const response = { id: "na-1", title: "Call", body: "", energy: "7.0", estimatedTime: "PT30M", status: "NEXT_ACTION" };
    const patch = { energy: 7, estimatedTime: { hours: 0, minutes: 30 }, contextIds: ["ctx-1"] };
    globalThis.fetch = mock.fn(async (input, init) => {
      assert.ok(input.toString().endsWith("/next-actions/na-1"));
      assert.equal(init?.method, "PATCH");
      assert.equal(init?.body, JSON.stringify(patch));
      return new Response(JSON.stringify(response), { status: 200 });
    });

    const item = await patchNextActionAttributes("na-1", patch);

    assert.equal(item.energy, 7);
    assert.deepEqual(item.estimatedTime, { hours: 0, minutes: 30 });
  });
});
