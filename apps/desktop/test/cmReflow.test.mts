import assert from "node:assert/strict";
import test from "node:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { type EditorView } from "@codemirror/view";
import { reflowParagraph } from "../src/features/inbox/cmReflow.ts";

function viewFor(doc: string, anchor: number, head = anchor): EditorView {
  let state = EditorState.create({
    doc,
    selection: EditorSelection.range(anchor, head),
    extensions: [markdown({ base: markdownLanguage })]
  });
  return {
    get state() { return state; },
    dispatch(spec: Parameters<EditorState["update"]>[0]) { state = state.update(spec).state; }
  } as unknown as EditorView;
}

test("reflowParagraph joins hard-wrapped prose under cursor", () => {
  const doc = "first line of prose\nsecond line continues\nthird line\n\nnext paragraph\nstays wrapped";
  const view = viewFor(doc, doc.indexOf("second"));

  assert.equal(reflowParagraph(view), true);
  assert.equal(
    view.state.doc.toString(),
    "first line of prose second line continues third line\n\nnext paragraph\nstays wrapped"
  );
});

test("reflowParagraph preserves explicit hard breaks", () => {
  const doc = "first hard break  \nsecond line\nthird line";
  const view = viewFor(doc, doc.indexOf("second"));

  reflowParagraph(view);

  assert.equal(view.state.doc.toString(), "first hard break  \nsecond line third line");
});

test("reflowParagraph does not merge headings or separate list items", () => {
  const doc = "# Heading\nparagraph one\nparagraph two\n- item one\n- item two";
  const view = viewFor(doc, doc.indexOf("paragraph"));

  reflowParagraph(view);

  assert.equal(view.state.doc.toString(), "# Heading\nparagraph one paragraph two\n- item one\n- item two");
});

test("reflowParagraph returns false for a single-line paragraph", () => {
  const view = viewFor("single line", 3);
  assert.equal(reflowParagraph(view), false);
});
