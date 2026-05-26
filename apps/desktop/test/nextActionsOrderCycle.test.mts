import assert from "node:assert/strict";
import test from "node:test";

import { nextOrder } from "../src/features/next-actions/orderCycle.ts";

test("nextOrder cycles priority -> time -> energy", () => {
  assert.equal(nextOrder("priority"), "time");
  assert.equal(nextOrder("time"), "energy");
  assert.equal(nextOrder("energy"), "priority");
});
