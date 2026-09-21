import assert from "node:assert/strict";
import test from "node:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import { type EditorView } from "@codemirror/view";
import {
  hopMarkerBackward,
  hopMarkerForward,
  markerHopTarget
} from "../src/features/inbox/cmMarkerHop.ts";

function viewFor(doc: string, cursor: number): EditorView {
  let state = EditorState.create({ doc, selection: EditorSelection.cursor(cursor) });
  return {
    get state() { return state; },
    dispatch(spec: Parameters<EditorState["update"]>[0]) { state = state.update(spec).state; }
  } as unknown as EditorView;
}

test("markerHopTarget crosses one marker run at a time", () => {
  assert.equal(markerHopTarget("**bold**", 6, 1), 8);
  assert.equal(markerHopTarget("**bold**", 8, -1), 6);
  assert.equal(markerHopTarget("[link](url)", 5, 1), 6);
  assert.equal(markerHopTarget("[link](url)", 6, 1), 7);
});

test("markerHopTarget stays line local and returns null without marker", () => {
  assert.equal(markerHopTarget("plain prose", 4, 1), null);
  assert.equal(markerHopTarget("plain prose", 4, -1), null);
  assert.equal(markerHopTarget("snake_case", 0, 1), null);
});

test("hopMarkerForward and backward move the editor cursor", () => {
  const view = viewFor("**bold**", 6);
  assert.equal(hopMarkerForward(view), true);
  assert.equal(view.state.selection.main.head, 8);
  assert.equal(hopMarkerBackward(view), true);
  assert.equal(view.state.selection.main.head, 6);
});
