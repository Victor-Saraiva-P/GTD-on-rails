import assert from "node:assert/strict";
import test, { describe, mock } from "node:test";

import { optimisticMutate } from "../src/lib/api/optimistic.ts";

describe("optimisticMutate", () => {
  test("applies optimistic update and resolves on success", async () => {
    let state = ["item1", "item2"];
    const current = () => state;
    const set = (next: string[]) => { state = next; };
    const mutate = mock.fn(async () => "done");
    const onSuccess = mock.fn();

    const result = await optimisticMutate({
      current,
      applyOptimistic: (s) => s.filter((item) => item !== "item1"),
      set,
      mutate,
      onSuccess
    });

    assert.equal(result, "done");
    assert.deepEqual(state, ["item2"]);
    assert.equal(mutate.mock.callCount(), 1);
    assert.equal(onSuccess.mock.callCount(), 1);
    assert.deepEqual(onSuccess.mock.calls[0].arguments, ["done"]);
  });

  test("rolls back state and calls onError when mutation rejects", async () => {
    let state = ["item1", "item2"];
    const current = () => state;
    const set = (next: string[]) => { state = next; };
    const error = new Error("Network failure");
    const mutate = mock.fn(async () => {
      throw error;
    });
    const onError = mock.fn();

    await assert.rejects(
      async () => {
        await optimisticMutate({
          current,
          applyOptimistic: (s) => s.filter((item) => item !== "item1"),
          set,
          mutate,
          onError
        });
      },
      (err: unknown) => {
        assert.equal(err, error);
        return true;
      }
    );

    assert.deepEqual(state, ["item1", "item2"]);
    assert.equal(onError.mock.callCount(), 1);
    assert.deepEqual(onError.mock.calls[0].arguments, [error, ["item1", "item2"]]);
  });
});
