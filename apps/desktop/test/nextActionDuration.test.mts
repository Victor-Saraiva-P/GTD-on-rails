import assert from "node:assert/strict";
import test from "node:test";
import { parseEstimatedTime } from "../src/features/next-actions/types.ts";

test("preserves the backend zero-duration representation when reopening an edit", () => {
  assert.deepEqual(parseEstimatedTime("PT0S"), { hours: 0, minutes: 0 });
});

test("parses whole-minute durations and preserves missing estimates", () => {
  assert.deepEqual(parseEstimatedTime("PT1H30M"), { hours: 1, minutes: 30 });
  assert.deepEqual(parseEstimatedTime("PT15M"), { hours: 0, minutes: 15 });
  assert.equal(parseEstimatedTime(null), null);
  assert.equal(parseEstimatedTime("PT30S"), null);
});
