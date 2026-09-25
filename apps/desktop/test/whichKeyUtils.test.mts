import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  categorizeKeybind,
  filterKeybinds,
  formatKeybindDisplay,
  groupKeybindsByCategory
} from "../src/features/keybinds/whichKeyUtils.ts";
import type { KeybindDefinition } from "../src/features/keybinds/types.ts";

describe("whichKeyUtils", () => {
  describe("formatKeybindDisplay", () => {
    test("formats simple direct key", () => {
      const binding: KeybindDefinition = {
        id: "inbox.move-down",
        key: "j",
        description: "Move down",
        runKeybind: () => undefined
      };
      assert.equal(formatKeybindDisplay(binding), "j");
    });

    test("formats key with Ctrl modifier", () => {
      const binding: KeybindDefinition = {
        id: "inbox.redo",
        key: "r",
        ctrl: true,
        description: "Redo last action",
        runKeybind: () => undefined
      };
      assert.equal(formatKeybindDisplay(binding), "Ctrl+r");
    });

    test("formats leader key sequence", () => {
      const binding: KeybindDefinition = {
        id: "inbox.format-bold",
        key: "b",
        leader: true,
        sequence: ["t", "b"],
        description: "Format bold",
        runKeybind: () => undefined
      };
      assert.equal(formatKeybindDisplay(binding), "Space t b");
    });

    test("formats multi-key direct sequence", () => {
      const binding: KeybindDefinition = {
        id: "inbox.move-first",
        key: "g",
        sequence: ["g", "g"],
        description: "Move to first item",
        runKeybind: () => undefined
      };
      assert.equal(formatKeybindDisplay(binding), "g g");
    });
  });

  describe("categorizeKeybind", () => {
    test("categorizes formatting leader keys as Formatting", () => {
      const bold: KeybindDefinition = {
        id: "format.bold",
        key: "b",
        leader: true,
        sequence: ["t", "b"],
        description: "Bold",
        runKeybind: () => undefined
      };
      assert.equal(categorizeKeybind(bold), "Formatting");
    });

    test("categorizes other leader keys as Leader Shortcuts", () => {
      const inbox: KeybindDefinition = {
        id: "nav.inbox",
        key: "i",
        leader: true,
        sequence: ["i"],
        description: "Open inbox",
        runKeybind: () => undefined
      };
      assert.equal(categorizeKeybind(inbox), "Leader Shortcuts");
    });

    test("categorizes j, k, gg, G, [, ] as Navigation", () => {
      const nav: KeybindDefinition = {
        id: "inbox.move-down",
        key: "j",
        description: "Move down",
        runKeybind: () => undefined
      };
      assert.equal(categorizeKeybind(nav), "Navigation");
    });

    test("categorizes action keys like a, d, p as Actions", () => {
      const action: KeybindDefinition = {
        id: "inbox.create",
        key: "a",
        description: "Add new stuff",
        runKeybind: () => undefined
      };
      assert.equal(categorizeKeybind(action), "Actions");
    });
  });

  describe("filterKeybinds", () => {
    const bindings: KeybindDefinition[] = [
      { id: "1", key: "a", description: "Add new stuff", runKeybind: () => undefined },
      { id: "2", key: "d", description: "Delete selected stuff", runKeybind: () => undefined },
      { id: "3", key: "j", description: "Move down", runKeybind: () => undefined }
    ];

    test("returns all items on empty query", () => {
      assert.equal(filterKeybinds(bindings, "").length, 3);
      assert.equal(filterKeybinds(bindings, "   ").length, 3);
    });

    test("filters by key or description case-insensitively", () => {
      const deleteResult = filterKeybinds(bindings, "delete");
      assert.equal(deleteResult.length, 1);
      assert.equal(deleteResult[0].key, "d");

      const aResult = filterKeybinds(bindings, "A");
      assert.equal(aResult.length, 1);
      assert.equal(aResult[0].key, "a");
    });
  });

  describe("groupKeybindsByCategory", () => {
    test("groups bindings into distinct category buckets", () => {
      const sample: KeybindDefinition[] = [
        { id: "1", key: "a", description: "Add", runKeybind: () => undefined },
        { id: "2", key: "j", description: "Down", runKeybind: () => undefined },
        { id: "3", key: "c", leader: true, sequence: ["c"], description: "Calendars", runKeybind: () => undefined },
        { id: "4", key: "b", leader: true, sequence: ["m", "b"], description: "Bullet", runKeybind: () => undefined }
      ];

      const groups = groupKeybindsByCategory(sample);
      assert.equal(groups.Actions.length, 1);
      assert.equal(groups.Navigation.length, 1);
      assert.equal(groups["Leader Shortcuts"].length, 1);
      assert.equal(groups.Formatting.length, 1);
    });
  });
});
