import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { EditorState, Text } from "@codemirror/state";
import {
  collectFoldAllEffects,
  exactFoldAtRange,
  findEnclosingHeadingLine,
  headingFoldingExtension,
  headingLevelAt,
  isCodeFenceLine,
  isLineInsideCodeFence,
  isRangeFolded,
  parseHeadingLevel,
  rangeForHeading,
  registerHeadingFoldVimCommands
} from "../src/features/inbox/cmHeadingFold.ts";

describe("cmHeadingFold", () => {
  describe("parseHeadingLevel", () => {
    test("detects heading levels from 1 to 6", () => {
      assert.equal(parseHeadingLevel("# Heading 1"), 1);
      assert.equal(parseHeadingLevel("## Heading 2"), 2);
      assert.equal(parseHeadingLevel("### Heading 3"), 3);
      assert.equal(parseHeadingLevel("#### Heading 4"), 4);
      assert.equal(parseHeadingLevel("##### Heading 5"), 5);
      assert.equal(parseHeadingLevel("###### Heading 6"), 6);
    });

    test("handles leading whitespace and ignores hashtags or plain text", () => {
      assert.equal(parseHeadingLevel("   ## Indented"), 2);
      assert.equal(parseHeadingLevel("#hashtag"), null);
      assert.equal(parseHeadingLevel("Plain text"), null);
      assert.equal(parseHeadingLevel(""), null);
    });
  });

  describe("isCodeFenceLine", () => {
    test("identifies backtick and tilde fences", () => {
      assert.equal(isCodeFenceLine("```"), true);
      assert.equal(isCodeFenceLine("```typescript"), true);
      assert.equal(isCodeFenceLine("~~~"), true);
      assert.equal(isCodeFenceLine("  ```bash"), true);
      assert.equal(isCodeFenceLine("`inline code`"), false);
      assert.equal(isCodeFenceLine("Plain line"), false);
    });
  });

  describe("isLineInsideCodeFence", () => {
    const doc = Text.of([
      "Line 1",
      "```bash",
      "#!/bin/bash",
      "# Bash comment",
      "```",
      "# Real heading",
      "Some text"
    ]);

    test("correctly identifies whether a line is inside or outside code fences", () => {
      assert.equal(isLineInsideCodeFence(doc, 1), false);
      assert.equal(isLineInsideCodeFence(doc, 2), false); // fence start
      assert.equal(isLineInsideCodeFence(doc, 3), true);
      assert.equal(isLineInsideCodeFence(doc, 4), true); // bash comment
      assert.equal(isLineInsideCodeFence(doc, 5), false); // fence end
      assert.equal(isLineInsideCodeFence(doc, 6), false); // real heading
      assert.equal(isLineInsideCodeFence(doc, 7), false);
    });
  });

  describe("headingLevelAt", () => {
    const docText = [
      "# Main Title",
      "Introductory text",
      "```",
      "# Not a heading",
      "```",
      "## Subheading"
    ].join("\n");
    const state = EditorState.create({ doc: docText });

    test("returns level for markdown headings", () => {
      assert.equal(headingLevelAt(state, 1), 1);
      assert.equal(headingLevelAt(state, 6), 2);
    });

    test("returns null for comments inside code fence and plain lines", () => {
      assert.equal(headingLevelAt(state, 2), null);
      assert.equal(headingLevelAt(state, 4), null);
    });

    test("returns null for out-of-range lines", () => {
      assert.equal(headingLevelAt(state, 0), null);
      assert.equal(headingLevelAt(state, 999), null);
    });
  });

  describe("rangeForHeading", () => {
    const docText = [
      "# Chapter 1", // line 1
      "Para 1.1",     // line 2
      "Para 1.2",     // line 3
      "## Section 1", // line 4
      "Sec 1 text",   // line 5
      "## Section 2", // line 6
      "Sec 2 text",   // line 7
      "# Chapter 2", // line 8
      "End note"      // line 9
    ].join("\n");
    const state = EditorState.create({ doc: docText });

    test("folds h1 until the next h1", () => {
      const range = rangeForHeading(state, 1, 1);
      assert.notEqual(range, null);
      assert.equal(range?.from, state.doc.line(1).to);
      assert.equal(range?.to, state.doc.line(7).to);
    });

    test("folds h2 until the next h2 or higher", () => {
      const range1 = rangeForHeading(state, 4, 2);
      assert.notEqual(range1, null);
      assert.equal(range1?.from, state.doc.line(4).to);
      assert.equal(range1?.to, state.doc.line(5).to);

      const range2 = rangeForHeading(state, 6, 2);
      assert.notEqual(range2, null);
      assert.equal(range2?.from, state.doc.line(6).to);
      assert.equal(range2?.to, state.doc.line(7).to);
    });

    test("returns null when heading has no content beneath it", () => {
      const emptyState = EditorState.create({ doc: "# Last Line Heading" });
      assert.equal(rangeForHeading(emptyState, 1, 1), null);
    });
  });

  describe("findEnclosingHeadingLine", () => {
    const docText = [
      "Intro before any heading", // line 1
      "# Main Heading",           // line 2
      "Body line 1",              // line 3
      "## Subheading A",          // line 4
      "Sub text A",               // line 5
      "# Second Heading"          // line 6
    ].join("\n");
    const state = EditorState.create({ doc: docText });

    test("returns line itself when cursor is on a heading", () => {
      assert.equal(findEnclosingHeadingLine(state, 2), 2);
      assert.equal(findEnclosingHeadingLine(state, 4), 4);
    });

    test("returns parent heading when cursor is in body text", () => {
      assert.equal(findEnclosingHeadingLine(state, 3), 2);
      assert.equal(findEnclosingHeadingLine(state, 5), 4);
    });

    test("returns null when cursor is before the first heading", () => {
      assert.equal(findEnclosingHeadingLine(state, 1), null);
    });
  });

  describe("exactFoldAtRange & isRangeFolded", () => {
    test("detects whether a range is currently folded", () => {
      const doc = "# Heading\nSome content to fold\nMore content";
      const state = EditorState.create({
        doc,
        extensions: [headingFoldingExtension()]
      });
      const range = rangeForHeading(state, 1, 1);
      assert.notEqual(range, null);
      if (range) {
        assert.equal(exactFoldAtRange(state, range), null);
        assert.equal(isRangeFolded(state, range), false);
      }
    });
  });

  describe("collectFoldAllEffects", () => {
    test("collects fold effects for all headings with content", () => {
      const doc = "# H1\nContent 1\n## H2\nContent 2";
      const state = EditorState.create({
        doc,
        extensions: [headingFoldingExtension()]
      });
      const effects = collectFoldAllEffects(state);
      assert.equal(effects.length, 2);
    });
  });

  describe("registerHeadingFoldVimCommands", () => {
    test("registers vim actions and commands idempotently without throwing", () => {
      assert.doesNotThrow(() => {
        registerHeadingFoldVimCommands();
        registerHeadingFoldVimCommands();
      });
    });
  });
});
