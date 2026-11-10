import assert from "node:assert/strict";
import test from "node:test";
import { reviewKeyAction } from "../src/features/agent-processing/reviewKeyAction.ts";

test("review shortcuts select only available choices", () => {
  assert.deepEqual(reviewKeyAction("1", 2, false, false, true), { select: 0 });
  assert.deepEqual(reviewKeyAction("2", 2, false, false, true), { select: 1 });
  assert.equal(reviewKeyAction("3", 2, false, false, true), null);
  assert.equal(reviewKeyAction("0", 2, false, false, true), null);
});

test("review shortcuts confirm, close or process manually regardless of row focus", () => {
  assert.equal(reviewKeyAction("Enter", 2, false, false, false), "confirm");
  assert.equal(reviewKeyAction("Escape", 2, false, false, false), "close");
  assert.equal(reviewKeyAction("p", 2, false, false, false), "manual");
});

test("review shortcuts do not interfere with typing or native button activation", () => {
  for (const key of ["1", "2", "3", "Enter", "p"]) {
    assert.equal(reviewKeyAction(key, 3, true, false, true), null);
  }
  assert.equal(reviewKeyAction("Enter", 2, false, true, true), null);
  assert.equal(reviewKeyAction("Escape", 2, true, false, false), null);
  assert.equal(reviewKeyAction("Escape", 2, true, false, true), "close");
});
