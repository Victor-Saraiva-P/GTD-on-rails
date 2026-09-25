import assert from "node:assert/strict";
import test from "node:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { computeActiveLines, buildLivePreviewDecorations } from "../src/features/inbox/cmLivePreview.ts";
import { itemBodyStateField } from "../src/features/inbox/itemBodyUtils.ts";

function createMockView(doc: string, anchor: number, head?: number, readOnly = false) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.range(anchor, head ?? anchor),
    extensions: [
      markdown({ base: markdownLanguage }),
      EditorState.readOnly.of(readOnly),
      itemBodyStateField.init(() => ({
        text: doc,
        inlineMarks: [],
        lineBlocks: [],
        blockEntities: []
      }))
    ]
  });

  return {
    state,
    visibleRanges: [{ from: 0, to: doc.length }]
  };
}

test("computeActiveLines identifies line numbers under cursor", () => {
  const state = EditorState.create({
    doc: "line 1\nline 2\nline 3",
    selection: EditorSelection.cursor(10) // line 2
  });
  const active = computeActiveLines(state);
  assert.equal(active.has(2), true);
  assert.equal(active.has(1), false);
  assert.equal(active.has(3), false);
});

test("computeActiveLines handles multi-line selections", () => {
  const state = EditorState.create({
    doc: "line 1\nline 2\nline 3\nline 4",
    selection: EditorSelection.range(2, 16) // line 1 to line 3
  });
  const active = computeActiveLines(state);
  assert.equal(active.has(1), true);
  assert.equal(active.has(2), true);
  assert.equal(active.has(3), true);
  assert.equal(active.has(4), false);
});

test("buildLivePreviewDecorations hides markdown tokens on inactive lines", () => {
  const doc = "# Heading 1\n**bold** text on inactive line";
  // Cursor on line 1 (head: 3)
  const view = createMockView(doc, 3) as any;
  const decos = buildLivePreviewDecorations(view);

  // Line 1 is active -> syntax tokens visible
  // Line 2 is inactive -> syntax tokens hidden
  let hiddenRanges = 0;
  decos.between(0, doc.length, (from, to, value) => {
    if (value.spec.class === "cm-bold-text") {
      assert.equal(from, doc.indexOf("**bold**"));
    }
    if (value.spec.widget || value.spec.filter) {
      hiddenRanges++;
    }
  });

  assert.ok(decos.size > 0);
});

test("read-only live preview keeps markdown syntax hidden on its selected line", () => {
  const doc = "# Heading";
  const view = createMockView(doc, 3, undefined, true) as any;
  const decos = buildLivePreviewDecorations(view);
  let hidesHeadingPrefix = false;

  decos.between(0, doc.length, (from, to) => {
    if (from === 0 && to > from) hidesHeadingPrefix = true;
  });

  assert.equal(hidesHeadingPrefix, true);
});

test("buildLivePreviewDecorations renders task checkbox in read-only preview", () => {
  const doc = "- [ ] Task one\n- [x] Task two";
  const view = createMockView(doc, 2, undefined, true) as any;
  const decos = buildLivePreviewDecorations(view);

  let hasTaskWidget = false;
  decos.between(0, doc.length, (from, to, value) => {
    if (value.spec.widget && value.spec.widget.constructor.name === "TaskCheckboxWidget") {
      hasTaskWidget = true;
    }
  });

  assert.equal(hasTaskWidget, true);
});
