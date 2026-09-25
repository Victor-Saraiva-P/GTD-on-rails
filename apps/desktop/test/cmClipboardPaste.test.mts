import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { Vim } from "@replit/codemirror-vim";
import {
  handlePasteKeyDown,
  isPasteCandidate,
  loadClipboardIntoVimRegister,
  type PatchableRegisterController
} from "../src/features/inbox/cmClipboardPaste.ts";

describe("cmClipboardPaste", () => {
  describe("isPasteCandidate", () => {
    test("returns true for bare p and P", () => {
      assert.equal(isPasteCandidate({ key: "p" }), true);
      assert.equal(isPasteCandidate({ key: "P" }), true);
    });

    test("returns false when Ctrl, Meta, or Alt is held", () => {
      assert.equal(isPasteCandidate({ key: "p", ctrlKey: true }), false);
      assert.equal(isPasteCandidate({ key: "p", metaKey: true }), false);
      assert.equal(isPasteCandidate({ key: "p", altKey: true }), false);
    });

    test("returns false for non-paste keys", () => {
      assert.equal(isPasteCandidate({ key: "y" }), false);
      assert.equal(isPasteCandidate({ key: "d" }), false);
      assert.equal(isPasteCandidate({ key: "Enter" }), false);
    });
  });

  describe("loadClipboardIntoVimRegister", () => {
    test("sets register text with linewise flag when text ends with newline", () => {
      const controller = Vim.getRegisterController() as unknown as PatchableRegisterController;
      let recordedText = "";
      let recordedLinewise: boolean | undefined = false;
      if (controller?.unnamedRegister) {
        controller.unnamedRegister.setText = (text, linewise) => {
          recordedText = text;
          recordedLinewise = linewise;
        };
      }
      loadClipboardIntoVimRegister("Multiple lines\n");
      assert.equal(recordedText, "Multiple lines\n");
      assert.equal(recordedLinewise, true);
    });

    test("sets register text with characterwise flag when text does not end with newline", () => {
      const controller = Vim.getRegisterController() as unknown as PatchableRegisterController;
      let recordedText = "";
      let recordedLinewise: boolean | undefined = true;
      if (controller?.unnamedRegister) {
        controller.unnamedRegister.setText = (text, linewise) => {
          recordedText = text;
          recordedLinewise = linewise;
        };
      }
      loadClipboardIntoVimRegister("Single line text");
      assert.equal(recordedText, "Single line text");
      assert.equal(recordedLinewise, false);
    });
  });

  describe("handlePasteKeyDown", () => {
    test("does not intercept if key is not p or P", () => {
      let defaultPrevented = false;
      const fakeEvent = {
        key: "x",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        target: null,
        preventDefault: () => {
          defaultPrevented = true;
        },
        stopImmediatePropagation: () => undefined
      } as unknown as KeyboardEvent;

      handlePasteKeyDown(fakeEvent, { contentDOM: null } as never);
      assert.equal(defaultPrevented, false);
    });
  });
});
