import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { Text } from "@codemirror/state";
import {
  findNextHeadingLine,
  isHeadingLineText,
  moveToHeadingMotion,
  registerHeadingMotions
} from "../src/features/inbox/cmHeadingMotion.ts";

describe("cmHeadingMotion", () => {
  describe("isHeadingLineText", () => {
    test("detects markdown headings from h1 to h6", () => {
      assert.equal(isHeadingLineText("# Heading 1"), true);
      assert.equal(isHeadingLineText("## Heading 2"), true);
      assert.equal(isHeadingLineText("### Heading 3"), true);
      assert.equal(isHeadingLineText("###### Heading 6"), true);
    });

    test("handles leading whitespace before hashes", () => {
      assert.equal(isHeadingLineText("  ## Indented Heading"), true);
    });

    test("rejects lines without a space after hashes or plain text", () => {
      assert.equal(isHeadingLineText("#hashtag"), false);
      assert.equal(isHeadingLineText("Plain text paragraph"), false);
      assert.equal(isHeadingLineText("1. Ordered item"), false);
    });
  });

  describe("findNextHeadingLine", () => {
    const doc = Text.of([
      "First intro line",
      "# First Heading",
      "Some paragraph under h1",
      "## Second Heading",
      "More notes here",
      "### Third Heading",
      "Final notes"
    ]);

    test("finds next heading line moving forward", () => {
      const target = findNextHeadingLine(doc, 1, true, 1);
      assert.equal(target, 2);
    });

    test("finds second heading forward when repeat is 2", () => {
      const target = findNextHeadingLine(doc, 1, true, 2);
      assert.equal(target, 4);
    });

    test("returns null when no further headings exist forward", () => {
      const target = findNextHeadingLine(doc, 6, true, 1);
      assert.equal(target, null);
    });

    test("finds previous heading line moving backward", () => {
      const target = findNextHeadingLine(doc, 5, false, 1);
      assert.equal(target, 4);
    });

    test("finds older heading when repeat is 2 moving backward", () => {
      const target = findNextHeadingLine(doc, 5, false, 2);
      assert.equal(target, 2);
    });

    test("returns null when no earlier headings exist backward", () => {
      const target = findNextHeadingLine(doc, 2, false, 1);
      assert.equal(target, null);
    });
  });

  describe("moveToHeadingMotion", () => {
    test("falls back to lastLine when moving forward with no headings left", () => {
      const doc = Text.of(["Just plain line", "Second plain line"]);
      const fakeCm = {
        cm6: { state: { doc } } as never,
        firstLine: () => 0,
        lastLine: () => 1
      };
      const pos = moveToHeadingMotion(fakeCm, { line: 0, ch: 0 }, { forward: true });
      assert.equal(pos.line, 1);
    });

    test("falls back to firstLine when moving backward with no earlier headings", () => {
      const doc = Text.of(["Just plain line", "Second plain line"]);
      const fakeCm = {
        cm6: { state: { doc } } as never,
        firstLine: () => 0,
        lastLine: () => 1
      };
      const pos = moveToHeadingMotion(fakeCm, { line: 1, ch: 0 }, { forward: false });
      assert.equal(pos.line, 0);
    });
  });

  test("registerHeadingMotions executes idempotently", () => {
    assert.doesNotThrow(() => {
      registerHeadingMotions();
      registerHeadingMotions();
    });
  });
});
