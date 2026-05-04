import assert from "node:assert/strict";
import test from "node:test";

import {
  formatStuffCreatedAt,
  getStuffBodyLines,
  getStuffBodyPreviewLines
} from "../src/features/inbox/types.ts";

test("getStuffBodyLines returns no lines for an empty body", () => {
  assert.deepEqual(getStuffBodyLines(null), []);
  assert.deepEqual(getStuffBodyLines(""), []);
});

test("getStuffBodyLines trims text and removes bullet markers", () => {
  const body = "  - Capture idea\n* Clarify next action\n• Ship it  ";
  assert.deepEqual(
    getStuffBodyLines(body),
    ["Capture idea", "Clarify next action", "Ship it"]
  );
});

test("getStuffBodyPreviewLines preserves blank lines and spacing", () => {
  const body = "  first line\n\nthird line  ";
  assert.deepEqual(getStuffBodyPreviewLines(body), ["  first line", "", "third line  "]);
  assert.deepEqual(getStuffBodyPreviewLines(null), []);
});

test("formatStuffCreatedAt formats a date string", () => {
  const dateString = "2026-05-01T15:00:00Z";
  const formatted = formatStuffCreatedAt(dateString);
  assert.ok(formatted.length > 0);
  assert.ok(typeof formatted === "string");
});
