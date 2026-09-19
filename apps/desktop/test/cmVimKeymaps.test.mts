import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { type EditorView, type KeyBinding } from "@codemirror/view";
import {
  buildVimAwareDefaultKeymap,
  deferEscapeKeyToVim,
  deferMotionKeysToVim
} from "../src/features/inbox/cmVimKeymaps.ts";

describe("cmVimKeymaps", () => {
  describe("deferMotionKeysToVim", () => {
    test("motion key returns false when vim is active and non-insert", () => {
      let nativeRan = false;
      const bindings: KeyBinding[] = [
        {
          key: "Enter",
          run: () => {
            nativeRan = true;
            return true;
          }
        }
      ];
      const deferred = deferMotionKeysToVim(bindings);
      const fakeView = {
        state: {}
      } as unknown as EditorView;

      // Without CM vim adapter on view, vim is not active, native runs
      const resultNative = deferred[0].run!(fakeView);
      assert.equal(resultNative, true);
      assert.equal(nativeRan, true);
    });

    test("leaves non-motion keys untouched", () => {
      const bindings: KeyBinding[] = [
        {
          key: "Mod-a",
          run: () => true
        }
      ];
      const deferred = deferMotionKeysToVim(bindings);
      assert.equal(deferred[0], bindings[0]);
    });
  });

  describe("deferEscapeKeyToVim", () => {
    test("escape key runs native when view has no active modal vim", () => {
      let nativeRan = false;
      const bindings: KeyBinding[] = [
        {
          key: "Escape",
          run: () => {
            nativeRan = true;
            return true;
          }
        }
      ];
      const deferred = deferEscapeKeyToVim(bindings);
      const fakeView = {
        state: {}
      } as unknown as EditorView;
      const res = deferred[0].run!(fakeView);
      assert.equal(res, true);
      assert.equal(nativeRan, true);
    });
  });

  describe("buildVimAwareDefaultKeymap", () => {
    test("returns keymap array containing deferred enter and escape", () => {
      const keymap = buildVimAwareDefaultKeymap();
      assert.ok(Array.isArray(keymap));
      assert.ok(keymap.length > 0);
      const enterBinding = keymap.find((b) => b.key === "Enter");
      assert.ok(enterBinding);
      assert.equal(enterBinding?.preventDefault, false);
      const escapeBinding = keymap.find((b) => b.key === "Escape");
      assert.ok(escapeBinding);
      assert.equal(escapeBinding?.preventDefault, false);
    });
  });
});
