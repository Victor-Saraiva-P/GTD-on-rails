import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_NEXT_ACTION_ORDER, nextOrder } from "../src/features/next-actions/orderCycle.ts";

test("default next action order is priority", () => {
  assert.equal(DEFAULT_NEXT_ACTION_ORDER, "priority");
});

test("nextOrder cycles priority -> time -> energy", () => {
  assert.equal(nextOrder("priority"), "time");
  assert.equal(nextOrder("time"), "energy");
  assert.equal(nextOrder("energy"), "priority");
});
