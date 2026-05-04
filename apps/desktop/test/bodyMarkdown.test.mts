import assert from "node:assert/strict";
import test from "node:test";

import {
  createSaveItemBodyCommand,
  MAX_MARKDOWN_BODY_LENGTH,
  normalizeMarkdownBody
} from "../src/features/inbox/bodyMarkdown.ts";

test("normalizeMarkdownBody converts missing body to empty markdown", () => {
  assert.equal(normalizeMarkdownBody(null), "");
  assert.equal(normalizeMarkdownBody(undefined), "");
});

test("normalizeMarkdownBody preserves markdown whitespace and line breaks", () => {
  assert.equal(normalizeMarkdownBody("  # Title\r\n\n- item  "), "  # Title\n\n- item  ");
});

test("normalizeMarkdownBody rejects unsupported control characters", () => {
  assert.throws(
    () => normalizeMarkdownBody("bad\u0001body"),
    /body character U\+0001 is invalid/
  );
});

test("normalizeMarkdownBody rejects oversized markdown", () => {
  assert.throws(
    () => normalizeMarkdownBody("a".repeat(MAX_MARKDOWN_BODY_LENGTH + 1)),
    /expected at most 100000 characters/
  );
});

test("createSaveItemBodyCommand saves normalized editor markdown", async () => {
  const savedBodies: string[] = [];
  const command = createSaveItemBodyCommand((body) => savedBodies.push(body));
  const handled = command(fakeEditorView("one\r\ntwo"));

  await Promise.resolve();

  assert.equal(handled, true);
  assert.deepEqual(savedBodies, ["one\ntwo"]);
});

function fakeEditorView(markdown: string) {
  return {
    state: {
      doc: {
        toString: () => markdown
      }
    }
  };
}
