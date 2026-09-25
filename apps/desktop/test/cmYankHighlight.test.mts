import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { EditorState } from "@codemirror/state";
import {
  setYankHighlightEffect,
  yankHighlightField,
  wireYankHighlight
} from "../src/features/inbox/cmYankHighlight.ts";

describe("cmYankHighlight", () => {
  test("creates empty decoration set initially", () => {
    const state = EditorState.create({
      doc: "Line one\nLine two",
      extensions: [yankHighlightField]
    });
    const decos = state.field(yankHighlightField);
    assert.equal(decos.size, 0);
  });

  test("applies decoration when setYankHighlightEffect is dispatched", () => {
    const state = EditorState.create({
      doc: "Line one\nLine two",
      extensions: [yankHighlightField]
    });
    const tr = state.update({
      effects: setYankHighlightEffect.of([{ from: 0, to: 4 }])
    });
    const decos = tr.state.field(yankHighlightField);
    assert.equal(decos.size, 1);
  });

  test("clears decoration when setYankHighlightEffect of null is dispatched", () => {
    let state = EditorState.create({
      doc: "Line one\nLine two",
      extensions: [yankHighlightField]
    });
    state = state.update({
      effects: setYankHighlightEffect.of([{ from: 0, to: 4 }])
    }).state;
    assert.equal(state.field(yankHighlightField).size, 1);

    state = state.update({
      effects: setYankHighlightEffect.of(null)
    }).state;
    assert.equal(state.field(yankHighlightField).size, 0);
  });

  test("wireYankHighlight can be called idempotently", () => {
    assert.doesNotThrow(() => {
      wireYankHighlight();
      wireYankHighlight();
    });
  });
});
