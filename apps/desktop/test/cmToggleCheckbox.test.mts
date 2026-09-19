import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { checkboxToggleChange } from "../src/features/inbox/cmToggleCheckbox.ts";

describe("checkboxToggleChange", () => {
  test("turns plain text into an unchecked checkbox", () => {
    const change = checkboxToggleChange("buy milk", 10);
    assert.deepEqual(change, { from: 10, insert: "- [ ] " });
  });

  test("preserves leading whitespace on plain text", () => {
    const change = checkboxToggleChange("   nested item", 20);
    assert.deepEqual(change, { from: 23, insert: "- [ ] " });
  });

  test("appends checkbox to existing bullet marker", () => {
    const change = checkboxToggleChange("* note", 0);
    assert.deepEqual(change, { from: 2, insert: "[ ] " });
  });

  test("appends checkbox to existing numbered marker", () => {
    const change = checkboxToggleChange("1. first", 5);
    assert.deepEqual(change, { from: 8, insert: "[ ] " });
  });

  test("toggles unchecked [ ] to checked [x]", () => {
    const change = checkboxToggleChange("- [ ] active task", 0);
    assert.deepEqual(change, { from: 3, to: 4, insert: "x" });
  });

  test("toggles checked [x] to unchecked [ ]", () => {
    const change = checkboxToggleChange("- [x] done task", 0);
    assert.deepEqual(change, { from: 3, to: 4, insert: " " });
  });

  test("toggles checked uppercase [X] to unchecked [ ]", () => {
    const change = checkboxToggleChange("  - [X] done task", 10);
    assert.deepEqual(change, { from: 15, to: 16, insert: " " });
  });

  test("leaves forwarded and cancelled tasks alone", () => {
    assert.equal(checkboxToggleChange("- [>] forwarded", 0), null);
    assert.equal(checkboxToggleChange("- [-] cancelled", 0), null);
  });
});
