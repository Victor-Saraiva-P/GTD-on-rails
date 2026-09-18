import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  getActiveEditorView,
  registerActiveEditorView
} from "../src/features/keybinds/activeEditorRegistry.ts";
import {
  isVimAwaitingArgument,
  isVimEditorAwaitingArgument
} from "../src/features/keybinds/isVimAwaitingArgument.ts";

describe("isVimAwaitingArgument", () => {
  test("returns false when view is null", () => {
    assert.equal(isVimAwaitingArgument(null), false);
  });

  test("returns false when editor registry has no active view", () => {
    registerActiveEditorView(null);
    assert.equal(getActiveEditorView(), null);
    assert.equal(isVimEditorAwaitingArgument(), false);
  });

  test("returns true when Vim plugin has expectLiteralNext", () => {
    const fakeView = {
      cm: {
        state: {
          vim: {
            expectLiteralNext: true
          }
        }
      }
    };
    registerActiveEditorView(fakeView as never);
    assert.equal(isVimEditorAwaitingArgument(), true);
  });

  test("returns true when Vim inputState has pending keyBuffer items", () => {
    const fakeView = {
      cm: {
        state: {
          vim: {
            inputState: {
              keyBuffer: ["f"]
            }
          }
        }
      }
    };
    registerActiveEditorView(fakeView as never);
    assert.equal(isVimEditorAwaitingArgument(), true);
  });

  test("returns false when Vim inputState keyBuffer is empty", () => {
    const fakeView = {
      cm: {
        state: {
          vim: {
            inputState: {
              keyBuffer: []
            }
          }
        }
      }
    };
    registerActiveEditorView(fakeView as never);
    assert.equal(isVimEditorAwaitingArgument(), false);
    registerActiveEditorView(null);
  });
});
