import assert from "node:assert/strict";
import test from "node:test";

import { getStuffBodyLines, formatStuffCreatedAt } from "../src/features/inbox/types.ts";

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

test("formatStuffCreatedAt formats a date string", () => {
  const dateString = "2026-05-01T15:00:00Z";
  const formatted = formatStuffCreatedAt(dateString);
  assert.ok(formatted.length > 0);
  assert.ok(typeof formatted === "string");
});

