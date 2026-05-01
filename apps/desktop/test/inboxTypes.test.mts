import assert from "node:assert/strict";
import test from "node:test";

import { getStuffBodyLines, formatStuffCreatedAt, type Body } from "../src/features/inbox/types.ts";

test("getStuffBodyLines returns no lines for an empty body", () => {
  assert.deepEqual(getStuffBodyLines(null), []);
  assert.deepEqual(getStuffBodyLines({ version: 1, blocks: [] }), []);
});

test("getStuffBodyLines trims text and removes bullet markers", () => {
  const body: Body = {
    version: 1,
    blocks: [
      { id: "1", type: "paragraph", properties: { richText: [{ text: "  - Capture idea" }] } },
      { id: "2", type: "paragraph", properties: { richText: [{ text: "* Clarify next action" }] } },
      { id: "3", type: "paragraph", properties: { richText: [{ text: "• Ship it  " }] } }
    ]
  };
  assert.deepEqual(
    getStuffBodyLines(body),
    ["Capture idea", "Clarify next action", "Ship it"]
  );
});

test("formatStuffCreatedAt formats a date string", () => {
  const dateString = "2026-05-01T15:00:00Z";
  const formatted = formatStuffCreatedAt(dateString);
  assert.ok(formatted.length > 0);
  assert.ok(typeof formatted === "string");
});

