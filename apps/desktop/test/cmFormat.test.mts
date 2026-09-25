import assert from "node:assert/strict";
import test from "node:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  clearFormatting,
  formatMarkerBackspaceTransaction,
  insertDivider,
  setBlockType,
  toggleWrap,
  wrapLink
} from "../src/features/inbox/cmFormat.ts";

function createTestView(doc: string, selection?: { anchor: number; head?: number }): EditorView {
  let state = EditorState.create({
    doc,
    selection: selection ? EditorSelection.range(selection.anchor, selection.head ?? selection.anchor) : undefined
  });
  return {
    get state() { return state; },
    dispatch(spec: any) {
      const tr = state.update(spec);
      state = tr.state;
    },
    focus() {}
  } as unknown as EditorView;
}

test("toggleWrap inserts empty marker pair and positions cursor in middle", () => {
  const view = createTestView("hello world", { anchor: 5 });
  toggleWrap(view, "**");
  assert.equal(view.state.doc.toString(), "hello**** world");
  assert.equal(view.state.selection.main.anchor, 7);
});

test("toggleWrap removes empty marker pair when pressed again", () => {
  const view = createTestView("hello**** world", { anchor: 7 });
  toggleWrap(view, "**");
  assert.equal(view.state.doc.toString(), "hello world");
  assert.equal(view.state.selection.main.anchor, 5);
});

test("toggleWrap wraps selected text with marker", () => {
  const view = createTestView("hello world", { anchor: 6, head: 11 });
  toggleWrap(view, "**");
  assert.equal(view.state.doc.toString(), "hello **world**");
});

test("toggleWrap unwraps already wrapped selection", () => {
  const view = createTestView("hello **world**", { anchor: 8, head: 13 });
  toggleWrap(view, "**");
  assert.equal(view.state.doc.toString(), "hello world");
});

test("setBlockType applies heading block prefix", () => {
  const view = createTestView("My Heading", { anchor: 3 });
  setBlockType(view, "h1");
  assert.equal(view.state.doc.toString(), "# My Heading");
});

test("setBlockType changes heading level", () => {
  const view = createTestView("# My Heading", { anchor: 3 });
  setBlockType(view, "h2");
  assert.equal(view.state.doc.toString(), "## My Heading");
});

test("setBlockType applies bullet and numbered lists", () => {
  const view = createTestView("line 1\nline 2", { anchor: 0, head: 10 });
  setBlockType(view, "bullet");
  assert.equal(view.state.doc.toString(), "- line 1\n- line 2");

  setBlockType(view, "numbered");
  assert.equal(view.state.doc.toString(), "1. line 1\n2. line 2");
});

test("setBlockType applies todo checkbox format", () => {
  const view = createTestView("Task item", { anchor: 2 });
  setBlockType(view, "todo");
  assert.equal(view.state.doc.toString(), "- [ ] Task item");

  setBlockType(view, "todo-checked");
  assert.equal(view.state.doc.toString(), "- [x] Task item");
});

test("setBlockType resets block to paragraph", () => {
  const view = createTestView("## Some heading", { anchor: 5 });
  setBlockType(view, "paragraph");
  assert.equal(view.state.doc.toString(), "Some heading");
});

test("wrapLink wraps selected text as markdown link", () => {
  const view = createTestView("Visit example site", { anchor: 6, head: 13 });
  wrapLink(view, "https://example.com");
  assert.equal(view.state.doc.toString(), "Visit [example](https://example.com) site");
});

test("insertDivider inserts markdown horizontal rule", () => {
  const view = createTestView("First line", { anchor: 10 });
  insertDivider(view);
  assert.equal(view.state.doc.toString(), "First line\n---\n");
});

test("clearFormatting strips block prefixes and inline markers", () => {
  const view = createTestView("# **Bold** title", { anchor: 5 });
  clearFormatting(view);
  assert.equal(view.state.doc.toString(), "Bold title");
});

test("formatMarkerBackspaceTransaction removes empty marker pair", () => {
  const state = EditorState.create({
    doc: "hello**** world",
    selection: EditorSelection.cursor(7)
  });
  const tr = formatMarkerBackspaceTransaction(state);
  assert.ok(tr);
  assert.deepEqual(tr?.changes, { from: 5, to: 9, insert: "" });
});
