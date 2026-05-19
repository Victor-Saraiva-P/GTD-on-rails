import assert from "node:assert/strict";
import test from "node:test";

import {
  createSaveItemBodyCommand,
  MAX_MARKDOWN_BODY_LENGTH,
  normalizeMarkdownBody,
  saveNormalizedMarkdownBody
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

test("saveNormalizedMarkdownBody forwards normalized body", async () => {
  const savedBodies: string[] = [];
  const normalized = await saveNormalizedMarkdownBody("line 1\r\nline 2", (body) => {
    savedBodies.push(body);
  });

  assert.equal(normalized, "line 1\nline 2");
  assert.deepEqual(savedBodies, ["line 1\nline 2"]);
});

test("saveNormalizedMarkdownBody rejects invalid markdown before save", async () => {
  let saveCallCount = 0;

  await assert.rejects(
    () =>
      saveNormalizedMarkdownBody("invalid\u0001body", () => {
        saveCallCount += 1;
      }),
    /body character U\+0001 is invalid/
  );

  assert.equal(saveCallCount, 0);
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
