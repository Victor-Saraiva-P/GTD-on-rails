import assert from "node:assert/strict";
import test from "node:test";

import { hasPotentialClipboardImage } from "../src/features/contexts/contextIconClipboard.ts";

test("hasPotentialClipboardImage rejects missing clipboard data", () => {
  assert.equal(hasPotentialClipboardImage(null), false);
});

test("hasPotentialClipboardImage accepts file-backed clipboard data", () => {
  const clipboardData = {
    types: ["Files"],
    items: []
  };

  assert.equal(hasPotentialClipboardImage(clipboardData), true);
});

test("hasPotentialClipboardImage accepts supported image items", () => {
  const clipboardData = {
    types: [],
    items: [{ kind: "string", type: "image/png" }]
  };

  assert.equal(hasPotentialClipboardImage(clipboardData), true);
});
