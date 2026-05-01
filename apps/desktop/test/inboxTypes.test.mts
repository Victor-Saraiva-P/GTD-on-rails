import assert from "node:assert/strict";
import test from "node:test";

import { getStuffBodyLines } from "../src/features/inbox/types.ts";

test("getStuffBodyLines returns no lines for an empty body", () => {
  assert.deepEqual(getStuffBodyLines(null), []);
  assert.deepEqual(getStuffBodyLines(""), []);
});

test("getStuffBodyLines trims text and removes bullet markers", () => {
  assert.deepEqual(
    getStuffBodyLines("  - Capture idea\n* Clarify next action\n• Ship it  "),
    ["Capture idea", "Clarify next action", "Ship it"]
  );
});
